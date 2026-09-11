# External Behavioral Evaluation Protocol (Phase 2)

Status: `draft → frozen at Main Evaluation start`
Question: **Does loading the Cognitive Skill make an agent actually perform better on real tasks?**

This is NOT a routing-label test. Primary evidence is *the artifact the agent produces and whether it
satisfies objective acceptance criteria* — not whether the router guessed the right strategy.

---

## 1. Why Phase 1 evidence is insufficient

All Phase 1 numbers (validation 32/32, benchmark 19/19, robustness ±13.7%) measure
**specification / routing consistency**: does `route(profile)` match a hand-authored label?
None of them measure whether an agent that reads `SKILL.md` finishes a real task better.
Phase 1 is therefore: *internally well-tested, externally unvalidated.*

E2E keyword extraction on the held-out corpus is 25/32 (78%) — the pipeline's own numbers already
say signal extraction is the weak link, which is a *behavioral* claim that was never tested
behaviorally.

---

## 2. Frozen baseline

Recorded at Phase 0 (see `reports/phase-2-external-eval.md` §2):

| Item | Value |
|---|---|
| Baseline commit | `599beac09a461f81518217cadc606b5448e6bf31` |
| Version | `0.2.0` |
| Branch | `phase2-external-behavioral-eval` (master untouched) |
| Runtime | Node `v22.22.2`, Windows (win32), bash shell |
| Phase 1 gate | `npm test` = 26 scripts, exit 0 |

**Freeze rule (hard).** After Main Evaluation run #1 begins, the following may NOT be changed to
improve scores: `router/*` thresholds or rules, `strategies/*` behavior, `SKILL.md` cognitive
content, corpus acceptance criteria, checker logic, judge rubrics.
Permitted after freeze: harness bugs, logging bugs, environment bugs, docs/typo fixes that do not
change cognitive behavior. Any newly discovered *cognitive* defect → record as a Failure, do not fix
and re-run on the same corpus.

---

## 3. Conditions

| Condition | Description |
|---|---|
| **Control A — default** | Task text only. The agent runs with its normal harness behavior. Tests: "does adding the skill beat what a modern agent already does?" |
| **Control B — minimal best practice** | Task text + a three-line reminder: *understand what is asked and the constraints → do the work → check the result before finishing.* Tests: "is any observed gain the skill's specific structure, or just any process reminder?" |
| **Treatment — Cognitive Skill** | Task text + full `SKILL.md` + one line stating the repository is available and its CLI/library may be used. This is the realistic deployment of the skill. |

Same model, same harness, same tools, same fixtures, same task text, same workspace layout.
The only manipulated variable is the instruction block prefixed to the task.

**Honest scope note.** Control A is "the default WorkBuddy agent", not a bare model with an empty
system prompt. The harness itself already contains general task-execution guidance. The measured
question is therefore the *incremental* value of the skill on top of a modern agent harness — which
is the deployment question that actually matters, but it is a narrower claim than "skill vs. nothing".

---

## 4. Execution mechanism and its consequences

There is no programmatic way to spawn model sessions from inside this environment: run dispatch is
performed by the main agent (Agent tool), one **fresh-context subagent per run**, which writes its
deliverables into a per-run workspace directory. Everything else is scripted:

- `evals/external/harness.js prepare <taskId> <runId>` → creates an isolated workspace with fixtures.
- `evals/external/harness.js check <taskId> <runId>` → runs the frozen deterministic checker.
- `evals/external/harness.js record <runId> ...` → appends one metrics row (append-only JSONL).
- `evals/external/harness.js report` → aggregates.

**Consequence 1 — dispatch is unblinded.** The main agent necessarily knows the condition when it
dispatches. Mitigations, all enforced mechanically:
(a) acceptance criteria and checkers are authored and committed *before* any run;
(b) artifacts live under anonymous run IDs, and the condition↔runId map is stored in a separate
sealed file never shown to reviewers;
(c) a majority of tasks are verified by deterministic scripts that the main agent cannot influence;
(d) subjective tasks are scored by a blinded reviewer subagent that receives only the anonymous
artifact path and the pre-registered rubric.

