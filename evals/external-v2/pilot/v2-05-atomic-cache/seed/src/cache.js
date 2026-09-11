'use strict';

async function saveCache(store, key, value) {
  await store.write(key, value);
}

module.exports = { saveCache };
