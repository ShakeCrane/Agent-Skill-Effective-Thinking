'use strict';
// Deterministic acceptance checker for v2-02 (date-only / timezone root-cause trap).
// The candidate module is exercised in CHILD processes with different TZ values. Child stdout is
// captured through a temp FILE (never a pipe — pipes are EPERM in this sandbox).
const path = require('path');
const fs = require('fs');
const { runNodeJSON } = require('../../../scripts/lib.js');

const TZS = ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'];
const VALID = ['2026-09-11', '2024-02-29', '2026-01-01', '2026-12-31'];
const INVALID = ['2025-02-29', '2026-02-30', '2026-13-01', '2026-00-10', 'not-a-date'];

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });

// Ask a child process (with the given TZ) to run the candidate against the contract cases.
function probe(ws, tz) {
  const modPath = path.join(ws, 'src', 'date-only.js');
  const code = `
    const mod = require(${JSON.stringify(modPath)});
    const out = { parses: {}, formats: {}, throws: {} };
    for (const v of ${JSON.stringify(VALID)}) {
      try { out.parses[v] = mod.parseDateOnly(v); } catch (e) { out.parses[v] = { threw: String(e.message) }; }
      try { out.formats[v] = mod.formatDateOnly(v); } catch (e) { out.formats[v] = { threw: String(e.message) }; }
    }
    for (const v of ${JSON.stringify(INVALID)}) {
      try { mod.parseDateOnly(v); out.throws[v] = false; } catch (e) { out.throws[v] = true; }
    }
    out.arity = { parse: mod.parseDateOnly.length, format: mod.formatDateOnly.length };
    out.exported = typeof mod.parseDateOnly === 'function' && typeof mod.formatDateOnly === 'function';
    _emit(out);
  `;
  return runNodeJSON(code, { cwd: ws, env: { TZ: tz } });
}

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function check(ws) {
  const criteria = [];
  const results = {};
  for (const tz of TZS) results[tz] = probe(ws, tz);

  const usable = TZS.filter((tz) => results[tz].json && !results[tz].json.__error);
  if (usable.length !== TZS.length) {
    criteria.push(C('V2-02-C1', false, `candidate failed to run under TZ=${TZS.filter((tz) => !usable.includes(tz)).join(',')}`));
    criteria.push(C('V2-02-C2', false, 'cannot evaluate'));
    criteria.push(C('V2-02-C3', false, 'cannot evaluate'));
    criteria.push(C('V2-02-C4', false, 'cannot evaluate'));
    criteria.push(C('V2-02-C5', false, 'cannot evaluate'));
    return { taskPass: false, criteria, secondary: {}, notes: ['candidate did not run in one or more TZ environments'] };
  }

  // C1 — timezone independence of parsing on a plain valid date
  const probeDate = '2026-09-11';
  const want = { year: 2026, month: 9, day: 11 };
  const perTz = TZS.map((tz) => ({ tz, got: results[tz].json.parses[probeDate] }));
  const c1 = perTz.every((p) => same(p.got, want));
  criteria.push(C('V2-02-C1', c1, JSON.stringify(perTz)));

  // C2 — leap day
  const leap = TZS.map((tz) => ({ tz, got: results[tz].json.parses['2024-02-29'] }));
  const c2 = leap.every((p) => same(p.got, { year: 2024, month: 2, day: 29 }));
  criteria.push(C('V2-02-C2', c2, JSON.stringify(leap)));

  // C3 — invalid calendar dates rejected in every TZ
  const badPerTz = TZS.map((tz) => ({ tz, throws: results[tz].json.throws }));
  const c3 = badPerTz.every((p) => INVALID.every((v) => p.throws[v] === true));
  criteria.push(C('V2-02-C3', c3, JSON.stringify(badPerTz)));

  // C4 — round-trip
  const rt = TZS.map((tz) => ({ tz, got: VALID.map((v) => results[tz].json.formats[v]) }));
  const c4 = rt.every((p) => same(p.got, VALID));
  criteria.push(C('V2-02-C4', c4, JSON.stringify(rt)));

  // C5 — API unchanged
  const anyTz = results[TZS[0]].json;
  const c5 = anyTz.exported === true && anyTz.arity.parse === 1 && anyTz.arity.format === 1;
  criteria.push(C('V2-02-C5', c5, JSON.stringify(anyTz.arity)));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
