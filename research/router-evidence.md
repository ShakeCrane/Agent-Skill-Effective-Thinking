# Research Brief — Evidence grounding the Task Router

Status: `experimental` (select findings CONFIRMED; design implications are ours to validate).
Purpose: record which external evidence motivates this design, and its limits, so future
sessions don't re-derive it. Updated: Session 01.

## Findings (from primary sources)

### Overthinking is real and harmful
Extended test-time compute / long chains of thought do **not** monotonically improve results;
overthinking degrades accuracy and wastes tokens, especially on easy problems
([When More Thinking Hurts: Overthinking in LLM Test-Time Compute](https://arxiv.org/html/2604.10739),
["Towards Thinking-Optimal Scaling of Test-Time Compute"](https://openreview.net/forum?id=6ICFqmixlS)).
→ **Design implication:** the router must actively route *easy/cheap-to-verify* tasks to Fast /
Structured, and must not equate "more thinking" with "better." This directly motivated the
v2 fix (high error cost alone must not force Deep when cheaply verifiable).

### Self-correction without external feedback often fails
LLMs frequently cannot self-correct their reasoning on their own and sometimes *degrade* after
self-correction without external feedback
([Huang et al., Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798)).
→ **Design implication:** reflection is not evidence. The router's verification emphasis must be on
external checks (tests, runs, compilers, primary sources), not model self-review. Matches AGENTS.md
verification priority.

### Long-context degradation
Performance degrades significantly when relevant information is in the middle of a long context
([Lost in the Middle](https://arxiv.org/abs/2307.03172)).
→ **Design implication:** `context_size=large` routes to Deep, and the skill mandates context
compaction (keep latest plan/constraints, drop old plans/logs). Long-context tasks need more
care, not just more tokens.

### Routing between models works but cost must be explicit
Learning-based routers can approach strong-model quality at much lower cost by routing easy queries
to cheaper models ([RouteLLM](https://arxiv.org/html/2406.18665v4)); routing framed as cost/perf
optimization sustains accuracy at lower cost
([OmniRouter](https://arxiv.org/html/2502.20576v5)).
→ **Design implication:** escalation should be *cost-aware*: only escalate on concrete mismatch,
and support de-escalation for mechanical/verifiable work. "Upgrade" is not the default.

### Calibration is unreliable
LLMs are often overconfident / miscalibrated on difficulty and correctness, with mitigation
needed ([Mind the Confidence Gap](https://www.alphaxiv.org/abs/2502.11028v2),
[Self-Ensemble](https://arxiv.org/html/2506.01951v2)).
→ **Design implication:** the rated signals (clarity, hidden constraint, error cost) are
model-judged and therefore noisy. The router is intentionally conservative on route-changing
signals and flags uncertainty, and signals are small and inspectable so an agent can reason about
them.

## What remains UNKNOWN / not yet validated for our prototype
- Whether these thresholds generalize beyond the 13 labeled benchmark tasks (they almost certainly
  do not out of the box — the "100% on training set" is a warning sign, not a validation).
- Whether a deterministic rule router beats or loses to a learned router at equal cost in our
  setup (not measured).
- Whether the model-judged signal extraction itself is reliable enough (not measured).

## Implications encoded into the current design (v2)
1. Cheap verification → prefer Fast/Structured over Deep even under high stakes (anti-overthinking).
2. Verification = external checks, not self-review (anti-false-self-correction).
3. Large context → Deep + mandated compaction (anti-long-context-degradation).
4. Escalation is cost-aware and mismatch-driven; de-escalation supported (anti-wasteful-upgrade).
5. Small, inspectable signals + conservative flagging (anti-miscalibration).
