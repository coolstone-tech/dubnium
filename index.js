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
    unwatchFile,
    watchFile,
    symlink,
    appendFileSync,
    truncateSync
} = require('fs')

const path = require('path')

const stringify = (data) => {
    return typeof data == 'object' ? JSON.stringify(data, null, 2) : String(data)
}
const walkDir = (dir, callback) => {
    readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f)
        let isDirectory = statSync(dirPath).isDirectory()
        isDirectory ? this.walkDir(dirPath, callback) : callback(path.join(dir, f))
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
        this.emit('start', dirPath, ext)
        if (!ext) {
            this.ext = 'json'
        } else {
            this.ext = ext.toLowerCase().trim()
        }
    }

    /** Get the path to a Record
     * @since v2.2.1
     */
    find(tag = "") {
        return `${this.dirPath}/${tag}.${this.ext}`
    }

    /** Make a new Record
     * @param {string} tag The Record's tag
     * @param data Record's data
     * @param {function?} callback
     * @param {object?} options writeFile options
     */
    create(tag, data, callback, options) {
        if (this.exists(tag)) return this.get(tag)
        this.emit("create", tag, stringify(data))
        writeFileSync(this.find(tag), stringify(data), options)
        if (callback) callback(this.get(tag))
        return this.get(tag)
    }

    /** Check if Record exists
     * @param {string} tag The Record's tag
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
            tag,
            data: t.ext == 'json' ? JSON.parse(d) : d,
            path: t.find(tag),
            size: statSync(t.find(tag)).size,
            /** Exit the Record editor API
             * @since v2.2.0
             */
            exit() {
                return t
            },
            /** Delete the Record */
            delete() {
                t.emit("delete", tag, this.data)
                rmSync(t.find(tag))
                return t
            },
            /** Overwrite the Record's content
             * @param data Record's data
             */
            overwrite(data) {
                t.emit("overwrite", tag, t.get(tag).data, data)
                writeFileSync(t.find(tag), stringify(data))
                return t.get(tag)
            },
            /** Add data to end of a Record (Not recommend for JSON)
             * @param data Data to append
             * @param {object?} options appendFile options
             * @since 2.2.0
             */
            append(data, options) {
                t.emit("append", tag, stringify(data))
                appendFileSync(t.find(tag), stringify(data), options)
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
                    console.error("Use overwrite for your file type");
                    return t.get(tag)
                } else {
                    t.emit("change", tag, key, value)

                    let jsonObj = t.get(tag).data

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
                    writeFileSync(`${dir}/${tag}.${t.ext}`, stringify(t.get(tag).data))
                    rmSync(t.find(tag))
                    return new dubnium(dir, t.ext).get(tag)
                }
            },
            /** Clone Record to another directory
             * @param {string} dir The directory to clone to
             */
            clone(dir) {
                t.emit('clone', tag, t.dirPath, dir)
                writeFileSync(`${dir}/${tag}.${t.ext}`, stringify(t.get(tag).data))
                return new dubnium(dir, t.ext).get(tag)
            },
            /** Overwrite a Record with data from another Record
             * @param {string} _tag The tag of the Record to get data from
             * @since v2.0.0
             */
            syncWith(_tag) {
                t.emit("synced", tag, _tag)
                return t.get(tag).overwrite(t.get(_tag).data)
            },
            /** Don't allow any functions to be called after.
             * @since v2.0.0
             * @returns nothing
             */
            end() {
                t.emit("end")
            },
            /** Run a function when a file is accessed
             * @param {function} listener Callback to run on accessed
             * @since v2.0.0
             */
            watch(listener) {
                watchFile(t.find(tag), {}, listener)
                return t.get(tag)
            },
            /** Stop watching
             * @param {function} listener
             * @since v2.0.0
             */
            unwatch(listener) {
                unwatchFile(t.find(tag), listener)
                return t.get(tag)
            },
            /** Get Record's stats
             * @since v2.0.0
             */
            stats() {
                return statSync(t.find(tag))
            },
            /** Make an alias of a Record
             * @param {string} dirPath The path to create symlink in
             * @param {function} callback Callback
             * @since v2.0.0
             */
            createSymlink(dirPath, callback) {
                t.emit("symlink", tag, dirPath)
                symlink(path.join(t.dirPath, `${this.tag}.${t.ext}`), dirPath, callback)
                return t.get(tag)
            },
            /** Search Record content
             * @since v2.1.0
             * @param {string} query Search query
             * @param {string} splitBy String to split the Record's data by. For example, "\n" for lines or " " for spaces.
             */
            search(query, splitBy) {
                let results = []
                if (!query) return null
                const lines = stringify(this.data).split(splitBy || " ")
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
                const obj = t.get(tag).data
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
            /** Convert the Record's data to string
             * @since v2.0.0
             */
            toString() {
                return stringify(this.data)
            },
            /** Convert the Record's data to an object, if possible
             * @since v2.0.0
             */
            toJSON() {
                return new Object(this.data)
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
                t.emit("other",Function,args)
                const f = require('fs')[Function].apply(null, arr)
                r.returns = f
                return r
            },

            /** Run a custom callback function.
             * @since v2.2.2
             */
            custom(callback = (record, recordPath) => {}) {
                if (typeof callback != 'function') return t.get(tag)
                t.emit("custom",callback)
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
    custom(callback = (Class, dirPath) => {}) {
        this.emit("custom",callback)
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
                obj_of_data[filename.replace('.' + this.ext, '')] = this.get(path.basename(filename).replace(path.extname(filename), "")).data
            })
        } else if (returnType == 2) {
            obj_of_data = []
            array_of_filenames.forEach(f => {
                obj_of_data.push({
                    tag: path.basename(f).replace(path.extname(f), ""),
                    data: this.get(path.basename(f).replace(path.extname(f), "")).data
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
            if (d.data[key] == value) {
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
                res.push({
                    tag: f,
                    data: this.get(f)
                })
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
            this.emit("delete_old", ms)
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
    /** Deletes Records larger than the specified size, in bytes
     * @param {number} maxBytes Delete Records larger than this (in bytes)
     * @since v2.2.0
     */
    deleteLarge(maxBytes) {
        if (maxBytes) {
            this.emit("delete_large", maxBytes)
            walkDir(this.dirPath, (filePath) => {
                const stat = statSync(filePath)
                if (stat.size > maxBytes) {
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
        rmSync(this.dirPath, {
            recursive: true
        })
        mkdirSync(this.dirPath)
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
}

module.exports = dubnium
module.exports.Dubnium = dubnium


/** Invoke CLI programmatically
 * @since 2.0.0
 */
module.exports.cli = () => {
    require("./cli")
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
        const t = this.template
        for (const e in this.template) {
            if (typeof arguments[n] != typeof t[e]) console.warn(`Changed type of ${Object.keys(t).find(key => t[key] == t[e])} to ${typeof arguments[n]} [Arg #${n}]`)
            if (arguments[n]) t[e] = arguments[n]
            n++
        }
        return t
    }

}
