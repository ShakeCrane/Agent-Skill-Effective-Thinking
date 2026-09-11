// Adaptive-loop test: the feedback loop must re-route on failure (feed failures_so_far back into
// the router, deepening/upgrading at the repeated-failure threshold) and must be bounded
// (cannot loop forever). Uses mock executors, fully deterministic.
//
// Run: node evals/adaptive-test.js
'use strict';
const { run, runAsync, adaptiveLoop, normalizeMaxSteps, DEFAULT_BUDGET, ATTEMPT_BUDGET_REASON } =
  require('../router/adaptive-loop.js');

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

// ============================================================================
// Case 8-11 (P1 regression): the EXECUTION attempt budget is exact.
//
// Bug being locked down: `run()`/`runAsync()` kept their own `guard < cap + 1` counter while
// `adaptiveLoop` separately enforced `budgets.MAX_STEPS`, so:
//   - maxSteps=1 executed the task TWICE and could return `done:false`;
//   - maxSteps=2 executed three times;
//   - an exhausted hard budget was even reported with the STRATEGY's stopping reason
//     ("deep: keep deliberating — …"), which is semantically the opposite of a hard stop.
// Invariant now: maxSteps=N -> execute() is called at most N times, the loop is terminal at N, and
// exhaustion has its own reason that can never be mistaken for a deliberation decision.
// ============================================================================
const ALWAYS_FAIL_TASK = 'Review the security of our auth flow before we launch to production.';
const failExpr = (counter) => () => { counter.calls += 1; return { ok: false }; };

// ---- Case 8: maxSteps=1, executor always fails -> exactly 1 attempt, terminal, budget reason ----
{
  const c = { calls: 0 };
  const final = run({ task: ALWAYS_FAIL_TASK, maxSteps: 1, execute: failExpr(c) });
  check('maxSteps=1 executes exactly once', c.calls === 1, `execute calls=${c.calls}`);
  check('maxSteps=1 is terminal after one failure',
    final.done === true && final.success === false && final.attempts === 1,
    `done=${final.done} success=${final.success} attempts=${final.attempts}`);
  check('maxSteps=1 reports the execution attempt budget reason',
    final.stopReason === ATTEMPT_BUDGET_REASON, JSON.stringify(final.stopReason));
  check('maxSteps=1 history reason is the budget reason (not a strategy reason)',
    final.history[final.history.length - 1].stopReason === ATTEMPT_BUDGET_REASON,
    JSON.stringify(final.history[final.history.length - 1].stopReason));
  check('maxSteps=1 does not reuse a deep/deliberation stop reason',
    !/deliberat|without new information|evidence sufficient/.test(String(final.stopReason)),
    JSON.stringify(final.stopReason));
}

// ---- Case 9: maxSteps=2, executor always fails -> exactly 2 attempts, terminal ----
{
  const c = { calls: 0 };
  const final = run({ task: ALWAYS_FAIL_TASK, maxSteps: 2, execute: failExpr(c) });
  check('maxSteps=2 executes exactly twice', c.calls === 2, `execute calls=${c.calls}`);
  check('maxSteps=2 is terminal at the budget',
    final.done === true && final.success === false && final.attempts === 2,
    `done=${final.done} attempts=${final.attempts}`);
  check('maxSteps=2 reports the execution attempt budget reason',
    final.stopReason === ATTEMPT_BUDGET_REASON, JSON.stringify(final.stopReason));
}

// ---- Case 10: maxSteps=1 and the FIRST attempt succeeds -> exactly 1 attempt, success ----
{
  const c = { calls: 0 };
  const final = run({
    task: 'Rename the local variable foo to bar in a 30-line function.',
    maxSteps: 1,
    execute: () => { c.calls += 1; return { ok: true }; },
  });
  check('maxSteps=1 first-attempt success executes once and succeeds',
    c.calls === 1 && final.done === true && final.success === true && final.attempts === 1,
    `execute calls=${c.calls} done=${final.done} success=${final.success}`);
  check('a successful run carries no failure stop reason', final.stopReason === null,
    JSON.stringify(final.stopReason));
}

