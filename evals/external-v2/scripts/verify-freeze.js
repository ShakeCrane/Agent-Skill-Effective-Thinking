#!/usr/bin/env node
// verify-freeze.js — deterministic drift check for the frozen v2 pilot state.
//
// Recomputes every hash recorded in freeze-manifest.json and compares. Any difference exits
// nonzero and names the drifting path. Run this BEFORE each pilot batch and before the final
// aggregation; after the pilot starts, frozen-artifact drift means the run set is not a single
// coherent experiment.
//
// This script never repairs or regenerates the manifest.
'use strict';
const fs = require('fs');
const path = require('path');
const { V2_ROOT, sha256, treeHash, exists, readJSON, FREEZE_MANIFEST } = require('./lib.js');

function main() {
  if (!exists(FREEZE_MANIFEST)) {
    console.error('VERIFY-FREEZE FAILED: freeze-manifest.json is missing (run scripts/freeze.js first).');
    process.exit(1);
  }
  const manifest = readJSON(FREEZE_MANIFEST);
  const drift = [];
  const missing = [];

  for (const a of manifest.artifacts) {
    const abs = path.join(V2_ROOT, a.path);
    if (!exists(abs)) { missing.push(a.path); continue; }
    const actual = a.tree ? treeHash(abs) : sha256(abs);
    if (actual !== a.sha256) drift.push({ path: a.path, expected: a.sha256, actual });
  }

  console.log('V2 FREEZE VERIFICATION');
  console.log(`protocol   ${manifest.protocolVersion}`);
  console.log(`frozen at  ${manifest.freezeTimestamp}`);
  console.log(`baseline   ${manifest.phase1BaselineCommit} (v${manifest.phase1PackageVersion})`);
  console.log(`artifacts  ${manifest.artifacts.length}`);
  console.log('');

  if (drift.length === 0 && missing.length === 0) {
    console.log('VERIFY-FREEZE PASS: all frozen artifacts match the manifest.');
    process.exit(0);
  }
  for (const m of missing) console.log(`MISSING: ${m}`);
  for (const d of drift) {
    console.log(`DRIFT:   ${d.path}`);
    console.log(`  expected ${d.expected}`);
    console.log(`  actual   ${d.actual}`);
  }
  console.log('');
  console.log(`VERIFY-FREEZE FAIL: ${drift.length} drifted, ${missing.length} missing.`);
  console.log('Do NOT regenerate the manifest to absorb this. Use the measurement-fix protocol.');
  process.exit(1);
}

if (require.main === module) main();
