
const {
    rm,
    readFile,
    rename,
    stat,
    symlink,
    readdir,
    mkdir,
    lstat
} = require('fs/promises')

const { exists } = require('./functions')

const PATH = require('path')

/** @typedef {import('./index')} Dubnium */ 

module.exports = class Record {

tag = ''
path = ''

/** @type {Dubnium} */
#dubniumInstance = null

 constructor(path, dbInstance){
    this.path = path
    this.tag = PATH.parse(path).name
    this.#dubniumInstance = dbInstance
}

#locate(tag){
    return `${this.#dubniumInstance.config.dir}/${tag}.${this.#dubniumInstance.config.ext}`
}

/**
 * Read the record
 * @param {boolean} [stringify] - `true` to return JSON records as strings
 * @returns {Promise<*>} The record data
 */
async read(stringify = false) {
    const data = await readFile(this.path, 'utf-8')
    
    if (this.#dubniumInstance.config.ext === 'json') {
        return stringify ? data : JSON.parse(data)
    }
    return data
}

/**
 * Write data to the record, overwriting existing data
 * @param {*} data - The data to write to the record. Will be stringified if not a string.
 * @returns {Promise<Record>} The Record instance
 */
async write(data){

let payload;

if (this.#dubniumInstance.config.ext === 'json') {
    payload = typeof data === 'string' ? data : JSON.stringify(data);
    if (typeof data === 'string') {
            try {
                JSON.parse(data);
            } catch (e) {
                payload = JSON.stringify(data);
            }
        }
    } else {
        payload = String(data);
    }
    
    await this.#dubniumInstance.safeWrite(this.path, payload)
    
    if(this.#dubniumInstance.config.versioning.enabled) {
        const versionsDir = `${this.#dubniumInstance.config.dir}/.versions/${this.tag}`
        if(!await exists(versionsDir)) await mkdir(versionsDir, { recursive: true })
        const timestamp = new Date().toISOString()

        const versionFiles = await readdir(versionsDir)
        if(versionFiles.length >= this.#dubniumInstance.config.versioning.limit) {
            const oldestFile = versionFiles.sort()[0]
            await rm(`${versionsDir}/${oldestFile}`)
        }

        await this.#dubniumInstance.safeWrite(`${versionsDir}/${timestamp}.${this.#dubniumInstance.config.ext}`, payload)
    }
    this.#dubniumInstance.emit('edit', this.tag, data)
    return this
}

/**
 * Delete the record
 * @returns {Promise<Dubnium>} The Dubnium instance
 */
async delete() {
    if (this.#dubniumInstance.config.trash) {
        const trashPath = PATH.join(this.#dubniumInstance.config.trash, `${this.tag}.${this.#dubniumInstance.config.ext}`)
        await rename(this.path, trashPath)
    } else {
        await this.#dubniumInstance.safeUnlink(this.path)
    }
    this.#dubniumInstance.emit('delete', this.tag)
    return this.#dubniumInstance
}

/**
 * Append data to the record
 * @param {*} data - The data to append to the record. Must be an object if the record is a JSON file.
 * @returns {Promise<Record>} The updated Record instance
 */
async append(data) {
    await this.#dubniumInstance.atomicUpdate(this.path, (current) => {
        if (typeof current === 'object') {
            return { ...current, ...data }
        }
        return current + data
    })
    return this
}

/**
 * Prepend data to the record
 * @param {*} data - The data to prepend to the record. Must be an object if the record is a JSON file.
 * @returns {Promise<Record>} The updated Record instance
 */
async prepend(data){
    await this.#dubniumInstance.atomicUpdate(this.path, (current) => {
        if (typeof current === 'object') {
            return { ...data, ...current }
        } 
        return data + current
    })
    return this
}

/**
 * Truncate the record's data to a specified length
 * @param {number} len The length to truncate the data to
 * @returns {Promise<Record>} The updated Record instance
 */
async truncate(len) {
    const current = await this.read(true)
    const truncated = current.slice(0, len)
    await this.write(truncated)
    return this
}

