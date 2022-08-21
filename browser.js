/*
Copyright 2022 CoolStone Technologies
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


const stringify = (data) => {
    return typeof data == 'object' ? JSON.stringify(data, null, 2) : String(data)
}

const searchArray = (arr, val) => {
    return arr.filter(el => {
        return el.match(new RegExp(val, 'gi'))
    })
}


class Dubnium {
    type = ''
    storeIn = localStorage
    constructor(type,temp) {
        this.type = type ? type : 'text'
        this.storeIn = temp ? sessionStorage : localStorage
    }

    create(tag, data) {
        if (this.exists(tag)) return this.get(tag)
        this.storeIn.setItem(tag,stringify(data))
        return this.get(tag)
    }

    exists(tag) {
        return this.storeIn.getItem(tag) ? true : false
    }

    get(tag) {
        const t = this
        const d = this.storeIn.getItem(tag)
        return {
            tag,
            data: t.type == 'json' ? JSON.parse(d) : d,
            exit() {
                return t
            },
            delete() {
                t.storeIn.removeItem(tag)
                return t
            },
    
            overwrite(data) {
                t.storeIn.setItem(tag,data)
                return t.get(tag)
            },
            append(data) {
                const nd = stringify(this.data) + stringify(data)
                t.storeIn.setItem(tag,stringify(nd))
                return t.get(tag)
            },
            truncate(start,end) {
                const nd = stringify(this.data).substring(start,end)
                t.storeIn.setItem(tag,nd)
                return t.get(tag)
            },
            setValue(key, value) {
                if (t.type != 'json') {
                    console.error("Use overwrite for your file type")
                    return t.get(tag)
                } else {
                    let jsonObj = JSON.parse(this.data)
                    jsonObj[key] = value
                    t.storeIn.setItem(tag,stringify(jsonObj))
                    return t.get(tag)
                }
            },
            setTag(new_tag) {
                let data = t.storeIn.getItem(tag)
                t.storeIn.setItem(new_tag,stringify(data))
                t.storeIn.removeItem(tag)
                return t.get(new_tag)
            },
            syncWith(_tag) {
        return t.get(tag).overwrite(t.get(_tag).data)
            },
            end() { return },
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
            toString() {
                return stringify(this.data)
            },
            toJSON() {
                return new Object(this.data)
            },
            custom(callback = (record=this) => {}) {
                if (typeof callback != 'function') return t.get(tag)
                callback(this)
                return t.get(tag)
            }
        }
    }
    end() { return }

    custom(callback = (db=new dubnium()) => {}) {
        if (typeof callback != 'function') return t.get(tag)
        callback(this)
        return this
    }


    getAll(returnType) {
        let array_of_filenames = []
        for (let i = 0; i < this.storeIn.length; i++){
            array_of_filenames.push(this.storeIn.key(i))
        }

        let obj_of_data

        if (returnType == 1) {
            obj_of_data = {}

            array_of_filenames.forEach(filename => {
                obj_of_data[filename]= this.get(filename).data
            })
        } else if (returnType == 2) {
            obj_of_data = []
            array_of_filenames.forEach(f => {
                obj_of_data.push({
                    tag: f,
                    data: this.get(f).data
                })
            })
        }

        return obj_of_data
    }

    getFromValue(key, value, returnType) {
        if (this.type != 'json') return this
        let data = returnType == 1 ? {} : []
        this.getAll(2).forEach(d => {
            if (d.data[key] == value) {
                returnType == 1 ? data[d.tag] = this.get(d.tag) : data.push(this.get(d.tag))
            }

        })
        return data
    }
    searchTags(query, returnType) {
        const list = []
        for (let i = 0; i < this.storeIn.length; i++){
            list.push(this.storeIn.key(i))
        }


        const r = searchArray(list, query)
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
            query,
            results: res
        }
    }
}

const record = () => {
    (options={ type:"json", tag:"tag", temp:false, data }) => {return new dubnium(options.type,options.temp).create(options.tag,stringify(options.data))}

}

class Template {
    template = {}
    constructor(template) {
        this.template = template
    }
    use(...values) {
        let n = 0
        let r = new Object(this.template)
        values.forEach(val => {
        if(n > r.length) return
        let key = Object.keys(this.template)[n]
        if(typeof val != typeof r[key]) console.warn(`Changed type of ${Object.keys(this.template)[n]} to ${typeof val}`)
        r[key] = val
        n++
        })
        return r
    }
}