'use strict';
// Deterministic acceptance checker for v2-05 (failure atomicity).
const path = require('path');
const fs = require('fs');

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });
const KEY = 'config:app';
const OLD = { theme: 'dark' };
const NEW = { theme: 'light' };

function load(ws, rel, exportName) {
  const p = path.join(ws, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} is missing`);
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  if (!mod || typeof mod[exportName] !== 'function') throw new Error(`${exportName} is not exported as a function`);
  return mod[exportName];
}

async function check(ws) {
  const criteria = [];
  const FakeStore = load(ws, 'src/fake-store.js', 'FakeStore');
  const saveCache = load(ws, 'src/cache.js', 'saveCache');

  criteria.push(C('V2-05-C5', saveCache.length === 3, `arity=${saveCache.length}`));

  // ---- success path ----
  const okStore = new FakeStore({ [KEY]: OLD });
  let okErr = null;
  try { await saveCache(okStore, KEY, NEW); } catch (e) { okErr = e; }
  const afterOk = await okStore.read(KEY);
  criteria.push(C('V2-05-C1',
    !okErr && JSON.stringify(afterOk) === JSON.stringify(NEW),
    JSON.stringify({ err: okErr && okErr.message, afterOk })));

  // C2 — temp + replace used, target never written directly
  const usedWriteTemp = okStore.calls.some((c) => c[0] === 'writeTemp');
  const usedReplace = okStore.calls.some((c) => c[0] === 'replace');
  const directTargetWrite = okStore.calls.some((c) => c[0] === 'write' && c[1] === KEY);
  criteria.push(C('V2-05-C2',
    usedWriteTemp && usedReplace && !directTargetWrite,
    JSON.stringify(okStore.calls)));

  // ---- injected replace failure ----
  const badStore = new FakeStore({ [KEY]: OLD });
  badStore.failReplace = true;
  let badErr = null;
  try { await saveCache(badStore, KEY, NEW); } catch (e) { badErr = e; }
  const afterFail = await badStore.read(KEY);
  criteria.push(C('V2-05-C3',
    JSON.stringify(afterFail) === JSON.stringify(OLD),
    JSON.stringify({ threw: badErr && badErr.message, afterFail })));

  // C4 — temp cleanup on both paths (a temp key is any key that is not the target)
  const leftoversOk = Object.keys(okStore.files).filter((k) => k !== KEY);
  const leftoversBad = Object.keys(badStore.files).filter((k) => k !== KEY);
  criteria.push(C('V2-05-C4',
    leftoversOk.length === 0 && leftoversBad.length === 0,
    JSON.stringify({ leftoversOk, leftoversBad })));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
