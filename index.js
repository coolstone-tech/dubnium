const {
    existsSync,
    writeFileSync,
    rmSync,
    readFileSync,
    readdirSync,
    renameSync,
    statSync,
    mkdirSync,
    appendFileSync,
    truncateSync,
    symlinkSync,
    watch,
    readdir,
} = require('fs')

const {
    stringify,
    fullPath,
    walkDir,
    searchArray
} = require('./functions')

const path = require('path')
const {
    homedir
} = require('os')

const DubniumError = class extends Error {
    constructor(message) {
        super(message)
        this.name = 'DubniumError'
    }
}

class Dubnium extends require('events') {
    config = {
        dir: '',
        ext: 'json',
        force: false,
        preserveConfig: false,
        versioning: {
            temp: true,
            file: true,
            max: 10,
        }
        }

    #watcher = null

    name = path.basename(this.config.dir)

    constructor(dir = "", ext = "", options = this.config) {
        super()
        if(!dir) throw new DubniumError('No directory specified')
        if(!ext) console.warn('No extension specified, using "json"')
        this.emit('start', dir, ext, options)
        this.config = options ? options : this.config
        this.config.dir = dir.replace('~', homedir())
        this.config.ext = ext || 'json'
        if (!existsSync(dir)) mkdirSync(dir)
        if (!existsSync(`${dir}/.dubnium`)) mkdirSync(`${dir}/.dubnium`)
        if (!existsSync(`${dir}/.dubnium/config.json`) && !options?.preserveConfig) writeFileSync(`${dir}/.dubnium/config.json`, stringify(this.config))
        this.name = options?.name || path.basename(dir)
        if(!options?.versioning?.temp && !options?.versioning?.file) return
        this.startVersioning(this.config.versioning)
    }

    /**
     * Get the path to a Record
     * @param {string} tag The tag to locate
     * @returns {string} record path
     */
    locate(tag) {
        return `${this.config.dir}/${tag}.${this.config.ext}`
    }

    /**
     * Check if a Record exists
     * @param {string} tag The tag to check
     * @returns {boolean} Whether the Record exists
     */
    has(tag) {
        return existsSync(this.locate(tag))
    }

