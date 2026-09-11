# Pilot notes (39/39 runs) — harness validated, corpus has a ceiling problem

Pilot = 13 tasks x 3 conditions, frozen run order (seed 20260909), all runs completed and judged.

## Result (pilot only — NOT a project conclusion)

| condition | n | pass |
|---|---|---|
| controlA (default) | 13 | 11 (85%) |
| controlB (minimal reminder) | 13 | 12 (92%) |
| treatment (skill) | 13 | 12 (92%) |

Cost proxies: artifact bytes and file churn are essentially identical across conditions
(median bytes 518 / 518 / 607; created files 1 / 1 / 1). No overthinking cost signal detected.

## Harness defects found and fixed during pilot (all pre-Main, all non-cognitive)

1. **Measurement bug:** `TASK.md` (which contains the whole SKILL.md for the treatment condition)
   was counted as an artifact, inflating treatment verbosity by ~7 KB. Fixed: injected files are
   excluded from artifact measurement. Re-judged.
2. **Unfair criterion (j1):** `j1.change_condition` ("states a condition that would change the
   decision") was gating, but the j1 task text only asks for "decision and the reasons". It measured
   the skill's stylistic rubric, not task success. Demoted to SECONDARY (non-gating); the harness now
   computes pass from gating criteria only.
3. **Spec ambiguity (b2):** the checker required `retry()` to return a plain value for a sync `fn`,
   so a perfectly reasonable `async function retry` was scored as failing. This measured code style,
   not semantics. Checker made style-agnostic (thenables resolved); all three b2 runs pass.
4. **Dispatcher bug (mine):** in bash, `"$t__$c"` parses as variable `t__` (empty), so runId
   collapsed to the condition name and 6 rows judged a non-existent workspace. Rows purged,
   re-judged with `${t}__${c}`.
5. **Invalid metric:** `elapsedMs` currently spans prepare -> judge, i.e. it is dominated by the
   orchestrator's own turn latency, not agent execution. Pilot elapsed times are therefore
   MEANINGLESS (all ~242 s). Main must mark start immediately before dispatch.

## The important pilot finding: ceiling effect

All three conditions land at 85-92%. The corpus does not discriminate: the model completes almost
everything, and the treatment-control difference is 1 task. Category B (`b1-fix-date-range`) failed
for ALL three conditions (hidden unsorted-merge defect found by none), i.e. it discriminates nothing
either, and its fairness is arguable (a defensible minimal fix is scored as failure).

Consequences for Main:
- Tasks must be **harder and multi-criteria**, so that *requirement omission* is the measurable
  signal, not binary success. Binary pass is kept as the primary metric (protocol), but criteria
  satisfaction rate is the sensitive one (13 tasks x ~5 criteria is far too few).
- The only discriminating pilot signal was exactly a **requirement omission** (`d1.constraints`:
  controlA did not restate the 50 MB / crash-survival constraints). Main should multiply that shape.
- `controlB` matching `treatment` is the single most important thing to try to confirm or refute.
