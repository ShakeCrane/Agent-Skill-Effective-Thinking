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
  router (failures_so_far), escalates at ≥3 (F7/R-1), bounded by the execution attempt budget and
  the Deep stopping conditions ("不要无限研究").
- **Two separate budgets, deliberately not merged:**
  - *execution attempt budget* (`MAX_STEPS`, spellable as `maxSteps` or `budgets.MAX_STEPS`;
    explicit `maxSteps` wins) — how many times `execute()` may be called. `normalizeMaxSteps()` is
    the single source of truth and the loop is its only enforcer, so `maxSteps=N` calls `execute()`
    at most N times. Exhaustion is terminal on its own: `done === true`, `success === false`,
    `stopReason === 'execution: attempt budget exhausted'` — a reason that is intentionally distinct
    from every `stopping.js` reason.
  - *deliberation budgets* (`stopping.js`: `DEEP_STAGNATION_ROUNDS`, `DEEP_MAX_ATTEMPTS`) — when the
    Deep strategy stops deliberating. These bound the strategy, not the execution count.
  - Invariant: `run()`/`runAsync()` keep NO budget of their own; their only stop condition is the
    loop reporting done. (Earlier they also ran a `guard < cap + 1` counter, so `maxSteps=1` executed
    twice, could return `done:false`, and an exhausted hard budget was reported with the *strategy's*
    stopping reason.)

## Evidence
- `evals/protocol-test.js`, `evals/stopping-test.js`, `evals/adaptive-test.js`: required/optional
  step ordering, stop-conditions incl. anti-over-deliberation, failure-feeding escalation at the
  threshold, bounded always-failing loops, step-wise control.
- `evals/adaptive-test.js`: runAsync (async executor) escalates and stays bounded; exact attempt
  budget (`maxSteps=1` → exactly 1 call; `maxSteps=2` → exactly 2), success on the final permitted
  attempt, direct-loop `MAX_STEPS=1` terminal with the execution-budget reason (not a strategy
  reason), and sync/async terminal-semantics equality at N=1,2,3.
- Live-demoed with real subagents (Session 36 async adapters); Session 49/50 (capability reorder)
  F-6b one-shot-outranks-parallel verified via CLI + tests.

## Known limits / open questions
- Protocol/stopping are deterministic heuristics; stop thresholds are hand-tuned. Adaptive loop is
  sync/async host-driven (the execute step is injected; full host productionization deferred).
