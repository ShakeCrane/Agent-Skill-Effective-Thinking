// Adaptive execution loop.
// Closes the feedback loop the router needs to be adaptive, not a one-shot predicate:
//
//   route(profile) -> strategy/model -> EXECUTE -> observe outcome
//        ^                                            |
//        +--- feed failures_so_far back -------------+
//                 (may deepen strategy / upgrade model)
//
// This implements the objective's "已发生失败次数" signal "for real": the loop feeds execution
// failures back into the router, which escalates/deepens at the repeated-failure threshold.
// Retries are bounded (hard attempt budget; deep strategy additionally bound by the stopping
// conditions), so the loop cannot run forever ("不要无限研究").
//
// Policy (clear, defensible):
//   - The loop ALWAYS executes at least once (deliberation-done != task-done).
//   - After a SUCCESS -> done.
//   - After a FAILURE -> failures++, re-route (may escalate); continue unless
//       (a) attempts >= MAX_STEPS (hard EXECUTION attempt budget), or
//       (b) strategy is DEEP and shouldStop says stop (anti-无限研究 bounds).
//   - The task's description may already report prior failures (e.g. "has failed 5 times") —
//     those are COMBINED with in-loop failures, not overwritten.
//
// TWO SEPARATE BUDGETS — do not conflate them:
//   * EXECUTION attempt budget (`MAX_STEPS`): how many times `execute()` may be called at all.
//     Its exhaustion is terminal by itself and is reported as `execution: attempt budget
//     exhausted`. It is NOT a deliberation signal.
//   * DELIBERATION budgets (in strategies/stopping.js: DEEP_STAGNATION_ROUNDS,
//     DEEP_MAX_ATTEMPTS): when the DEEP strategy should stop deliberating and act. These bound
//     the strategy, not the execution count.
//
// SINGLE SOURCE OF TRUTH for the execution attempt budget: `normalizeMaxSteps()` below. The loop
// enforces it; `run()`/`runAsync()` own NO budget of their own and simply drive the loop until it
// reports done. (Fix: the driver used to keep a second, independent `guard < cap + 1` counter while
// the loop separately enforced `budgets.MAX_STEPS`, so `run({maxSteps:1})` executed twice and could
// return `done:false`. Two budgets = no budget.)
//
// Environment-agnostic: injected execute() returns { ok, newInfo? }. Fully testable in pure Node.

'use strict';
const { route } = require('./task-router.js');
const { extract } = require('./extract.js');
const { shouldStop } = require('../strategies/stopping.js');

const DEFAULT_BUDGET = { MAX_STEPS: 10 };

// The single hard attempt-budget stop reason. Deliberately distinct from every stopping.js reason
// so an exhausted execution budget can never be mistaken for a strategy/deliberation decision.
const ATTEMPT_BUDGET_REASON = 'execution: attempt budget exhausted';

/**
 * normalizeMaxSteps(opts) -> positive int
 * The ONE place the execution attempt budget is resolved. Precedence:
 *   1. an explicit `opts.maxSteps` (the direct `run({maxSteps:N})` API) — wins when both are given;
 *   2. `opts.budgets.MAX_STEPS` (the loop's own override);
 *   3. DEFAULT_BUDGET.MAX_STEPS.
 * Invalid values (non-finite, or < 1) are a caller error, not a silent fallback: a budget of 0
 * would mean "never execute", which contradicts the loop's always-execute-once policy, and a
 * negative/garbage budget is almost always a bug. Fail loud instead of guessing.
 */
function normalizeMaxSteps(opts = {}) {
  const explicit = opts.maxSteps;
  const fromBudgets = (opts.budgets || {}).MAX_STEPS;
  const raw = explicit !== undefined && explicit !== null ? explicit : fromBudgets;
  if (raw === undefined || raw === null) return DEFAULT_BUDGET.MAX_STEPS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new RangeError(
      `adaptive-loop: maxSteps/MAX_STEPS must be a positive integer, received ${JSON.stringify(raw)}`
    );
  }
  return Math.floor(n);
}

function buildProfile(task, profile, inLoopFailures) {
  const base = profile || extract(task);
  const inherent = Number.isFinite(Number(base.failures_so_far)) ? Number(base.failures_so_far) : 0;
  return Object.assign({}, base, { failures_so_far: inherent + inLoopFailures });
}

/**
 * adaptiveLoop({ task, profile, current_model_tier, budgets, maxSteps }) -> loop
 * loop.step(execResult?) : execResult undefined = initial route (never done; we will execute).
 *                          execResult {ok, newInfo?} = record outcome, re-route, decide done.
 * loop.state: { attempts, failures, strategy, model_action, done, success, stopReason, history }
 *
 * `maxSteps` and `budgets.MAX_STEPS` are two spellings of the SAME budget; an explicit `maxSteps`
 * wins (see normalizeMaxSteps). Whichever is used, the loop is the only enforcer: after at most
 * `maxSteps` executions it is terminal, even if the strategy would happily continue.
 */
