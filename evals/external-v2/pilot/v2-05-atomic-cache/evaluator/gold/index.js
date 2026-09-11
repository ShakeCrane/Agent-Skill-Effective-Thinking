'use strict';
// GOLD: write a temp entry, atomically replace it onto the target, always clean the temp up.
const fs = require('fs');
const path = require('path');

const GOLD = `'use strict';

async function saveCache(store, key, value) {
  const tmpKey = key + '.tmp';
  await store.writeTemp(tmpKey, value);
  try {
    await store.replace(tmpKey, key);
  } catch (err) {
    // The replace failed: the target still holds the previous value. Drop the scratch entry.
    await store.remove(tmpKey);
    throw err;
  }
  // replace() consumed the temp entry on success; make cleanup idempotent anyway.
  await store.remove(tmpKey);
}

module.exports = { saveCache };
`;

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'cache.js'), GOLD);
}

module.exports = { apply };
