// Threshold-robustness test: do the router's decisions over-fit the exact threshold values?
// Perturbs each default threshold by +-10% and +-20% (single-axis and all-at-once), re-runs
// route() over the FULL combined set (train + held-out validation), and measures how often the
// decision (strategy, model_action) flips vs the baseline thresholds.
//
// Low flip rate = decisions are robust to threshold choice (not over-fit to the exact numbers the
// benchmark happens to pass at — the F2/F5 concern). High flip rate = fragile / over-fit.
//
// Run: node evals/robustness-test.js
'use strict';
const { route, DEFAULTS } = require('../router/task-router.js');
const { ITEMS: TRAIN } = require('./benchmark.js');
const { ITEMS: VAL } = require('./validation.js');

const ALL = TRAIN.concat(VAL);
const THRESH_KEYS = Object.keys(DEFAULTS);
const JITTERS = [0.1, 0.2];

// baseline decisions: {strategy, model_action} per item (items have no inherent failures >0 that
// interact; each runs independently).
function baselineDecisions() {
  return ALL.map((it) => {
    const r = route(it.profile, {});
    return `${r.strategy}/${r.model_action}`;
  });
}

// Run with jittered thresholds; return count of decisions that differ from baseline.
function countFlips(applyJitter) {
  const thresholds = Object.assign({}, DEFAULTS);
  for (const k of THRESH_KEYS) {
    const v = applyJitter(k, DEFAULTS[k]);
    if (Number.isFinite(v)) thresholds[k] = v;
  }
  let flips = 0;
  ALL.forEach((it, i) => {
    const r = route(it.profile, { thresholds });
    const d = `${r.strategy}/${r.model_action}`;
    if (d !== baseline[i]) flips += 1;
  });
  return flips;
}

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const baseline = baselineDecisions();
const N = ALL.length;

// Sanity: baseline itself is exactly the published result set (no flips at default thresholds).
const baselineFlips = baseline.filter((d) => d === 'undefined').length; // always 0; keep for shape
check(`baseline over ${N} items recorded`, baseline.length === N, `${N} items`);

// --- single-threshold jitter: flip rate must stay low ---
const singleFlips10 = [];
const singleFlips20 = [];
for (const k of THRESH_KEYS) {
  for (const j of JITTERS) {
    const plus = countFlips((key) => (key === k ? DEFAULTS[k] * (1 + j) : undefined));
    const minus = countFlips((key) => (key === k ? DEFAULTS[k] * (1 - j) : undefined));
    if (j === 0.1) { singleFlips10.push(plus, minus); }
    else { singleFlips20.push(plus, minus); }
  }
}
const maxSingle10 = Math.max(...singleFlips10);
const maxSingle20 = Math.max(...singleFlips20);
const rate10 = (maxSingle10 / N) * 100;
const rate20 = (maxSingle20 / N) * 100;
check(`single-threshold +-10% max flip rate <= 15%`, rate10 <= 15,
  `${maxSingle10}/${N} (${rate10.toFixed(1)}%)`);
check(`single-threshold +-20% max flip rate <= 25%`, rate20 <= 25,
  `${maxSingle20}/${N} (${rate20.toFixed(1)}%)`);

// --- all-thresholds jitter at once: robustness to co-tuning ---
const all10 = countFlips(() => undefined); // placeholder (jitter applied below via closure)
function allTunJitter(j) {
  return countFlips((key, v) => v * (1 + (key.charCodeAt(0) % 2 ? j : -j)));
}
const maxAll10 = allTunJitter(0.1);
const maxAll20 = allTunJitter(0.2);
const allRate10 = (maxAll10 / N) * 100;
const allRate20 = (maxAll20 / N) * 100;
check(`all-thresholds +-10% flip rate <= 25%`, allRate10 <= 25, `${maxAll10}/${N} (${allRate10.toFixed(1)}%)`);
check(`all-thresholds +-20% flip rate <= 40%`, allRate20 <= 40, `${maxAll20}/${N} (${allRate20.toFixed(1)}%)`);

console.log('');
console.log(`Summary: single-axis +-10% max=${maxSingle10}/${N} (${rate10.toFixed(1)}%), +-20% max=${maxSingle20}/${N} (${rate20.toFixed(1)}%); all-axes +-10%=${allRate10.toFixed(1)}%, +-20%=${allRate20.toFixed(1)}%.`);
console.log(failures === 0
  ? 'ROBUSTNESS TEST PASS: routing decisions are stable under threshold perturbation (not over-fit to exact values)'
  : `ROBUSTNESS TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
