'use strict';
// Focused test: the offline build produces a bundle containing the banner from src/banner.js.
const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-offline.js')], { cwd: root, stdio: 'ignore' });
assert.strictEqual(r.status, 0, 'offline build failed');
const bundle = fs.readFileSync(path.join(root, 'dist', 'bundle.js'), 'utf8');
const { BANNER } = require('../src/banner.js');
assert.ok(bundle.includes(BANNER), 'bundle does not contain the banner');

console.log('banner.test.js OK');
