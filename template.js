const DubniumTemplateError = class extends Error {
    constructor(message) {
        super(message)
        this.name = 'DubniumTemplateError'
    }
}

const Template = class {
    template = {}
    constructor(template){
        this.template = template
        if(!typeof template == 'string' && !typeof template == 'object') throw new DubniumTemplateError(`Invalid template type`)
    }

    /** Use the template */
    use(...values){
    if (typeof this.template == 'string'){
        let r = this.template
        values.forEach((val, index) => {
        r = r.split(`{${index}}`).join(val)
        })
        return r
    }else if(typeof this.template == 'object'){
        let n = 0
        const r = this.template
        values.forEach(val => {
            if (n > r.length) return
            let key = Object.keys(this.template)[n]
            if (typeof val != typeof r[key]) console.warn(`Changed type of ${Object.keys(this.template)[n]} to ${typeof val}`)
            if(r[key] == 'required' && !val) throw new DubniumTemplateError(`Missing required value ${key}`)
            r[key] = val
            n++
        })
        return r
    }else{
        throw new DubniumTemplateError(`Invalid template type. Must be string or object Got ${typeof this.template}`)
    }
}
}


module.exports = Template