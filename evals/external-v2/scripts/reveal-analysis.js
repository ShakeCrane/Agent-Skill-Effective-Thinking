#!/usr/bin/env node
// reveal-analysis.js — unblind the conditions and produce the condition-level analysis.
//
// Runs ONLY after results/blind-sensitivity.json has been written and locked. Reads the sealed
// condition mapping at that point and never modifies the blind verdict.
'use strict';
const fs = require('fs');
const path = require('path');
const { V2_ROOT } = require('./lib.js');

const RESULTS = path.join(V2_ROOT, 'results', 'pilot-results.jsonl');
const BLIND = path.join(V2_ROOT, 'results', 'blind-sensitivity.json');
const SEAL = path.join(V2_ROOT, 'results', 'condition-seal.json');
const OUT = path.join(V2_ROOT, 'results', 'revealed-analysis.json');

const CONS = ['controlA', 'controlB', 'treatment'];

function main() {
  if (!fs.existsSync(BLIND)) throw new Error('blind sensitivity verdict missing — refusing to unblind');
  const blind = JSON.parse(fs.readFileSync(BLIND, 'utf8'));
  if (!blind.blinded) throw new Error('blind verdict is not marked blinded');
  const seal = JSON.parse(fs.readFileSync(SEAL, 'utf8'));

  const rows = fs.readFileSync(RESULTS, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => JSON.parse(l)).filter((r) => r.status === 'valid_completed');

  const tasks = Array.from(new Set(rows.map((r) => r.taskId))).sort();
  const at = (taskId, cond) => rows.find((r) => r.taskId === taskId && r.condition === cond);

  // ---- per condition ----
  const byCond = {};
  for (const c of CONS) {
    const rs = rows.filter((r) => r.condition === c);
    byCond[c] = {
      runs: rs.length,
      taskPass: rs.filter((r) => r.taskPass).length,
      criterionPassed: rs.reduce((n, r) => n + r.primaryPassed, 0),
      criterionTotal: rs.reduce((n, r) => n + r.primaryTotal, 0),
      failedCriteria: rs.flatMap((r) => r.failedCriteria),
      outputBytesTotal: rs.reduce((n, r) => n + r.outputBytesExcludingConditionInputs, 0),
      filesChangedTotal: rs.reduce((n, r) => n + r.filesChanged, 0),
      extraFilesCreated: rs.reduce((n, r) => n + r.filesCreated, 0),
    };
    byCond[c].criterionRate = byCond[c].criterionTotal ? byCond[c].criterionPassed / byCond[c].criterionTotal : null;
  }

  // ---- paired per task ----
  function paired(a, b) {
    const tally = { aFail_bPass: 0, aPass_bFail: 0, bothPass: 0, bothFail: 0 };
    const detail = [];
    for (const t of tasks) {
      const ra = at(t, a), rb = at(t, b);
      const pa = ra.taskPass, pb = rb.taskPass;
      if (!pa && pb) tally.aFail_bPass += 1;
      else if (pa && !pb) tally.aPass_bFail += 1;
      else if (pa && pb) tally.bothPass += 1;
      else tally.bothFail += 1;
      detail.push({ taskId: t, [a]: pa ? 'P' : 'F', [b]: pb ? 'P' : 'F' });
    }
    return { tally, detail };
  }

  const treatmentVsB = paired('controlB', 'treatment'); // treatment win = B fail / T pass
  const treatmentVsA = paired('controlA', 'treatment');
  const bVsA = paired('controlA', 'controlB');

  // ---- task-level table ----
  const taskTable = tasks.map((t) => {
    const row = { taskId: t, family: t.replace(/^v2-\d\d-/, '') };
    for (const c of CONS) {
      const r = at(t, c);
      row[c] = `${r.taskPass ? 'PASS' : 'FAIL'} ${r.primaryPassed}/${r.primaryTotal}`;
      row[c + '_failed'] = r.failedCriteria;
      row[c + '_bytes'] = r.outputBytesExcludingConditionInputs;
      row[c + '_changed'] = r.filesChanged;
    }
    const passes = CONS.map((c) => at(t, c).taskPass);
    row.allPass = passes.every(Boolean);
    row.anyDisagreement = passes.some((p) => p !== passes[0]);
    return row;
  });

  // ---- F17 proxy: post-success unrelated actions, from artefact churn on the negative controls ----
  const negativeControls = ['v2-10-scope-control', 'v2-11-easy-constant', 'v2-12-boundary-fix'].map((t) => {
    const per = {};
    for (const c of CONS) {
      const r = at(t, c);
      per[c] = { taskPass: r.taskPass, changedPaths: r.changedPaths, filesCreated: r.filesCreated, outputBytes: r.outputBytesExcludingConditionInputs };
    }
    return { taskId: t, per };
  });

  const out = {
    revealedAt: new Date().toISOString(),
    sealUsed: seal.mapping,
    blindVerdictLocked: {
      quality: blind.quality.verdict,
      efficiency: blind.efficiency.verdict,
      combined: blind.combinedVerdict,
    },
    byCondition: byCond,
    paired: {
      treatment_vs_controlB: treatmentVsB.tally,
      treatment_vs_controlA: treatmentVsA.tally,
      controlB_vs_controlA: bVsA.tally,
      detail_treatment_vs_controlB: treatmentVsB.detail,
    },
    taskTable,
    negativeControls,
    telemetryLimits: {
      actionCounts: 'unavailable from this host (recorded as null, never fabricated)',
      elapsedMs: 'recorded as null — dominated by orchestrator turn latency',
      availableProxies: ['outputBytesExcludingConditionInputs', 'filesChanged', 'filesCreated', 'checker criterion detail'],
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

  // ---- console summary ----
  console.log('REVEALED CONDITION ANALYSIS');
  console.log('blind verdict (already locked):', blind.combinedVerdict);
  console.log('');
  console.log('condition'.padEnd(11), 'runs', 'taskPass', 'criteria', 'bytes', 'filesChanged', 'extraFiles');
  for (const c of CONS) {
    const v = byCond[c];
    console.log(
      c.padEnd(11), String(v.runs).padEnd(4), `${v.taskPass}/${v.runs}`.padEnd(8),
      `${v.criterionPassed}/${v.criterionTotal}`.padEnd(8), String(v.outputBytesTotal).padEnd(5),
      String(v.filesChangedTotal).padEnd(12), String(v.extraFilesCreated)
    );
  }
  console.log('');
  console.log('paired controlB vs treatment :', JSON.stringify(treatmentVsB.tally), '(aFail_bPass = treatment win)');
  console.log('paired controlA vs treatment :', JSON.stringify(treatmentVsA.tally));
  console.log('paired controlA vs controlB  :', JSON.stringify(bVsA.tally));
  console.log('');
  console.log('tasks with any condition disagreement:', taskTable.filter((t) => t.anyDisagreement).length);
  console.log('written -> results/revealed-analysis.json');
}

if (require.main === module) main();
