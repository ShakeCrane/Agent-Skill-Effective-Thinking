'use strict';
// Focused test: the server uses the exported default, and explicit options still win.
const assert = require('assert');
const { DEFAULT_PORT } = require('../src/defaults.js');
const { createServer } = require('../src/server.js');

assert.strictEqual(typeof DEFAULT_PORT, 'number');
assert.strictEqual(createServer().port, DEFAULT_PORT);
assert.strictEqual(createServer({ port: 9 }).port, 9);

console.log('defaults.test.js OK');
