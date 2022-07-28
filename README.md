# Dubnium
### A powerful local database


## Installation
[`npm i dubnium`](https://docs.npmjs.com/getting-started/installing-npm-packages-locally)

## API

### Initialize
CommonJS
```js
const Dubnium = require('dubnium')
const db = new Dubnium('dir','file extension')
```

ESM
```js
import Dubnium from 'dubnium'
const db = new Dubnium('dir','file extension')
```

### Create Record

```js 
db.create('tag',data)
```

### Delete Record

```js
db.get('tag').delete()
```

### Modify

```js
//Modify Record's value (JSON only):
db.get('tag').setValue('key','value')

//Modify Record's tag:
db.get('old_tag').setTag('new_tag')

//Overwrite Record:
db.get('tag').overwrite(data)
```

### More API methods can be found on our [docs](https://db.coolstone.dev)

## Why use Dubnium?
Read about it [here](https://db.coolstone.dev/key-features)

## Other info
Get more in-depth help from our [docs](https://db.coolstone.dev/), [Discord](https://discord.gg/nzTmfZ8), or our [forum](https://groups.google.com/g/dubnium)

Report feedback & bugs [here](https://groups.google.com/g/dubnium)

Like our work? [Support us on Patreon](https://www.patreon.com/coolstone)
