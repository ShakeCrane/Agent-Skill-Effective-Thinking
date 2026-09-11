'use strict';
// Deterministic acceptance checker for v2-04 (idempotent migration).
const path = require('path');
const fs = require('fs');

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });
const clone = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function load(ws) {
  const p = path.join(ws, 'src', 'migrate.js');
  if (!fs.existsSync(p)) throw new Error('src/migrate.js is missing');
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  if (!mod || typeof mod.migrate !== 'function') throw new Error('migrate is not exported as a function');
  return mod.migrate;
}

async function check(ws) {
  const criteria = [];
  const migrate = load(ws);

  criteria.push(C('V2-04-C5', migrate.length === 1, `arity=${migrate.length}`));

  // ---- C1: idempotency + no duplicate default entry ----
  const inputA = { plugins: [{ id: 'user-a', enabled: false }, { id: 'user-b', enabled: true }] };
  const r1 = migrate(clone(inputA));
  const r2 = migrate(clone(r1));
  const defaultsInR1 = (r1.plugins || []).filter((p) => p && p.id === 'builtin-safe').length;
  const defaultsInR2 = (r2.plugins || []).filter((p) => p && p.id === 'builtin-safe').length;
  criteria.push(C('V2-04-C1',
    eq(r1, r2) && defaultsInR1 === 1 && defaultsInR2 === 1,
    JSON.stringify({ r1: r1.plugins, r2: r2.plugins })));

  // ---- C2: a pre-existing user entry must not be overwritten ----
  const custom = { id: 'builtin-safe', enabled: false, note: 'user tuned this' };
  const inputB = { plugins: [{ id: 'user-a' }, custom] };
  const rB = migrate(clone(inputB));
  const kept = (rB.plugins || []).find((p) => p && p.id === 'builtin-safe');
  criteria.push(C('V2-04-C2',
    !!kept && kept.enabled === false && kept.note === 'user tuned this'
      && (rB.plugins || []).filter((p) => p && p.id === 'builtin-safe').length === 1,
    JSON.stringify(kept)));

  // ---- C3: order preserved, new entry appended ----
  const idsBefore = inputA.plugins.map((p) => p.id);
  const idsAfter = (r1.plugins || []).map((p) => p.id);
  const prefixOk = idsBefore.every((id, i) => idsAfter[i] === id);
  const appendedOk = idsAfter.length === idsBefore.length + 1 && idsAfter[idsAfter.length - 1] === 'builtin-safe';
  criteria.push(C('V2-04-C3', prefixOk && appendedOk, JSON.stringify(idsAfter)));

  // ---- C4: no input mutation (deep snapshot of input and nested entries) ----
  const before = JSON.stringify(inputA);
  const beforeCustom = JSON.stringify(inputB);
  migrate(inputA);
  migrate(inputB);
  criteria.push(C('V2-04-C4',
    JSON.stringify(inputA) === before && JSON.stringify(inputB) === beforeCustom,
    JSON.stringify({ inputA, inputB })));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
