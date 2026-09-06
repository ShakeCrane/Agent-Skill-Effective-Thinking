# Method: Verification-Priority Planner (`verificationPlan`)

File: `strategies/verify.js` · Status: **experimental** (not core — no live-LLM-executor run yet)

## Purpose

Decouple "how hard should I think?" (the router's strategy) from "how do I **prove** the result?"
(answerable in priority order). Turns a routing decision into a concrete, ordered verification plan
so an agent never mistakes self-inspection for evidence.

## Mechanism

`verificationPlan(strategy, profile)` → `{ primary, methods, note }`.

- Fixed priority ladder (reflection-is-not-evidence): `external-test` (actual run / automated test)
  > `compiler-runtime` > `authoritative-source` > `independent-computation` >
  `multi-source` > `independent-reviewer` > **`self-review` LAST**.
- Verification difficulty picks ladder depth: ≤0.3 trivial (external test), ≤0.5 (compiler +
  authoritative), ≤0.7 (independent computation + multi-source), >0.7 or high error-cost or one-shot
  (independent reviewer / adversarial). Self-review is never primary and is always only the final
  sanity pass.
- Cheap-verification honesty: a fast/low-verify task gets a shallow plan and an explicit note that
  cheap verification is available — never an inflated ladder.

## Applicability / non-applicability

- **Use for:** any executed task, to choose the verification the executor must actually run;
  especially high-stakes / one-shot / hard-to-verify work where the plan should escalate to
  independent review.
- **Don't use as evidence:** the plan itself verifies nothing — it only selects and orders channels.
  A "good plan" is one whose primary channel the field test shows catches planted errors.

## Trigger / stop

- Trigger: after routing, whenever the agent is about to finish and claim success.
- Stop: once the highest-available priority channel has actually been executed.

## Expected gain / cost

- Gain: evidence-before-claim, self-review demoted to a final sanity pass, no "I re-checked it"
  masquerading as verification. Cost: trivial (pure function).

## Failure modes

- Plan is only as good as its channels: a low-verify subject may have no executable external test —
  the plan can't conjure one, it must say so (honest note) and fall back to the next method.
- Coarse depth boundaries (0.3 / 0.5 / 0.7) can jump several rungs — a mild over-verification risk
  just above a boundary; acceptable because the plan is advisory to the executor, not binding.

## Evidence

- `evals/verify-test.js` — ladder ordering, self-review-last, escalation, never-primary (unit).
- `evals/verify-field-test.js` — mutation harness: for 4 in-process subjects the planner-selected
  channels PROVABLY catch planted errors (correct passes, mutations caught, independent second
  opinion disagrees with mutated one-shot code).
- `evals/library-test.js` — exposed on the public API (`verificationPlan`, `VERIFY_LADDER`).
- **Live-executor run (Session 30, first):** two real subagents (self-review-only vs independent
  runner) each verified two planted-bug subjects. BOTH channels caught both bugs; ground truth by
  direct execution confirmed BUGGY. The expected "self-review misses, execution catches" gap was
  NOT observed at n=2 — recorded honestly in `research/live-verify-run.md`. The ladder's rule
  survives on its actual rationale (an assertion is weaker evidence than a run, so prefer the run;
  self-review stays last-resort, never primary), not on an overclaim that self-review always fails.
- `npm test` = 26 eval scripts, exit 0; `npm run audit` = 26/26 PASS.

## Known limits / open questions

- No live-LLM-executor run at scale: the first live run (Session 30) is n=2 and did NOT show a
  self-review-vs-execution performance gap — so the planner remains `experimental`. Promotion to
  `validated` needs a larger, varied sample and ideally a measured self-review failure rate (cf.
  Huang et al. 2023 on unreliable self-correction without external feedback).
- Ladder depth is coarse and hand-tuned; margin-based smoothing is a candidate refinement.
