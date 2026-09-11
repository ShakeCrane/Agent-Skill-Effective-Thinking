'use strict';
// Focused test: sequential increments only.
const assert = require('assert');
const { Counter } = require('../src/counter.js');

(async () => {
  const counter = new Counter();
  await counter.increment('hits');
  await counter.increment('hits');
  await counter.increment('hits');
  assert.strictEqual(counter.get('hits'), 3);
  console.log('counter.test.js OK');
})();
