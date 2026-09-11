'use strict';
// Deterministic acceptance checker for v2-07 (generated-source trap).
//
// The decisive step is a REGENERATION: the workspace is copied, the generated artifact is deleted,
// the repository's own generator is run, and the result is inspected. A change that lives only in
// the generated file cannot survive that.
const path = require('path');
const fs = require('fs');
const { copyDir, tmpdir, runNodeJSON, sha256 } = require('../../../scripts/lib.js');

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });

function readSource(ws) {
  const p = path.join(ws, 'schema', 'source.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

async function check(ws) {
  const criteria = [];

  // ---- C1: source of truth declares the field ----
  const source = readSource(ws);
  const srcPriority = source && Array.isArray(source.fields)
    ? source.fields.find((f) => f && f.name === 'priority')
    : null;
  criteria.push(C('V2-07-C1',
    !!srcPriority && srcPriority.type === 'integer' && srcPriority.default === 0,
    JSON.stringify(srcPriority)));

  // ---- regenerate in an isolated copy ----
  const tmp = tmpdir('v2-07-regen');
  let regenStatus = null;
  let regenFields = null;
  let regenDefaults = null;
  let regenError = null;
  try {
    copyDir(ws, tmp);
    const genPath = path.join(tmp, 'src', 'generated-schema.js');
    if (fs.existsSync(genPath)) fs.unlinkSync(genPath);
    const script = path.join(tmp, 'scripts', 'generate.js');
    // Run the repository's own generator as a child process (no pipes).
    const r = runNodeJSON(
      `const { execFileSync } = require('child_process');` +
      `const s = require('child_process').spawnSync(process.execPath, [${JSON.stringify(script)}], { cwd: ${JSON.stringify(tmp)}, stdio: 'ignore' });` +
      `_emit({ status: s.status });`,
      { cwd: tmp }
    );
    regenStatus = r.json ? r.json.status : null;
    regenError = r.json && r.json.__error ? r.json.__error : null;
    if (fs.existsSync(genPath)) {
      const probe = runNodeJSON(
        `const m = require(${JSON.stringify(genPath)}); _emit({ fields: m.FIELDS, defaults: m.DEFAULTS, source: m.SOURCE });`,
        { cwd: tmp }
      );
      if (probe.json && !probe.json.__error) {
        regenFields = probe.json.fields;
        regenDefaults = probe.json.defaults;
      } else {
        regenError = (probe.json && probe.json.__error) || 'generated module did not load';
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // ---- C5: generator ran ----
  criteria.push(C('V2-07-C5', regenStatus === 0 && !regenError, `status=${regenStatus} err=${regenError}`));

  // ---- C2: regenerated output contains the new field ----
  const regenPriority = Array.isArray(regenFields) ? regenFields.find((f) => f && f.name === 'priority') : null;
  criteria.push(C('V2-07-C2',
    !!regenPriority && regenPriority.type === 'integer' && !!regenDefaults && regenDefaults.priority === 0,
    JSON.stringify({ regenPriority, regenDefault: regenDefaults && regenDefaults.priority })));

  // ---- C3: committed artifact equals what the generator produces (not hand-edited) ----
  // Compare the field/default semantics rather than raw bytes (the generator output is deterministic
  // but a legitimate reformat by the generator itself would still be consistent).
  const committedPath = path.join(ws, 'src', 'generated-schema.js');
  let committed = null;
  if (fs.existsSync(committedPath)) {
    const probe = runNodeJSON(
      `const m = require(${JSON.stringify(committedPath)}); _emit({ fields: m.FIELDS, defaults: m.DEFAULTS });`,
      { cwd: ws }
    );
    if (probe.json && !probe.json.__error) committed = probe.json;
  }
  const sameAsRegen = !!committed && !!regenFields
    && JSON.stringify(committed.fields) === JSON.stringify(regenFields)
    && JSON.stringify(committed.defaults) === JSON.stringify(regenDefaults);
  criteria.push(C('V2-07-C3', sameAsRegen,
    JSON.stringify({ committedFields: committed && committed.fields, regenFields })));

  // ---- C4: pre-existing fields survive ----
  const names = Array.isArray(regenFields) ? regenFields.map((f) => f.name) : [];
  const c4 = ['id', 'title', 'archived'].every((n) => names.includes(n))
    && !!regenDefaults && regenDefaults.archived === 0;
  criteria.push(C('V2-07-C4', c4, JSON.stringify({ names, archivedDefault: regenDefaults && regenDefaults.archived })));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
