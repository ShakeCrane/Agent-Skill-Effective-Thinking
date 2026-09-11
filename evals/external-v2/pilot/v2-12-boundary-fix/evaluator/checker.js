'use strict';
// Deterministic acceptance checker for v2-12 (cheap-verification negative control).
const path = require('path');
const fs = require('fs');
const { walk, sha256, exists } = require('../../../scripts/lib.js');

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });
const FIXED_FILES = ['src/format.js', 'RANGE.md'];

function load(ws) {
  const p = path.join(ws, 'src', 'range.js');
  if (!fs.existsSync(p)) throw new Error('src/range.js is missing');
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  if (!mod || typeof mod.isWithin !== 'function') throw new Error('isWithin is not exported as a function');
  return mod.isWithin;
}

async function check(ws, ctx) {
  const criteria = [];
  const isWithin = load(ws);
  const seed = ctx.seedDir;

  criteria.push(C('V2-12-C1', isWithin(5, 5, 10) === true, `isWithin(5,5,10)=${isWithin(5, 5, 10)}`));
  criteria.push(C('V2-12-C2', isWithin(10, 5, 10) === true, `isWithin(10,5,10)=${isWithin(10, 5, 10)}`));
  criteria.push(C('V2-12-C3', isWithin(7, 5, 10) === true && isWithin(5.0001, 5, 10) === true, 'middle values'));
  criteria.push(C('V2-12-C4',
    isWithin(4.9999, 5, 10) === false && isWithin(10.0001, 5, 10) === false,
    `below=${isWithin(4.9999, 5, 10)} above=${isWithin(10.0001, 5, 10)}`));

  const changed = FIXED_FILES.filter((rel) => {
    const wsPath = path.join(ws, rel);
    const seedPath = path.join(seed, rel);
    if (!exists(seedPath)) return false;
    if (!exists(wsPath)) return true;
    return sha256(wsPath) !== sha256(seedPath);
  });
  criteria.push(C('V2-12-C5', changed.length === 0, JSON.stringify(changed)));

  const seedFiles = new Set(walk(seed).filter((f) => f !== 'TASK.md'));
  const extra = walk(ws).filter((f) => f !== 'TASK.md' && !seedFiles.has(f));
  criteria.push(C('V2-12-C6', extra.length === 0, JSON.stringify(extra)));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
