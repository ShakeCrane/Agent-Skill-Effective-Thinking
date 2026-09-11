# Phase 2 External Behavioral Evaluation Report

Frozen baseline: `599beac` (branch `phase2-external-behavioral-eval`). Protocol:
`research/external-eval-protocol.md`. Corpus/checkers/harness: `evals/external/`.

## 1. Executive Conclusion

**NO CLEAR BENEFIT.**

Over 36 Main runs (12 multi-criteria tasks × 3 conditions), every condition achieved
**12/12 task pass and 55/55 criterion satisfaction** — a saturation ceiling, not a measured
difference. Across the full 75-run dataset, the Cognitive Skill (`treatment`) shows **no measurable
behavioral advantage over `controlB` (a three-line "understand → do → check" reminder)**, and neither
over a capable default agent. The one criterion that separated conditions in the pilot
(`d1.constraints`) was caught by BOTH the skill and the minimal reminder, i.e. it is a
process-reminder effect, not a skill-structure effect.

This is a **null result bounded by corpus sensitivity**, not proof the skill "does nothing": the
model completed every task in every condition. A meaningful benefit (or cost) was not detectable at
this corpus difficulty.

## 2. Recovered Starting State

Resumed from WorkBuddy (HY4) on branch `phase2-external-behavioral-eval` @ `599beac`.

- Phase 2 files existed **untracked** in git: `evals/external/` (corpus 25 items, 25 checkers,
  harness, prompts, selftest, run-order, results) + `research/external-eval-protocol.md`.
- **Pilot already complete:** 39/39 runs (13 original tasks × 3 conditions), judged, in
  `results.jsonl`. Pilot note: ceiling effect (85–92%), only discriminating signal = requirement
  omission (`d1.constraints`), and `controlB` matched `treatment`.
- **Main not yet run:** `run-order.json` lists 75 runs (25 tasks × 3). 39 were pilot; **36 hard-task
  runs (12 `n*` tasks × 3) were missing.**
- Recovered state was verified against files (not the handoff): 75 planned, 39 done, 36 missing, no
  duplicate/orphan/dirty rows, correct condition randomization (each task × each condition × 1).

## 3. Experimental Integrity

- **Condition isolation:** the manipulated variable is only the instruction block prefixed into each
  workspace's `TASK.md`; the dispatcher message to every run is byte-identical ("read TASK.md and
  follow it"), only the workspace path differs. Treatment loads full `SKILL.md`; controlA = empty
  preamble; controlB = three-line reminder.
- **Randomization:** seeded shuffle (seed `20260909`), interleaved conditions per task, stored once
  in `run-order.json`; verified each task × each condition appears exactly once.
- **Frozen tasks/checkers:** corpus text, acceptance criteria and checker logic authored before runs
  and unchanged this session (git diff shows only the harness-env fix below).
- **Deterministic checkers:** 25/25 pass the `selftest.js` non-vacuous + satisfiable proof
  (pristine → FAIL, gold → PASS).
- **Harness fix (M6, environment-compat only):** four checkers (`c1`, `h1`, `n6`, `n12`) used
  `execFileSync` with piped child stdio, which returns `EPERM` in this sandbox and made them unable
  to PASS at all (they would tautologically fail every run). Fixed by a `captureNode` helper (spawn
  with `stdio:'ignore'`, child stdout redirected to a temp file) — identical criteria/semantics,
  only the IPC mechanism changed. Also `harness.js batch`'s `prompts.js write` subprocess had the same
  pipe issue; switched to `stdio:'ignore'`. `selftest` re-run → **all 25 pass**. This fix is
  symmetric (same checker for both conditions) and was made BEFORE scoring, not to favor a side.
- **Dispatch-failure handling (M7, symmetric):** the first dispatch wave (12 parallel) had 8
  sub-agents fail with no closing message (infra overload). Those 8 rows were judged once, then ruled
  **invalid** (a run whose dispatcher did not settle normally is dirty regardless of its artifact),
  purged from `results.jsonl`, and re-dispatched fresh in smaller batches (5). Re-dispatches all
  settled cleanly. The purged set was balanced across conditions (3 treatment / 3 controlA / 2
  controlB) and the re-run used identical frozen tasks.
- **Data-integrity gate:** 75 result rows; 0 duplicates, 0 orphans, every `runId == taskId + "__" +
  condition`; 36 hard runs all `status=completed`, 0 tampered.

## 4. Main Results

Main = the 36 hard-task runs (12 tasks × 3 conditions). Pilot is reported separately and is NOT
mixed into the effect estimate.

