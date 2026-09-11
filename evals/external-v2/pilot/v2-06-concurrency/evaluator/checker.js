'use strict';
// Deterministic acceptance checker for v2-06 (concurrency race).
const path = require('path');
const fs = require('fs');

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });

function load(ws) {
  const p = path.join(ws, 'src', 'counter.js');
  if (!fs.existsSync(p)) throw new Error('src/counter.js is missing');
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  if (!mod || typeof mod.Counter !== 'function') throw new Error('Counter is not exported as a class');
  return mod.Counter;
}

async function check(ws) {
  const criteria = [];
  const Counter = load(ws);
  const counter = new Counter();

  criteria.push(C('V2-06-C4',
    typeof counter.increment === 'function' && typeof counter.get === 'function' && counter.increment.length === 1,
    `increment=${typeof counter.increment} get=${typeof counter.get} arity=${counter.increment && counter.increment.length}`));

  // C1 — first burst of 100
  await Promise.all(Array.from({ length: 100 }, () => counter.increment('a')));
  const after100 = counter.get('a');
  criteria.push(C('V2-06-C1', after100 === 100, `get('a')=${after100} want 100`));

  // C2 — second burst of 50
  await Promise.all(Array.from({ length: 50 }, () => counter.increment('a')));
  const after150 = counter.get('a');
  criteria.push(C('V2-06-C2', after150 === 150, `get('a')=${after150} want 150`));

  // C3 — two keys concurrently
  const other = new Counter();
  const jobs = [];
  for (let i = 0; i < 40; i++) jobs.push(other.increment('x'));
  for (let i = 0; i < 25; i++) jobs.push(other.increment('y'));
  await Promise.all(jobs);
  criteria.push(C('V2-06-C3',
    other.get('x') === 40 && other.get('y') === 25,
    JSON.stringify({ x: other.get('x'), y: other.get('y') })));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
