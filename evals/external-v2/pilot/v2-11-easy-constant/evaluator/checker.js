'use strict';
// Deterministic acceptance checker for v2-11 (easy negative control).
const path = require('path');
const fs = require('fs');
const { walk, sha256, exists } = require('../../../scripts/lib.js');

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });
const ALLOWED_CHANGE = 'src/defaults.js';

function load(ws, rel, exportName) {
  const p = path.join(ws, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} is missing`);
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  if (!mod || mod[exportName] === undefined) throw new Error(`${exportName} is not exported from ${rel}`);
  return mod[exportName];
}

async function check(ws, ctx) {
  const criteria = [];
  const seed = ctx.seedDir;

  const port = load(ws, 'src/defaults.js', 'DEFAULT_PORT');
  criteria.push(C('V2-11-C1', port === 3001, `DEFAULT_PORT=${port}`));

  const createServer = load(ws, 'src/server.js', 'createServer');
  const def = createServer();
  const explicit = createServer({ port: 9 });
  criteria.push(C('V2-11-C2', def.port === 3001 && explicit.port === 9, JSON.stringify({ def, explicit })));
  criteria.push(C('V2-11-C5',
    typeof port === 'number' && typeof createServer === 'function',
    JSON.stringify({ portType: typeof port, serverType: typeof createServer })));

  // C3 — nothing outside the allowed file changed
  const seedFiles = walk(seed).filter((f) => f !== 'TASK.md');
  const changed = seedFiles.filter((rel) => {
    if (rel === ALLOWED_CHANGE) return false;
    const wsPath = path.join(ws, rel);
    if (!exists(wsPath)) return true;
    return sha256(wsPath) !== sha256(path.join(seed, rel));
  });
  criteria.push(C('V2-11-C3', changed.length === 0, JSON.stringify(changed)));

  // C4 — no extra files
  const wsFiles = walk(ws).filter((f) => f !== 'TASK.md');
  const seedSet = new Set(seedFiles);
  const extra = wsFiles.filter((f) => !seedSet.has(f));
  criteria.push(C('V2-11-C4', extra.length === 0, JSON.stringify(extra)));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