    #check(tag) {
        if (!existsSync(`${this.config.dir}/.dubnium`)) mkdirSync(`${this.config.dir}/.dubnium`)
        if(!existsSync(`${this.config.dir}/.dubnium/versions/`)) mkdirSync(`${this.config.dir}/.dubnium/versions`)
        if (tag && !this.has(this.locate(tag))) throw new DubniumError(`File ${this.locate(tag)} does not exist`)
    }

    /**
     * Get a Record
     * @param {string} tag Tag of the Record to get 
     * @returns Record
     */
    get(tag) {
        const file = this.locate(tag)
        const _this = this
        if (!existsSync(file)) return null
        return {
            /** Record content */
            content: _this.config.ext == 'json' ? JSON.parse(readFileSync(file, 'utf8')) : readFileSync(file, 'utf8'),
            /** Record tag */
            tag,
            /** Record path */
            path: file,
            /** Record full path */
            realpath:fullPath(file),
            /** Record stats */
            stats: statSync(file),
            /** Delete the Record
             * @returns database
             */
            delete() {
                _this.delete(tag)
                return _this
            },
            /** Edit the Record
             * @param {string} content New content
             * @returns Record
             * */
            edit(content) {
                _this.edit(tag, content)
                return this
            },
            /** Save the Record
             * @returns Record
             * */
            save() {
                _this.edit(tag, this.content)
                _this.emit('save',this.tag, this.content)
                return this
            },
            /** Set the Record's tag
             * @param {string} newTag New tag
             * @returns Record
             * */
            setTag(newTag) {
                _this.setTag(tag, newTag)
                return this
            },
            /** Search the Record's content
             * @param {string} query Query to search for
             * @param {string} splitBy Split the content by this
             * @returns {string} Result
             * */
            searchAsArray(query, splitBy){
                return searchArray(String(this.content).split(splitBy || ' '), query)
            },
            /** Search the Record's content
             * @param {string} query Query to search for
             * @returns {string} Result
             * */
            search(query){
            return stringify(this.content).search(query)
            },
            /** Search the Record's content
             * @param {string} query Query to search for
             * @returns {string} Result
             * */
            searchKeys(query) {
                let results = {}
                const obj = t.get(tag).content
                for (let key in obj) {
                    if (obj[key]) {
                        if (obj.hasOwnProperty(key)) {
                            if (key.indexOf(query) !== -1 || obj[key].indexOf(query) !== -1) {
                                results[key] = obj[key]
                            }
                        }
                    }
                }
                return results
            },
            /** Truncate the Record
             * @param {number} length Length to truncate to
             * @returns Record
             * */
            truncate(length) {
                truncateSync(file, length)
                _this.emit('truncate', this.tag, length)
                return this
            },
            /** Append to the Record
             * @param {string} content Content to append
             * @returns Record
             * */
            append(content) {
               appendFileSync(file, content)
                _this.emit('append', this.tag, content)
               return this
            },
            /** Prepend to the Record
             * @param {string} content Content to prepend
             * @returns Record
             * */
            prepend(content) {
                const _res = `${content}${this.content}` 
                this.edit(_res)
                _this.emit('prepend', this.tag, content)
                return this
            },
            /** Sync the Record with another Record
             * @param {string} _tag Tag to sync with
             * @returns {object} Original and source Records
             * */
            syncWith(_tag) {
            writeFileSync(file, _this.get(_tag).content)
            _this.emit('sync', _tag)
            return {
            original: this,
            source: _this.get(_tag)
            }
            },
                /** Use an extension at the Record level
             * @param {string} name Set a custom name for the extension
             * @param source Source of the extension
             * @param permissions Permissions for the extension
             * @returns database
             * */
            extend(name, source=()=>{}, permissions=module.exports.extensionPermissions){
                if(this[name]) throw new DubniumError(`Cannot overwrite "${name}"`)
                this[name] = (...args) => {
                return source(permissions.DATABASE ? _this : null, permissions.RECORD ? this : null, ...args)
                }
                return this
                },
                /** Create a symlink to the Record
                 * @param {string} target Target of the symlink
                 * @returns Record
                 * */
                symlink(target) {
                    symlinkSync(target, file)
                    _this.emit('symlink', this.tag, target)
                    return this
                },
                /** Get the Record's content as a string
                 * @returns {string} Content
                 * */
                toString() {
                    return stringify(this.content)
                },
                /** Get the Record's content as a JSON object, if possible
                 * @returns {object} Content
                 * */
                toJSON() {
                    return new Object(this.content)
                },
                /** Exit the Record editor API
             * @returns database
             */
                exit(){
                return _this
                },
                end(){},
                /** Run a custom `fs` function
                 * @param {string} func Function to run
                 * @param {any} args Arguments to pass to the function
                 */
                fs(func, ...args){
                    _this.emit('fs', func, this.tag, ...args)
                    return require('fs')[func](this.config.dir, ...args)
                },
                /**
                 * Clone the Record
                 * @param {string} target Target directory to clone to
                 * @returns 
                 */
                clone(target){
                    writeFileSync(`${target}/${this.tag}.${_this.config.ext}`, this.content)
                    _this.emit('clone', this.tag, target)
                    return {
                        original: this,
                        clone:new Dubnium(target, _this.config.ext).get(this.tag)
                    }
                },
                /** Empty the Record
                 * @returns Record
                 */
                empty(){
                    writeFileSync(file, '')
                    _this.emit('empty', this.tag)
                    return this
                },
                /** Check if the Record is empty */
                isEmpty(){
                return stringify(this.content).length == 0
                },
                /** Set an alias for a Record level function
                 * @param {string} alias Alias to set
                 * @param {string} func Function to alias
                 * @returns Record
                 */
                alias(alias, func){
                    if(!this[func]) throw new DubniumError(`Function "${func}" does not exist`)
                    if(this[alias]) throw new DubniumError(`Cannot overwrite "${alias}"`)
                    this[alias] = (...args) => {
                    return this[func](...args)
                    }
                    return this
                    },
                    /** Beautify a JSON Record
                     * @param {function} replacer Replacer function
                     * @param {number} space Space to uses, defaults to 2
                     */
                    beautify(replacer, space){
                    if(typeof this.content == 'object') writeFileSync(file, JSON.stringify(this.content, replacer, space || 2))
                    _this.emit('beautify', this.tag, replacer, space)
                    return this
                    }
        }
    }

           /** Run a custom `fs` function
                 * @param {string} func Function to run
                 * @param {any} args Arguments to pass to the function
                 */
    fs(func, ...args){
    this.emit('fs', func, null, ...args)
    return require('fs')[func](this.config.dir, ...args)
    }

    end(){}

    /** Run a bash command in the directory
     * @param {string} command Command to run
     * @param {function} callback Callback to pass to `child_process.exec`
     * @param {object} opts Options to pass to `child_process.exec`
     */
    exec(command, callback=(error, stdout=Buffer.from(), stderr=Buffer.from()) => {}, opts){
    this.emit('exec', command, callback)
    let _opts = opts || {}
    _opts.cwd = fullPath(this.config.dir)
    require('child_process').exec(command, _opts, callback)
    return this
    }

