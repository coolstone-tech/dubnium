const { readdirSync, statSync, realpathSync } = require("fs")
const path = require("path")

module.exports = {

    stringify(data) {
        if (typeof data == "string") return data
        else if (typeof data == "object") return JSON.stringify(data)
        else {
            return String(data)
        }
    },

    walkDir(dir, callback) {
        return readdirSync(dir).forEach(f => {
            statSync(path.join(dir, f)).isDirectory() ? walkDir(path.join(dir, f), callback) : callback(path.join(dir, f))
        })
    },

    searchArray(arr = [], val = "") {
        return arr.filter(el => {
            return el.match(new RegExp(val, 'gi'))
        })
    },

    fullPath(file_path) {
        return realpathSync((file_path ? file_path : "~").replace("~", require("os").homedir()))
    }

}