function adaptiveLoop(opts = {}) {
  const task = opts.task;
  const profile = opts.profile;
  const tier = opts.current_model_tier || 'auto';
  const maxSteps = normalizeMaxSteps(opts);

  const state = {
    attempts: 0,
    failures: 0,
    roundsSinceNewInfo: 0, // accumulated CONSECUTIVE no-new-info rounds (drives deep stagnation stop)
    strategy: null,
    model_action: null,
    done: false,
    success: false,
    stopReason: null, // why the loop became terminal: success / execution budget / strategy stop
    history: [],
  };

  function step(execResult) {
    if (state.done) return state;

    const haveResult = !!execResult;
    if (haveResult) {
      state.attempts += 1;
      if (!execResult.ok) state.failures += 1;
      // Accumulate CONSECUTIVE no-new-info rounds (the deep stagnation budget) instead of deriving a
      // non-cumulative 0/1 from the current round only. `newInfo === false` is an explicit "no new
      // information"; any other value (true, or omitted) resets the counter. Without accumulation the
      // "no new info -> no new info -> stagnation stop" condition in stopping.js was unreachable.
      if (execResult.newInfo === false) {
        state.roundsSinceNewInfo += 1;
      } else {
        state.roundsSinceNewInfo = 0;
      }
    }

    const p = buildProfile(task, profile, state.failures);
    const r = route(p, { current_model_tier: tier });
    state.strategy = r.strategy;
    state.model_action = r.model_action;

    if (!haveResult) {
      // Initial route only: never done (deliberation-done != task-done; we always execute at least once).
      state.history.push({
        attempt: state.attempts, failures: state.failures,
        strategy: r.strategy, model_action: r.model_action, stopReason: null, done: false,
      });
      return state;
    }

    const s = shouldStop(r.strategy, {
      planWritten: true,
      assumptionsExplicit: true,
      evidenceSufficient: !!execResult.ok,
      attempts: state.attempts,
      roundsSinceNewInfo: state.roundsSinceNewInfo,
    });

    if (execResult.ok) {
      state.done = true;
      state.success = true;
    } else if (state.attempts >= maxSteps) {
      // HARD execution attempt budget exhausted — terminal on its own, and reported with its own
      // reason so it is never confused with a strategy/doc deliberation decision.
      state.done = true;
      state.stopReason = ATTEMPT_BUDGET_REASON;
    } else if (r.strategy === 'deep' && s.stop) {
      state.done = true; // deep anti-无限研究 bound (stagnation / deliberation attempts)
      state.stopReason = s.reason;
    } else {
      // Not done: re-execute. `shouldStop` is still reported on the attempts that continue so the
      // strategy's own deliberation view stays observable, but it does not end the loop.
      state.stopReason = null;
    }

    state.history.push({
      attempt: state.attempts, failures: state.failures,
      strategy: r.strategy, model_action: r.model_action,
      stopReason: state.done ? state.stopReason : s.reason,
      done: state.done,
    });
    return state;
  }

  return { step, get state() { return state; } };
}

/**
 * Drive the loop to termination.
 * There is NO separate driver-side budget: `adaptiveLoop` owns the attempt budget, so the driver
 * only stops when the loop reports done. `maxSteps` is forwarded into the loop and is the same
 * number in both APIs — `run({maxSteps:N})` calls `execute()` at most N times, period.
 */
function executeArgs(s) {
  return { strategy: s.strategy, model_action: s.model_action, attempt: s.attempts };
}

/**
 * run({ task, profile, current_model_tier, execute, maxSteps }) -> final state
 * Drives the loop to completion. execute({ strategy, model_action, attempt }) -> { ok, newInfo? }
 * At most `maxSteps` executions (default 10). On exhaustion: done=true, success=false,
 * stopReason='execution: attempt budget exhausted'.
 *
 * Synchronous by construction: a synchronous executor is never raced against a Promise.
 */
function run(opts = {}) {
  if (typeof opts.execute !== 'function') {
    throw new TypeError('adaptive-loop: run() requires an execute() function');
  }
  const loop = adaptiveLoop(opts);
  let s = loop.step(); // initial route
  while (!s.done) {
    s = loop.step(opts.execute(executeArgs(s)));
  }
  return loop.state;
}

/**
 * runAsync({ task, profile, current_model_tier, execute, maxSteps }) -> Promise<final state>
 * Async variant of run for REAL subagents/executors: execute may return { ok, newInfo? } or a
 * Promise (e.g. await a real agent's attempt and its verification). Same bounded policy and the
 * SAME attempt-budget semantics as run() — just awaiting each execution step.
 */
async function runAsync(opts = {}) {
  if (typeof opts.execute !== 'function') {
    throw new TypeError('adaptive-loop: runAsync() requires an execute() function');
  }
  const loop = adaptiveLoop(opts);
  let s = loop.step(); // initial route
  while (!s.done) {
    s = loop.step(await opts.execute(executeArgs(s)));
  }
  return loop.state;
}

module.exports = { adaptiveLoop, run, runAsync, buildProfile, normalizeMaxSteps, DEFAULT_BUDGET, ATTEMPT_BUDGET_REASON };