// ---- Case 11: success on the FINAL permitted attempt -> not cut short, marked success ----
{
  const c = { calls: 0 };
  const final = run({
    task: ALWAYS_FAIL_TASK,
    maxSteps: 2,
    execute: () => { c.calls += 1; return { ok: c.calls >= 2 }; }, // succeed on the last allowed attempt
  });
  check('success on the final permitted attempt is not cut short',
    c.calls === 2 && final.attempts === 2 && final.done === true && final.success === true,
    `execute calls=${c.calls} attempts=${final.attempts} done=${final.done} success=${final.success}`);
}

// ---- Case 12: explicit `maxSteps` wins over `budgets.MAX_STEPS`, and `budgets.MAX_STEPS` alone
//      (the direct `adaptiveLoop` spelling) is honored. One source of truth for both spellings. ----
{
  check('explicit maxSteps wins over budgets.MAX_STEPS',
    normalizeMaxSteps({ maxSteps: 1, budgets: { MAX_STEPS: 9 } }) === 1,
    `maxSteps=1 budgets.MAX_STEPS=9 -> ${normalizeMaxSteps({ maxSteps: 1, budgets: { MAX_STEPS: 9 } })}`);
  check('budgets.MAX_STEPS is honored when maxSteps is absent',
    normalizeMaxSteps({ budgets: { MAX_STEPS: 3 } }) === 3,
    `-> ${normalizeMaxSteps({ budgets: { MAX_STEPS: 3 } })}`);
  check('default attempt budget is used when neither is given',
    normalizeMaxSteps({}) === DEFAULT_BUDGET.MAX_STEPS, `-> ${normalizeMaxSteps({})}`);
  let threw = null;
  try { normalizeMaxSteps({ maxSteps: 0 }); } catch (e) { threw = e; }
  check('an impossible (0) attempt budget fails loud instead of guessing', threw instanceof RangeError,
    threw ? threw.message : 'no error thrown');
}

