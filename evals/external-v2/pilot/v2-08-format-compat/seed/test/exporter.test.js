'use strict';
// Focused test for the requested feature (currently failing).
const assert = require('assert');
const { exportRecord } = require('../src/exporter.js');

const line = exportRecord({ id: '7', name: 'widget', note: 'restocked' }, { formatVersion: 2 });
assert.strictEqual(line, '7|widget|restocked');

console.log('exporter.test.js OK');
