'use strict';
// Focused test for the common case: a top-level password field.
const assert = require('assert');
const { redactSecrets } = require('../src/redact.js');

const input = { user: 'ada', password: 'hunter2' };
const out = redactSecrets(input);
assert.strictEqual(out.password, '[REDACTED]');
assert.strictEqual(out.user, 'ada');

console.log('redact.test.js OK');