// ---- Case 13: direct loop API — `adaptiveLoop({budgets:{MAX_STEPS:1}})` is terminal after ONE
//      failure, with the execution-budget reason and NOT a strategy reason. ----
{
  const loop = adaptiveLoop({ task: ALWAYS_FAIL_TASK, budgets: { MAX_STEPS: 1 } });
  let s = loop.step(); // initial route
  const afterFailure = loop.step({ ok: false });
  check('direct loop with MAX_STEPS=1 is terminal after one failed attempt',
    afterFailure.done === true && afterFailure.success === false && afterFailure.attempts === 1,
    `done=${afterFailure.done} success=${afterFailure.success} attempts=${afterFailure.attempts}`);
  check('direct loop reports the execution budget reason',
    afterFailure.stopReason === ATTEMPT_BUDGET_REASON, JSON.stringify(afterFailure.stopReason));
  check('direct loop does not report a strategy/deliberation stop reason',
    !/deliberat|without new information|evidence sufficient|structured:|fast:/.test(String(afterFailure.stopReason)),
    JSON.stringify(afterFailure.stopReason));
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

// ---- Case 6 (regression): a DEEP task with consecutive no-new-info rounds must stop via
//      STAGNATION (roundsSinceNewInfo accumulating to the budget), NOT via the attempt cap. The
//      pre-fix loop derived roundsSinceNewInfo as 0/1 per round, so "no info -> no info -> stop"
//      was unreachable and only the attempt cap could end it. ----
{
  const profile = {
    clarity: 0.5, hidden_constraint: 0.7, constraint_count: 2, constraint_conflict: 0.4,
    reasoning_complexity: 0.5, novelty: 0.5, error_cost: 0.5, reversibility: 0.4,
    verification_difficulty: 0.8, tool_dependency: false, context_size: 'small',
    parallelism: false, failures_so_far: 0,
  };
  let calls = 0;
  const final = run({
    profile,
    current_model_tier: 'auto',
    maxSteps: 20, // attempt cap far above the stagnation budget (2), so a stop here can only be stagnation
    execute: () => { calls += 1; return { ok: false, newInfo: false }; },
  });
  check('stagnation stops deep loop before attempt cap',
    final.done === true && final.success === false && final.attempts === 2,
    `attempts=${final.attempts} calls=${calls}`);
  const last = final.history[final.history.length - 1];
  check('stop reason is stagnation (not attempt cap)',
    /without new information/.test(last.stopReason || ''), last.stopReason || '(none)');
  check('stagnation counter accumulated across rounds',
    final.roundsSinceNewInfo === 2, `roundsSinceNewInfo=${final.roundsSinceNewInfo}`);
}

// ---- Case 7 (regression complement): new information resets the stagnation counter, so an
//      alternating no-info/new-info deep loop is NOT stopped by stagnation. ----
{
  const profile = {
    clarity: 0.5, hidden_constraint: 0.7, constraint_count: 2, constraint_conflict: 0.4,
    reasoning_complexity: 0.5, novelty: 0.5, error_cost: 0.5, reversibility: 0.4,
    verification_difficulty: 0.8, tool_dependency: false, context_size: 'small',
    parallelism: false, failures_so_far: 0,
  };
  let calls = 0;
  const loop = adaptiveLoop({ profile });
  loop.step();
  const a = loop.step({ ok: false, newInfo: false });
  const b = loop.step({ ok: false, newInfo: true }); // new info resets the streak
  check('new info resets the stagnation counter', b.roundsSinceNewInfo === 0,
    `roundsSinceNewInfo=${b.roundsSinceNewInfo} after ${JSON.stringify({ a: a.roundsSinceNewInfo })}`);
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
  check('runAsync success on the final permitted attempt is not cut short',
    final.attempts === 4 && final.success === true && final.stopReason === null,
    `attempts=${final.attempts} success=${final.success} stopReason=${JSON.stringify(final.stopReason)}`);

  // ---- P1 regression, async: runAsync must obey the SAME exact attempt budget as run() ----

  // Case 14: runAsync maxSteps=1, always failing -> exactly 1 attempt, terminal, budget reason
  {
    let calls = 0;
    const s1 = await runAsync({
      task: ALWAYS_FAIL_TASK,
      maxSteps: 1,
      execute: async () => { calls += 1; return { ok: false }; },
    });
    check('runAsync maxSteps=1 executes exactly once', calls === 1, `execute calls=${calls}`);
    check('runAsync maxSteps=1 is terminal with the budget reason',
      s1.done === true && s1.success === false && s1.attempts === 1 && s1.stopReason === ATTEMPT_BUDGET_REASON,
      `done=${s1.done} success=${s1.success} attempts=${s1.attempts} reason=${JSON.stringify(s1.stopReason)}`);

    // Case 15: runAsync maxSteps=2, always failing -> exactly 2 attempts, terminal
    let calls2 = 0;
    const s2 = await runAsync({
      task: ALWAYS_FAIL_TASK,
      maxSteps: 2,
      execute: async () => { calls2 += 1; return { ok: false }; },
    });
    check('runAsync maxSteps=2 executes exactly twice', calls2 === 2, `execute calls=${calls2}`);
    check('runAsync maxSteps=2 is terminal with the budget reason',
      s2.done === true && s2.success === false && s2.attempts === 2 && s2.stopReason === ATTEMPT_BUDGET_REASON,
      `done=${s2.done} attempts=${s2.attempts} reason=${JSON.stringify(s2.stopReason)}`);

    // ---- Case 16: sync and async terminal semantics are IDENTICAL for the same budget/executor ----
    for (const maxSteps of [1, 2, 3]) {
      let sc = 0;
      const sync = run({ task: ALWAYS_FAIL_TASK, maxSteps, execute: () => { sc += 1; return { ok: false }; } });
      let ac = 0;
      const async_ = await runAsync({ task: ALWAYS_FAIL_TASK, maxSteps, execute: async () => { ac += 1; return { ok: false }; } });
      const same = sc === ac && sync.attempts === async_.attempts && sync.done === async_.done &&
        sync.success === async_.success && sync.stopReason === async_.stopReason;
      check(`sync/async terminal semantics identical at maxSteps=${maxSteps}`, same,
        `sync{calls=${sc},attempts=${sync.attempts},done=${sync.done},ok=${sync.success},reason=${JSON.stringify(sync.stopReason)}} ` +
        `async{calls=${ac},attempts=${async_.attempts},done=${async_.done},ok=${async_.success},reason=${JSON.stringify(async_.stopReason)}}`);
    }
  }

  console.log(failures === 0 ? 'ADAPTIVE TEST PASS: execution feedback loop re-routes on failure and stays bounded'
    : `ADAPTIVE TEST FAIL: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();