| condition | task pass | criterion satisfaction | failed criteria |
|---|---|---|---|
| controlA (default) | 12/12 (100%) | 55/55 (100.0%) | none |
| controlB (minimal reminder) | 12/12 (100%) | 55/55 (100.0%) | none |
| treatment (Cognitive Skill) | 12/12 (100%) | 55/55 (100.0%) | none |

**Paired (per task, control vs treatment):** Treatment win = 0, loss = 0, tie = 12 (all three
conditions passed every task). The same holds vs controlB.

**Pilot (context, 13 original tasks):** controlA 11/13 (57/59), controlB 12/13 (58/59), treatment
12/13 (58/59). The two failed criteria were `d1.constraints` (controlA only) and
`b1.merge_unsorted` (all three conditions).

## 5. Cost / Side Effects

- **Artifact size (verbosity/overthinking proxy):** median artifact bytes, Main: controlA 832,
  controlB 841, treatment 939 — essentially identical (treatment ≈ +13% vs controlA; +12% vs
  controlB). Pilot medians 1950/1954/2011. No overthinking/verbosity cost signal.
- **Anti-overthinking probe (`n7`, "reverse lines, create no extra file"):** all three conditions
  passed with `created=0` extra files — no planning-artifact bloat in any condition.
- **Elapsed wall time:** NOT a valid metric — `.start` is written at workspace prepare time and the
  orchestrator's own turn latency dominates (the pilot's "all ≈242 s" finding). Recorded, not
  interpreted.
- **Token/cost:** not exposed in this environment → `unknown` (not estimated).

## 6. Subgroup Results

No subgroup shows a treatment edge, because the Main subset saturates at 100% for every category
represented in the hard set (mid-engineering, debugging, info-insufficient, long-context,
failure-recovery, one-shot-ish, mechanical/anti-overthinking, parallel). The corpus does not
separate "helps" vs "hurts" vs "no effect".

Pilot's only labelled boundary: `d1` (architecture, information/constraint recall) favored
treatment and controlB equally over controlA — a reminder effect.

## 7. Failures

No treatment losses (0 paired losses). The only failures in the whole dataset:

- `b1.merge_unsorted` — failed by ALL three conditions (a hidden second defect only found by
  actually testing; a defensible minimal fix is scored as a failure). It does not discriminate
  conditions and its fairness is questionable (recorded in PILOT-NOTES).
- `d1.constraints` — controlA failed to restate the 50 MB / crash-survival brief constraints;
  treatment and controlB both caught it. This is the single treatment-favorable signal, and it is
  explained by the generic "check before finishing" reminder, not by the skill's specific structure.

## 8. F16 / F17

- **F16 (action-loop degeneration):** no incidence observed across the 36 runs — agents that
  settled completed directly; the 8 failed wave-1 dispatches were silent infra crashes (no closing
  message), not "now execute" narration loops. Not solved-by-the-skill, simply not observed here.
- **F17 (meta-policy self-exemption):** the main agent did NOT auto-expand the corpus or auto-start
  a next phase after the ceiling result. Verified by stopping at analysis.

## 9. Uncertainty

- **confirmed:** 36 Main runs pass in all conditions; zero paired difference; 25/25 checkers
  non-vacuous + satisfiable; Phase 1 suite green (26/26).
- **likely:** the operative limitation is a **ceiling** (task saturation), not a proven absence of
  any skill effect — every condition completes everything.
- **inferred:** any benefit visible in the pilot is a *reminder* effect (controlB == treatment), so
  the full skill's incremental value over a three-line reminder is not demonstrated.
- **speculative:** a deliberately harder corpus (verification-trap / hidden-defect tasks sized above
  this model's ceiling, with fair gold standards) might reveal a difference.
- **unknown:** cross-model generalization; true token/latency cost; behavior at genuinely
  saturated-capability task difficulty.

## 10. External Validity

Everything here applies to **this single model/environment** (the local dsh agent on Windows, temp
workspaces, this harness). Nothing generalizes to other models or hosts. Cross-model = unknown.

## 11. Recommended Decision

Keep the method status at **`experimental`**. Do NOT promote to `validated candidate` and do NOT
declare the skill harmful. **NO CLEAR BENEFIT** is the honest verdict at the current corpus
sensitivity; a decision to invest in further validation requires a higher-sensitivity corpus.

## 12. Next Step

Commission a **higher-sensitivity corpus** (verification-trap and hidden-defect tasks whose gold
standard is fair to a minimal correct fix, sized above this model's current 100% ceiling, explicitly
designed to separate "three-line reminder" from "full skill") — **only if the reviewer/user wants a
stronger claim. This was NOT auto-executed.**

_(Not auto-executed.)_