**Consequence 2 — token/cost is not directly measurable.** Per-run token usage of a subagent is not
exposed in this environment. We record the proxies we *can* measure (elapsed wall time, artifact
size, file churn, self-reported attempts) and mark true token cost as `unknown` rather than
estimating it. Claiming a cost number we cannot measure would be worse than admitting the gap.

**Consequence 3 — single operator, sequential runs.** Wall-clock allows a bounded corpus; we
therefore optimize for **task diversity**, not for repeated runs of the same item. A repeat-run
variance estimate is done only on a small high-variance subset.

---

## 5. Corpus requirements

Tasks must be genuinely new — not rewrites of the 19/32 Phase 1 routing items. Each item:

```
task_id, category, task_text, environment, acceptance_criteria[],
verification_method, difficulty_notes, risk_notes
```

Coverage (A–J per objective): A mechanical-simple (overthinking check) · B mid engineering ·
C high-uncertainty debugging · D architecture/trade-off · E information-insufficient (must read
files before acting) · F high-risk-but-cheaply-verifiable (avoid "high risk ⇒ deep") ·
G long-context · H failure-recovery · I parallel-applicable · J one-shot/irreversible.

**Verification-first design rule.** A task is only admitted if success can be checked *objectively*
(deterministic script, hidden test suite, parser/diff, rule-based fact check). Subjective tasks are
admitted sparingly (planning/architecture only) and always with a pre-registered rubric; they are
never used where an automated check exists.

---

## 6. Randomization, isolation, ordering

- Run order is generated **once**, before any run, from a recorded seed, and interleaves conditions
  per task (no systematic "control always first"). Stored in `evals/external/run-order.json`.
- Each run: fresh subagent context (no shared history), fresh workspace copy of fixtures, no access
  to another condition's output.
- Residual contamination risk is recorded, not hidden: the *main* agent sees all outputs (it must,
  to dispatch); the *reviewer* does not.

---

## 7. Metrics

**Primary** (evidence rank 1–3): task success (binary, by checker) · acceptance-criterion
satisfaction rate · requirement omission count · hard-constraint violation count (any violation is
recorded categorically, not averaged away) · verification adequacy (did the run actually check its
own result before finishing — measured by observable actions, not self-claim).

**Secondary**: first-pass quality · rework/attempts (self-report, low rank) · file churn · artifact
size (verbosity/overthinking proxy) · elapsed wall time · premature completion · tool-call count
where observable.

**Meta failures (F16/F17 watch)**: action-loop degeneration (declares intent, never invokes) ·
repetitive narration · endless planning · premature completion · failure to escalate after real
failure · unnecessary escalation · meta-policy self-exemption. Observed, not assumed.

**Not measured**: exact tokens, exact monetary cost, per-run latency breakdown. Marked `unknown`.

---

## 8. Scoring and blind review

- Objective tasks: deterministic checker emits one pass/fail per acceptance criterion. No judgment.
- Subjective tasks: pre-registered rubric, per-criterion 0–2, reviewer subagent receives
  `Candidate A` / `Candidate B` paths only. Reviewer must not be told the hypothesis.
- Two reviewers where affordable; disagreement is recorded separately, never silently averaged.
- **Reviewer unavailable = `unavailable`, never negative evidence.**

---

## 9. Analysis plan

Per task: condition-level pass vector. Aggregated: Control vs Treatment success rate, Δ criterion
satisfaction, Δ constraint violations, Δ time, Δ verbosity. Per category breakdown (the interesting
result is *where* the skill helps and where it hurts, not the grand mean).

Explicitly evaluated: **is the gain worth the cost?** A +4% quality gain with +70% time is reported
as such and does not count as success.

---

## 10. Verdict space (all four are legitimate outcomes)

`VALIDATED CANDIDATE` · `MIXED` · `NO CLEAR BENEFIT` · `REGRESSION`.
The protocol is written so that the last three are reachable; nothing in the design lets the
experiment drift toward the first.

---

## 11. Gates

- Phase 0 → 1: baseline recorded, branch created, Phase 1 suite green.
- Phase 1 → 2: protocol frozen (this file), checkers authored before runs.
- Phase 2 → 3: corpus complete + every task has a working checker.
- Phase 3 → 4: pilot complete, harness reproducible, scoring stable.
- Phase 4 → report: main evaluation at target N, both conditions done, verification complete.
- Stop: verdict issued, repo converged. No Phase 3 auto-start.
