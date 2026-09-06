# LLM-Fills-Profile vs Keyword Baseline — live measurement (server: Session 37)

Status: `experimental` (n=10 live fills across two sessions — Session 37 n=4, Session 56 n=6 — one
model family). Purpose: answer the objective's
"agent-self signal-extraction reliability" question — can a real agent fill the task profile from
understanding (via `router/llm-profile.js fillProfile`) to route better than the keyword extractor?

## Setup

- New adapter `router/llm-profile.js` (`fillProfile`/`fillProfileSync`): a host injects
  `askLLM(task)`; the adapter sanitizes the model's output (clamps numerics, validates enums/
  booleans/counts), falls back to keyword extraction for missing fields, and degrades to keyword on
  a throwing model. Fully unit-tested (`evals/llm-profile-test.js`, 25-script suite).
- Live: one fresh sub-agent filled full 14-field profiles for 4 tasks spanning the strategy space
  (creative brainstorm, architecture migration, scoped bugfix, one-shot investment).

## Task-by-task (routed)

| id | task | expected | keyword route | LLM-filled route | note |
|---|---|---|---|---|---|
| T1 | brainstorm taglines | fast/keep | fast/keep ✓ | structured/delegate ✗ | LLM marked parallelism=true on a cheap creative task (over-eager) |
| T2 | monolith→microservices | deep/keep | deep/keep ✓ | deep/delegate ✗ | LLM marked parallelism=true + tool=true; not true fan-out units |
| T3 | off-by-one bugfix | structured/keep | structured/keep ✓ | structured/keep ✓ | exact agreement |
| T4 | one-shot investment | deep/upgrade | deep/upgrade ✓ | deep/**delegate** (was) → deep/**upgrade** (fixed) | LLM correctly set one_shot+parallel; EXPOSED F-6b |

## Findings (honest)

1. **The LLM path is a real alternative signal source, not a universal win.** On 3/4 tasks keyword
   matched the expected label and LLM-fill disagreed where it over-marked `parallelism` on tasks that
   are not true fan-out units (brainstorm, migration). Keyword was more conservative; LLM was more
   permissive on parallelism. So "use the LLM profile" is a host choice, not a guaranteed upgrade.
2. **The live run caught a genuine router bug (F-6b):** T4's correct `one_shot:true + parallelism:
   true` profile was being DELEGATED instead of UPGRADED, because the parallel-delegate branch
   preceded the one-shot branch. A one-shot irreversible judgment is never fan-out work. Fixed in
   `task-router.js` (one-shot outranks parallel), lock-in via benchmark item + P7. Direct check:
   T4 now deep/upgrade; pure parallel still delegates.
3. **Signal-filling quality gap:** an LLM that fills profiles is itself fallible on `parallelism`
   (`one_shot`, `context_size` it judged well on all 4). The adapter's job is to keep that reliable
   (sanitize + fallback), which is exactly what `fillProfile` does.

## Files
- `router/llm-profile.js`, `evals/llm-profile-test.js`, benchmark item `one-shot-parallel-judgment`.
- Live sub-agent transcripts are transient; this record is the durable artifact.

## Re-measurement: boundary-item fills vs independent judges (Session 56, n=6)

Asked a FRESH fill agent to fill 14-field profiles for 6 validation-corpus items (4 where two independent
judges coalesced against the author/router in Session 54, plus 2 control items where the judges
agreed with the author). Fills were routed through the real `fillProfileSync`→`route` path.

| id | author/router | judges (A/B) | LLM-filled route | fill sides with |
|---|---|---|---|---|
| ambiguous-cheap-reversible | structured/keep | **fast**/keep | structured/keep | author |
| many-constraints-trivial-verify | **fast**/keep | structured/keep | structured/keep | judges |
| contract-review-large-hd | deep/**keep** | deep/**delegate** | deep/**delegate** | judges |
| novel-hard-verify-algo | deep/keep | deep/**upgrade** | deep/keep | author |
| yaml-json-comments | structured/keep | structured/keep | deep/delegate | neither (over-mark) |
| mech-parallel-delegate | structured/delegate | structured/delegate | deep/delegate | neither (over-deepen) |

1. **The fill surfaced a judge-visible signal the author's profile missed:** `contract-review-large-
   hd` got `parallelism=true` → `deep/delegate`, exactly both judges' reading (a 200-page review IS
   partitionable). This is the strongest case yet that the LLM-fill path can beat the extractor on a
   real delegability signal.
2. **It reproduced the author — not the judges — on genuinely ambiguous items:** `ambiguous-cheap-
   reversible` was filled with `clarity=0.35`, IDENTICAL to the author's. So the Session-54 "judges
   say fast" is an alternative stance, not the dominant reading (author + fresh fill = 2 sources read
   it ambiguous). The router's P1-cautious `structured` is the majority-of-models reading, not
   author-idiosyncrasy.
3. **Session-37 over-marking mode reproduced at n=6:** on both mechanical-batch conversions the fill
   over-flagged — `yaml-json-comments` (conflict 0.8 + parallelism true → wrong deep/delegate on a
   single-scripted batch) and `mech-parallel-delegate` (constraint_count 4 → spurious deep, delegate
   coincidentally right). `novel-hard-verify-algo` stayed deep/keep (judges' upgrade is a model-
   strength preference the router reserves for concrete failure/one-shot/capability mismatch).
4. **Net:** the LLM-fill path is a complementary, not uniformly-better, signal source — it can catch
   judge-visible signals (partitionable → delegate) and echoes the author on ambiguity, but over-flags
   batch conversions. This is exactly why the design keeps sanitize + keyword fallback + never-sole-
   source: the adapter contains the model's over-marking while letting its genuine reads through.
   It further supports the standing finding that **signal extraction is the real bottleneck**.
