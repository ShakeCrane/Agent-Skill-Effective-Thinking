// Decision-certainty classifier.
// The router picks a strategy but currently says nothing about HOW SURE it is. This module adds an
// honest, explainable confidence flag computed from the margin between the governing signals and
// their thresholds — so an agent knows when to treat a routing as tentative and verify more.
//
// Margins (re-derived from DEFAULTS so it can't drift from the router):
//   - fast:      how far the profile is comfortably BELOW the fast caps
//                (min over clarity↑, verification↓, reasoning↓, hidden↓, errorCost↓, reversibility↑).
//   - deep:      how far the STRONGEST firing trigger is above its threshold (max over fired
//                triggers) — a single decisive trigger is enough; the weakest misfire should not
//                drag it down (honest about the strongest evidence, per the doc-vs-code fix V7).
//   - structured: min(distance to fast, distance to deep) AND hard-capped below 'high' — the
//                middleband is inherently tentative and its certainty must NEVER reach 'high'
//                (Finding V6: the old "0.5 fallback cap" did not actually cap).
// Certainty: margin >= 0.15 high, 0.05..0.15 medium, < 0.05 boundary (treat tentatively, verify more).
//
// F6 tie-in: the jitter-sensitive boundary tasks from the robustness test naturally classify as
// 'boundary', exactly where the agent should be most careful.

'use strict';
const { DEFAULTS } = require('../router/task-router.js');

function sig(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

/**
 * marginFor(profile, strategy, T?) -> number
 * Margins are defined so that LARGER = more decisive. Negative means the strategy shouldn't hold.
 */
function marginFor(p, strategy, T = DEFAULTS) {
  const clarity = sig(p.clarity), hidden = sig(p.hidden_constraint), conflict = sig(p.constraint_conflict);
  const reasoning = sig(p.reasoning_complexity), novelty = sig(p.novelty), errCost = sig(p.error_cost);
  const rev = sig(p.reversibility), verif = sig(p.verification_difficulty);
  const context = p.context_size || 'small';
  const failures = Number.isFinite(Number(p.failures_so_far)) ? Number(p.failures_so_far) : 0;
  const ccount = Number.isFinite(Number(p.constraint_count)) ? Number(p.constraint_count) : 0;

  const fastDs = [
    clarity - T.CLR_FAST, T.V_EASY - verif, T.R_LOW - reasoning, T.H_LOW - hidden,
    T.E_LOW - errCost, rev - T.REV_HIGH,
  ];
  const deepDs = [];
  if (verif > T.V_HIGH) deepDs.push(verif - T.V_HIGH);
  if (clarity < T.CLR_DEEP && verif > T.V_MID) deepDs.push(Math.min(T.CLR_DEEP - clarity, verif - T.V_MID)); // F2 ambiguity trigger
  if (reasoning > T.R_HIGH) deepDs.push(reasoning - T.R_HIGH);
  if (conflict > T.C_HIGH) deepDs.push(conflict - T.C_HIGH);
  if (context === 'large') deepDs.push(0.3);
  if (verif > T.V_MID) {
    if (failures >= T.FAILURE_THRESHOLD) deepDs.push(verif - T.V_MID);
    if (errCost >= T.E_HIGH_OR_DEEP) deepDs.push(Math.min(errCost - T.E_HIGH_OR_DEEP, verif - T.V_MID));
    if (hidden > T.H_HIGH) deepDs.push(Math.min(hidden - T.H_HIGH, verif - T.V_MID)); // V5: hidden-constraint trigger must contribute a REAL margin, not the 0.3 fallback
  }
  if (novelty > T.N_HIGH && verif > T.V_EASY) deepDs.push(Math.min(novelty - T.N_HIGH, verif - T.V_EASY));
  if (ccount >= T.C_COUNT_HIGH && verif > T.V_EASY) deepDs.push(Math.min(0.1, verif - T.V_EASY));

  if (strategy === 'fast') return Math.min(...fastDs);
  // deep: decisiveness = STRONGEST supporting trigger (using the weakest under-reports when several
  // independent triggers support the decision; the robustness-flip risk is separately covered).
  if (strategy === 'deep') return deepDs.length ? Math.max(...deepDs) : 0;

  // structured: distance to the NEAREST boundary (single closest flip), HARD-CAPPED BELOW the
  // 'high' threshold (0.15) so the tentative middleband can never read as 'high' — even when the
  // profile sits far from both boundaries (Finding V6: the old fallback cap of 0.5 did not cap).
  const toFast = -Math.max(...fastDs);
  const toDeep = deepDs.length ? -Math.max(...deepDs) : 0.5;
  return Math.min(toFast, toDeep, 0.14);
}

/**
 * classify(profile, opts?) -> { strategy, certainty, margin }
 */
function classify(profile, opts = {}) {
  const { route } = require('../router/task-router.js');
  const strategy = opts.strategy || route(profile, {}).strategy;
  const margin = marginFor(profile, strategy, opts.thresholds || DEFAULTS);
  const certainty = margin >= 0.15 ? 'high' : (margin >= 0.05 ? 'medium' : 'boundary');
  return { strategy, certainty, margin: round3(margin) };
}

function round3(n) { return Math.round(n * 1000) / 1000; }

module.exports = { classify, marginFor };
