const {
    writeFile,
    readFile,
    readdir,
    stat,
    mkdir,
    rmdir,
    unlink
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
    }

module.exports._config = _config

module.exports = class Dubnium extends require('events') {

    config = _config

    #root = process.geteuid ? process.geteuid() === 0 : false

    name = ""

    constructor(dir ="", conf = _config) {
        super()
        mkdirSync(dir || this.config.dir, { recursive: true })
        this.config.dir = realpathSync(dir || this.config.dir) // Use sync once during initialization to ensure the directory is set before any async operations
        this.config = { ...this.config, ...conf }
        if(this.config.trash) mkdirSync(this.config.trash, { recursive: true })
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
     * @param {boolean} parseJSON Whether to parse the record as JSON (default: false)
     * @returns {Promise<string|object>} The record data, either as a string or parsed JSON object
     */
    async read(tag, parseJSON = false) {
        if (!tag) throw new DubniumError(`Tag is required`)
        const filePath = this.#resolvePath(tag);
    
    if (!(await functions.exists(filePath))) {
        throw new DubniumError(`Record at "${filePath}" does not exist`);
    }
    
        const data = await readFile(filePath, 'utf-8')
        return parseJSON ? JSON.parse(data) : data
    }

    async write(tag, data) {
        if (!tag) throw new DubniumError(`Tag is required`)
        if (data === undefined) throw new DubniumError(`Data is required`)
        const filePath = this.#resolvePath(tag);
        await this.safeWrite(filePath, typeof data === 'string' ? data : JSON.stringify(data))
    }

    /** Create a record with a tag and data
     * @param {string} tag Tag of the record to create
     * @param {*} data Data to store in the record (will be stringified if not a string)
     * @returns {Promise<Dubnium>} The Dubnium instance 
     */
     async create(tag="", data) {
        if (!tag) throw new DubniumError(`Tag is required`)
        if (data === undefined) throw new DubniumError(`Data is required`)
        if (typeof data == "object") data = JSON.stringify(data)
        await this.safeWrite(this.#resolvePath(tag), data, { flag: this.config.force ? 'w' : 'wx' })
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
     * @returns {Promise<Array>} An array of Record instances or tags, depending on `tagOnly`
     */
    async getFromValue(value="", { tagOnly = false, limit = 0 }){
        return this.getAll({ tagOnly, filter: async f => {
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
     * @param {*} alais Name of the new alias method
     * @param {*} existing_func Name of the existing method to alias
     * @returns {Dubnium} The Dubnium instance 
     */
    alias(alais, existing_func) {
    this[alais] = this[existing_func]
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
        for (const record of records) {
            const stats = await stat(record.path)
            if (now - stats.mtimeMs > totalLimit) {
                await record.delete()
            }
        }
        this.emit('deleteOld', timeLimits)
        return this
    }

    /** Delete records that are larger than a specified size limit
     * @param {number} size Size limit in bytes
     * @returns {Promise<Dubnium>} The Dubnium instance 
     */
    async deleteLarge(size){
        const records = await this.getAll({ tagOnly: false })
        for (const record of records) {
            const stats = await stat(record.path)
            if (stats.size > size) {
                await record.delete()
            }
        }
        this.emit('deleteLarge', size)
        return this
    }

    /**
     * Empty the trash directory by permanently deleting all files in it
     * @returns {Promise<Dubnium>} The Dubnium instance
     */
    async emptyTrash(){
        if (!this.config.trash) throw new DubniumError(`Trash directory is not configured`)
        const trashFiles = await readdir(this.config.trash)
        for (const file of trashFiles) {
            await functions.safeUnlink(path.join(this.config.trash, file))
        }
        return this
    }

    async deleteFromTrash(tag) {
        if (!this.config.trash) throw new DubniumError(`Trash directory is not configured`)
        const trashFile = path.join(this.config.trash, `${tag}.${this.config.ext}`)
        if (!await functions.exists(trashFile)) throw new DubniumError(`Record with tag "${tag}" does not exist in trash`)
        await functions.safeUnlink(trashFile)
        return this
    }

    async *[Symbol.asyncIterator]() {
        const records = await this.getAll({ tagOnly: false })
        for (const record of records) {
            yield record 
        }
    }

}