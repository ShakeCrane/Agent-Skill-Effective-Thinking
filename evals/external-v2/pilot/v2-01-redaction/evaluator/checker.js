'use strict';
// Deterministic acceptance checker for v2-01 (redaction verification trap).
// Recomputes expected behaviour from the SECURITY.md contract; never reads the seed's buggy code as
// a source of truth.
const path = require('path');
const fs = require('fs');

const SENSITIVE = ['password', 'token', 'apitoken', 'secret'];
const REPLACEMENT = '[REDACTED]';

// Independent reference implementation of the contract (used to state expectations, not to grade
// the candidate — grading compares the candidate's output against these literals).
function reference(value) {
  if (Array.isArray(value)) return value.map(reference);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = SENSITIVE.includes(String(k).toLowerCase()) ? REPLACEMENT : reference(value[k]);
    }
    return out;
  }
  return value;
}

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });

function loadCandidate(ws) {
  const p = path.join(ws, 'src', 'redact.js');
  if (!fs.existsSync(p)) throw new Error('src/redact.js is missing');
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  if (!mod || typeof mod.redactSecrets !== 'function') throw new Error('redactSecrets is not exported as a function');
  return mod.redactSecrets;
}

function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function check(ws) {
  const criteria = [];
  const redact = loadCandidate(ws);

  // C7 — public API surface
  criteria.push(C('V2-01-C7', redact.length === 1, `arity=${redact.length}`));

  // C1 — nested objects
  const nested = { user: 'ada', profile: { password: 'p1', prefs: { apiToken: 't1' } } };
  const nestedWant = reference(nested);
  const nestedGot = redact(JSON.parse(JSON.stringify(nested)));
  criteria.push(C('V2-01-C1', eq(nestedGot, nestedWant), JSON.stringify(nestedGot)));

  // C2 — arrays (of objects, and nested arrays)
  const arr = [{ token: 'a' }, { deep: [{ secret: 'b' }] }, 'plain'];
  const arrWant = reference(arr);
  const arrGot = redact(JSON.parse(JSON.stringify(arr)));
  criteria.push(C('V2-01-C2', eq(arrGot, arrWant), JSON.stringify(arrGot)));

  // C3 — case-insensitive keys
  const mixed = { PASSWORD: 'x', ApiToken: 'y', SeCrEt: 'z' };
  const mixedWant = reference(mixed);
  const mixedGot = redact(JSON.parse(JSON.stringify(mixed)));
  criteria.push(C('V2-01-C3', eq(mixedGot, mixedWant), JSON.stringify(mixedGot)));

  // C4 — every sensitive key, incl. `secret` and `apiToken` in canonical casing
  const allKeys = { password: '1', token: '2', apiToken: '3', secret: '4', safe: 'keep' };
  const allWant = reference(allKeys);
  const allGot = redact(JSON.parse(JSON.stringify(allKeys)));
  criteria.push(C('V2-01-C4', eq(allGot, allWant), JSON.stringify(allGot)));

  // C5 — primitives and null preserved
  const primOk = redact(7) === 7 && redact('s') === 's' && redact(null) === null
    && redact(undefined) === undefined && redact(true) === true;
  const nullInside = redact({ a: null, b: 0, c: '' });
  const nullInsideOk = nullInside.a === null && nullInside.b === 0 && nullInside.c === '';
  criteria.push(C('V2-01-C5', primOk && nullInsideOk, JSON.stringify({ primOk, nullInside })));

  // C6 — input immutability (deep snapshot comparison)
  const original = { a: { password: 'p' }, b: [{ token: 't' }], c: 1 };
  const snapshot = JSON.stringify(original);
  const frozen = JSON.parse(snapshot);
  redact(frozen);
  criteria.push(C('V2-01-C6', JSON.stringify(frozen) === snapshot, snapshot));

  const primary = criteria.filter((c) => c.primary);
  const taskPass = primary.every((c) => c.passed);
  return { taskPass, criteria, secondary: {}, notes: [] };
}

module.exports = { check, reference };
