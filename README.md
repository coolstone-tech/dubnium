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

ECMAScript
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
// Modify Record's data:
db.get('tag').edit(data)

// Modify Record's tag:
db.get('old_tag').setTag('new_tag')
```

### More API methods can be found on our [docs](https://db.coolstone.dev)

## Why use Dubnium?
Read about it [here](https://db.coolstone.dev/key-features)

## Other info
Get more in-depth help from our [docs](https://db.coolstone.dev/), [Discord](https://discord.gg/nzTmfZ8), or ask a question on [GitHub](https://github.com/coolstone-tech/dubnium/discussions)

Report feedback & bugs [here](https://github.com/coolstone-tech/dubnium/issues)

Like our work? [Support us on Patreon](https://www.patreon.com/coolstone)
