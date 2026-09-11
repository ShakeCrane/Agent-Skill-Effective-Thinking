# External Behavioral Evaluation v2 Pilot

## Frozen Baseline

| Item | Value |
|---|---|
| Phase 1 commit | `599beac09a461f81518217cadc606b5448e6bf31` |
| Phase 1 package version | `0.2.0` |
| Branch | `phase2-external-behavioral-eval` |
| Frozen skill snapshot | `evals/external-v2/frozen/SKILL.md` — SHA-256 `a5a52ff0d813059fc8398ac0c55525cfe23eb09468b7b8c76f2ce5786b561c98` |
| Source `SKILL.md` at freeze | same bytes (source SHA-256 identical) |
| Protocol version | `v2-pilot-1` |
| Freeze timestamp | `2026-09-11T00:50:36.397Z` |
| Freeze manifest | `evals/external-v2/freeze-manifest.json` — 84 artifacts |
| Freeze commits | `2342843` (v1 evaluation evidence), `bfababe` (v2 corpus + freeze) |
| Corpus | 12 tasks × 3 conditions; run order seed `20260911` |

Treatment runs inject **only** the frozen snapshot. `prepare-run.js` no longer reads the live
repository `SKILL.md`, so run 1 and run 36 used identical Skill bytes regardless of the working tree.

## Integrity

| Item | Count |
|---|---|
| Planned runs | 36 |
| `valid_completed` | **36** |
| `infra_invalid_rerun` | 0 |
| `measurement_invalid` | 0 |
| `unrecoverable_environment_failure` | 0 |
| Measurement amendments | none |
| Freeze verification | `verify-freeze` PASS before dispatch and before aggregation (84/84 artifacts) |
| Checker errors | 0 |
| Duplicate / orphan rows | 0 / 0 |

Gates re-run immediately before dispatch: v2 selftest (12/12 gold, 24/24 mutation kill, provenance
65/65, 0 checker errors), run-order validation (36 unique, each task exactly A/B/T, `order` 1..36),
JSON sweep (31 files, 0 invalid), frozen-SKILL smoke (Treatment `inputChars=9345` and contains the
frozen text; `evaluator/` never present in any workspace), Phase 1 `npm test` exit 0.

Dispatch discipline: max 5 parallel agents per batch; byte-identical dispatcher text; fresh
workspace per run; no run saw another condition's output, the gold, the checker or the mutations.

All 36 dispatches settled normally. Two environment observations are recorded rather than hidden:

- **`v2-09` (3 runs, both control conditions and treatment).** Spawned subprocesses cannot write into
  the pilot workspace in this sandbox (`EPERM` on `mkdir dist/`). Each agent built in a byte-identical
  replica and proved the artifact identical by SHA-256. The session-side checker rebuilds in its own
  temp copy, so the requirement (artifact genuinely derived from `src/banner.js`) is verified
  independently and all three runs passed. Not an invalid run: the agent received normal task/tools.
- **Scaffolding left behind (2 runs, both `controlB`, orders 1 and 20).** Shell deletion is denied in
  those workspaces; agents reported the denial (several worked around it via Node). No criterion
  penalises extra files in those tasks, so this does not affect pass/fail.

## Blind Sensitivity

Computed with conditions anonymised (`condition-X/Y/Z`) from a sealed mapping, then **locked to a
read-only file** (`results/blind-sensitivity.json`) before any reveal. The verdict below was produced
without consulting the condition mapping.

### Quality sensitivity

| metric | value |
|---|---|
| tasks where all three anonymous conditions pass | **12 / 12** |
| tasks with any condition-level disagreement | **0 / 12** |
| threshold | CEILING-LIMITED if all-pass ≥ 9 **or** disagreement < 4 |
| **verdict** | **CEILING-LIMITED** |

### Efficiency sensitivity

| metric | value |
|---|---|
| runs with reliable action-count telemetry | **0 / 36** |
| tasks with material action-count spread | — (not computable) |
| threshold | INFORMATIVE if telemetry ≥ 10/12 **and** spread ≥ 4/12 |
| **verdict** | **UNMEASURABLE** |

This host does not expose per-agent tool/action events to the evaluating process. Per pre-registration
no substitute value was invented (action counts are `null`; `elapsedMs` is `null` because it is
dominated by orchestrator turn latency). Artifact bytes and file churn were recorded as available
proxies, but they are not a gate.

### Combined (Case 4)

> Quality ceiling-limited **and** efficiency low/unmeasurable → **PILOT SENSITIVITY FAIL — CEILING-LIMITED**.

## Revealed Results

| condition | runs | task pass | criteria | median bytes | files changed |
|---|---|---|---|---|---|
| controlA (bare) | 12 | 12/12 | 65/65 | 3588 | 26 |
| controlB (minimal scaffold) | 12 | 12/12 | 65/65 | 3280 | 21 |
| treatment (full skill) | 12 | 12/12 | 65/65 | 5411 | 24 |

No failed criteria in any run of any condition. No task showed condition-level disagreement.

## Treatment vs Control B

Primary comparison:

