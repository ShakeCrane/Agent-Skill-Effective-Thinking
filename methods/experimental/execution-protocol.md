# Method: Execution Protocol, Stopping, Adaptive Loop

Files: `strategies/protocol.js`, `strategies/stopping.js`, `router/adaptive-loop.js` ·
Status: **validated** (deterministic, heavily unit-tested; async variant live-demoed)

## Purpose
Once the router picks a strategy, define WHAT to do (protocol), WHEN to stop deliberating
(stopping), and how to re-route on failure (adaptive loop). Together they make the router a loop,
not a one-shot predicate.

## Mechanism
- `protocolFor(strategy)` → required/optional steps (Fast: none-extra; Structured: light
  Objective/HC/Assumptions/Plan/Verification; Deep: decomposition, alternatives, counterexamples,
  strongest objection, assumption checks, external evidence, independent review, adversarial tests).
- `shouldStop(strategy, state)` → bounded stop: Fast stops immediately; Structured stops once the
  light plan is written; Deep stops when evidence suffices OR no new info OR attempts exhausted.
- `adaptiveLoop`/`run`/`runAsync`: always executes at least once; feeds failures back into the
  router (failures_so_far), escalates at ≥3 (F7/R-1), bounded by MAX_STEPS (hard budget) and the
  Deep stopping conditions ("不要无限研究").

## Evidence
- `evals/protocol-test.js`, `evals/stopping-test.js`, `evals/adaptive-test.js`: required/optional
  step ordering, stop-conditions incl. anti-over-deliberation, failure-feeding escalation at the
  threshold, bounded always-failing loops, step-wise control.
- `evals/adaptive-test.js`: runAsync (async executor) escalates and stays bounded.
- Live-demoed with real subagents (Session 36 async adapters); Session 49/50 (capability reorder)
  F-6b one-shot-outranks-parallel verified via CLI + tests.

## Known limits / open questions
- Protocol/stopping are deterministic heuristics; stop thresholds are hand-tuned. Adaptive loop is
  sync/async host-driven (the execute step is injected; full host productionization deferred).