/** Get a Record from its value
 * @param {string} value Value to search for
 * @returns Record[]
 */
    getFromValue(value){
        const records = this.getAll()
        const results = []
        for (const record of records) {
            if (record.content === value) results.push(record)
        }
        return results
    }

    /** Get a Record from a key/value pair
     * @param {string} key Key to search for
     * @param {string} value Value to search for
     * @returns Record[]
     * */
    getFromKeyValue(key, value){
        const records = this.getAll()
        const results = []
        for (const record of records) {
            if (record.content[key] === value) results.push(record)
        }
        return results
    }

    /** Get all Records
     * @returns Record[]
     * */
    getAll(){
        const files = readdirSync(this.config.dir)
        const records = []
        for (const file of files) {
            if (file.endsWith(this.config.ext)) {
                records.push(this.get(file.replace(`.${this.config.ext}`, '')))
            }
        }
        return records
    }

    /** Filter Records by tag
     * @param {string} query Tag to search for
     * @returns Record[]
     * */
    filter(query){
        const results = []
      this.getAll().forEach(record => {
            if (record.tag.search(query)) results.push(record)
        })
        return results
    }
    
    /** Search Records by content
     * @param {string} query Query to search for
     * @returns Record[]
     * */
    search(query){
        const results = []
        this.getAll().forEach(record => {
            if (stringify(record.content).includes(query)) results.push(record)
        })
        return results
    }

    /** Create a Record
     * @param {string} tag Tag to create
     * @param {any} content Content to write
     * @param {object} options Options to pass to `fs.writeFileSync`
     * @returns Record
     * */
    create(tag, content, options) {
    this.emit('create', tag, content)
    if(this.has(tag) && !options.force) console.warn(`${this.locate(tag)} already exists`)
    writeFileSync(this.locate(tag), stringify(content), options)
    return this.get(tag)
    }

    /** Create a Record from a file
     * @param {string} tag Tag to create
     * @param {string} file File to read from
     * @param {object} options Options to pass to `fs.writeFileSync`
     * @returns Record
     * */
    createFromFile(tag, file, options) {
        this.emit('create', tag, file)
        if(this.has(tag) && !options.force) console.warn(`${this.locate(tag)} already exists`)
        if(!existsSync(fullPath(file), 'utf8')) throw new DubniumError(`File ${fullPath(file)} does not exist`)
        if(!readFileSync(fullPath(file), 'utf8').length) console.warn(`File ${fullPath(file)} is empty`)
        writeFileSync(this.locate(tag), readFileSync(fullPath(file), 'utf8'), options)
        return this.get(tag)
    }

    /** Delete a Record
     * @param {string} tag Tag to delete
     * @returns database
     */
    delete(tag) {
        this.emit('delete', tag)
        const file = this.locate(tag)
        this.#check(tag)
        rmSync(file)
        return this
    }

    /** Edit a Record. This will overwrite the entire file
     * @param {string} tag Tag to edit
     * @param {any} content Content to write
     * @returns Record
     * */
    edit(tag, content) {
        this.emit('edit', tag, readFileSync(this.locate(tag), 'utf8'), content)
        const file = this.locate(tag)
        this.#check()
        writeFileSync(file, stringify(content))
        return this.get(tag)
    }

    /** Set a Record's tag
     * @param {string} tag Tag to edit
     * @param {string} newTag New tag to set
     * @returns Record
     */
    setTag(tag, newTag) {
        this.emit('retagged', tag, newTag)
        const file = this.locate(tag)
        this.#check()
        renameSync(file, this.locate(newTag))
        return this.get(newTag)
    }
    
    /** Wipe the database
     * @returns database
     */
    wipe(){
        this.emit('wipe', this.config.dir)
        walkDir(this.config.dir, (file) => {
            if (file.endsWith(this.config.ext)) rmSync(file)
        })
        return this
    }

    /** Delete the database
     * @returns database
     * */
    close(){
    rmSync(`${this.config.dir}`, {recursive: true})
    this.emit('close', this.config.dir)
    return this
    }

    /** Delete old Records
     * @returns database
     * */
    deleteOld(options = {
        ms: 0,
        seconds: 0,
        minutes: 0,
        hours: 0,
        days: 0
    }) {
        let ms = options.ms ? options.ms : 0
        if (options.days) {
            ms += options.days * 86400000
        }
        if (options.hours) {
            ms += options.hours * 3600000
        }
        if (options.minutes) {
            ms += options.minutes * 60000
        }
        if (options.seconds) {
            ms += options.seconds * 1000
        }
        if (ms) {
            this.emit("delete_old", options)
            walkDir(this.dirPath, (filePath) => {
                const stat = statSync(filePath)
                if (new Date().getTime() > new Date(stat.mtime).getTime() + ms) {
                    rmSync(filePath)
                }
            })
        }
        return this
    }

    /** Delete large Records
     * @returns database
     * */
    deleteLarge(options = {
        bytes: 0,
        kilobytes: 0,
        megabytes: 0,
        gigabytes: 0
    }) {
        let b = options.bytes ? options.bytes : 0
        if (options.kilobytes) b += options.kilobytes * 1024
        if (options.megabytes) b += options.megabytes * 1024 * 1024
        if (options.gigabytes) b += options.gigabytes * 1024 * 1024 * 1024
        if (b) {
            this.emit("delete_large", options)
            walkDir(this.dirPath, (filePath) => {
                const stat = statSync(filePath)
                if (stat.size > b) {
                rmSync(filePath)
                }
            })
        }
        return this
    }

                /** Use an extension at the database level
             * @param {string} name Set a custom name for the extension
             * @param source Source of the extension
             * @param permissions Permissions for the extension
             * @returns database
             * */
    extend(name, source=()=>{}, permissions=new module.exports.extensionPermissions()){
        if(this[name]) throw new DubniumError(`Cannot overwrite "${name}"`)
        this[name] = (...args) => {
    return source(permissions.DATABASE ? this : null, null, ...args)
    }
    return this
    }

                    /** Set an alias for a database level function
                 * @param {string} alias Alias to set
                 * @param {string} func Function to alias
                 * @returns Record
                 */
    alias(alias, func){
    if(!this[func]) throw new DubniumError(`Function "${func}" does not exist`)
    if(this[alias]) throw new DubniumError(`Cannot overwrite "${alias}"`)
    this[alias] = (...args) => {
    return this[func](...args)
    }
    return this
    }

    /** Create a directory for the database
     * @returns database
     * */
    dir(){
    mkdirSync(this.config.dir)
    this.emit('dir', this.config.dir)
    return this
    }

    /** Iterate the database
     * @param callback Callback to run
     */
    iterate(callback=(record=this.get())=>{}){
        this.getAll().forEach(record => {
            callback(record)
        })
        return this
    }

    /** Save the config file
     * @returns database
     */
    saveConfig(){
        writeFileSync(`${this.config.dir}/.dubnium/config.json`, JSON.stringify(this.config, null, 2))
        return this
    }

    versions = {
    database:this,
    /** Locate a version
     * @param {string} tag Tag to locate
     */
    locate(tag,opts={date, index}){
       if(date) return `${this.database.config.dir}/.dubnium/versions/${tag}/${opts.date}.${this.database.config.ext}`
       if(index) return `${this.database.config.dir}/.dubnium/versions/${tag}/${readdirSync(`${this.database.config.dir}/.dubnium/versions/${tag}`)[opts.index]}`
       return null
    },
    /** Read a **file** version from its ISO date
     * @param {string} tag Tag to read from
     * @param {string} date Date to read from
     */
    readFromDate(tag, date){
        if(!existsSync(`${this.database.config.dir}/.dubnium/versions/${tag}`)) throw new DubniumError(`Record ${tag} does not exist`)
        return readFileSync(this.locate(tag, date), 'utf8')
    },
    /** Read a **file** version from its index
     * @param {string} tag Tag to read from
     * @param {number} index Index to read from
     * */
    readFromIndex(tag, index){
        if(!existsSync(`${this.database.config.dir}/.dubnium/versions/${tag}`)) throw new DubniumError(`Record ${tag} does not exist`)
        const files = readdirSync(`${this.database.config.dir}/.dubnium/versions/${tag}`)
        if(!files[index]) console.warn(`Version at index ${index} does not exist in ${tag}`)
        return readFileSync(this.locate(tag, index), 'utf8')
    },
    /** Set the number of stored versions
     * @param {number} max Maximum number of versions to store. Default: 100
     */
    setLength(max){
            if(!max) max = 100
            for ( const v in this.database.versions.temp ){
                if(this.database.versions?.temp[v]?.length > max) this.database.versions.temp[v].length = max
            }
            readdirSync(`${this.database.config.dir}/.dubnium/versions`).forEach(tag => {
                const files = readdirSync(`${this.database.config.dir}/.dubnium/versions/${tag}`)
                if(files.length > max) {
                    for(let i = 0; i < files.length - max; i++){
                        rmSync(`${this.database.config.dir}/.dubnium/versions/${tag}/${files[i]}`)
                    }
                }
            })
            return this
        },
        /** Delete a **file** version from its ISO date
         * @param {string} tag Tag to delete from
         * @param {string} date Date to delete
         * */
        deleteFromDate(tag, date){
            if(!existsSync(`${this.database.config.dir}/.dubnium/versions/${tag}`)) throw new DubniumError(`Record ${tag} does not exist`)
            if(!date) throw new DubniumError(`Date not specified`)
            if(!existsSync(this.locate(tag, date))) throw new DubniumError(`Version ${date} does not exist in ${tag}`)
            rmSync(this.locate(tag, date))
            return this
        },
        /** Delete a **file** version from its index
         * @param {string} tag Tag to delete from
         * @param {number} index Index to delete
         * */
        deleteFromIndex(tag, index){
            if(!existsSync(`${this.database.config.dir}/.dubnium/versions/${tag}`)) throw new DubniumError(`Record ${tag} does not exist`)
            const files = readdirSync(`${this.database.config.dir}/.dubnium/versions/${tag}`)
            if(!files[index]) console.warn(`Version at index ${index} does not exist in ${tag}`)
            rmSync(this.locate(tag, index))
            return this
        },
    /** Temporary versions */
    temp:{}
    }

    middleware = {
        database:this,
        /** Create a record from a request
         * @param {string} tag Tag to create
         * */
        create(tag={from:"", key:""}, content={from:"", key:""}){
            return (req, res, next) => {
                if(typeof tag != 'string' && !req[tag.from]) throw new DubniumError(`${tag.from} not found in request`)
                if(typeof content != 'string' && !req[content.from]) throw new DubniumError(`${content.from} not found in request`)
                const _tag = typeof tag == 'string' ? tag : req[tag.from][tag.key] ?? req[tag.from]
                const _content = typeof content == 'string' ? content : req[content.from][content.key] ?? req[content.from]
                this.database.create(_tag, _content)
                next()
            }
        },
        /** Get a record from a request */
        get(tag={from:"", key:""}){
            return (req, res, next) => {
                if(!req[tag.from][tag.key]) throw new DubniumError(`Tag not found in ${tag.from} at ${tag.key}`)
                const _tag = typeof tag == 'string' ? tag : req[tag.from][tag.key] ?? req[tag.from]
                req.record = this.database.get(_tag)
                next()
            }
        },
        /** Inject database into request object
         * @param {string} name Name of the database object. Default: `db`
         */
        db(name){
           return (req, res, next) => {
                req[name || 'db'] = this.database
                next()
              }
        },
        /** Delete a record from a request */
        delete(tag={from:"", key:""}){
            return (req, res, next) => {
                if(!req[tag.from][tag.key]) throw new DubniumError(`Tag not found in ${tag.from} at ${tag.key}`)
                const _tag = typeof tag == 'string' ? tag : req[tag.from][tag.key] ?? req[tag.from]
                this.database.delete(_tag)
                next()
            }
        },
        /** Edit a record from a request */
        edit(tag={from:"", key:""}, content={from:"", key:""}){
            return (req, res, next) => {
                if(typeof tag != 'string' && !req[tag.from]) throw new DubniumError(`${tag.from} not found in request`)
                if(typeof content != 'string' && !req[content.from]) throw new DubniumError(`${content.from} not found in request`)
                const _tag = typeof tag == 'string' ? tag : req[tag.from][tag.key] ?? req[tag.from]
                const _content = typeof content == 'string' ? content : req[content.from][content.key] ?? req[content.from]
                this.database.edit(_tag, _content)
                next()
            }
        },
        /** Run a function from a request */
        other(func, ...args){
            return (req, res, next) => {
                const result = this.database[func](...args)
                req.db.function = func
                req.db[func] = this.database[func]
                req.db.args = args
                req.db.result = result
                next()
            }    
        }
    }

    /** Stop recording versions */
    stopVersioning(options = { temp:false, file:false }){
        this.emit('stop_versioning', options)
        if(options.temp) this.versions.temp = {}
        if(options.file) this.#watcher.close()
        return this
    }

    /** Start recording versions */
    startVersioning(options = { temp:true, file:true, max:100 }){
        this.emit('start_versioning', options)
        this.#watcher = watch(this.config.dir, (event, filename) => {
            const directory = `${this.config.dir}/.dubnium/versions`
            this.#check()
            const nm = path.basename(filename).replace(`.${this.config.ext}`, '')
            if(options.max > 0) {
                if(this.versions.temp[nm]?.length > options.max) this.versions.temp[nm].shift()
                if(readdirSync(`${this.config.dir}/.dubnium/versions/${nm}`).length > options.max){
                readdir(directory , (e, f) => {
                    if (e) throw e
                    readdir(`${directory}/${nm}`, (err, files) => {
                    if (err) throw err
                     files.sort((a, b) => {
                      return statSync(path.join(directory, nm, a)).birthtime.getTime() - statSync(path.join(directory, nm, b)).birthtime.getTime()
                    })
                    const oldestFile = fullPath(path.join(directory, nm, files[0]))
                    rmSync(oldestFile)
                  })
                })
                }
            }
            this.emit(event, nm)
            if(event != 'change') return
            if(!this.has(nm)) return
            if(!this.versions.temp[nm]) this.versions.temp[nm] = []
            if(options.temp) this.versions.temp[nm].push({ date:new Date(), content:this.get(nm).content })
            if(!existsSync(`${this.config.dir}/.dubnium/versions/${nm}`) && options.file) mkdirSync(`${this.config.dir}/.dubnium/versions/${nm}`)
            if(options.file) writeFileSync(`${this.config.dir}/.dubnium/versions/${nm}/${new Date().toISOString()}.${this.config.ext}`, stringify(readFileSync(`${this.config.dir}/${filename}`, 'utf8')))
        })
        return this
    }
}

/** Create a Record */
const Record = (dir, tag, content, ext) => {
return new Dubnium(dir, ext || "json").create(tag, content)
}

const Template = class {
    template = {}
    #type = 0
    constructor(template){
        this.template = template
        this.#type = typeof template == 'string' ? 1 : 0
    }

    /** Use the template */
    use(...values){
    if (this.#type == 0){
        let r = this.template
        values.forEach((val, index) => {
        r = r.split(`{${index}}`).join(val)
        })
        return r
    }else{
        let n = 0
        const r = this.template
        values.forEach(val => {
            if (n > r.length) return
            let key = Object.keys(this.template)[n]
            if (typeof val != typeof r[key]) console.warn(`Changed type of ${Object.keys(this.template)[n]} to ${typeof val}`)
            r[key] = val
            n++
        })
        return r
    }
}
}

class extensionPermissions {
RECORD = false
DATABASE = false

constructor(record=false, database=false){
    this.RECORD = record
    this.DATABASE = database
}
}

module.exports = Dubnium
module.exports.Dubnium = Dubnium
module.exports.Template = Template
module.exports.extensionPermissions = extensionPermissions
module.exports.Record = Record
