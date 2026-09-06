// Task Router — lightweight, deterministic, inspectable.
// Given a minimal task profile, decides execution strategy and model action.
// See methods/core/task-router.md for the design and thresholds.

'use strict';

const { capabilityMismatch } = require('./capabilities.js');

// ---- Default thresholds (keep round and few; see router.md) ----
const DEFAULTS = {
  CLR_FAST: 0.7,        // clarity needed to go Fast
  CLR_DEEP: 0.4,        // clarity below which a task is ambiguous enough to consider Deep (with non-trivial verification)
  V_EASY: 0.3,          // verification difficulty at/below which verification is trivial
  R_LOW: 0.3,           // reasoning complexity at/below which Fast is OK
  H_LOW: 0.2,           // hidden-constraint probability at/below which Fast ignores it
  E_LOW: 0.3,           // error cost at/below which Fast is acceptable
  REV_HIGH: 0.7,        // reversibility at/above which mistakes are cheap
  V_HIGH: 0.7,          // verification difficulty at/above which we go Deep
  R_HIGH: 0.7,          // reasoning complexity at/above which we go Deep
  N_HIGH: 0.7,          // novelty at/above which we go Deep
  C_HIGH: 0.7,          // constraint conflict threshold
  C_COUNT_HIGH: 4,      // several constraints at once
  H_HIGH: 0.6,          // high hidden-constraint probability
  V_MID: 0.5,
  E_HIGH_OR_DEEP: 0.7,
  FAILURE_THRESHOLD: 3,
  REV_LOW: 0.3,         // reversibility at/below which a mistake is effectively irreversible
};

