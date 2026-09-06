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
//       (a) attempts >= MAX_STEPS (hard budget), or
//       (b) strategy is DEEP and shouldStop says stop (anti-无限研究 bounds).
//   - The task's description may already report prior failures (e.g. "has failed 5 times") —
//     those are COMBINED with in-loop failures, not overwritten.
//
// Environment-agnostic: injected execute() returns { ok, newInfo? }. Fully testable in pure Node.

'use strict';
const { route } = require('./task-router.js');
const { extract } = require('./extract.js');
const { shouldStop } = require('../strategies/stopping.js');

const DEFAULT_BUDGET = { MAX_STEPS: 10 };

function buildProfile(task, profile, inLoopFailures) {
  const base = profile || extract(task);
  const inherent = Number.isFinite(Number(base.failures_so_far)) ? Number(base.failures_so_far) : 0;
  return Object.assign({}, base, { failures_so_far: inherent + inLoopFailures });
}

/**
 * adaptiveLoop({ task, profile, current_model_tier, budgets }) -> loop
 * loop.step(execResult?) : execResult undefined = initial route (never done; we will execute).
 *                          execResult {ok, newInfo?} = record outcome, re-route, decide done.
 * loop.state: { attempts, failures, strategy, model_action, done, success, history }
 */
function adaptiveLoop(opts = {}) {
  const task = opts.task;
  const profile = opts.profile;
  const tier = opts.current_model_tier || 'auto';
  const B = Object.assign({}, DEFAULT_BUDGET, opts.budgets || {});

  const state = {
    attempts: 0,
    failures: 0,
    strategy: null,
    model_action: null,
    done: false,
    success: false,
    history: [],
  };

  function step(execResult) {
    if (state.done) return state;

    const haveResult = !!execResult;
    if (haveResult) {
      state.attempts += 1;
      if (!execResult.ok) state.failures += 1;
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
      roundsSinceNewInfo: execResult.newInfo === false ? 1 : 0,
    });

    if (execResult.ok) {
      state.done = true;
      state.success = true;
    } else if (state.attempts >= B.MAX_STEPS) {
      state.done = true; // hard budget
    } else if (r.strategy === 'deep' && s.stop) {
      state.done = true; // deep anti-无限研究 bound (stagnation / attempts)
    }

    state.history.push({
      attempt: state.attempts, failures: state.failures,
      strategy: r.strategy, model_action: r.model_action,
      stopReason: (state.done && !execResult.ok) ? s.reason : null,
      done: state.done,
    });
    return state;
  }

  return { step, get state() { return state; } };
}

/**
 * run({ task, profile, current_model_tier, execute, maxSteps }) -> final state
 * Drives the loop to completion. execute({ strategy, model_action, attempt }) -> { ok, newInfo? }
 */
function run(opts = {}) {
  const loop = adaptiveLoop(opts);
  let s = loop.step(); // initial route
  let guard = 0;
  const cap = opts.maxSteps || DEFAULT_BUDGET.MAX_STEPS;
  while (!s.done && guard < cap + 1) {
    const result = opts.execute({
      strategy: s.strategy,
      model_action: s.model_action,
      attempt: s.attempts,
    });
    s = loop.step(result);
    guard += 1;
  }
  return loop.state;
}

/**
 * runAsync({ task, profile, current_model_tier, execute, maxSteps }) -> Promise<final state>
 * Async variant of run for REAL subagents/executors: execute may return { ok, newInfo? } or a
 * Promise (e.g. await a real agent's attempt and its verification). Same bounded policy, just
 * awaiting each execution step.
 */
async function runAsync(opts = {}) {
  const loop = adaptiveLoop(opts);
  let s = loop.step(); // initial route
  let guard = 0;
  const cap = opts.maxSteps || DEFAULT_BUDGET.MAX_STEPS;
  while (!s.done && guard < cap + 1) {
    const result = await opts.execute({
      strategy: s.strategy,
      model_action: s.model_action,
      attempt: s.attempts,
    });
    s = loop.step(result);
    guard += 1;
  }
  return loop.state;
}

module.exports = { adaptiveLoop, run, runAsync, buildProfile, DEFAULT_BUDGET };
