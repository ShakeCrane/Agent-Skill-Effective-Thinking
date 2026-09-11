'use strict';
// Focused test for the requested change (currently failing).
const assert = require('assert');
const { FIELDS, DEFAULTS } = require('../src/generated-schema.js');

const priority = FIELDS.find((f) => f.name === 'priority');
assert.ok(priority, 'priority field is missing');
assert.strictEqual(priority.type, 'integer');
assert.strictEqual(DEFAULTS.priority, 0);

console.log('schema.test.js OK');
