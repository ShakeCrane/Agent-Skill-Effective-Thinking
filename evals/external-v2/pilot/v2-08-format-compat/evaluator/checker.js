'use strict';
// Deterministic acceptance checker for v2-08 (buried backward compatibility).
const path = require('path');
const fs = require('fs');

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });
const REC = { id: '7', name: 'widget', note: 'restocked' };

function load(ws) {
  const p = path.join(ws, 'src', 'exporter.js');
  if (!fs.existsSync(p)) throw new Error('src/exporter.js is missing');
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  if (!mod || typeof mod.exportRecord !== 'function') throw new Error('exportRecord is not exported as a function');
  return mod.exportRecord;
}

async function check(ws) {
  const criteria = [];
  const exportRecord = load(ws);
  const call = (record, options) => (options === undefined ? exportRecord(record) : exportRecord(record, options));

  // C1 — default stays v1
  const def = call(REC);
  const defEmpty = call(REC, {});
  criteria.push(C('V2-08-C1', def === '7|widget' && defEmpty === '7|widget', JSON.stringify({ def, defEmpty })));

  // C2 — explicit v1 identical to default
  const v1 = call(REC, { formatVersion: 1 });
  criteria.push(C('V2-08-C2', v1 === '7|widget', JSON.stringify(v1)));

  // C3 — v2 with note
  const v2 = call(REC, { formatVersion: 2 });
  criteria.push(C('V2-08-C3', v2 === '7|widget|restocked', JSON.stringify(v2)));

  // C4 — v2 without note keeps three fields
  const noNote = call({ id: '8', name: 'gear' }, { formatVersion: 2 });
  const emptyNote = call({ id: '8', name: 'gear', note: '' }, { formatVersion: 2 });
  criteria.push(C('V2-08-C4', noNote === '8|gear|' && emptyNote === '8|gear|', JSON.stringify({ noNote, emptyNote })));

  // C5 — escaping preserved in all fields (including note) for v1 and v2
  const tricky = { id: 'a|b', name: 'c|d', note: 'e|f' };
  const v1Esc = call(tricky, { formatVersion: 1 });
  const v2Esc = call(tricky, { formatVersion: 2 });
  criteria.push(C('V2-08-C5',
    v1Esc === 'a\\|b|c\\|d' && v2Esc === 'a\\|b|c\\|d|e\\|f',
    JSON.stringify({ v1Esc, v2Esc })));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
