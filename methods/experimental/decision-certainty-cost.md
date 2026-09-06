# Method: Decision Certainty & Cost (honest confidence + advisory effort)

Files: `strategies/certainty.js`, `strategies/cost.js` ·
Status: **experimental** (margin logic conformance-tested; cost is advisory ordering only)

## Purpose
- Certainty: after the router picks a strategy, say HOW SURE it is (high/medium/boundary) from the
  margin between governing signals and their thresholds — so an agent knows when to treat a routing
  as tentative and verify more, and boundary items are never falsely labeled "high".
- Cost: relative effort estimate (tokens/latency/toolCalls) that NEVER overrides the quality
  decision.

## Mechanism
- `certainty.marginFor(profile, strategy)`: fast = distance below caps; deep = strongest supporting
  trigger above threshold; structured = min(toFast, toDeep) HARD-CAPPED below 'high' (V6 fix —
  the middleband must never read as high). Hidden-constraint trigger contributes a REAL margin (V5
  fix — no more 0.3 fallback → false high).
- `cost.estimateCost(strategy, profile)` → advisory relative numbers.

## Evidence
- `evals/certainty-test.js`: trivial→high, decisive-deep→high, boundary→non-high, structured
  honest, monotonicity. `evals/cost-test.js`: deep > fast advisory, budget checks, cost never
  overrides strategy.
- F-6b/capability interactions verified via `evals/principles-test.js` (P1–P7).

## Known limits / open questions
- Certainty margins derive from the same thresholds the router uses (co-dependence); they are
  heuristic, not calibrated probabilities. Cost factors are order-of-magnitude, awaiting real-model
  timing measurement.
