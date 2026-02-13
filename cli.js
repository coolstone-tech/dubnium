#! /usr/bin/env node
const path = require('path');
const { readFile } = require('fs/promises');
const functions = require('./functions');
const Dubnium = require('./index');

const rl = require("readline").createInterface({ 
    input: process.stdin, 
    output: process.stdout 
});

const question = (str) => new Promise(resolve => rl.question(str, resolve));

async function runCLI() {
    const cmd = process.argv[2]?.toLowerCase();

    if (!cmd) {
        console.log("\nUsage: dubnium <command>");
        process.exit(0);
    }

    if (['docs', 'help', 'support'].includes(cmd)) {
        console.log("Get help: https://db.coolstone.dev");
        process.exit(0);
    }

    try {
        const dirpath = await question('Dir path: ');
        if (!dirpath || !(await functions.exists(dirpath))) {
            console.error("Invalid path.");
            return runCLI();
        }

        let config = { ext: 'json' };
        const configPath = path.join(dirpath, '.dubnium', 'config.json');
        
        if (await functions.exists(configPath)) {
            config = JSON.parse(await readFile(configPath, 'utf-8'));
        } else {
            const ext = await question('File extension (json/txt): ');
            config.ext = ext || 'json';
        }

        const db = new Dubnium(dirpath, config);
        const rawArgs = await question("Args (separate with ','): ");
        const args = rawArgs.split(',').map(a => a.trim());

        if (typeof db[cmd] === 'function') {
            const result = await db[cmd](...args);
            console.log(`\nResult:\n`, result);
        } else {
            const record = db.get(args[0]);
            const recordArgs = args.slice(1);
            
            if (typeof record[cmd] === 'function') {
                const result = await record[cmd](...recordArgs);
                console.log(`\nResult:\n`, result);
            } else {
                console.log("\nCommand not found.");
            }
        }
    } catch (err) {
        console.error(`\nError: ${err.message}`);
    } finally {
        rl.close();
    }
}

runCLI();