/*
Copyright 2022 CoolStone Technologies
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
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
    realpathSync
} = require('fs')

const path = require('path')

if(!existsSync(`${__dirname}/plugins.js`)) writeFileSync(`${__dirname}/plugins.js`,'')

const stringify = (data) => {
    return typeof data == 'object' ? JSON.stringify(data, null, 2) : String(data)
}
const walkDir = (dir, callback) => {
    readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f)
        let isDirectory = statSync(dirPath).isDirectory()
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f))
    })
}
const searchArray = (arr, val) => {
    return arr.filter(el => {
        return el.match(new RegExp(val, 'gi'))
    })
}


const dubnium = class extends require("events") {
    dirPath = ''
    ext = ''

    /** Initialize a new database
     * @param {string} dirPath Path to dir
     * @param {string?} ext Custom file extension
     */
    constructor(dirPath, ext) {
        super()
        this.dirPath = dirPath
        const cf = `${dirPath}/dubniumconfig.json`
        if (!existsSync(cf)) writeFileSync(cf, JSON.stringify({ext}))
        const config = JSON.parse(readFileSync(cf))
        if (existsSync(cf) && config.ext) {
            this.ext = config.ext
        } else {
            this.ext = ext ? ext : 'json'
        }
        this.emit('start', this.dirPath, this.ext)
    }

    /** Get the path to a Record
     * @since v2.2.1
     * @param {string} tag Record's tag
     * @param {bool?} realpath Return real path?
     */
    find(tag, realpath) {
        const original = `${this.dirPath}/${tag}.${this.ext}`
        return realpath ? realpathSync(original) : original
    }

    /** Make a new Record
     * @param {string} tag The Record's tag
     * @param content Record's content
     * @param {object?} options writeFile options
     */
    create(tag, content, options) {
        if (this.has(tag)) return this.get(tag)
        this.emit("create", tag, stringify(content))
        writeFileSync(this.find(tag), stringify(content), options)
        return this.get(tag)
    }

    /** Check if Record exists
     * @param {string} tag The Record's tag
     */
    has(tag) {
        return existsSync(this.find(tag))
    }

    /** Use `has()`
     * @deprecated v2.3.0
     */
    exists(tag) {
        return existsSync(this.find(tag))
    }


    /** Get Record
     * @param {string} tag The Record's tag
     * @returns Record
     */
    get(tag) {
        const t = this
        if (!this.find(tag) || !existsSync(this.find(tag))) return null
        const d = readFileSync(this.find(tag), 'utf8')
        return {
            /**  Record's tag */
            tag,
            /** Record's content */
            content: t.ext == 'json' ? JSON.parse(d) : d,
            /** Use `.content` 
             * @deprecated v2.3.0 */
            data: t.ext == 'json' ? JSON.parse(d) : d,
            /** Path to Record */
            path: t.find(tag),
            /** Full path to Record */
            realpath: realpathSync(t.find(tag)),
            /** Run a plugin */
            plugins:require("./plugins")
            /** Exit the Record editor API
             * @since v2.2.0
             */
            exit() {
                return t
            },
            /** Delete the Record */
            delete() {
                t.emit("delete", tag, this.content)
                rmSync(t.find(tag))
                return t
            },
            /** Overwrite the Record's content
             * @param content New content to overwrite with
             */
            overwrite(content) {
                t.emit("overwrite", tag, t.get(tag).content, content)
                writeFileSync(t.find(tag), stringify(content))
                return t.get(tag)
            },
            /** Add content to end of a Record (Not recommend for JSON)
             * @param content Content to append
             * @since 2.2.0
             */
            append(content) {
                t.emit("append", tag, stringify(content))
                appendFileSync(t.find(tag), stringify(content))
                return t.get(tag)
            },
            /** Truncate Record
             * @param {number} length New file length.
             * @since 2.2.0
             */
            truncate(length) {
                t.emit("truncate", tag, length)
                truncateSync(t.find(tag), length)
                return t.get(tag)
            },
            /** Change Record's value (JSON only)
             * @param {string} key JSON Key
             * @param value Key's value
             */
            setValue(key, value) {
                if (t.ext != 'json') {
                    console.error("Use overwrite for your file type")
                    return t.get(tag)
                } else {
                    t.emit("change", tag, key, value)
                    let jsonObj = t.get(tag).content
                    jsonObj[key] = value
                    writeFileSync(t.find(tag), JSON.stringify(jsonObj, null, 2))
                    return t.get(tag)
                }
            },
            /** Change Record's tag
             * @param {string} new_tag The new tag
             */
            setTag(new_tag) {
                t.emit("retagged", tag, new_tag)
                renameSync(t.find(tag), t.find(new_tag))
                return t.get(new_tag)
            },
            /** Move Record to another directory
             * @param {string} dir The directory to move to
             */
            move(dir) {
                if (existsSync(dir)) {
                    t.emit('move', tag, t.dirPath, dir)
                    writeFileSync(`${dir}/${tag}.${t.ext}`, stringify(t.get(tag).content))
                    rmSync(t.find(tag))
                    return new dubnium(dir, t.ext).get(tag)
                }
            },
            /** Clone Record to another directory
             * @param {string} dir The directory to clone to
             */
            clone(dir) {
                t.emit('clone', tag, t.dirPath, dir)
                writeFileSync(`${dir}/${tag}.${t.ext}`, stringify(t.get(tag).content))
                return {
                    original: t.get(tag),
                    new: new dubnium(dir, t.ext).get(tag)
                }
            },
            /** Overwrite a Record with cotent from another Record
             * @param {string} _tag The tag of the Record to get content from
             * @since v2.0.0
             */
            syncWith(_tag) {
                t.emit("synced", tag, _tag)
                return t.get(tag).overwrite(t.get(_tag).content)
            },
            /** Don't allow any functions to be called after.
             * @since v2.0.0
             * @returns nothing
             */
            end() {
                t.emit("end")
            },
            /** Get Record's stats
             * @since v2.0.0
             */
            stats: statSync(t.find(tag)),
            /** Make an alias of a Record
             * @param {string} dirPath The path to create symlink in
             * @since v2.0.0
             */
            createSymlink(dirPath) {
                t.emit("symlink", tag, dirPath)
                symlinkSync(path.join(t.dirPath, `${this.tag}.${t.ext}`), dirPath)
                return t.get(tag)
            },
            /** Search Record content
             * @since v2.1.0
             * @param {string} query Search query
             * @param {string} splitBy String to split the Record's content by. For example, "\n" for lines or " " for spaces.
             */
            search(query, splitBy) {
                let results = []
                if (!query) return null
                const lines = stringify(this.content).split(splitBy || " ")
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].search(query) !== -1) {
                        results.push(lines[i])
                    }
                }
                return {
                    record: t.get(tag),
                    query,
                    results,
                    splitBy
                }
            },
            /** Search keys in a Record (JSON only)
             * @since v2.0.0
             */
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
                return {
                    record: t.get(tag),
                    query,
                    results
                }
            },
            /** Convert the Record's content to string
             * @since v2.0.0
             */
            toString() {
                return stringify(this.content)
            },
            /** Convert the Record's content to an object, if possible
             * @since v2.0.0
             */
            toJSON() {
                return new Object(this.content)
            },
            /** Run any function from `fs`. If you wish to get the return value, access the `returns` property
             * @param {string} Function The function (name) to run
             * @param args The function arguments
             */
            other(Function, ...args) {
                const r = t.get(tag)
                if (!require('fs')[Function]) {
                    throw new TypeError(`fs.${Function} is not a function`)
                }
                const arr = []
                arr.push(t.find(tag))
                args.forEach(e => {
                    arr.push(e)
                })
                t.emit("other", Function, args)
                const f = require('fs')[Function].apply(null, arr)
                r.returns = f
                return r
            },

            /** Run a custom callback function.
             * @since v2.2.2
             */
            custom(callback = (record = this, recordPath = "") => {}) {
                if (typeof callback != 'function') return t.get(tag)
                t.emit("custom", callback)
                callback(this, this.path)
                return t.get(tag)
            }
        }
    }

    /** Don't allow any functions to be called after.
     * @since v2.0.0
     */
    end() {
        this.emit("end")
    }

    /** Run a custom callback function.
     * @since v2.2.2
     */
    custom(callback = (Class = this, dirPath = "") => {}) {
        this.emit("custom", callback)
        if (typeof callback != 'function') return t.get(tag)
        callback(this, this.dirPath)
        return this
    }

    /** Get all Records
     * @param {number} returnType 1: Return as JSON. 2: Return as Array
     */
    getAll(returnType) {
        let array_of_filenames = []
        for (const f of readdirSync(this.dirPath)) {
            if (f != '.DS_Store') {
                if (path.extname(f).toLowerCase().replace(".", '') == this.ext) {
                    array_of_filenames.push(f)
                }
            }
        }

        let obj_of_data

        if (returnType == 1) {
            obj_of_data = {}

            array_of_filenames.forEach(filename => {
                obj_of_data[filename.replace('.' + this.ext, '')] = this.get(path.basename(filename).replace(path.extname(filename), "")).content
            })
        } else if (returnType == 2) {
            obj_of_data = []
            array_of_filenames.forEach(f => {
                obj_of_data.push({
                    tag: path.basename(f).replace(path.extname(f), ""),
                    content: this.get(path.basename(f).replace(path.extname(f), "")).content
                })
            })
        }

        return obj_of_data
    }


    /** Get all Records from a key & value (JSON only)
     * @param {string} key JSON Key
     * @param value The key's value
     * @param {string} returnType 1: Return as JSON. 2: Return as Array
     */
    getFromValue(key, value, returnType) {
        if (this.ext != 'json') return
        let data = returnType == 1 ? {} : []
        this.getAll(2).forEach(d => {
            if (d.content[key] == value) {
                returnType == 1 ? data[d.tag] = this.get(d.tag) : data.push(this.get(d.tag))
            }

        })
        return data
    }

    /** Search Tags
     * @param {string} term Search query
     * @param {string} returnType 1: Return as JSON. 2: Return as Array
     */
    searchTags(term, returnType) {
        const list = []
        for (const f of readdirSync(this.dirPath)) {
            if (f != '.DS_Store') {
                if (path.extname(f).toLowerCase().replace(".", '') == this.ext) {
                    list.push(f.replace(path.extname(f), ''))
                }
            }
        }

        const r = searchArray(list, term)
        let res = []
        if (returnType && returnType == 1) {
            res = {}
            r.forEach(f => {
                res[f] = this.get(f)
            })
        } else {
            res = []
            r.forEach(f => {
                res.push(this.get(f))
            })
        }
        return {
            query: term,
            results: res
        }
    }

    /** Delete Records older than a specified time
     * @param {object} options Time options
     * @param {number} options.ms Milliseconds
     * @param {number} options.seconds Seconds
     * @param {number} options.minutes Minutes
     * @param {number} options.hours Hours
     * @param {number} options.days Days
     */
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
                    this.get(path.basename(filePath).replace(`.${this.ext}`, '')).delete()
                    return
                }
            })
        }
        return this
    }
    /** Deletes Records larger than the specified size
     * @param {object} options Options
     * @since v2.2.0
     */
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
                    this.get(path.basename(filePath).replace(`.${this.ext}`, '')).delete()
                    return
                }
            })
        }
        return this
    }
    /** Delete all Records */
    wipe() {
        if (!existsSync(this.dirPath)) return this
        this.emit('wipe', this.dirPath)
        readdirSync(this.dirPath).forEach(file => {
            if (file.toLowerCase() == 'dubniumconfig.json') return
            rmSync(this.find(file.replace(require("path").extname(file), '')))
        })
        return this
    }
    /** Delete all Records & the directory */
    close() {
        if (!existsSync(this.dirPath)) return this
        this.emit('close', this.dirPath)
        rmSync(this.dirPath, {
            recursive: true
        })
        return this
    }
    /** Make the directory */
    dir() {
        if (!existsSync(this.dirPath)) {
            this.emit('dir', this.dirPath)
            mkdirSync(this.dirPath)
        }
        return this
    }

    plugins = require("./plugins")
}

module.exports = dubnium
module.exports.Dubnium = dubnium


/** Invoke CLI programmatically
 * @since 2.0.0
 */
module.exports.cli = () => {
    require("./cli")
}

/** Create a Record */
module.exports.Record = (options = {
    dir: "./",
    ext: "json",
    tag: "tag",
    content
}) => {
    return new dubnium(options.dir, options.ext).create(options.tag, stringify(options.content))
}

module.exports.Template = class {

    template = {}

    /** Set up a JSON template
     * @param {object} template The template
     * @since 2.0.0
     */
    constructor(template) {
        this.template = template
    }

    /** Use template
     * @param values The values, in order from the template.
     * @since v2.0.1
     */
    use(...values) {
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

/** Manage your plugins */
module.exports.PluginManager = { 
    /** Load plugins config from a file
     * @param file Path to file.
     */
    loadFromFile(file) {
    writeFileSync(`${__dirname}/plugins.js`, readFileSync(file,'utf8'))
    },
    /** Get a list of active plugins */
    activePlugins:require("./plugins")
}
