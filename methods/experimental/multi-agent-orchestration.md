# Method: Multi-Agent Orchestration (fan-out, independent review, consolidate)

File: `multi-agent/orchestrate.js` · Status: **experimental** (validated as async-wiring point,
live-demoed with real subagents; host productionization deferred)

## Purpose
Implement the objective's 多 Agent 使用原则 as testable machinery: fan out independent work to
workers, get INDEPENDENT reviewers to vote on claims (Agent 自评不能直接作为结论), consolidate
results (keep good, surface failures, never discard all on one failure), and enforce
"汇总 → 比较 → 选择 → 合并 → 验证 → 清理".

## Mechanism
- `fanOutSync`/`fanOutAsync`(items, worker): per-item resilience — a throwing/rejecting worker is
  recorded as a failure, others survive; results in input order.
- `reviewSync`/`reviewAsync`(claims, reviewers, opts?): each vote is agree / disagree / **unavailable**
  (throwing or no boolean `agree`). Verdicts: agreed / disputed / rejected / unavailable /
  insufficient_review, computed over VALID votes only with a configurable `minReviews` quorum — a
  reviewer exception is unavailable, never a dissent; zero valid votes → `unavailable` (never
  `rejected`); below quorum → `insufficient_review`. Result exposes agreeVotes / disagreeVotes /
  unavailableVotes / validVotes / quorumMet; reviewer failures are kept as diagnostics.
- `consolidate`: okCount/failedCount, kept results, explicit failures (evidence, not dropped).
- Async variants are the bridge to REAL subagents (Session 36); exposed on the public API and on
  the SKILL.md agent contract.

## Evidence
- `evals/orchestrate-test.js`: order preservation, rejection-not-abort, disagreement→disputed,
  unanimous-disagreement→rejected, reviewer exception→unavailable (NOT dissent), all-unavailable→
  unavailable, quorum-not-met→insufficient_review, no-boolean-agree→unavailable, consolidation;
  async variants covered.
- Live demo (Session 36): 3 real verification sub-agents returned CONFIRMED with line evidence →
  consolidate 3/3 → a live reviewAsync produced a genuine DISPUTED verdict → captain resolved it by
  reading the source (ground truth).

## Known limits / open questions
- Async adapters await sequentially (a never-resolving worker stalls the call — acceptable for
  determinism, not a timeout policy). Real host integration is a future concern, not claimed done.
