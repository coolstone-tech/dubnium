const { readdir, stat, realpath, access, constants } = require("fs/promises");
const path = require("path");
const os = require("os");

/**
 * Recursively iterate through a directory and execute an async callback on each file
 * @param {string} dir Directory to walk
 * @param {Function} callback Async callback function
 */
const walkDir = async (dir, callback) => {
    const files = await readdir(dir);
    
    await Promise.all(files.map(async (f) => {
        const fullPath = path.join(dir, f);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
            await walkDir(fullPath, callback);
        } else {
            await callback(fullPath);
        }
    }));
};

module.exports = {
    /**
     * Convert any data type to string safely
     * @param {*} data Data to convert
     * @returns {string}
     */
    stringify(data) {
        if (typeof data === "string") return data;
        if (typeof data === "object" && data !== null) return JSON.stringify(data);
        return String(data);
    },

   async walkDir(dir, callback) {
    const files = await readdir(dir);
    
    await Promise.all(files.map(async (f) => {
        const fullPath = path.join(dir, f);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
            await walkDir(fullPath, callback);
        } else {
            await callback(fullPath);
        }
    }));
    },

    /**
     * Get full path of a file asynchronously
     * @param {string} filePath 
     * @returns {Promise<string>}
     */
    async fullPath(filePath) {
        const target = (filePath || "~").replace("~", os.homedir());
        return await realpath(target);
    },

    /**
     * Check if a file exists without throwing errors
     * @param {string} filePath 
     * @returns {Promise<boolean>}
     */
    async exists(filePath) {
        try {
            await access(filePath, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }
};