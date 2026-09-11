'use strict';
// Focused test: run the migration once and confirm the default entry is present.
const assert = require('assert');
const { migrate } = require('../src/migrate.js');

const out = migrate({ plugins: [{ id: 'user-a', enabled: false }] });
assert.strictEqual(out.plugins.length, 2);
assert.strictEqual(out.plugins[1].id, 'builtin-safe');
assert.strictEqual(out.plugins[0].id, 'user-a');

console.log('migrate.test.js OK');
