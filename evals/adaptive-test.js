// Adaptive-loop test: the feedback loop must re-route on failure (feed failures_so_far back into
// the router, deepening/upgrading at the repeated-failure threshold) and must be bounded
// (cannot loop forever). Uses mock executors, fully deterministic.
//
// Run: node evals/adaptive-test.js
'use strict';
const { run, runAsync, adaptiveLoop } = require('../router/adaptive-loop.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// ---- Case 1: trivial task succeeds on attempt 1, no escalation ----
{
  const task = 'Rename the local variable foo to bar in a 30-line function.';
  const final = run({
    task,
    execute: () => ({ ok: true }),
  });
  check('trivial task stops immediately', final.done === true && final.success === true,
    `attempts=${final.attempts} strategy=${final.strategy} model=${final.model_action}`);
  check('trivial task never escalates', final.model_action === 'keep' && final.failures === 0);
}

// ---- Case 2: fails 3 times then succeeds -> loop feeds failures back -> router escalates to
//      upgrade exactly when failures>=3 (repeated-failure rule), then succeeds ----
{
  // Explicit, neutral profile: no inherent failures, verif 0.6 (> V_MID so the repeated-failure
  // upgrade rule can fire). Initially routes structured/keep; escalates to deep/upgrade once the
  // loop has fed back 3 failures.
  const profile = {
    clarity: 0.6, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0.3,
    reasoning_complexity: 0.5, novelty: 0.4, error_cost: 0.4, reversibility: 0.5,
    verification_difficulty: 0.6, tool_dependency: false, context_size: 'small',
    parallelism: false, failures_so_far: 0,
  };
  let calls = 0;
  const final = run({
    profile,
    current_model_tier: 'auto',
    execute: () => {
      calls += 1;
      return { ok: calls >= 4 }; // fail attempts 1-3, succeed on 4
    },
  });
  check('failure-feeding loop succeeds within budget', final.success === true,
    `attempts=${final.attempts} calls=${calls} failures=${final.failures}`);
  check('repeated failures escalate model', final.history.some((h) => h.model_action === 'upgrade'),
    JSON.stringify(final.history.map((h) => `${h.attempt}:${h.strategy}/${h.model_action}`)));
  // Escalation must fire on/after the 3rd failure (failures>=3 fed back into the router).
  const upgraded = final.history.filter((h) => h.model_action === 'upgrade');
  check('escalation fires when failures>=3 fed back',
    upgraded.length >= 1 && upgraded[0].attempt >= 3 && final.history.find((h) => h.attempt === 3).failures >= 3,
    `first upgrade attempt=${upgraded.length ? upgraded[0].attempt : 'none'}`);
}

// ---- Case 3: always-failing task stops within budget (no infinite loop) ----
{
  const task = 'Review the security of our auth flow before we launch to production.';
  let calls = 0;
  const final = run({
    task,
    execute: () => { calls += 1; return { ok: false }; },
  });
  check('always-failing loop is bounded', final.done === true && final.success === false,
    `attempts=${final.attempts} calls=${calls}`);
  check('loop stops within the attempt budget', final.attempts <= 10, `attempts=${final.attempts}`);
}

// ---- Case 4: step-wise controller works (route before any execution) ----
{
  const task = 'Convert this markdown file to HTML.';
  const loop = adaptiveLoop({ task });
  const first = loop.step(); // route, no execution yet
  check('step-wise initial route works', first.strategy !== null && first.attempts === 0,
    `strategy=${first.strategy} attempts=${first.attempts}`);
  const s1 = loop.step({ ok: true });
  check('step-wise success completes loop', s1.done === true && s1.success === true);
}

// ---- Case 5: async run (runAsync) — the adapter for real subagent executors. Same bounded,
//      failure-feeding policy, but the execute step may return a Promise (await a real agent).
;(async () => {
  const profile = {
    clarity: 0.6, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0.3,
    reasoning_complexity: 0.5, novelty: 0.4, error_cost: 0.4, reversibility: 0.5,
    verification_difficulty: 0.6, tool_dependency: false, context_size: 'small',
    parallelism: false, failures_so_far: 0,
  };
  let calls = 0;
  const final = await runAsync({
    profile,
    current_model_tier: 'auto',
    maxSteps: 10,
    execute: async ({ attempt }) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 1)); // simulate awaiting a real subagent
      return { ok: calls >= 4 }; // fail attempts 1-3, succeed on 4
    },
  });
  check('runAsync succeeds within budget', final.success === true,
    `attempts=${final.attempts} calls=${calls} failures=${final.failures}`);
  check('runAsync escalates on repeated failure (failures>=3 fed back)',
    final.model_action === 'upgrade' && final.history.some((h) => h.model_action === 'upgrade'),
    `model=${final.model_action}`);
  check('runAsync is bounded', final.attempts <= 10, `attempts=${final.attempts}`);
  console.log(failures === 0 ? 'ADAPTIVE TEST PASS: execution feedback loop re-routes on failure and stays bounded'
    : `ADAPTIVE TEST FAIL: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();