#! /usr/bin/env node
// Syntax: [npx] dubnium <command>
if(!process.argv[2]) {return console.log("\nPlease add command.\n\nCommand syntax: \x1b[47m\x1b[30m[npx] dubnium <command>\n") }
const cmd = process.argv[2].toLowerCase()
if(cmd == 'docs' || cmd == 'help' || cmd == 'support') return console.log("Get help on our docs, https://db.coolstone.dev")
const rl = require("readline").createInterface({ input:process.stdin, output:process.stdout })
const q = () => {
rl.question('Dir path: ', dirpath => {
if(!dirpath){ rl.close();console.log("\nPlease specify a path.\n\nCommand syntax: \x1b[47m\x1b[30m[npx] dubnium <command>\n"); return}
rl.question("File extension: ", ext => {
rl.question("Args (separate with ','): ", args => {
const db = new (require("./index"))(dirpath,ext)
let a = args.split(",")
if(db[cmd] && typeof db[cmd] == 'function'){
console.log(`Ran ${cmd} \n\n`, db[cmd](a[0],a[1],a[2],args[3]))
}else if(db.get(a[0])[cmd] && typeof db.get(a[0])[cmd] == 'function'){
console.log(`Ran ${cmd} \n\n`, db.get(a[0])[cmd](a[1],a[2],a[3],a[4]))
}else{
console.log("\nCommand not found.\n\nCommand syntax: \x1b[47m\x1b[30m[npx] dubnium <command>\n")
}
rl.close()
})
})
})
}
module.exports = q
q()
