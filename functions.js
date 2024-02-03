const { readdirSync, statSync, realpathSync } = require("fs")
const path = require("path")

/**
* Iterate through a directory and execute a callback function on each file
* @param {*} dir Directory to walk
* @param {*} callback Callback function
* @returns {void}
*/
const walkDir = (dir, callback) => {
   return readdirSync(dir).forEach(f => {
       statSync(path.join(dir, f)).isDirectory() ? walkDir(path.join(dir, f), callback) : callback(path.join(dir, f))
   })
}

module.exports = {

    /**
     * Convert any data type to string
     * @param {*} data Data to convert to string
     * @returns {string} Stringified data
     */
    stringify(data) {
        if (typeof data == "string") return data
        else if (typeof data == "object") return JSON.stringify(data)
        else {
            return String(data)
        }
    },

    walkDir,

  /**
   * Search an array for a value
   * @param {*} arr Array to search
   * @param {*} val Value to search for
   * @returns {Array} Array of matches
   */
    searchArray(arr = [], val = "") {
        return arr.filter(el => {
            return el.match(new RegExp(val, 'gi'))
        })
    },

    /**
     * Get full path of a file
     * @param {*} file_path File path to get full path of
     * @returns {string} Full path
     */
    fullPath(file_path) {
        return realpathSync((file_path ? file_path : "~").replace("~", require("os").homedir()))
    }
}

    fullPath(file_path) {
        return realpathSync((file_path ? file_path : "~").replace("~", require("os").homedir()))
    }

}
