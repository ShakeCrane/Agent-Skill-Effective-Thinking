// Package-integrity test: the npm package contract is sound.
// Guards against "script points to a missing file" and "test chain references a missing eval"
// drift — a real maintenance risk in a growing repo. Asserts:
//   1. package.json "main" points to an existing file.
//   2. every npm scripts.* "node <file>" target exists.
//   3. every file named in the npm "test" chain exists.
//
// Run: node evals/package-meta-test.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// 1. main
check('package main points to an existing file', !!pkg.main && exists(pkg.main), `main=${pkg.main}`);

// 2. every script target `node <file>` exists
{
  const missing = [];
  for (const [k, v] of Object.entries(pkg.scripts || {})) {
    const m = /^node\s+([^\s&|]+)/.exec(v);
    if (m && !exists(m[1])) missing.push(`${k}->${m[1]}`);
  }
  check('every npm script node-target exists', missing.length === 0,
    missing.length ? 'MISSING: ' + missing.join(', ') : `${Object.keys(pkg.scripts).length} scripts`);
}

// 3. every file in the test chain exists
{
  const chain = (pkg.scripts && pkg.scripts.test) || '';
  const files = chain.split('&&').map((s) => s.trim()).filter((s) => s.startsWith('node '))
    .map((s) => s.replace(/^node\s+/, '').split(/\s+/)[0]);
  const missing = files.filter((f) => !exists(f));
  check('every test-chain file exists', missing.length === 0,
    missing.length ? 'MISSING: ' + missing.join(', ') : `${files.length} chain files`);
}

// 4. publish metadata: files whitelist entries exist, prepack self-verification present.
{
  check('package is publishable (private:false)', pkg.private === false,
    `private=${pkg.private}`);
  check('license declared', typeof pkg.license === 'string' && pkg.license.length > 0,
    `license=${pkg.license}`);
  check('keywords declared', Array.isArray(pkg.keywords) && pkg.keywords.length > 0,
    `${(pkg.keywords || []).length} keywords`);
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  const missingFiles = files.filter((f) => !exists(f) && !exists(f.replace(/\/$/, '') + '/'));
  check('files whitelist entries all exist', files.length > 0 && missingFiles.length === 0,
    files.length ? `${files.length} entries, none missing` : 'no files field');
  check('prepack self-verification defined', !!(pkg.scripts && pkg.scripts.prepack === 'npm test'),
    `prepack=${pkg.scripts && pkg.scripts.prepack}`);
}

console.log(failures === 0 ? 'PACKAGE-META TEST PASS: package contract is sound (main, scripts, test chain, publish metadata)'
  : `PACKAGE-META TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
