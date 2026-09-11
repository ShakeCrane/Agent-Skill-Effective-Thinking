#!/usr/bin/env node
// blind-sensitivity.js — compute the two pre-registered sensitivity channels WITHOUT knowing which
// anonymous condition is which.
//
// Procedure (protocol.json → blindSensitivityProcedure):
//   1. all 36 valid runs exist
//   2. run the frozen checkers              (done by collect-batch.js)
//   3. build an anonymous condition mapping (condition-X/Y/Z); the mapping is written to a SEALED
//      file that this script never reads while computing the verdicts
//   4. compute QUALITY sensitivity on the anonymous labels
//   5. compute EFFICIENCY sensitivity on the anonymous labels
//   6. write and LOCK the result
//
// Only after that file exists does reveal-analysis.js unblind.
'use strict';
const fs = require('fs');
const path = require('path');
const { V2_ROOT, readJSON } = require('./lib.js');

const RESULTS = path.join(V2_ROOT, 'results', 'pilot-results.jsonl');
const BLIND_OUT = path.join(V2_ROOT, 'results', 'blind-sensitivity.json');
const SEAL = path.join(V2_ROOT, 'results', 'condition-seal.json');

function main() {
  const rows = fs.readFileSync(RESULTS, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const valid = rows.filter((r) => r.status === 'valid_completed');

  // ---- step 3: anonymise (deterministic, but invisible to the computations below) ----
  const realConds = Array.from(new Set(valid.map((r) => r.condition))).sort();
  const anonLabels = ['X', 'Y', 'Z'];
  const anonOf = {};
  realConds.forEach((c, i) => { anonOf[c] = 'condition-' + anonLabels[i]; });
  // sealed mapping is written for the LATER reveal step; it is not consulted below
  fs.writeFileSync(SEAL, JSON.stringify({
    sealedAt: new Date().toISOString(),
    note: 'Anonymous condition mapping. Written for the reveal step only; the blind verdicts were computed without reading it.',
    mapping: anonOf,
  }, null, 2) + '\n');

  const anon = valid.map((r) => ({ taskId: r.taskId, anon: anonOf[r.condition], taskPass: r.taskPass, actions: r.externalActions }));

  // ---- step 4: QUALITY sensitivity (anonymous) ----
  const tasks = Array.from(new Set(anon.map((r) => r.taskId))).sort();
  let allPass = 0;
  let disagreement = 0;
  const perTaskAnon = {};
  for (const t of tasks) {
    const runs = anon.filter((r) => r.taskId === t);
    perTaskAnon[t] = runs.map((r) => `${r.anon}:${r.taskPass ? 'P' : 'F'}`).sort();
    const passes = runs.filter((r) => r.taskPass).length;
    if (passes === runs.length) allPass += 1;
    if (passes > 0 && passes < runs.length) disagreement += 1;
  }
  const qualityCeiling = allPass >= 9 || disagreement < 4;
  const qualityVerdict = qualityCeiling ? 'CEILING-LIMITED' : 'INFORMATIVE';

  // ---- step 5: EFFICIENCY sensitivity (anonymous) ----
  const withActions = anon.filter((r) => typeof r.actions === 'number');
  const telemetryCoverage = withActions.length;
  let materialSpread = 0;
  for (const t of tasks) {
    const runs = anon.filter((r) => r.taskId === t && typeof r.actions === 'number');
    if (runs.length < 3) continue;
    const vals = runs.map((r) => r.actions);
    const mx = Math.max(...vals);
    const mn = Math.min(...vals);
    if (mx - mn >= 3 && mx / Math.max(1, mn) >= 1.5) materialSpread += 1;
  }
  const efficiencyVerdict = (telemetryCoverage >= 10 && materialSpread >= 4)
    ? 'INFORMATIVE'
    : (telemetryCoverage === 0 ? 'UNMEASURABLE' : 'LOW');

  // ---- step 6: lock ----
  const combined = (qualityVerdict === 'CEILING-LIMITED' && (efficiencyVerdict === 'LOW' || efficiencyVerdict === 'UNMEASURABLE'))
    ? 'PILOT SENSITIVITY FAIL — CEILING-LIMITED'
    : 'PILOT INFORMATIVE';

  const out = {
    computedAt: new Date().toISOString(),
    blinded: true,
    statement: 'This verdict was produced with conditions anonymised (condition-X/Y/Z). The condition mapping was not consulted.',
    validRuns: valid.length,
    tasks: tasks.length,
    quality: {
      channel: 'QUALITY SENSITIVITY',
      tasksAllThreeConditionsPass: allPass,
      tasksWithAnyDisagreement: disagreement,
      threshold: 'CEILING-LIMITED if all-pass >= 9 OR disagreement < 4',
      verdict: qualityVerdict,
    },
    efficiency: {
      channel: 'EFFICIENCY SENSITIVITY',
      primaryMetric: 'toolCalls / externalActions',
      runsWithReliableActionTelemetry: telemetryCoverage,
      tasksWithMaterialActionSpread: materialSpread,
      threshold: 'INFORMATIVE if telemetry >= 10/12 AND material spread >= 4/12',
      hostNote: 'This host does not expose per-agent action/tool events to the evaluating process, so action counts are unavailable. Per pre-registration, no substitute value is invented; elapsed time alone is not a gate.',
      verdict: efficiencyVerdict,
    },
    combinedVerdict: combined,
    perTaskAnonymous: perTaskAnon,
  };
  fs.writeFileSync(BLIND_OUT, JSON.stringify(out, null, 2) + '\n');
  fs.chmodSync(BLIND_OUT, 0o444); // locked: read-only, so a later step cannot quietly rewrite the verdict

  console.log('BLIND SENSITIVITY (conditions anonymised)');
  console.log(`valid runs: ${valid.length}   tasks: ${tasks.length}`);
  console.log('');
  console.log(`QUALITY     all-three-pass=${allPass}/${tasks.length}  disagreement=${disagreement}/${tasks.length}  -> ${qualityVerdict}`);
  console.log(`EFFICIENCY  telemetry=${telemetryCoverage}/${valid.length}  materialSpread=${materialSpread}/${tasks.length}  -> ${efficiencyVerdict}`);
  console.log('');
  console.log(`COMBINED    ${combined}`);
  console.log('');
  console.log('locked -> results/blind-sensitivity.json (read-only)');
}

if (require.main === module) main();
