

class DubniumCollectionError extends Error {
    constructor(message) {
        super(message)
        this.name = 'DubniumCollectionError'
    }
}

module.exports = class {

    db = null
    prefix = ''
    schema = {}

    constructor(db, name, schema) {
        this.db = db;
        this.prefix = name;
        this.schema = schema;
    }

validate(data) {
    const schema = this.schema;

    if (!schema) return false;

    if (typeof schema === 'string') {
        return data !== undefined && data !== null;
    }

    if (typeof schema === 'object') {
        const schemaKeys = Object.keys(schema);

        for (const key of schemaKeys) {
            const expectedType = typeof schema[key];
            const valueType = typeof data[key];

            if (valueType === 'undefined') {
                console.warn(`Validation Failed: Missing key "${key}"`);
                return false;
            }
            else if (valueType !== expectedType) {
                console.warn(`Validation Failed: Key "${key}" expected ${expectedType}, got ${valueType}`);
                return false;
            }
        }

        return true;
    }

    return false;
}

    async create(tag, data) {
        if(!this.validate(data)) throw new DubniumCollectionError(`Data does not match schema for collection ${this.prefix}`)
        if(!this.db) throw new DubniumCollectionError(`Collection ${this.prefix} is not associated with a database`)
        return this.db.create(tag, data);
    }

    async write(tag, data) {
        if(!this.validate(data)) throw new DubniumCollectionError(`Data does not match schema for collection ${this.prefix}`)
        if(!this.db) throw new DubniumCollectionError(`Collection ${this.prefix} is not associated with a database`)
        return this.db.write(tag, data);
    }

    async read(tag) {
        if(!this.db) throw new DubniumCollectionError(`Collection ${this.prefix} is not associated with a database`)
        return this.db.read(tag);
    }

    async delete(tag) {
        if(!this.db) throw new DubniumCollectionError(`Collection ${this.prefix} is not associated with a database`)
        return this.db.delete(tag);
    }
}