/**
 * Set a specific key-value pair in the record (for JSON records)
 * @param {string} key The key to get or set
 * @param {*} value The value to set
 * @returns {Promise<Record>} The Record instance
 */
async kv(key, value) {
    await this.#dubniumInstance.atomicUpdate(this.path, (data) => {
        if(typeof data !== 'object') throw new Error('Record data is not an object')
        data[key] = value
        return data
    })
    this.#dubniumInstance.emit('edit', this.tag)
    return this
}

/**
 * Change the record's tag
 * @param {string} newTag The new tag for the record
 * @returns {Promise<Record>} The updated Record instance
 */
async setTag(newTag){
    const newPath = this.#locate(newTag)
    await rename(this.path, newPath)
    this.path = newPath
    this.tag = newTag
    this.#dubniumInstance.emit('retagged', this.tag, newTag)
    return this
}

/**
 * Overwrite the current Record with another record's data
 * @param {string} newTag The tag of the record to sync with
 * @returns {Promise<Record>} The updated Record instance
 */
async syncWith(newTag){
const newData = await readFile(this.#locate(newTag), 'utf-8')
await this.write(newData)
return this
}

/**
 * Empty the record's data
 * @returns {Promise<Record>} The updated Record instance
 * @deprecated Use `write("")` instead
 */
async empty(){
await this.write('')
return this
}

/**
 * Check if the record is empty (has no data)
 * @returns {Promise<boolean>} `true` if the record is empty, `false` otherwise
 */
async isEmpty(){
const stats = await this.read()
return typeof stats === 'object' ? Object.keys(stats).length === 0 : stats.length === 0
}

/**
 * Search for a query string within the record's data
 * @param {string} q - The query string to search for within the record's data
 * @returns {Promise<number>} The index of the first occurrence of the query string within the record's data, or `-1` if not found
 */
async search(q){
const data = await this.read(true)
return data.search(q)
}

/**
 * Create a symbolic link to the record at the specified target path
 * @param {string} targetPath Path for the symlink
 * @returns {Promise<Record>} The Record instance
 */
async symlink(dest) {
  await mkdir(PATH.dirname(dest), { recursive: true });

  try {
    await lstat(dest);
    console.error(`Refusing to overwrite existing path: ${dest}`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  await symlink(this.path, dest, 'file');
return this
}

/**
 * Get statistics about the record, such as size and creation date
 * @returns {Promise<fs.Stats>} An object containing the record's statistics
 */
async stats(){
return await stat(this.path)
}

/**
 * End a chain of Record method calls.
 */
end() {}

/**
 * Exit the Record context and return to the Dubnium instance for the record's collection
 * @returns {Dubnium} The Dubnium instance associated with the record's collection
 */
exit(){
    return this.#dubniumInstance
}

/**
 * Create an alias for a Record method
 * @param {string} alais The name of the alias
 * @param {string} existing_func The name of the existing method to alias
 * @returns {Record} The Record instance
 */
alias(alais, existing_func) {
    this[alais] = this[existing_func]
    return this
}

/** Clone the record to a new tag
 * @param {string} newTag The tag for the cloned record
 * @returns {Promise<Record>} The new Record instance for the cloned record
 */
async clone(newTag){
    const data = await this.read()   
    this.#dubniumInstance.emit('clone', this.tag, newTag)
    return await this.#dubniumInstance.create(newTag, data)
}

/** Get a specific version of the record by date
 * @param {string} date The date of the version to retrieve (in ISO format)
 * @returns {Promise<*>} The data of the specified version
 */
async getVersion(date){
const versionPath = `${this.#dubniumInstance.config.dir}/.versions/${this.tag}/${date}.${this.#dubniumInstance.config.ext}`
if(!await exists(versionPath)) throw new Error('Version not found')
const data = await readFile(versionPath, 'utf-8')
return this.#dubniumInstance.config.ext == 'json' ? JSON.parse(data) : data
}

}