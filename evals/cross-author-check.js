// Cross-author label agreement check.
// The held-out validation set's labels were authored by the skill's author and the router matches
// them 22/22 — but that only proves router↔author agreement, not that the labels are the objective
// ground truth. This check compares the author's labels and the router's outputs against TWO
// INDEPENDENT labelers that saw only the task text (no profiles, no thresholds, no author labels).
//
// If independent labelers substantially disagree with the author/router, that is evidence the held-
// out labels are (partly) author-idiosyncratic, and the router may be fitting the author rather than
// real task nature. The labeler inputs are the JSON files at the paths given on the command line
// (two files: A and B) or in research/cross-author-labels/.
//
// Run: node evals/cross-author-check.js [pathA.json] [pathB.json]
'use strict';
const fs = require('fs');
const path = require('path');
const { ITEMS } = require('./validation.js');
const { route } = require('../router/task-router.js');

// If the label files are absent, exit 0 with a note (the harness is data-driven; its outputs on
// the real label inputs are recorded in research/ — never a hard repo failure).
if (!process.argv[2] || !process.argv[3]) {
  console.log('CROSS-AUTHOR CHECK: pass label .json paths; no files supplied, skipping.');
  process.exit(0);
}

const author = Object.fromEntries(ITEMS.map((it) => [it.id, `${it.expected.strategy}/${it.expected.model_action}`]));
const router = Object.fromEntries(ITEMS.map((it) => {
  const r = route(it.profile, {});
  return [it.id, `${r.strategy}/${r.model_action}`];
}));

function load(p) {
  const abs = path.isAbsolute(p) ? p : path.join(__dirname, '..', p);
  const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const out = {};
  for (const row of parsed) out[row.id] = `${row.strategy}/${row.model_action}`;
  return out;
}

function agreement(a, b, label) {
  const ids = Object.keys(a);
  let agree = 0;
  for (const id of ids) if (a[id] === b[id]) agree++;
  const rate = (agree / ids.length) * 100;
  console.log(`[${label}] agreement = ${agree}/${ids.length} (${rate.toFixed(1)}%)`);
  return { agree, n: ids.length, rate };
}

const labelerA = load(process.argv[2]);
const labelerB = load(process.argv[3]);

console.log('id'.padEnd(26), 'author'.padEnd(18), 'router'.padEnd(18), 'A'.padEnd(18), 'B'.padEnd(18), 'task');
for (const it of ITEMS) {
  console.log(
    it.id.padEnd(26),
    author[it.id].padEnd(18),
    router[it.id].padEnd(18),
    (labelerA[it.id] || '?').padEnd(18),
    (labelerB[it.id] || '?').padEnd(18),
    it.task.slice(0, 48)
  );
}

console.log('\n=== agreement totals (full strategy/model) ===');
agreement(author, router, 'author vs router');
agreement(author, labelerA, 'author vs A');
agreement(author, labelerB, 'author vs B');
agreement(router, labelerA, 'router vs A');
agreement(router, labelerB, 'router vs B');
agreement(labelerA, labelerB, 'A vs B');

// ---- strategy-only agreement: isolates "how hard to think" from "which model". The router's
//      strategy dimension is more load-bearing than its model_action hint (which a caller can
//      override from live capability state), so report it separately.
function strat(x) { const o = {}; for (const k in x) o[k] = x[k].split('/')[0]; return o; }
console.log('\n=== agreement totals (STRATEGY only) ===');
const sA = strat(author), sR = strat(router), sL1 = strat(labelerA), sL2 = strat(labelerB);
agreement(sA, sR, 'author vs router (strategy)');
agreement(sA, sL1, 'author vs A (strategy)');
agreement(sA, sL2, 'author vs B (strategy)');
agreement(sR, sL1, 'router vs A (strategy)');
agreement(sR, sL2, 'router vs B (strategy)');
agreement(sL1, sL2, 'A vs B (strategy)');

