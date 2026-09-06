// Stopping-condition test: asserts when deliberation should STOP and start executing, per the
// objective's "什么时候应该停止继续思考并开始执行" + "不要无限研究".
// Transition-table assertions: each (strategy, state) -> expected stop decision.
//
// Run: node evals/stopping-test.js
'use strict';
const { shouldStop } = require('../strategies/stopping.js');

let failures = 0;
const check = (name, got, want) => {
  const ok = got.stop === want;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}: stop=${got.stop} (want ${want}) — ${got.reason}`);
};

// --- fast: always stop immediately (no deliberation) ---
check('fast stops immediately (no plan)', shouldStop('fast', {}), true);
check('fast stops even mid-deliberation state', shouldStop('fast', { evidenceSufficient: false }), true);

// --- structured: needs planWritten AND assumptionsExplicit ---
check('structured keeps going with no plan', shouldStop('structured', {}), false);
check('structured keeps going with plan but no explicit assumptions',
  shouldStop('structured', { planWritten: true, assumptionsExplicit: false }), false);
check('structured stops with plan + explicit assumptions',
  shouldStop('structured', { planWritten: true, assumptionsExplicit: true }), true);

// --- deep: stop on sufficient evidence ---
check('deep stops when evidence sufficient',
  shouldStop('deep', { evidenceSufficient: true }), true);

// --- deep: anti-over-deliberation — stop on stagnation (no new info) ---
check('deep keeps going with new information (roundsSinceNewInfo=1)',
  shouldStop('deep', { roundsSinceNewInfo: 1 }), false);
check('deep stops after 2 rounds without new info',
  shouldStop('deep', { roundsSinceNewInfo: 2 }), true);
check('deep stops after 3 rounds without new info',
  shouldStop('deep', { roundsSinceNewInfo: 3, attempts: 1 }), true);

// --- deep: hard attempt cap (anti "无限研究") ---
check('deep keeps going under attempt budget',
  shouldStop('deep', { attempts: 2, roundsSinceNewInfo: 0 }), false);
check('deep stops after max attempts',
  shouldStop('deep', { attempts: 4, roundsSinceNewInfo: 0 }), true);

// --- deep: still-gaining-new-information keeps going (under all budgets) ---
check('deep keeps going while learning (attempts=1, fresh)',
  shouldStop('deep', { attempts: 1, roundsSinceNewInfo: 0, evidenceSufficient: false }), false);

// --- unknown strategy: safe stop ---
check('unknown strategy stops safely', shouldStop('other', {}), true);

console.log(failures === 0 ? 'STOPPING TEST PASS: deliberation stop conditions correct (incl. anti-over-deliberation)'
  : `STOPPING TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
