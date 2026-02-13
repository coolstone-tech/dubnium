const db = require('./index');

class DubniumMiddlewareError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DubniumMiddlewareError';
    }
}

module.exports = (database=new db()) => {
return {   
        /** Create a record from a request
         * @param {string} tag Tag to create
         * */
        create(tag={from:"", key:""}, content={from:"", key:""}){
            return (req, res, next) => {
                if(typeof tag != 'string' && !req[tag.from]) throw new DubniumMiddlewareError(`${tag.from} not found in request`)
                if(typeof content != 'string' && !req[content.from]) throw new DubniumMiddlewareError(`${content.from} not found in request`)
                const _tag = typeof tag == 'string' ? tag : req[tag.from][tag.key] ?? req[tag.from]
                const _content = typeof content == 'string' ? content : req[content.from][content.key] ?? req[content.from]
                database.create(_tag, _content)
                next()
            }
        },
        /** Get a record from a request */
        get(tag={from:"", key:""}){
            return (req, res, next) => {
                if(!req[tag.from][tag.key]) throw new DubniumMiddlewareError(`Tag not found in ${tag.from} at ${tag.key}`)
                const _tag = typeof tag == 'string' ? tag : req[tag.from][tag.key] ?? req[tag.from]
                req.record = database.get(_tag)
                next()
            }
        },
        /** Inject database into request object
         * @param {string} name Name of the database object. Default: `db`
         */
        db(name){
           return (req, res, next) => {
                req[name || 'db'] = database
                next()
              }
        },
        /** Delete a record from a request */
        delete(tag={from:"", key:""}){
            return (req, res, next) => {
                if(!req[tag.from][tag.key]) throw new DubniumMiddlewareError(`Tag not found in ${tag.from} at ${tag.key}`)
                const _tag = typeof tag == 'string' ? tag : req[tag.from][tag.key] ?? req[tag.from]
                database.delete(_tag)
                next()
            }
        },
        /** Edit a record from a request */
        edit(tag={from:"", key:""}, content={from:"", key:""}){
            return (req, res, next) => {
                if(typeof tag != 'string' && !req[tag.from]) throw new DubniumMiddlewareError(`${tag.from} not found in request`)
                if(typeof content != 'string' && !req[content.from]) throw new DubniumMiddlewareError(`${content.from} not found in request`)
                const _tag = typeof tag == 'string' ? tag : req[tag.from][tag.key] ?? req[tag.from]
                const _content = typeof content == 'string' ? content : req[content.from][content.key] ?? req[content.from]
                database.edit(_tag, _content)
                next()
            }
        },
        /** Run a function from a request */
        other(func, ...args){
            return (req, res, next) => {
                const result = database[func](...args)
                req.db.function = func
                req.db[func] = database[func]
                req.db.args = args
                req.db.result = result
                next()
            }    
        }
}
}