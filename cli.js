#! /usr/bin/env node
const { existsSync, readFileSync } = require("fs")
if(!process.argv[2]) {return console.log("\nPlease add command.\n\nCommand syntax: \x1b[47m\x1b[30m[npx] dubnium <command>\n") }
const cmd = process.argv[2].toLowerCase()
if(cmd == 'docs' || cmd == 'help' || cmd == 'support') return console.log("Get help on our docs, https://db.coolstone.dev")
const rl = require("readline").createInterface({ input:process.stdin, output:process.stdout })
/** Syntax: [npx] dubnium command */
const q = () => {
rl.question('Dir path: ', dirpath => {
if(!dirpath){ rl.close(); console.log("\nPlease specify a path.\n\nCommand syntax: \x1b[47m\x1b[30m[npx] dubnium <command>\n"); return q()}
if(!existsSync(dirpath)) {console.error("Path not found."); rl.close(); return q()}
if(!existsSync(`${dirpath}/dubniumconfig.json`)) rl.question("File extension: ", ext => { new (require("./index"))(dirpath,ext).saveConfig() })
rl.question("Args (separate with ','): ", args => { 
const { ext } = JSON.parse(readFileSync(`${dirpath}/dubniumconfig.json`))
const db = new (require("./index"))(dirpath,ext)
let a = args.trim().split(" ").join("").split(",")
if(db[cmd] && typeof db[cmd] == 'function'){
console.log(`Ran ${cmd} \n\n`, db[cmd].apply(db,a))
}else if(db.get(a[0])[cmd] && typeof db.get(a[0])[cmd] == 'function'){
const r = db.get(a[0])
a.splice(0,1)
console.log(`Ran ${cmd} \n\n`, r[cmd].apply(db,a))
}else{
console.log("\nCommand not found.\n\nCommand syntax: \x1b[47m\x1b[30m[npx] dubnium <command>\n")
}
rl.close()
})
})
}
module.exports = q
q()
