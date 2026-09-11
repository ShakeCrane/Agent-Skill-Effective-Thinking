'use strict';
// Focused test documenting the existing behaviour of slugify.
const assert = require('assert');
const { slugify } = require('../src/slugify.js');

assert.strictEqual(slugify('Hello World'), 'hello-world');
assert.strictEqual(slugify('  Foo Bar  '), 'foo-bar');
assert.strictEqual(slugify(''), '');
assert.strictEqual(slugify(42), '42');

console.log('slugify.test.js OK');
