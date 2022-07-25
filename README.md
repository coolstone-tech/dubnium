# Dubnium
### A powerful local database


## Installation
[`npm i dubnium`](https://docs.npmjs.com/getting-started/installing-npm-packages-locally)

## API

Initialize
```js
const DataManager = require('dubnium')
const db = new DataManager('dir','file extension')
/*db.dir() // if you want Dubnium to create a folder for you*/
```

Create Record

```js 
db.create('tag',data)
```

 Delete Record

```js
db.get('tag').delete()
```

  Modify

```js
//Modify Record's value (JSON only):
db.get('tag').setValue('key','value')

//Modify Record's tag:
db.get('old_tag').setTag('new_tag')

//Overwrite Record:
db.get('tag').overwrite(data)
```

## Why use Dubnium?
Read about it [here](https://db.coolstone.dev/key-features)

## Other info
Get more in-depth help from our [docs](https://db.coolstone.dev/), [Discord](https://discord.gg/nzTmfZ8), or our [forum](https://groups.google.com/g/dubnium)

Report feedback & bugs [here](https://forms.gle/s7Wi4pZqNbZG72mU7)

Like our work? [Support us on Patreon](https://www.patreon.com/coolstone)
