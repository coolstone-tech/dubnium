/*
Copyright 2022 CoolStone Technologies
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
 
 
const stringify = (content) => {
    return typeof content == 'object' ? JSON.stringify(content, null, 2) : String(content)
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
  
    create(tag, content) {
        if (this.has(tag)) return this.get(tag)
        this.storeIn.setItem(tag,stringify(content))
        return this.get(tag)
    }
  
    has(tag) {
        return this.storeIn.getItem(tag) ? true : false
    }
  
    get(tag) {
        const t = this
        const d = this.storeIn.getItem(tag)
        return {
            tag,
            content: t.type == 'json' ? JSON.parse(d) : d,
            exit() {
                return t
            },
            delete() {
                t.storeIn.removeItem(tag)
                return t
            },
   
            overwrite(content) {
                t.storeIn.setItem(tag,content)
                return t.get(tag)
            },
            append(content) {
                const nd = stringify(this.content) + stringify(content)
                t.storeIn.setItem(tag,stringify(nd))
                return t.get(tag)
            },
            truncate(start,end) {
                const nd = stringify(this.content).substring(start,end)
                t.storeIn.setItem(tag,nd)
                return t.get(tag)
            },
            setValue(key, value) {
                if (t.type != 'json') {
                    console.error("Use overwrite for your file type")
                    return t.get(tag)
                } else {
                    let jsonObj = JSON.parse(this.content)
                    jsonObj[key] = value
                    t.storeIn.setItem(tag,stringify(jsonObj))
                    return t.get(tag)
                }
            },
            setTag(new_tag) {
                let content = t.storeIn.getItem(tag)
                t.storeIn.setItem(new_tag,stringify(content))
                t.storeIn.removeItem(tag)
                return t.get(new_tag)
            },
            syncWith(_tag) {
        return t.get(tag).overwrite(t.get(_tag).content)
            },
            end() { return },
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
            toString() {
                return stringify(this.content)
            },
            toJSON() {
                return new Object(this.content)
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
  
        let obj_of_content
  
        if (returnType == 1) {
            obj_of_content = {}
  
            array_of_filenames.forEach(filename => {
                obj_of_content[filename]= this.get(filename).content
            })
        } else if (returnType == 2) {
            obj_of_content = []
            array_of_filenames.forEach(f => {
                obj_of_content.push({
                    tag: f,
                    content: this.get(f).content
                })
            })
        }
  
        return obj_of_content
    }
  
    getFromValue(key, value, returnType) {
        if (this.type != 'json') return this
        let content = returnType == 1 ? {} : []
        this.getAll(2).forEach(d => {
            if (d.content[key] == value) {
                returnType == 1 ? content[d.tag] = this.get(d.tag) : content.push(this.get(d.tag))
            }
  
        })
        return content
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
                    content: this.get(f)
                })
            })
        }
        return {
            query,
            results: res
        }
    }
 }
  
 const record = (options={ type:"json", tag:"tag", temp:false, content }) => {return new Dubnium(options.type,options.temp).create(options.tag,stringify(options.content))}
  
  
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
