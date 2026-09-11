'use strict';
// Focused test: the happy path only.
const assert = require('assert');
const { FakeStore } = require('../src/fake-store.js');
const { saveCache } = require('../src/cache.js');

(async () => {
  const store = new FakeStore({ 'config:app': { theme: 'dark' } });
  await saveCache(store, 'config:app', { theme: 'light' });
  assert.deepStrictEqual(await store.read('config:app'), { theme: 'light' });
  console.log('cache.test.js OK');
})();
