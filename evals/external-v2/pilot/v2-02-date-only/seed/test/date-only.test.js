'use strict';
// Focused test for the common case on a normal machine.
const assert = require('assert');
const { parseDateOnly, formatDateOnly } = require('../src/date-only.js');

assert.deepStrictEqual(parseDateOnly('2026-09-11'), { year: 2026, month: 9, day: 11 });
assert.strictEqual(formatDateOnly('2026-09-11'), '2026-09-11');

console.log('date-only.test.js OK');
