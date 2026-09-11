'use strict';
// Focused test for the documented inclusive boundaries.
const assert = require('assert');
const { isWithin } = require('../src/range.js');

assert.strictEqual(isWithin(5, 5, 10), true, 'min boundary must be included');
assert.strictEqual(isWithin(10, 5, 10), true, 'max boundary must be included');

console.log('range.test.js OK');
