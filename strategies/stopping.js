// Stopping-condition state machine: WHEN to stop deliberating and start executing.
// Directly implements the objective's "什么时候应该停止继续思考并开始执行" and the
// anti-over-deliberation rules ("不要无限研究" / "停止讨论 → 做决策 → 实现 → 验证").
//
// Each strategy has explicit stopping conditions:
//   fast       : stop NOW — write nothing more, execute directly.
//   structured : stop once the light plan (Objective/HardConstraints/Assumptions/Plan/Verification)
//                is written AND assumptions are explicit.
//   deep       : keep deliberating until ENOUGH EVIDENCE to decide, OR no new information for a
//                stagnation budget, OR attempt budget exhausted — then stop and act. Deliberation
//                must generate new information; otherwise it is just re-reading the same facts.
//
// The input `state` describes the deliberation so far:
//   { planWritten: bool, assumptionsExplicit: bool, evidenceSufficient: bool,
//     roundsSinceNewInfo: int, attempts: int }
// Budgets: DEEP_STAGNATION_ROUNDS = 2, DEEP_MAX_ATTEMPTS = 4.

'use strict';

const BUDGETS = {
  DEEP_STAGNATION_ROUNDS: 2, // no NEW information for this many rounds -> stop, act in parallel
  DEEP_MAX_ATTEMPTS: 4,      // hard cap on attempts -> stop (matches FAILURE_THRESHOLD spirit)
  STRUCTURED_FIELDS: 5,
};

function b(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * shouldStop(strategy, state, opts?) -> { stop: bool, reason: string }
 * @param {string} strategy 'fast' | 'structured' | 'deep'
 * @param {object} state { planWritten, assumptionsExplicit, evidenceSufficient,
 *                         roundsSinceNewInfo, attempts }
 * @param {object} [opts] { budgets } overrides for BUDGETS.
 */
function shouldStop(strategy, state = {}, opts = {}) {
  const B = Object.assign({}, BUDGETS, opts.budgets || {});

  if (strategy === 'fast') {
    return { stop: true, reason: 'fast: no deliberation needed — execute directly' };
  }

  if (strategy === 'structured') {
    const planWritten = !!state.planWritten;
    const assumptionsExplicit = !!state.assumptionsExplicit;
    if (planWritten && assumptionsExplicit) {
      return { stop: true, reason: 'structured: plan + assumptions explicit — start executing (light verify)' };
    }
    return { stop: false, reason: 'structured: still refining the light plan' };
  }

  if (strategy === 'deep') {
    // Enough evidence to decide -> stop.
    if (state.evidenceSufficient) {
      return { stop: true, reason: 'deep: evidence sufficient to decide — stop deliberating, act' };
    }
    // No new information for a stagnation budget -> more deliberation is re-reading, not learning.
    const stagnation = b(state.roundsSinceNewInfo, 0);
    if (stagnation >= B.DEEP_STAGNATION_ROUNDS) {
      return { stop: true, reason: `deep: ${stagnation} rounds without new information — stop, act (or parallelize independent parts)` };
    }
    // Hard attempt cap.
    const attempts = b(state.attempts, 0);
    if (attempts >= B.DEEP_MAX_ATTEMPTS) {
      return { stop: true, reason: `deep: ${attempts} attempts exhausted — stop deliberating, decide from current evidence` };
    }
    return { stop: false, reason: 'deep: keep deliberating — still gaining new information' };
  }

  // Unknown strategy: safe default — stop (don't hang).
  return { stop: true, reason: `unknown strategy '${strategy}' — stopping safely` };
}

module.exports = { shouldStop, BUDGETS };
