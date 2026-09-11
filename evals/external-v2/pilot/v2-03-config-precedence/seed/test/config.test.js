'use strict';
// Focused test for one simple override: a CLI value that is not also set elsewhere.
const assert = require('assert');
const { loadConfig } = require('../src/config.js');

const cfg = loadConfig({ cli: { timeout: 5 }, env: {}, file: {} });
assert.strictEqual(cfg.timeout, 5);

console.log('config.test.js OK');
