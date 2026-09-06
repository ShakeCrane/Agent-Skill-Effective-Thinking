// Cost / effort estimator.
// Operationalizes the objective's "Token / 时间成本" metric and the model-switch principle
// "在足够质量下使用最低合理成本". The router currently picks a strategy ignoring cost; this module
// makes the COST of a chosen strategy explicit so an agent can reason "deep ≈ 10x a fast — is it
// worth it here, or can I verify cheaply?".
//
// Design notes (honesty): values are ORDER-OF-MAGNITUDE relative indices (not absolute dolls/tokens),
// so they express relative cost ordering, not false precision. A key principle: cost advice is
// ADVISORY ONLY — it never auto-downgrades a strategy the router chose for quality reasons
// (escalation/risk decisions come from route(), the verification/quality arbiter). It merely
// surfaces "this costs a lot; make sure the added depth is necessary".

'use strict';

// Relative cost factors per strategy (order of magnitude).
// tokens/latency: how much thinking/context the strategy invests; toolCalls: expected tool churn.
const COST_FACTORS = {
  fast:      { tokens: 1, latency: 1, toolCalls: 0.2 },
  structured:{ tokens: 3, latency: 3, toolCalls: 1.0 },
  deep:      { tokens: 10, latency: 10, toolCalls: 4.0 },
};

/**
 * estimateCost(strategy, profile) -> { tokens, latency, toolCalls, wallTime }
 * Relative cost indices. Adjusted by:
 *   - context_size==large → +30% tokens/latency (long context processing),
 *   - tool_dependency → +1 toolCalls (external checks, lookups),
 *   - escalation note: any upgrade/delegate intent is OUTSIDE this core estimate (model tier is a
 *     caller concern); this is the strategy-level effort.
 */
function estimateCost(strategy, profile = {}) {
  const base = COST_FACTORS[strategy] || COST_FACTORS.structured;
  const ctxMul = (profile.context_size === 'large') ? 1.3 : 1.0;
  const toolAdjust = profile.tool_dependency ? 1 : 0;
  const tokens = base.tokens * ctxMul;
  const latency = base.latency * ctxMul;
  const toolCalls = base.toolCalls + toolAdjust;
  // wallTime: deep/structured driven by latency; a parallel/delegated batch would collapse wallTime,
  // but that is the delegate strategy's concern — surfaced here as-is (single-executor view).
  const wallTime = latency;
  return {
    tokens: round1(tokens),
    latency: round1(latency),
    toolCalls: round1(toolCalls),
    wallTime: round1(wallTime),
  };
}

/**
 * budgetCheck({ strategy, profile, budget }) -> { fits, cost, budget, advice }
 * Advisory: does the chosen strategy's cost fit a caller budget ({tokens?, latency?})?
 * If not, advice explains the tradeoff and reminds that quality/verification decisions are NOT
 * overridden by budget — a cheaper strategy is only acceptable if it still meets verification.
 */
function budgetCheck({ strategy, profile = {}, budget = {} }) {
  const cost = estimateCost(strategy, profile);
  const over = [];
  if (Number.isFinite(budget.tokens) && cost.tokens > budget.tokens) over.push('tokens');
  if (Number.isFinite(budget.latency) && cost.latency > budget.latency) over.push('latency');
  const fits = over.length === 0;
  const advice = fits
    ? 'Cost within budget.'
    : `Cost exceeds budget on: ${over.join(', ')}. Advisory only — do NOT auto-downgrade quality; ` +
      'prefer cheaper verification or revisit the routing decision if the depth is unnecessary.';
  return { fits, cost, budget, advice };
}

function round1(n) { return Math.round(n * 10) / 10; }

module.exports = { COST_FACTORS, estimateCost, budgetCheck };
