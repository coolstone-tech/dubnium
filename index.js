const {
    writeFile,
    readFile,
    readdir,
    stat,
    mkdir,
    rmdir,
    unlink,
    rm
} = require('fs/promises')

const Record = require('./record')

const lockfile = require('proper-lockfile')

const functions = require('./functions')

const path = require('path')
const { mkdirSync, realpathSync } = require('fs')

class DubniumError extends Error {
    constructor(message) {
        super(message)
        this.name = 'DubniumError'
    }
}

const _config = {
    dir: `${__dirname}/db`,
    ext: 'json',
    force: false,
    versioning: {
        enabled: false,
        limit: 10,
    },
    requireRoot: [
        'close',
        'wipe',
        'deleteOld',
        'deleteLarge',
    ],
    trash: "",
    name: "dubnium",
    metadata:true
    }

const d = new Date().toISOString()
const metadataDefaults = {
    createdAt: d,
    updatedAt: d,
    ttl: 0,
}

module.exports._config = _config

module.exports = class Dubnium extends require('events') {

    config = _config

    #root = process.geteuid ? process.geteuid() === 0 : false

    name = ""

    index = {}

    constructor(dir ="", conf = _config) {
        super()
        mkdirSync(dir || this.config.dir, { recursive: true })
        this.config.dir = realpathSync(dir || this.config.dir) // Use sync once during initialization to ensure the directory is set before any async operations
        this.config = { ...this.config, ...conf }
        if(this.config.trash) mkdirSync(this.config.trash, { recursive: true })
        if(this.config.versioning.enabled) mkdirSync(`${this.config.dir}/.versions`, { recursive: true })
        this.name = this.config.name ? this.config.name : path.basename(this.config.dir)
                conf.requireRoot?.forEach(method => {
                    if (!this[method]) throw new DubniumError(`Method "${method}" does not exist`)
                    const originalMethod = this[method]
                    this[method] = (...args) => {
                        if (!this.#root) throw new DubniumError(`${method} requires superuser privileges`)
                        return originalMethod.apply(this, args)
                    }
                })   
    }

#resolvePath(input) {
    let resolved;
    if (path.isAbsolute(input)) {
        resolved = input;
    } else if (input.startsWith('.') || input.includes('/') || input.includes('\\')) {
        resolved = path.resolve(this.config.dir, input);
    } else {
        resolved = path.join(this.config.dir, `${path.basename(input)}.${this.config.ext}`);
    }

    if (!resolved.startsWith(this.config.dir)) {
        throw new DubniumError(`Access denied: ${input} is outside database directory`);
    }
    return resolved;
}

/**
 * Get metadata for a record by tag, including methods to read, write, and delete the metadata
 * @param {string} tag The tag of the record to get metadata for
 * @returns 
 */
metadata(tag) {
    if(!this.config.metadata) return {
        async read() { return metadataDefaults },
        async write() { return null },
        async delete() { return null },
        filePath: null
    }
    const filePath = this.#resolvePath(path.join('.metadata', tag))
    return {
        filePath,
        /**
         * Read metadata for a record. If the metadata file does not exist, it will return default metadata values. If the metadata file exists but is invalid JSON, it will also return default metadata values.
         */
        async read() {
            if (!await functions.exists(filePath)) return metadataDefaults
            const data = await readFile(filePath, 'utf-8')
            return { ...metadataDefaults, ...JSON.parse(data) }
        },
        /**
         * Write metadata for a record, overwriting existing metadata. If `meta` is not an object, it will be stored under a `data` property in the metadata JSON.
         * @param {*} meta The metadata to write. If not an object, it will be stored as `{ data: meta }` in the metadata JSON.
         */
        async write(meta=metadataDefaults) {
            const existing = await this.read() || {}
            const updated = { ...existing, ...meta }
            if(!(await functions.exists(path.dirname(filePath)))) await mkdir(path.dirname(filePath), { recursive: true })
            await writeFile(filePath, JSON.stringify(updated), 'utf-8')
        },
        /**
         * Delete the metadata file for a record. This does not delete the record itself, only its associated metadata file. If the metadata file does not exist, this method does nothing.
         */
        async delete() {
            if (await functions.exists(filePath)) await unlink(filePath)
        }
    }
}

    /**
     * Safely write data to a file with locking to prevent concurrent writes
     * @param {string} tag The tag of the record to write to
     * @param {*} content The content to write to the file
     */
    async safeWrite(tag, content) {
        const filePath = this.#resolvePath(tag)
        if (!(await functions.exists(filePath))) {
            await writeFile(filePath, '', 'utf-8'   ) 
        }
        
        let release
        try {
            release = await lockfile.lock(filePath, { retries: { retries: 5, maxTimeout: 1000 } })
            await writeFile(filePath, content, 'utf-8')         
        } catch (e) {
            throw new DubniumError(`Could not write to ${filePath}: ${e.message}`)
        } finally {
            if (release) await release()
        }
    }

    /**
 * Atomically update a file. 
 * @param {string} tag - The tag of the record to update
 * @param {function} updater - Function that takes current data and returns new data
 */
async atomicUpdate(tag, updater) {
    const filePath = this.#resolvePath(tag)
    if (!(await functions.exists(filePath))) await writeFile(filePath, '')

    let release
    try {
        release = await lockfile.lock(filePath, { retries: { retries: 5, maxTimeout: 1000 } })

        const raw = await readFile(filePath, 'utf-8')
        let currentData = raw
        
        const isJSON = this.config.ext === 'json'
        if (isJSON && raw) currentData = JSON.parse(raw)

        let newData = await updater(currentData)

        try{
        if (isJSON && typeof newData !== 'string') newData = JSON.stringify(newData)
        }catch{
            newData = {}
        }

        await writeFile(filePath, newData, 'utf-8')

    } catch (e) {
        throw new DubniumError(`Update failed: ${e.message}`)
    } finally {
        if (release) await release()
    }
}

/**
 * Safely delete a file with locking to prevent concurrent access issues
 * @param {string} tag - The tag of the record to delete
 */
async safeUnlink(tag) {
    const filePath = this.#resolvePath(tag)
    let release
    try {
        release = await lockfile.lock(filePath, { retries: { retries: 5, maxTimeout: 1000 } })
        await functions.exists(filePath) && await unlink(filePath)
    } catch (e) {
        throw new DubniumError(`Could not delete ${filePath}: ${e.message}`)
    } finally {
        if (release) await release()
    }
}
    /**
     * Return the file path for a given record tag
     * @param {string} tag The tag of the record to locate
     * @returns {string} The file path of the record
     */
locate(tag) {
    const safeTag = path.basename(tag); 
    return path.join(this.config.dir, `${safeTag}.${this.config.ext}`);
}

    /**
     * Check if a record with the given tag exists
     * @param {string} tag The tag of the record to check
     * @returns {Promise<boolean>} `true` if the record exists, `false` otherwise
     */
    has(tag) {
        return functions.exists(this.locate(tag))
    }

    /**
     * Read a record by tag
     * @param {string} tag Tag of the record to read
     * @returns {Promise<string|object>} The record data, either as a string or parsed JSON object
     */
    async read(tag) {
        return await this.get(tag).read()
    }

    /**
     * Write data to a record by tag, creating the record if it doesn't exist
     * @param {string} tag Tag of the record to write to
     * @param {*} data Data to write to the record (will be stringified if not a string)
     * @returns {Promise<Dubnium>} The Dubnium instance
     */
async write(tag, data){
await this.get(tag).write(data)
return this
}

    /** Create a record with a tag and data
     * @param {string} tag Tag of the record to create
     * @param {*} data Data to store in the record (will be stringified if not a string)
     * @param {number} [ttl] Optional time-to-live for the record in milliseconds
     * @returns {Promise<Dubnium>} The Dubnium instance 
     */
     async create(tag="", data, ttl=0) {
        if (!tag) throw new DubniumError(`Tag is required`)
        if (data === undefined) throw new DubniumError(`Data is required`)
        if (typeof data == "object") data = JSON.stringify(data)
        const timestamp = new Date().toISOString()
        await this.safeWrite(this.locate(tag), data, { flag: this.config.force ? 'w' : 'wx' })
        if(this.config.metadata) await this.metadata(tag).write({ createdAt: timestamp, ttl })
        if(this.config.versioning.enabled) {
        const versionsDir = path.join(this.config.dir, '.versions', tag)
        if(!await functions.exists(versionsDir)) await mkdir(versionsDir, { recursive: true })
        await this.safeWrite(`${versionsDir}/${timestamp}.${this.config.ext}`, data)
    }
    if(this.index.length) this.index[tag] = data
    this.emit('create', tag, data)
    return this
    }

    /**
     * Get a record by tag
     * @param {*} tag Tag of the record to get
     * @returns {Record} A Record instance containing the record data and metadata
     */
    get(tag) {
        return new Record(this.locate(tag), this)
    }

    /**
     * Get all records, with optional filtering and limiting
     * @param {Object} options Options for filtering and limiting records
     * @param {boolean} options.tagOnly Whether to return only tags (default: false)
     * @param {number} options.limit Maximum number of records to return (default: 0, meaning no limit)
     * @param {Function} options.filter Function to filter records (default: () => true)
     * @returns {Promise<Array>} An array of Record instances or tags, depending on `tagOnly`
     */
    async getAll({ tagOnly = false, limit = 0, filter = () => true }){
        if(Object.keys(this.index).length > 0) {
            const tags = Object.keys(this.index).filter(tag => filter(tag)).slice(0, limit > 0 ? limit : undefined)
            return tagOnly ? tags : tags.map(tag => new Record(this.locate(tag), this))
        }
        if((await functions.exists(path.join(this.config.dir, '.index')))) {
            const indexData = JSON.parse(await readFile(path.join(this.config.dir, '.index'), 'utf-8'))
            return Object.keys(indexData).filter(tag => filter(tag)).slice(0, limit > 0 ? limit : undefined).map(tag => tagOnly ? tag : new Record(this.locate(tag), this))
        }
        let files = await readdir(this.config.dir)
        if (typeof filter === 'function') files = files.filter(f => f.endsWith(`.${this.config.ext}`) && f != `.${this.config.ext}`).filter(filter)
        if (limit > 0) files = files.slice(0, limit)
        return tagOnly ? files.map(f => f.split('.').slice(0, -1).join('.')) : files.map(f_1 => new Record(this.locate(f_1.split('.').slice(0, -1).join('.')), this))
    }


    /**
     * Get records that contain a specific value, with optional tag-only results and limiting
     * @param {*} value Value to search for within records
     * @param {Object} options Options for filtering and limiting records
     * @param {boolean} options.tagOnly Whether to return only tags (default: false)
     * @param {number} options.limit Maximum number of records to return (default: 0, meaning no limit)
     * @deprecated Use getAll with a custom filter function instead for more flexible searching. Example: `db.getAll({ filter: async f => (await f.read(true)).includes(value) })`
     * @returns {Promise<Array>} An array of Record instances or tags, depending on `tagOnly`
     */
    async getFromValue(value="", { tagOnly = false, limit = 0 }){
        return this.getAll({ tagOnly:false, filter: async f => {
            const filePath = this.locate(f.split('.').slice(0, -1).join('.'))
            if (!await functions.exists(filePath)) return false
            const data = await readFile(filePath, 'utf-8')
            return data.includes(value)
        }, limit })
    }

    /**
     * Delete a record by tag
     * @param {*} tag Tag of the record to delete
     * @returns {Promise<Dubnium>} The Dubnium instance 
     */
    async delete(tag) {
        await this.get(tag).delete()
        return this
    }

    /**
     * Create an alias for an existing method
     * @param {*} alias Name of the new alias method
     * @param {*} existing_func Name of the existing method to alias
     * @returns {Dubnium} The Dubnium instance 
     */
    alias(alias, existing_func) {
    this[alias] = this[existing_func]
    return this
}

    /**
     * Create the database directory if it doesn't exist
     * @returns {Promise<Dubnium>} The Dubnium instance 
     */
    async dir(){
        await mkdir(this.config.dir, { recursive: true })
        this.emit('dir')
        return this
    }

    /**
     * Delete all records in the database
     * @returns {Promise<Dubnium>} The Dubnium instance 
     */
    async wipe(){
        const records = await this.getAll()
        for (const record of records) {
            await record.delete()
        }
        this.emit('wipe')
        return this
    }

    /**
     * Close the database by deleting the database directory and all its contents
     * @returns {Promise<Dubnium>} The Dubnium instance 
     */
    async close(){
        await rmdir(this.config.dir, { recursive: true })
        this.emit('close')
        return this
    }

    /**
     * Delete records that are older than a specified time limit
     * @param {Object} options Time limits for deleting old records
     * @param {number} options.ms Time limit in milliseconds
     * @param {number} options.s Time limit in seconds
     * @param {number} options.m Time limit in minutes
     * @param {number} options.h Time limit in hours
     * @param {number} options.d Time limit in days
     * @returns {Promise<Dubnium>} The Dubnium instance 
     */
    async deleteOld({ ms, s, m, h, d }){
        const timeLimits = {
            ms: ms || 0,
            s: (s || 0) * 1000,
            m: (m || 0) * 60 * 1000,
            h: (h || 0) * 60 * 60 * 1000,
            d: (d || 0) * 24 * 60 * 60 * 1000,
        }
        const totalLimit = Object.values(timeLimits).reduce((a, b) => a + b, 0)
        const records = await this.getAll({ tagOnly: false })
        const now = Date.now()
        let count = 0
        for (const record of records) {
            const stats = await stat(record.path)
            if (now - stats.mtimeMs > totalLimit) {
                await record.delete()
                count += 1
            }
        }
        this.emit('deleteOld', timeLimits, count)
        return this
    }

    /** Delete records that are larger than a specified size limit
     * @param {number} size Size limit in bytes
     * @returns {Promise<Dubnium>} The Dubnium instance 
     */
    async deleteLarge(size){
        const records = await this.getAll({ tagOnly: false })
        let count = 0
        for (const record of records) {
            const stats = await stat(record.path)
            if (stats.size > size) {
                await record.delete()
                count += 1
            }
        }
        this.emit('deleteLarge', size, count)
        return this
    }

    /**
     * Empty the trash directory by permanently deleting all files in it
     * @returns {Promise<Dubnium>} The Dubnium instance
     */
    async emptyTrash(){
        if (!this.config.trash) throw new DubniumError(`Trash directory is not configured`)
        const trashFiles = await readdir(this.config.trash)
        let count = 0
        for (const file of trashFiles) {
            await functions.safeUnlink(path.join(this.config.trash, file))
            count += 1
        }
        this.emit('emptyTrash', count)
        return this
    }

    /**
     * Permanently delete a record from the trash directory by tag
     * @param {string} tag The tag of the record to delete from trash
     * @returns {Promise<Dubnium>} The Dubnium instance
     */
    async deleteFromTrash(tag) {
        if (!this.config.trash) throw new DubniumError(`Trash directory is not configured`)
        const trashFile = path.join(this.config.trash, `${tag}.${this.config.ext}`)
        if (!await functions.exists(trashFile)) throw new DubniumError(`Record with tag "${tag}" does not exist in trash`)
        await functions.safeUnlink(trashFile)
        return this
    }

    /**
     * Restore a record from the trash directory by tag
     * @param {string} tag The tag of the record to restore from trash
     * @returns {Promise<Dubnium>} The Dubnium instance
     */
    async restoreFromTrash(tag) {
        if (!this.config.trash) throw new DubniumError(`Trash directory is not configured`)
        const trashFile = path.join(this.config.trash, `${tag}.${this.config.ext}`)
        if (!await functions.exists(trashFile)) throw new DubniumError(`Record with tag "${tag}" does not exist in trash`)
        await this.safeWrite(this.locate(tag), await readFile(trashFile, 'utf-8'))
        await functions.safeUnlink(trashFile)
        return this
    }

    async *[Symbol.asyncIterator]() {
        const records = await this.getAll({ tagOnly: false })
        for (const record of records) {
            yield record 
        }
    }

    /**
     * Monitor records for expiration based on their TTL (time-to-live) metadata and automatically delete expired records at regular intervals
     * @param {Number} interval The interval in milliseconds at which to check for expired records (default: 60000 ms or 1 minute)
     */
    monitorTTL(interval = 60000) {
    this.ttlInterval = setInterval(async () => {
        for await (const record of this) {
           const meta = await this.metadata(record.tag).read()
              if(meta.ttl && meta.createdAt){
        const age = Date.now() - new Date(meta.createdAt).getTime()
        if(age > meta.ttl) {
            await record.delete()
            this.emit('expire', record.tag)
        }
    }
        }
    }, interval)
}

/**
 * Build an in-memory index of all records for faster access, with an option to include only tags or full record data. This method reads all records and stores their data in the `index` property of the Dubnium instance, keyed by record tag.
 * @param {number} limit Optional limit on the number of records to index (default: 0, meaning no limit)
 * @returns {Promise<Dubnium>} The Dubnium instance
 */
async buildIndex(limit = 0) {
    const records = await this.getAll({ tagOnly:true })
    records.slice(0, limit > 0 ? limit : undefined).forEach(async tag => {
       const record = this.get(tag)
        const data = await record.read(true)
       this.index[record.tag] = data
    })
    return this
}

/**
 * Build a persistent index of all records by reading from a cached index file if it exists, or building a new index and saving it to the cache file if it doesn't. This method checks for the existence of an index file in the database directory (named `.index`), and if it exists, reads and parses the JSON data to populate the `index` property. If the index file does not exist, it calls `buildIndex()` to create the index from scratch, then saves the index to the `.index` file for future use. This allows for faster access to record data on subsequent runs by avoiding the need to read each record file individually.
 * @returns {Promise<Dubnium>} The Dubnium instance
 */
async buildPersistentIndex() {
   for await (const record of this) {
        const data = await record.read()
         this.index[record.tag] = data
    }
    this.safeWrite('.index', JSON.stringify(this.index))
    this.index = {}
    return this
}

}