// Ensure a signal is a number in [0,1]; ignore NaN/undefined by returning fallback.
function sig(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

/**
 * route(taskProfile, opts)
 * @param {object} p task profile. Fields per router.md:
 *   clarity, hidden_constraint, constraint_count, constraint_conflict,
 *   reasoning_complexity, novelty, error_cost, reversibility,
 *   verification_difficulty, tool_dependency, context_size, parallelism,
 *   failures_so_far
 * @param {object} [opts]
 *   - mismatch: bool — caller's concrete capability-mismatch estimate (default false)
 *   - model_capabilities: { reasoning, context, reliability } — the CURRENT model's capability
 *     profile; when provided, escalation is computed from the task-vs-model capability mismatch
 *     (see router/capabilities.js).
 *   - current_model_tier: 'strong' | 'cheap' | 'auto' (default 'auto') — whether the current
 *     model is a strong one, so a fast mechanical task can be handed DOWN to a cheaper model.
 *   - thresholds: partial override of DEFAULTS
 * @returns {{strategy, model_action, could_deescalate, recommend_deescalate, reasons: string[]}}
 */
function route(p, opts = {}) {
  const T = Object.assign({}, DEFAULTS, opts.thresholds || {});
  const reasons = [];
  const mismatch = !!opts.mismatch;

  const clarity = sig(p.clarity);
  const hidden = sig(p.hidden_constraint);
  const constraintCount = Number.isFinite(Number(p.constraint_count)) ? Number(p.constraint_count) : 0;
  const conflict = sig(p.constraint_conflict);
  const reasoning = sig(p.reasoning_complexity);
  const novelty = sig(p.novelty);
  const errCost = sig(p.error_cost);
  const rev = sig(p.reversibility);
  const verif = sig(p.verification_difficulty);
  const context = p.context_size || 'small';
  const parallel = !!p.parallelism;
  const oneShot = p.one_shot === true; // output is a single irreversible decision (vs an iterable deliverable)
  const failures = Number.isFinite(Number(p.failures_so_far)) ? Number(p.failures_so_far) : 0;

  // ---- Model action (escalate / delegate / keep) ----
  // Repeated failure is strong empirical evidence of a mismatch REGARDLESS of the profile's own
  // verification estimate (if the profile claimed "easy to verify", the failures prove it wrong) —
  // so failure escalation is unconditional on verification_difficulty (Finding F-1: was gated on
  // verif>0.5, silently dropping real failure evidence).
  const capMismatch = opts.model_capabilities ? capabilityMismatch(p, opts.model_capabilities) : null;
  const capFlag = !!opts.mismatch || (capMismatch && capMismatch.mismatch);
  let model_action = 'keep';
  if (failures >= T.FAILURE_THRESHOLD) {
    model_action = 'upgrade';
    reasons.push(`failures=${failures}>=${T.FAILURE_THRESHOLD} — empirical proof the profile/model is wrong`);
  } else if (oneShotHighStakes(p, T)) {
    // One-shot, irreversible, and (high error cost OR hard to verify) → needs the most reliable
    // SINGLE judgment. (Finding F-6: the old gate wrongly required ALL of cost/rev/verif; either
    // risk axis alone justifies escalation for a one-shot call. Finding F-6b, Session 37: a
    // one-shot judgment must outrank parallel-delegation — fanning out a single irreversible
    // decision is wrong even when some related work looks parallel.)
    model_action = 'upgrade';
    reasons.push(`one-shot, ${errCost >= T.E_HIGH_OR_DEEP ? 'high error cost' : 'hard to verify'}, irreversible`);
  } else if (parallel && canDelegate(p, T) && !capFlag) {
    // Parallel independent units worth fanning out — independent of tool_dependency (Finding F-4):
    // a parallel code refactor or batch transform is just as delegable as research. Only skipped for
    // trivially-fast mechanical batches (no fan-out value) or a real capability mismatch (then upgrade).
    model_action = 'delegate';
    reasons.push('parallel independent units worth fanning out');
  } else if (capFlag) {
    model_action = 'upgrade';
    reasons.push(capMismatch ? 'capability mismatch: ' + capMismatch.details.join('; ') : 'concrete capability mismatch');
  }

  // ---- Strategy selection ----
  let strategy;
  const deepReasons = [];

  if (verif > T.V_HIGH) deepReasons.push(`hard to verify (vd=${verif.toFixed(2)})`);
  // Repeated failures are strong evidence the task is harder than the surface suggests — go Deep
  // (this also covers the "upgrade-late" failure mode: don't wait for more attempts before
  // deepening). NOT gated on verification (Finding F-1): failures are empirical, they override the
  // profile's own (now-disproven) verification estimate.
  if (failures >= T.FAILURE_THRESHOLD) {
    deepReasons.push(`${failures} repeated failures -> problem harder than assumed`);
  }
  if (reasoning > T.R_HIGH) deepReasons.push(`high reasoning complexity (${reasoning.toFixed(2)})`);
  // NOTE: constraint_count and novelty do NOT force Deep alone — handled below WITH the
  // trivial-verification guard (v4 overthinking fix).
  if (conflict > T.C_HIGH) deepReasons.push(`constraint conflict (${conflict.toFixed(2)})`);
  if (hidden > T.H_HIGH && verif > T.V_MID) deepReasons.push(`probable hidden constraint + not trivially verifiable`);
  // Ambiguity can only force Deep when verification is not cheap (Finding F-2): a cheap-to-verify
  // vague task is clarified (Structured), not deep; a vague + hard-to-verify task needs deep
  // problem-framing. This closes the "clarity never feeds deep" hole.
  if (clarity < T.CLR_DEEP && verif > T.V_MID) {
    deepReasons.push(`ambiguous (clarity=${clarity.toFixed(2)}) + not cheaply verifiable`);
  }
  if (context === 'large') deepReasons.push('large context');
  // Constraint count and novelty must NOT force Deep when the task is trivially verifiable
  // (overthinking guard, v4): many trivial constraints / a novel-but-mechanical task with cheap
  // verification are not deep. Require it not be trivially verifiable.
  if (constraintCount >= T.C_COUNT_HIGH && verif > T.V_EASY) {
    deepReasons.push(`many constraints (${constraintCount}) + not trivially verifiable`);
  }
  if (novelty > T.N_HIGH && verif > T.V_EASY) {
    deepReasons.push(`high novelty (${novelty.toFixed(2)}) + not trivially verifiable`);
  }
  // High error cost alone must NOT force Deep. Stakes raise the need for VERIFICATION, not
  // deliberation; if the task is cheap to verify and reversible, "fast + verified" is safer
  // and cheaper. So high stakes only push Deep when verification is NOT cheap (risk can't be
  // caught by a cheap check). This was a v1 overthinking failure (see Session Report).
  // Note (Finding F-3): this uses verif>V_EASY consistent with novelty/constraint guards — the
  // SAME "not trivially verifiable" bar, so verif=0.4 doesn't mean 'deep for novelty but cheap for
  // stakes'.
  if (errCost >= T.E_HIGH_OR_DEEP && verif > T.V_EASY) {
    deepReasons.push(`high error cost (${errCost.toFixed(2)}) + not trivially verifiable`);
  }

  if (deepReasons.length > 0) {
    strategy = 'deep';
    reasons.push(...deepReasons);
  } else if (
    clarity >= T.CLR_FAST &&
    verif <= T.V_EASY &&
    reasoning <= T.R_LOW &&
    hidden <= T.H_LOW &&
    errCost <= T.E_LOW &&
    rev >= T.REV_HIGH
  ) {
    strategy = 'fast';
    reasons.push('clear, low-cost, easily verifiable, reversible');
  } else {
    strategy = 'structured';
    reasons.push('middle complexity: plan lightly then verify');
  }

  // ---- De-escalation (downgrade) decision ----
  // could_deescalate: the task COULD be executed by a cheaper/faster model (it needs no
  // upgrade and is a low-effort fast task) — an observation.
  const could_deescalate = strategy === 'fast' && model_action === 'keep';
  // recommend_deescalate: only actually recommend handing it to a cheaper model if the CURRENT
  // model is a strong one (there is something to downgrade from). Mirrors the upgrade rule:
  // a concrete current-vs-requirement match, in the cost direction.
  const tier = (opts.current_model_tier || 'auto');
  const recommend_deescalate =
    could_deescalate &&
    tier === 'strong';

  return { strategy, model_action, could_deescalate, recommend_deescalate, reasons };
}

function canDelegate(p, T) {
  // Fan-out is valuable for ANY parallel independent units (research, code refactor batches, test
  // splits) — NOT just tool-dependency research (Finding F-4). Skip only truly trivial mechanical
  // batches (everything at the Fast boundary) where fan-out has no value.
  if (!p.parallelism) return false;
  const trivialFast =
    sig(p.clarity) >= T.CLR_FAST && sig(p.verification_difficulty) <= T.V_EASY &&
    sig(p.reasoning_complexity) <= T.R_LOW && sig(p.hidden_constraint) <= T.H_LOW &&
    sig(p.error_cost) <= T.E_LOW && sig(p.reversibility) >= T.REV_HIGH;
  return !trivialFast;
}

function oneShotHighStakes(p, T) {
  // One-shot means the output IS a single irreversible decision (investment call, final legal
  // clause) — NOT an iterable deliverable (architecture plan, security review) which can be
  // reviewed/redone. Then escalate on EITHER high error cost OR hard-to-verify (Finding F-6:
  // previously required both + low reversibility, dropping genuine cases).
  return (
    p.one_shot === true &&
    sig(p.reversibility) <= T.REV_LOW &&
    (sig(p.error_cost) >= T.E_HIGH_OR_DEEP || sig(p.verification_difficulty) > T.V_HIGH)
  );
}

module.exports = { route, DEFAULTS };