| outcome | count |
|---|---|
| controlB fail / treatment pass (**treatment win**) | **0** |
| controlB pass / treatment fail (**treatment loss**) | **0** |
| both pass | **12** |
| both fail | 0 |

ControlA vs treatment and controlA vs controlB are identical: 0 / 0 / 12 / 0.

Interpretation is constrained by the sensitivity verdict: with every condition passing every task,
this pilot cannot show an incremental benefit of the full skill over the three-line scaffold — and,
critically, it also cannot show the absence of one. The corpus is simply solved by all three
conditions.

## Task Family Analysis

No family produced a disagreement. Two families are worth naming explicitly:

- `source-of-truth` (V2-07) and `failure-recovery` (V2-09): **byte-identical artifacts across all
  three conditions** (3588 and 3243 bytes), i.e. the three conditions converged on the same solution
  shape.
- `easy-negative-control` (V2-11) and `cheap-verification-negative-control` (V2-12): identical at
  1251 and 1372 bytes in every condition — the two negative controls behaved exactly as designed,
  with no extra deliberation artifacts and no scope creep.

## Efficiency

**Not measurable at host level** (see above). Available proxies:

- **Artifact bytes:** treatment median 5411 vs controlB 3280 (**+65%**) and controlA 3588 (**+51%**).
  The divergence is concentrated in `v2-02-date-only` (+9417), `v2-05-atomic-cache` (+4703) and
  `v2-06-concurrency` (+4506).
- **Composition of the difference:** the extras are overwhelmingly *verification* artifacts —
  treatment added test files in 8 changed paths vs controlB's 2. Transcripts confirm the pattern
  (contract test suites, mutation/falsification runs, multi-timezone matrices). This is additional
  checking, not obviously wasted deliberation, and it produced **no** quality difference on this
  corpus.
- **File churn:** controlA 26, controlB 21, treatment 24 changed paths.
- **Tool calls / retries / tests run:** `null` (unavailable; never fabricated).

The honest reading: on a corpus where all conditions already pass, the full skill bought more
verification work for the same outcome. Whether that verification is valuable cannot be decided by
this pilot, because the tasks do not contain a failure mode it would catch for one condition and
not another.

## Treatment Losses

**None.** There were no treatment losses and no failures of any kind, so the prescribed per-loss
analysis has no instances. This is reported as such rather than replaced with a weaker analysis of
non-losses.

## Negative Controls

`v2-10` / `v2-11` / `v2-12` (stopping/scope and the two cheap-verification controls) across all nine
runs:

- Every run changed **only** the target source file. One controlA run additionally updated the
  existing test file.
- **No TODO items were pursued** (V2-10's four decoys — parser, database, regex caching, docs — were
  left untouched in every run), **no unrelated refactoring**, and no run created extra files
  (the `no extra file` criteria in all three checkers passed).
- No overthinking signal: artifact sizes are at or near the seed minimum, and V2-11/V2-12 are
  byte-identical across conditions.

## F16 / F17

- **F16 (action-loop degeneration).** No incidence observed across the 36 dispatches: every settled
  agent acted (ran tests, edited files, produced artifacts) and none emitted repeated "now executing"
  narration in place of action. Because the host exposes no action-event stream, the following
  remain **unknown** rather than zero: declared-action gap, repeated-action-failure count
  (≥3 identical failures with no new evidence), no-progress streaks. Only the qualitative
  observation is available.
- **F17 (meta-policy self-exemption).** Proxy result: the nine negative-control runs show **zero**
  post-success unrelated actions — no continued reading, editing, TODO work or refactoring after the
  task was satisfied. This is a bounded proxy. It does **not** show that host-level F17 is solved:
  the real failure mode (an orchestrator auto-generating the next objective after declaring
  completion) was not exercised by this pilot. The evaluating agent itself stopped at the frozen
  scope and did not start Main.

## Limitations

- 12 tasks, one replicate per task per condition — no statistical inference is possible or offered.
- Node-only mini-repositories; **long-context behaviour is not covered**, and real multi-agent
  behaviour is not the subject of this pilot.
- Only the current model/environment; cross-model generalization remains unknown.
- Action/tool-level telemetry is unavailable, which is what made the efficiency channel
  UNMEASURABLE rather than merely low.
- Artifact bytes are a coarse cost proxy, and they are inflated by the verification files agents
  deliberately wrote.
- Both the corpus and the frozen state are constructed and executed by the same agent that wrote this
  report; the blind/locked procedure limits (but cannot eliminate) outcome-aware reporting.

## Pilot Verdict

> **PILOT CEILING-LIMITED**

Specifically `PILOT SENSITIVITY FAIL — CEILING-LIMITED`: quality is ceiling-limited (12/12 tasks
solved by all three conditions, zero disagreement) and efficiency is unmeasurable. Per the frozen
protocol this pilot does **not** authorize entering Main Evaluation.

## Recommended Next Step

Do **not** run Main against this corpus as-is. Recommendation only (not executed): if further
evaluation is funded, it should either (a) raise task difficulty above this model's ceiling with
genuinely discriminating failure modes, or (b) scope the work explicitly as **quality
ceiling-limited / efficiency-focused** with an instrumented host that can count external actions —
otherwise the same ceiling will recur.
