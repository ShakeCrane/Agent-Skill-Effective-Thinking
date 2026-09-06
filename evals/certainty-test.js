// Decision-certainty test: the classifier exposes an honest confidence flag from threshold margins.
// Key behaviors:
//   1. clear trivial task        -> fast, HIGH certainty
//   2. decisive deep task        -> deep, HIGH certainty
//   3. F6 boundary item (verif .75, deep by 0.05) -> boundary certainty
//   4. structured midband        -> NOT high (honest middle)
//   5. monotonicity: moving a decisive signal toward its threshold lowers the certainty class.
//
// Run: node evals/certainty-test.js
'use strict';
const { classify } = require('../strategies/certainty.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// 1. clear trivial fast -> high
{
  const c = classify({ clarity: 0.95, hidden_constraint: 0.05, constraint_count: 1, constraint_conflict: 0, reasoning_complexity: 0.05, novelty: 0, error_cost: 0.05, reversibility: 0.95, verification_difficulty: 0.05, tool_dependency: false, context_size: 'small', parallelism: false, failures_so_far: 0 });
  check('trivial task: fast + high certainty', c.strategy === 'fast' && c.certainty === 'high', `${c.strategy}/${c.certainty} margin=${c.margin}`);
}

// 2. decisive deep -> high
{
  const c = classify({ clarity: 0.6, hidden_constraint: 0.6, constraint_count: 4, constraint_conflict: 0.6, reasoning_complexity: 0.9, novelty: 0.5, error_cost: 0.5, reversibility: 0.4, verification_difficulty: 0.8, tool_dependency: false, context_size: 'large', parallelism: false, failures_so_far: 0 });
  check('decisive deep: deep + high certainty', c.strategy === 'deep' && c.certainty === 'high', `${c.strategy}/${c.certainty} margin=${c.margin}`);
}

// 3. F6 boundary item (verif=0.75 -> deep by only 0.05) -> boundary
{
  const c = classify({ clarity: 0.6, hidden_constraint: 0.7, constraint_count: 2, constraint_conflict: 0.3, reasoning_complexity: 0.7, novelty: 0.5, error_cost: 0.4, reversibility: 0.5, verification_difficulty: 0.75, tool_dependency: false, context_size: 'small', parallelism: false, failures_so_far: 0 });
  check('F6 boundary item: deep + boundary/medium certainty', c.strategy === 'deep' && c.certainty !== 'high', `${c.strategy}/${c.certainty} margin=${c.margin}`);
}

// 4. structured middleband -> not high
{
  const c = classify({ clarity: 0.6, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0.3, reasoning_complexity: 0.5, novelty: 0.4, error_cost: 0.4, reversibility: 0.5, verification_difficulty: 0.4, tool_dependency: false, context_size: 'small', parallelism: false, failures_so_far: 0 });
  check('structured middleband: honest (not high)', c.strategy === 'structured' && c.certainty !== 'high', `${c.strategy}/${c.certainty} margin=${c.margin}`);
}

// 5. monotonicity: nudge a decisive signal toward its trigger threshold lowers certainty
{
  const base = { clarity: 0.95, hidden_constraint: 0.05, constraint_count: 1, constraint_conflict: 0, reasoning_complexity: 0.05, novelty: 0, error_cost: 0.05, reversibility: 0.95, verification_difficulty: 0.05, tool_dependency: false, context_size: 'small', parallelism: false, failures_so_far: 0 };
  const cHigh = classify(base);
  const cLow = classify(Object.assign({}, base, { clarity: 0.72 })); // barely above CLR_FAST=0.7
  check('moving toward the threshold lowers certainty',
    cHigh.certainty === 'high' && ['boundary', 'medium'].includes(cLow.certainty) && cLow.margin < cHigh.margin,
    `${cHigh.certainty}(m=${cHigh.margin}) -> ${cLow.certainty}(m=${cLow.margin})`);
}

console.log(failures === 0 ? 'CERTAINTY TEST PASS: decision certainty is honest and threshold-margin-based'
  : `CERTAINTY TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
