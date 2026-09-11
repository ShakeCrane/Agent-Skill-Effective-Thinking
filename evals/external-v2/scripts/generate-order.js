#!/usr/bin/env node
// Generate the frozen randomized run order: 12 tasks x 3 conditions = 36 runs.
//
// Deterministic (mulberry32 + Fisher-Yates) with a recorded seed, so the order is reproducible and
// is generated ONCE before any run. Run ids are built with an explicit template string
// (`${taskId}__${condition}__r1`) to avoid the v1 shell `${t}__${c}` variable-expansion bug.
'use strict';
const fs = require('fs');
const path = require('path');
const { V2_ROOT, listTaskIds, readJSON } = require('./lib.js');

const SEED = 20260911;
const CONDITIONS = ['controlA', 'controlB', 'treatment'];

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function main() {
  const taskIds = listTaskIds();
  if (taskIds.length === 0) throw new Error('no pilot tasks found');
  const rand = rng(SEED);

  const runs = [];
  for (const taskId of taskIds) {
    const conds = CONDITIONS.slice();
    for (let i = conds.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [conds[i], conds[j]] = [conds[j], conds[i]];
    }
    for (const condition of conds) {
      runs.push({ taskId, condition, replicate: 1, runId: `${taskId}__${condition}__r1` });
    }
  }
  // Shuffle the whole block so tasks are interleaved (no task-by-task grouping).
  for (let i = runs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [runs[i], runs[j]] = [runs[j], runs[i]];
  }
  runs.forEach((r, i) => { r.order = i + 1; });

  const out = { seed: SEED, generatedAt: new Date().toISOString(), totalRuns: runs.length, runs };
  fs.writeFileSync(path.join(V2_ROOT, 'run-order.json'), JSON.stringify(out, null, 2) + '\n');

  // ---- validation ----
  const ids = new Set(runs.map((r) => r.runId));
  const problems = [];
  if (runs.length !== taskIds.length * 3) problems.push(`expected ${taskIds.length * 3} runs, got ${runs.length}`);
  if (ids.size !== runs.length) problems.push('runIds are not unique');
  for (const t of taskIds) {
    const got = runs.filter((r) => r.taskId === t).map((r) => r.condition).sort();
    if (JSON.stringify(got) !== JSON.stringify(['controlA', 'controlB', 'treatment'])) problems.push(`task ${t} condition set = ${got.join(',')}`);
    const bad = runs.filter((r) => r.taskId === t).filter((r) => r.runId !== `${r.taskId}__${r.condition}__r1`);
    if (bad.length) problems.push(`task ${t} runId template mismatch`);
  }
  // not always A -> B -> T
  let sequential = 0;
  for (const t of taskIds) {
    const seq = runs.filter((r) => r.taskId === t).sort((a, b) => a.order - b.order).map((r) => r.condition);
    if (JSON.stringify(seq) === JSON.stringify(CONDITIONS)) sequential++;
  }
  console.log(`run-order.json written: ${runs.length} runs (seed ${SEED})`);
  console.log(`tasks: ${taskIds.length}; unique runIds: ${ids.size}; A->B->T sequential tasks: ${sequential}`);
  console.log(problems.length ? `RUN ORDER PROBLEMS: ${problems.join(' | ')}` : 'RUN ORDER OK');
  if (problems.length) process.exit(1);
}

if (require.main === module) main();
module.exports = { SEED, CONDITIONS, rng };
