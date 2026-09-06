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
- `reviewSync`/`reviewAsync`(claims, reviewers): verdict agreed/disputed/rejected; a throwing
  reviewer counts as a dissent; notes carried for the main agent to resolve.
- `consolidate`: okCount/failedCount, kept results, explicit failures (evidence, not dropped).
- Async variants are the bridge to REAL subagents (Session 36); exposed on the public API and on
  the SKILL.md agent contract.

## Evidence
- `evals/orchestrate-test.js`: order preservation, rejection-not-abort, disagreement→disputed,
  unanimous-disagreement→rejected, throwing reviewer → dissent, consolidation; async variants
  covered.
- Live demo (Session 36): 3 real verification sub-agents returned CONFIRMED with line evidence →
  consolidate 3/3 → a live reviewAsync produced a genuine DISPUTED verdict → captain resolved it by
  reading the source (ground truth).

## Known limits / open questions
- Async adapters await sequentially (a never-resolving worker stalls the call — acceptable for
  determinism, not a timeout policy). Real host integration is a future concern, not claimed done.
