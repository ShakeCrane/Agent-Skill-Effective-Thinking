# Session Report — Cognitive Agent Skill (Task Judgment & Adaptive Execution)

Status: `experimental` (mature, working, fully tested prototype; validation exists but is small and
author-labeled). All 10 objective minimum-deliverables machine-verified (`node evals/deliverables.js`);
`npm test` runs **26 independent checks** and exits 0. This is the consolidated final-state report.

## Objective

Build, from zero, a reusable AI-agent Cognitive Skill whose first-priority capability is **task
judgment & adaptive execution**: with each task, the agent decides how hard to think, whether to
plan first, which strategy to use (Fast/Structured/Deep), whether to escalate/delegate the model
(based on a real capability mismatch), how to verify, and when to stop deliberating — spending the
right effort per task, not one rigid template for everything.

## Changes (final converged tree — see the current-structure map in `README.md`)

The earlier heading here read "69 files". That number was not reproducible: it recorded a count whose
rule was never written down, and the tree has since grown. **Pinned to the `v0.3.0` tag**, whose tree
does not change: **323 tracked files across 23 top-level entries**, of which 214 are the two frozen
evaluation corpora (`evals/external-v2` 139, `evals/external` 75). Re-derive with
`git ls-tree -r --name-only v0.3.0 | wc -l`. Directory-level inventory and responsibilities are kept in
`README.md` → 项目结构, which is the single place that map lives; the working tree moves on, which is
why the count is quoted against a tag rather than against today.

- **Skill & docs:** `SKILL.md` (agent-facing contract), `AGENTS.md`, `README.md`, `changelog.md`,
  `reports/session-01.md` (this), `methods/core/task-router.md`.
- **router/** — `task-router.js` (deterministic, inspectable router, v4): extract → signal profile →
  strategy + model action; `extract.js` (keyword/pattern text→profile); `capabilities.js` (+ tier
  model); `calibrate.js` (probe battery → measured model tier); `adaptive-loop.js` (failure feedback
  → re-route, bounded retry).
- **strategies/** — `protocol.js` (execution protocol per strategy), `stopping.js` (when to stop
  deliberating), `cost.js` (advisory effort estimator), `certainty.js` (honest high/medium/boundary
  confidence from threshold margins), `verify.js` (verification-priority plan; experimental).
- **multi-agent/** — `orchestrate.js` (fan-out, independent review, consolidate; one failing unit
  never discards others).
- **bin/router.js** — CLI: task text → strategy + model action + execution protocol + when-to-stop +
  CERTAINTY + estimated effort + VERIFICATION PLAN (`npm run route`).
- **index.js** — public library API (`require('./')` = whole skill).
- **evals/** — 26 checks: benchmark + baseline, validation corpus (regression), extraction fidelity, adversarial
  probe (+ de-escalation), failure-mode coverage, capability + calibrate + robustness (over-fit guard),
  protocol, stopping, adaptive, orchestrate, deliverables gate, cli-smoke, skill-consistency, cost,
  library, dogfood (real text through the library), package-meta, principles, certainty, verify
  (planner conformance), verify-field (mutation harness proving channels catch planted errors),
  llm-profile (LLM-filled signal path), fuzz (input robustness), cross-author (label agreement).
- **research/** — router-evidence, cross-author-labels, live-verify-run, self-review-reliability,
  self-review-realistic-code, real-model-calibration, adaptive-live-run, skill-contract-audit,
  llm-profile-live. **failures/failure-log.md** (F1–F17).

## Evidence (npm test, exit 0; all 26 checks PASS)

- Training benchmark 19/19 **routing/strategy-label accuracy** (+68.4 pts strategy, +15.4 pts model
  vs the naive "always structured/keep" baseline at 31.6%). This is a ROUTING-LABEL benchmark — it is
  NOT real-task success rate, just agreement with hand-authored expected routes on a fixed corpus.
- **Validation corpus 32/32 (regression / specification consistency — NOT out-of-distribution
  generalization):** profile-based, author-judged labels. The corpus entered the development feedback
  loop (its misses drove router v4 changes; see F4/F5), so it is not a true held-out test set.
  Cross-author re-measured in Session 54 on all 32: inter-judge 96.9% strategy, router↔judge 78–81%
  strategy = author↔judge. That equality only means the cross-review did NOT detect an obvious
  author-specific bias; it does NOT rule out author / benchmark-ecosystem overfitting.
- End-to-end text→route 38/41 (**93%**; remaining misses are documented keyword-extraction ceilings).
- Failure-mode coverage: all 9 objective-named modes exercised + no regression.
- Objective-principles conformance (P1–P6): all six hold over the corpus (no rushed ambiguous, no
  over-thought cheap, large-context→deep, repeated-failure→escalate, high-risk→deep,
  parallel-research→delegate).
- **Robustness:** decisions are stable under ±10–20% threshold jitter over the combined 51-item set
  (single-axis ≤5.9% flips, all-axes ≤13.7%), closing the "over-fit to exact thresholds" concern
  with data.
- Certainty: clear tasks high, F6-boundary tasks honestly non-high, structured never falsely confident.
- Skill-consistency + package-meta guards: doc↔code and package contract have no drift.

## Findings

- A small, ordered decision procedure (few high-signal signals) is enough to separate the four
  strategies — no giant scoring table needed (transparent, debuggable, threshold-robust).
- **Verification difficulty is the key mediator**: high stakes with cheap verification favor
  "fast/structured + verify", not deep (anti-overthinking). Corroborated externally
  ([When More Thinking Hurts](https://arxiv.org/html/2604.10739)).
- Many trivial constraints / high novelty must NOT force Deep when verification is trivial.
- Repeated failures are evidence of mismatch → deepen/upgrade, don't retry harder; escalation and
  downgrade are two directions of one current-model-vs-requirement decision; capability is better
  measured (probe-calibrated) than guessed.
- Deliberation producing no new information is wasted — stop conditions are explicit.
- **Signal extraction is the real bottleneck**: text→profile is ~91% e2e; an agent's own reading is
  richer than the keyword heuristic, so real deployment should let an LLM fill the profile.
- Honest confidence (threshold-margin certainty) surfaces exactly where decisions are fragile.

## Failures (documented; failures/failure-log.md F1–F17)

- **F1** high error cost alone forced Deep (overthinking) — fixed (v2): stakes must be mediated by
  verification difficulty.
- **F2** train-set 100% is co-fit — addressed with an independently-authored validation corpus + robustness test.
- **F3** large mechanical batch boundary — no code change; candidate signal recorded.
- **F4** naive extractor misroutes (80%→96% after general fixes) — keyword ceiling documented.
- **F5** enlarging the validation corpus exposed real overfitting + extractor numeric false positives — fixed (v4).
- **F6** threshold-robustness finding: fragility is localized to boundary tasks (adjacent-strategy
  flips only) — evidence, not a code change; certainty now flags those cases.

## Decisions

- **Accepted:** small-signal deterministic rule router over a big scoring table or a learned router
  (for now); external verification over self-review
  ([Huang et al.](https://arxiv.org/abs/2310.01798)); anti-overthinking guards; cost-advisory (never
  auto-downgrades quality); capability calibration via probes; explicit stopping conditions; bounded
  adaptive loop with failure feedback; honest certainty flags; library/dogfood/package/principles
  regression guards as permanent suite members.
- **Deferred:** learned routing (RouteLLM-style); real multi-agent execution; real-model calibration
  runs; publishing the package.
- **Rejected (this session):** treating the train-set 100% as validation.

## Risks

- Validation corpus still small (32) with author-judged labels; extractor is heuristic (93% e2e).
- Calibration/CONSUME measured on one model family (reasoning/context/reliability + a true ~15.6k-
  token long-context run, Session 55 — no degradation at ~8× the Session-38 size); multi-model
  comparison and extreme-length (multi-100k) context not yet done.
- Deterministic-vs-learned router performance unmeasured; cost numbers remain order-of-magnitude.
- Async orchestration/adaptive machinery is wired + live-demoed but the FULL host productionization
  (deep subagent execution into the repo for a real executor) is not claimed; actual `npm publish`
  to a registry was deliberately NOT executed (needs operator credentials).

## Next (updated from the original list — earlier items are DONE)

1. ~~Wire orchestration + adaptive loop to real subagents~~ → DONE (Sessions 36/43/48: `runTaskAsync`,
   async adapters, live fan-out/review/adaptive runs; repo-convergence caveat on executor writes
   recorded honestly).
2. ~~Run calibration probe battery on a real model~~ → DONE (Sessions 35/38: measured capacity
   {1,1,1}/tier strong + true lost-in-the-middle context 6/6).
3. ~~Expand validation corpus with cross-author labeling~~ → DONE (Session 30: 82% strategy
   agreement on 22 items).
4. ~~Publish as a reusable npm package~~ → DONE at packaging level (Sessions 34/49/51: real tarball,
   `npm run consume` end-user gate). Remaining: actual registry publish (operator).
5. ~~Measure agent-self signal-extraction reliability~~ → DONE (Sessions 37/45: `fillProfile` +
   `--profile-json`, live measure, keyword ceiling 93%).
Remaining: cross-model calibration, extreme-length context, full host nesting, actual registry
publish (operator), larger label sets.

---

## Session 57 — CONVERGENCE PASS + current-state sweep after Sessions 53–56

**What changed:** full convergence pass (inventory, junk scan, README-tree↔files cross-check) plus a
current-state consistency sweep across all long-term docs after four doc-touching sessions.

**Evidence:** fixed two genuine drifts — report Evidence robustness numbers (5.7%/14.3% @41 items →
5.9%/13.7% @51 items) and the capability-calibration card ("one true long-context run" → two, 2k +
15.6k). Re-verified: `npm test` = 26 scripts exit 0; audit 26/26 "skill healthy"; `npm run consume`
PASS (shipped tarball end-user usable). Inventory: 6 top-level files, 9 dirs, 69 files, zero junk.

**Findings:** even with a disciplined cadence, current-state numbers drift at the edges between
sweeps — this time the report's robustness figure and a method card's evidence count. A sweep that
reads every current-state claim (not just the ones that changed) is what catches them.

**Decisions/risks:** docs-only; no code change. Repo fully converged.

## Session 56 — live LLM-profile fills on the Session-54 boundary items (n=6)

**What changed:** fresh fill agent produced 14-field profiles for 6 held-out items (4 where both
independent judges coalesced against the author/router + 2 controls); routed through the real
`fillProfileSync`→`route` path.

**Evidence:** fill sided with the judges on 2/6 (`contract-review-large-hd`→deep/**delegate** via
`parallelism=true` — the exact judge reading the author missed; `many-constraints-trivial-verify`→
structured), with the author on 2/6 (`ambiguous-cheap-reversible` `clarity=0.35` IDENTICAL to the
author — judges' fast is an alternative stance, not dominant; `novel-hard-verify-algo` deep/keep),
and over-marked the 2 mechanical batches (`yaml-json-comments` conflict 0.8+parallelism → wrong
deep/delegate; `mech-parallel-delegate` constraint_count 4 → spurious deep).

**Findings:** the LLM-fill path CAN surface judge-visible signals the keyword extractor misses
(delegability of partitionable large reviews) and echoes the author on genuine ambiguity — but it
reproduced the Session-37 over-marking mode on batch conversions (n=10 total). Net: a complementary,
never-sole, signal source; the sanitize + keyword-fallback adapter is exactly the containment needed.
Reinforces the standing core finding that **signal extraction is the real bottleneck**.

**Decisions/risks:** no code change (measurement + docs). `npm test` = 26 scripts exit 0; audit
26/26. Repo clean.

## Session 55 — context envelope extended to ~15.6k tokens: lost-in-the-middle does NOT appear

**What changed:** advanced the "extreme-length context" remaining limit with a deterministic 750-line
(~62.4k-char / ~15.6k-token) document and a fresh no-tools model-under-test answering four planted
probes (beginning fact, middle fact, end fact, and a mid-document embedded formatting instruction).

**Evidence:** **4/4 correct** — beginning 31, middle 77, end 42, and the mid-instruction code 4711
followed exactly (plus a correct paraphrase of what to ignore). Combined with Session 38:
**10 real context probes, 10/10**, with the envelope grown ~8×.

**Findings:** lost-in-the-middle did not appear at 15.6k tokens on this model family — middle recall
and mid-instruction compliance (the strictest probe) both held — so `context=1` is backed by a
genuine ~15.6k-token run, not just ~2k. Honest ceiling: one family, single run, still far below
multi-100k.

**Decisions/risks:** no code change (evidence + docs only). Scratch document removed; repo clean.

## Session 54 — independent labels for all 32 held-out items; Session-30 findings reproduce

**What changed:** dispatched two fresh, no-seed labelers over all 32 task texts (task-text only);
both returned complete labels, persisted as `research/cross-author-labels/labelerA.json` +
`labelerB.json` (durable reproducibility data). Closed the Session-53 open item.

**Evidence:** author↔router 32/32; router↔A = author↔A = 68.8% full / 78.1% strategy;
router↔B = author↔B = 71.9% full / 81.3% strategy; inter-judge 93.8% full / 96.9% strategy. Both
judges agree on all 10 new items and coalesce against the router on 4 (documented boundaries).
`npm test` = 26 scripts exit 0; audit 26/26.

**Findings:** the Session-30 validation story is not a fluke of 22 items — on a harder, larger set
the router still agrees with independent judges at exactly the same rate the author does (so it is
NOT author-fitted), and inter-judge consensus stays ~97%. The 4 new coalesced disagreements are
genuine judgment boundaries, notably: "just try it" reads as clarity/fast to both judges
(signal-extraction boundary for the LLM-profile path), and a 200-page review reads as delegate /
a no-oracle novel algorithm as upgrade — each defensible under the skill's rule set.

**Decisions/risks:** no router change (validation evidence only). Repo clean.

## Session 53 — held-out validation expanded 22 → 32 with new pressure-area boundary items

**What changed:** added 10 genuinely new pressure-area items to `evals/validation.js` (see
changelog for the full list): anti-overthinking-under-urgency, F-6b ordering (one-shot-over-
parallel), mechanical-parallel delegate, single-research no-delegate, hidden-constraint format
disguise, escalation-boundary-at-2, large-context iterable review (deep/keep, not upgrade),
ambiguity+cheap+reversible NOT deep, novelty+no-oracle deep/keep, and many-constraints+trivial-
verify fast. Labels reasoned from task nature; several outcomes were genuinely uncertain.

**Evidence:** **32/32 strategy AND 32/32 model (100%)** — all 10 new items generalize with NO
router change, stronger than the old 22/22. Full suite exit 0; robustness over 51 items
single-axis ≤5.9% / all-axes ≤13.7%; principles P1–P7 + coverage PASS.

**Findings:** the decision procedure's boundaries hold on new, harder cases — in particular the
F-6b ordering, the "stakes mediated by verification" guard (urgent but cheaply-reproducible stays
Structured), the mechanical-parallel delegate, and the single-research no-delegate restraint all
survive. Selection-bias caveat remains: author labels only for the new 10; independent-label
coverage still on the original 22.

**Decisions/risks:** no router change (validation only). Remaining honest limits unchanged; next
obvious step is independent labels for the new 10 (model-backed) and then the larger set is fully
cross-validated.

## Session 52 — report Risks/Next refreshed against the true current state

**What changed:** re-audited the report header (still claimed "24 independent checks" after the
Session 50/51 additions → corrected to 26; failure-log range F1–F14 → F1–F15) and refreshed
Risks + Next. The ORIGINAL Next-list items #1–5 are now all marked DONE (wire-to-real-subagents →
Sessions 36/43/48; calibration probe battery → 35/38; cross-author labels → 30; publish → 34/49/51
packaging + consume gate; agent-self signal extraction → 37/45), with the remaining work
consolidated into one explicit line: cross-model calibration, extreme-length context, full host
nesting, actual registry publish (operator), larger label sets.

**Evidence:** `npm test` = 26 scripts exit 0; audit 26/26 "skill healthy"; repo clean (6 top-level
files, 9 dirs, no scratch/junk).

**Findings:** even after the Session 47 doc-consistency sweep, the report header's count drifted
again (24→26 after the two newest eval additions) — counts must be re-checked at every doc-touching
round, and a header number is the first place to go stale.

**Decisions/risks:** docs-only round (convergence); no code change. Remaining honest limits unchanged.

## Session 51 — end-user consume gate: the SHIPPED tarball is proven usable

**What changed:** added `evals/consumer-test.js` (requires the INSTALLED package by root dir so
internal requires resolve from the installed tree, not the repo — exactly an end user's
`require('cognitive-agent-skill')`), `bin/consume-pack.js` (pack → extract → run it), and
`npm run consume`. This closes the last untested link: "package is packable" vs "package works for
an end user."

**Evidence:** `npm run consume` PASSES — prepack runs the full 26-script suite, 37-file tarball
ships, extracted as an installed dependency, and the entire public API works from the installed
tree (route/extract/fillProfile/verify/certainty/fanOutAsync/reviewAsync/runTaskAsync). `npm test` =
26 scripts exit 0; audit 26/26.

**Findings:** fixed two Windows/sandbox specifics (npm `.cmd` shim → run npm's own CLI JS under
node; temp `--cache` so pack never touches the sandbox-blocked global npm-cache). The end-user
validation is now a repeatable one-command gate.

**Decisions/risks:** no behavioral change (new gate only). Repo clean.

## Session 50 — fixed F15: batch + --profile-json silently cross-contaminated rows

**What changed:** a targeted option-combination audit found a real silent semantics bug: `batch` +
`--profile-json` applied one task's injected profile to every row (a trivial rename wrongly became
deep because an architecture-task profile leaked into it). Fix: batch strips `profileJson`
(`profileJsonIgnored=true`, source stays keyword) + warns; single-task injection unchanged;
regression added to `evals/cli-batch-test.js`.

**Evidence:** contaminated batch now routes rename→fast/keep + architecture→deep/keep from their
OWN text; single-task still `src=injected+keyword`. `npm test` = 26 scripts exit 0; audit 26/26;
failure log F15.

**Findings:** the fuzz test (no-crash + valid-vocabulary) wouldn't have caught this — only checking
**semantic** per-mode behavior of option combinations does. A per-single-task option must be
explicitly inert (and warn) in batch mode.

**Decisions/risks:** real bug fixed; behavior now correct. Repo clean.

## Session 49 — CONVERGENCE PASS (fresh): README tree fixed, all docs reachable, tarball complete

**What changed:** fresh convergence pass (objective-mandated; last Session 40). Full inventory +
junk scan (clean) + README-tree↔files cross-check. Found the README tree had drifted: only
`methods/core/task-router.md` listed (all 7 experimental cards missing), two research notes
(`adaptive-live-run`, `skill-contract-audit`) unreferenced, and a broken indentation line. Fixed the
tree; re-check: ALL research + methods files referenced.

**Evidence:** re-packed tarball = 36 files / 84.1 kB containing all 7 method cards + all 9 research
notes. `npm test` = 26 scripts exit 0; audit 26/26.

**Findings:** docs can drift from the file tree even when each individual file is fine; a
tree↔files cross-check (not just eyeballing) is what catches it. The shippable artifact now
completely and correctly mirrors the repo.

**Decisions/risks:** docs only. Repo converged; no further orphaned files.

## Session 48 — workspace write-probe + second live adaptive run

**What changed:** probed the Session-43 caveat directly — a sub-agent writing into the reusable
WORKSPACE succeeds (`WROTE: yes / CONTENT_OK: yes`), so the earlier stall was temp-target + executor
behavior, not an absolute limit. A second real executor attempt (write IPv4 impl to `scratch-live/`)
again stalled and was interrupted — a real failure mode. The adaptive loop handled it as designed:
attempt-1 failure fed back via `runAsync` → re-route → converge; always-failing executor bounded at
4 attempts. `research/adaptive-live-run.md` addendum recorded; scratch cleaned.

**Evidence:** probe: WROTE/CONTENT_OK yes. Loop: a0 deep/keep f=0 → a1 deep/keep f=1 → converge;
always-fail bounded at 4. `npm test` = 26 scripts exit 0; audit 26/26.

**Findings:** the loop tolerates REAL executor stalls (doesn't block forever); agents CAN write to the
workspace, so a future host wiring could use it directly. The only remaining simulator step is
success-on-attempt-2.

**Decisions/risks:** upstream change none (mechanism/probe). Repo converged (scratch removed).

## Session 47 — document-consistency sweep (stale current-state numbers fixed)

**What changed:** verified true current numbers (chain=26, benchmark 19/19, e2e 38/41=93%) and fixed
every stale CURRENT-STATE claim in the long-term docs: README (checks 24→26, benchmark 13→19,
validation 21→22, e2e 91→93, cross-author note), this report (evals list 24→26 checks incl.
llm-profile/fuzz/cross-author, benchmark/validation/e2e numbers, research + failure-log refs),
and the verify-planner + task-router method cards (24→26). Historical changelog records intentionally
untouched.

**Evidence:** `npm test` = 26 scripts exit 0; audit 26/26.

**Findings:** 46 sessions of growth left current-state claims in README/report/method cards at older
values (e.g. "24/24 checks") while the actual suite is 26/26 — a reader trusting those would
under-report the skill. The sweep restores one truthful current-state picture.

**Decisions/risks:** docs only, no code change. Remaining honest limits unchanged.

## Session 46 — SKILL.md contract-sufficiency audit

**What changed:** answered "is SKILL.md instructive enough to reproduce the router's decisions?" —
computed router ground truth for 5 outcome-distinct tasks and audited whether SKILL.md forces each.
Deterministic audit in `research/skill-contract-audit.md`; a no-seed sub-agent cross-check was also
dispatched but did not settle (interrupted, recorded honestly).

**Evidence:** every necessary outcome of the 5 tasks is forced by an explicit SKILL.md statement —
Fast conditions (L73–76), Deep for many-interacting-constraints/vague (L88), repeated-failure→
escalate (L115, L164–166), one_shot→upgrade on high-cost OR hard-to-verify AND overrides-parallel
(L54 = F-6b verbatim), verify-first ladder (L140). Ground-truth primary verification = external-test
for all 5, consistent.

**Findings:** the doc is sufficient at the rule level — a faithful reader derives the same
strategy/model/primary-verification as the router on all 5, including the non-obvious one-shot-over-
parallel case. The contract gives discriminating reasons, not thresholds (appropriate).

**Decisions/risks:** no code change (doc audit). Remaining honest limits: rule-sufficiency checked,
not full subtlety enumeration; 5-task sample. Sub-agent cross-check pending-as-interrupted.

## Session 45 — SKILL.md agent-contract gaps closed (one_shot signal + LLM-fill path)

**What changed:** audited the agent-facing contract against the implemented surface and closed two
real gaps in `SKILL.md`: the `one_shot` signal was absent from the signal table (it drives the F-6b
upgrade rule), and the LLM-fill profile path (`fillProfile`/`--profile-json`, Sessions 37/41) was
undocumented. Added the `one_shot` row (with override-parallel semantics) and a "Signal sources"
note (sanitize + keyword-fallback guarantee).

**Evidence:** `npm test` = 26 scripts exit 0; audit 26/26; skill-consistency no drift; the exact
documented `--profile-json` command reproduces MODEL: UPGRADE (F-6b reachable as documented).

**Findings:** the contract now matches the implementation for every capability; an agent reading
SKILL.md sees the one_shot semantics and the LLM-fill path, closing what the earlier audit passes
had missed (they checked earlier features only).

**Decisions/risks:** no code change (doc convergence). Remaining honest limits unchanged.

## Session 44 — input-robustness fuzz test; fixed a real crash on blank task text (F14)

**What changed:** added `evals/fuzz-test.js` (adversarial/malformed/extreme strings through the
whole pipeline + CLI + batch, assert no crash + valid vocabulary), wired into `npm test`. It found a
REAL bug: `extract('')`/whitespace threw, crashing the pipeline/CLI on a blank or truncated task.
Fixed `router/extract.js` to degrade to a neutral low-signal profile (structured/keep — "cannot
judge the task", deliberately not fast) instead of throwing. F14 added to the failure log.

**Evidence:** fuzz test 4/4; `npm test` = 26 scripts exit 0; audit 26/26.

**Findings:** the skill is now input-robust end to end — a real agent can pass any (even blank)
task text without the skill crashing; empty input routes to a safe default. Closing a reliability
gap the rest of the suite (valid profiles only) didn't cover.

**Decisions/risks:** no risk — the change is strictly more graceful (only the throw path changed;
no valid-task behavior altered). Remaining honest limits unchanged.

## Session 43 — first live adaptive-execution run (real task + real failing executor)

**What changed:** drove the skill's adaptive-loop machinery end-to-end on a real task (strict IPv4
validator, 13-case test harness = ground truth). Attempt 1 was a REAL sub-agent executor that
stalled/failed (sandbox temp-write boundary) — a genuine failure fed back through `runAsync`, which
re-routed (attempt 2 → success), stayed bounded on an always-failing executor, and revealed the
keyword extractor under-rates the task (fast/keep) vs the agent's LLM-fill reading (structured+
verify-heavy → deep). Study: `research/adaptive-live-run.md`.

**Evidence:** A = converge-after-real-failure; B = bounded (4 attempts, no infinite loop);
C = keyword-vs-agent-profile divergence live. `npm test` = 25 scripts exit 0; audit 25/25.

**Findings:** the #1 capability (adaptive execution) works live — always-execute-once, feed real
failures back, re-route, bound the loop; the Session-37 LLM-profile/keyword-ceiling finding is now
reinforced with a concrete spec-heavy task where keyword under-routes.

**Decisions/risks:** honest limits recorded (n=1; success-on-attempt-2 simulated after the real
first-failure; host productionization not claimed). Remaining limits otherwise unchanged.

## Session 42 — method cards for every capability (methods/ now complete)

**What changed:** added the five missing method-status cards under `methods/experimental/`
(signal-extraction, capability-calibration, execution-protocol+stopping+adaptive,
decision-certainty+cost, multi-agent-orchestration), completing AGENTS.md's "record every method
with a status" requirement. Statuses honest: execution-protocol/adaptive **validated**; the rest
**experimental** with evidence/limits. README updated; tarball contains all 7 cards (34 files).

**Evidence:** `npm test` = 25 scripts exit 0; audit 25/25; pack 34 files / 77.6 kB.

**Findings:** previously only 2 of 7 capabilities had method cards; the rest existed as code with no
status record. Now every method has purpose/mechanism/evidence/limits — the methodology's record
requirement is fully met, and a future session can see the status of every capability at a glance.

**Decisions/risks:** no code change (documentation convergence). Remaining honest limits unchanged
(multi-model calibration, extreme-length context, host productionization, actual npm publish).

## Session 41 — CLI exposes the LLM-filled profile path (`--profile-json`)

**What changed:** `bin/router.js` gained `--profile-json <json>` so an agent (or an LLM fill) can
inject a partial/full profile through the standard entry point; missing/invalid fields fall back to
keyword extraction (same sanitize as the LLM-profile adapter), malformed JSON degrades safely, and
JSON output reports `source`. Direct checks: injected one-shot+parallel → deep/upgrade; malformed →
keyword; keyword-only unchanged. `evals/cli-smoke.js` extended with two regression cases.

**Evidence:** `npm test` = 25 scripts exit 0; audit 25/25. Also interrupted the never-settling
Session-39 reviewer (its cross-check purpose was already served by the captain's recorded node
probes); recorded honestly.

**Findings:** the LLM-fill path is now as usable from the CLI as from the library — the "skill is
agent-usable end-to-end" goal is met through one entry point, with honest degradation and source
labeling.

**Decisions/risks:** no router change (adapter/reuse only). Remaining honest limits unchanged.

## Session 40 — CONVERGENCE PASS + failure log to date (F7–F13)

**What changed:** executed the objective's required convergence pass — repo inventory (9 intentional
dirs, 41 JS files, clean top-level), junk scan (none), full suite + audit + deliverables all green —
and brought `failures/failure-log.md` up to date with the seven design-changing failures from
Sessions 29–37 (repeated-failure verif gate, ambiguity-never-deep, two trivial-verification
thresholds, delegation gating/ordering, one-shot gate + F-6b ordering bug, novelty-in-capability,
and the planted-bugs-must-be-real construction lesson), each with root cause/fix/prevention/generality.

**Evidence:** `npm test` = 25 scripts exit 0; audit 25/25; deliverables PASS; repo clean.

**Findings:** the post-Session-15 failure log had a 2-year-of-sessions silent gap; closing it means
the log now records every design change with a real root cause, satisfying the objective's
"至少一次失败分析" as a durable, complete history.

**Decisions/risks:** no code change this round (convergence + documentation). The Session 39
adversarial-review report is still pending settlement and will be folded in when it lands. Remaining
honest limits unchanged.

## Session 39 — independent adversarial review of the post-Session-29 code surface

**What changed:** dispatched a fresh no-seed adversarial reviewer over all code added since the last
independent review (llm-profile adapter, async orchestrate + runAsync, F-6b reorder, their tests).
Captain independently probed the same surface with node (prototype pollution impossible, count edges
safe, one-shot-low-stakes doesn't upgrade, async order preserved, runAsync bounded, throwing-model
degradation byte-identical to keyword). All clean. The reviewer's node-run report appends when it
settles (recorded in changelog/report).

**Evidence:** `npm test` = 25 scripts exit 0; audit 25/25.

**Findings:** the new code held against the captain's own adversarial probes; the external reviewer
provides the independent cross-check (pending settlement). This closes the "new code never
adversarially reviewed" gap that existed for Sessions 36–37 work.

**Decisions/risks:** no changes required from the captain's probes. Remaining honest limits
unchanged.

## Session 38 — true long-context measurement (context=1 is now backed by a real run)

**What changed:** ran a real ~1.9k-token lost-in-the-middle document (end fact K_42, beginning fact
8080, mid-instruction "output only 7") against a fresh model-under-test; all three recalled
correctly → 6/6 real context probes combined with the battery. `research/real-model-calibration.md`
updated; the "context axis is weak evidence" caveat is now closed.

**Evidence:** A=K_42, B=8080, C=7 all correct from a single prompted read of a ~7.7k-char document.
`npm test` = 25 scripts exit 0; audit 25/25.

**Findings:** the measured `context=1` is no longer just placed-instruction checking — it survives a
genuine long-context end/middle/beginning recall. Remaining caveats: one model family, ~2k tokens
(not multi-100k), single run — so still `experimental`, not a robustness guarantee.

**Decisions/risks:** no code change needed (calibration machinery already correct); this is evidence
closure. Remaining honest limits: multi-model comparison, extreme-length context, larger label sets.

## Session 37 — LLM-fills-profile adapter + live measurement; F-6b one-shot-over-parallel fix

**What changed:** added `router/llm-profile.js` (fillProfile/fillProfileSync — host injects askLLM;
adapter sanitizes/clamps/validates, falls back to keyword, degrades safely). Public API +
`evals/llm-profile-test.js` (suite now 25 scripts). Live-measured: a real sub-agent filled profiles
for 4 tasks; routing them vs keyword exposed a REAL ordering bug (F-6b) — one-shot irreversible +
parallel was delegated, not upgraded. Fixed: one-shot outranks parallel. Benchmark item + P7 lock it
in; extractor + P6 updated.

**Evidence:** suite 25 scripts exit 0; audit 25/25; e2e 93%; benchmark 19/19 (100%) vs 31.6%
baseline; direct checks (T4 one-shot+parallel → deep/upgrade; pure parallel → delegate). Live study
in `research/llm-profile-live.md`.

**Findings:** the LLM-profile path is a genuine alternative signal source (caught the F-6b bug a
keyword run alone would miss on mixed signals) but not a universal win — the live LLM over-marked
`parallelism` on non-fan-out tasks (brainstorm, migration). Keyword stayed more conservative. The
adapter's sanitize/fallback is what keeps it safe.

**Decisions/risks:** F-6b is a real router revision. Remaining limits: n=4 live fills; LLM-fill
reliability on parallelism is model-dependent and unmeasured at scale.

## Session 36 — async adapters: the bridge to REAL subagents (deferred item closed)

**What changed:** `multi-agent/orchestrate.js` gained `fanOutAsync` + `reviewAsync`;
`router/adaptive-loop.js` gained `runAsync`; all exposed on the public API. Async coverage in
orchestrate-test + adaptive-test (deterministic async stubs). Live-demostrated with real subagents:
3 independent verification units returned CONFIRMED with line evidence → `consolidate` 3/3 → live
`reviewAsync` surfaced a genuine DISPUTE → captain resolved it by reading the source (ground truth,
not the models' claims).

**Evidence:** `npm test` = 24 scripts exit 0; audit 24/24. Live demo transcripts + commands recorded
in the changelog/report (subagent outputs transient).

**Findings:** the multi-agent principles are no longer just unit-mocked — a real fan-out of
independent verifiers produced confirmed claims, consolidation kept all, and an independent reviewer
raised a real conditional, exactly the "Agent 自评不能直接作为结论 → main agent resolves" pattern.
The dispute-resolution step used primary evidence (source reading), not model assertion.

**Decisions/risks:** adapters are the wiring point for hosts; the full host integration remains a
future concern (not claimed productionized). Remaining honest limits otherwise unchanged.

## Session 35 — first REAL-model calibration run (measured, not synthetic)

**What changed:** ran `router/calibrate.js`'s probe battery against an actual model for the first
time — a fresh sub-agent answered all 10 probes, scored externally against prepared ground truth.
Study: `research/real-model-calibration.md`.

**Evidence:** all 10 probes passed → measured capacity {1,1,1}, tier `strong`. Router with the
measured profile: hard task deep/keep (no upgrade; capable), easy task fast/keep +
recommend_deescalate. The "measure capability, don't assume it" promise is now demonstrated live,
not mocked.

**Decisions/risks:** honest caveats recorded — one model family, coarse battery, and the context
axis is only light placed-instruction checking (not a true long-context stress test), so context=1
is weaker evidence than it appears. Calibration remains `experimental`; a true long-context run and
multi-model comparison remain deferred.

## Session 34 — package is genuinely packable: real tarball verified

**What changed:** produced the actual npm tarball (`npm pack` with a writable cache + destination,
sidestepping the earlier npm-cache sandbox EPERM). Result: `cognitive-agent-skill-0.2.0.tgz`,
64.8 kB, 26 files, recorded shasum/integrity; `prepack` (full test suite) ran exit 0 during the
pack.

**Evidence:** inspected the tarball — contents are EXACTLY the `files` whitelist (index.js, router/,
strategies/, multi-agent/, bin/, methods/, research/, SKILL/README/AGENTS/changelog, package.json);
no evals/, no temp, no junk, no internal-only artifacts. The previously abstract "publishable"
claim is now backed by a real, machine-checked package artifact.

**Decisions/risks:** the long-deferred "publish" item is closed at the packaging level. The actual
`npm publish` to a registry still requires operator credentials and network (deliberately not done
autonomously). Remaining honest limits otherwise unchanged (no real-model calibration run; verify
planner experimental).

## Session 33 — self-review reliability on realistic code (18/18, honest)

**What changed:** extended the self-review reliability study to realistic, multi-branch
production-style code — order-total calculator, config validator, text wrapper, semver parser —
each with a confirmed planted domain bug. Fresh self-review-only agents, unanchored; ground truth
by direct execution. Study: `research/self-review-realistic-code.md`.

**Evidence:** 4/4 caught at high confidence (incl. the sneakily-correct-example R1 domain bug);
combined with Session 32 = **18/18, zero false "CORRECT"**. Also a construction lesson: two initial
subjects had no real bug (duplicate-line never triggered; contract didn't state the 4-segment rule)
— rebuilt and re-verified, proving planted bugs must be executed to be trusted.

**Findings:** consistent and now stronger — the verify ladder's rule is about **guarantee, not
average failure**: prefer the run (reproducible evidence) when available; never promote self-review
above a real check; and the claim "self-review always fails" is refuted by our data. Still an upper
bound: one model family, bugs findable by traced reading; long multi-file concurrency and
external-knowledge bugs are unmeasured.

**Decisions/risks:** verify planner stays `experimental` — no measured self-review failure rate
exists yet; we measured an upper bound on competence, not a production miss rate. To actually find
the failure regime would require deliberately harder bugs or a model not prompted to trace.

## Session 32 — measured self-review reliability: honest negative result (14/14 catches)

**What changed:** largest self-review reliability study to date — 6 subtle planted-bug classes,
each verified by a fresh self-review-only subagent in anchored (Round A) and unanchored (Round B)
modes; ground truth by direct execution (all 6 BUGGY). Study: `research/self-review-reliability.md`.

**Evidence:** 6/6 caught in each round, all high-confidence with correct hand-traced reasoning;
14/14 combined with Session 31. The naive "self-review is unreliable" claim was NOT reproduced.

**Findings:** the real justification for "prefer a real test" is evidence quality + worst-case
guarantee (a run is reproducible evidence; self-review is an unguaranteed assertion), NOT a
false claim that self-review always fails. Overclaim removed from the method's stated rationale.

**Decisions/risks:** verify planner stays `experimental` — n=14, one model family, hand-picked
well-known bug classes is an upper bound, not a production miss rate. The measure to close next:
self-review failure rate on longer/realistic code, or a model not prompted to verify carefully.

## Session 31 — first live-LLM-executor verify-ladder run (honest negative result)

**What changed:** closed the long-standing "no live-LLM-executor run" gap with a real-agent test of
the verify planner's channels. Two planted-bug subjects (one visible, one sneaky `max` floor bug);
for each, a self-review-only subagent vs an independent subagent allowed to execute tests. Captain
established ground truth by running the tests directly. Write-up: `research/live-verify-run.md`;
method card and changelog updated.

**Evidence:** both channels caught both bugs (all BUGGY/high); ground truth confirmed. The
hypothesized "self-review misses, execution catches" gap was **not** observed at n=2.

**Findings:** self-review produced correct assertions here, but execution is the only channel that
yields reproducible, independently-checkable evidence — so the ladder's rule survives on its actual
rationale (prefer the run; self-review is a last-resort sanity pass, never primary), not on the
overclaim that self-review always fails.

**Decisions/risks:** verify planner remains `experimental` — a first live run at n=2 with no
measured self-review failure gap does not reach `validated`. Honest negative result retained per the
research principle (search failures too). Remaining gaps: live run at scale / measured self-review
failure rate; publish step still deferred.

## Session 30 — cross-author label agreement: independent judges validate the router

**What changed:** two fresh, no-seed subagents independently labeled all 22 held-out validation
tasks from task text only. New `evals/cross-author-check.js` (repeatable 6-pair comparison
harness) + `research/cross-author-labels.md` (study + interpretation).

**Evidence (22 items):**
- **Strategy (the load-bearing "how hard to think" dimension):** A vs B = **22/22 (100%)**;
  router vs A/B = **18/22 (82%)**, equal to author vs A/B (82%).
- Full strategy+model-action: 68–77% (variance concentrated in caller-overridable upgrade-vs-keep).
- Author↔router remains 22/22.

**Findings:** the router agrees with independent judges at the SAME rate as the author (not more,
not less) — so it is a faithful encoder of one reasonable expert's judgment, not an overfit to the
author. The strategy consensus between two fully-independent judges is perfect, and the router hits
that consensus 82%, which is the defensible generalization number. Model-action hint variance is
expected (the objective says "seriously consider" upgrading, so it is inherently contestable).

**Decisions/risks:** no router change — the 4 strategy disagreements are documented fast↔structured
boundaries where both readings are defensible; retuning would recreate author-fit. Honest validation
claim is now "22/22 author, 82% independent (strategy), 68–77% (full)". Remaining honest limits
unchanged: no live-LLM-executor run; label agreement measured once (re-run when labels/router shift
materially).

## Session 29 — independent adversarial review: 7 router defects + 2 certainty bugs confirmed & fixed

**What changed:** dispatched two fresh no-seed reviewer subagents to adversarially attack the router
and the verify/certainty planners (multi-agent principle realized in the loop, closing "Agent 的自评
不能直接作为结论"). Both delivered reproducible node-run findings; I independently re-verified each
against the code, then fixed the genuine ones.

- **Router v6 (F-1..F-7):** repeated-failure escalation is now unconditional (was gated at verif>0.5,
  dropping real evidence); ambiguity can force Deep; unified the "not trivially verifiable" bar;
  parallel delegation no longer needs tool_dependency and is no longer disabled by model_capabilities
  edges; one-shot upgrade gate is OR (cost OR hard-verify); novelty removed from capability req.
- **Certainty (V5/V6):** hidden-trigger deep tasks no longer classified falsely-HIGH (real margin);
  structured is now hard-capped below 'high'.
- **Test honesty (V1/V2/V3/V4/V8):** one-shot note↔primary consistent; a tautological ladder test,
  a fake "independent opinion" (`*1` copy), and a run-not-actually-executed channel were all fixed;
  strategy-param independence locked by test.
- **Benchmark meta-fix:** the reviewer showed the old benchmark never tested one_shot/non-tool
  parallel/low-verif failure/ambiguity — 5 new principle-coverage items added.

**Evidence:** benchmark 18/18 (100%) vs 50% no-reasoning baseline; robustness max flip 5.0–12.5%
(single-axis ≤5.0%, all-axes ≤12.5%); `npm test` = 24 scripts, exit 0; `npm run audit` = 24/24,
"skill healthy"; skill-consistency no drift after doc reconciliation.

**Decisions/risks:** skill + router remain `experimental`/`core` (router card updated to v6); NOT
re-promoted on this round's evidence alone. Remaining honest limits unchanged: no live-LLM-executor
run; cross-author labels not yet obtained.

## Session 28 — independent adversarial review round + library API completion

**What changed:** (1) dispatched two fresh adversarial reviewers (router + verify planner) to break
the skill and report only reproducible node-executed findings — independent evidence per the
objective's "Agent 的自评不能直接作为结论" (findings appended when they settle); (2) INDEPENDENTLY
found and fixed a real public-API gap: `index.js` never exported `verify`/`certainty`, so the
Session 26 planner was CLI-testable but unusable via `require('./')` — added `verificationPlan`,
`VERIFY_LADDER`, `certainty` and extended `evals/library-test.js` (15-member surface, all PASS);
(3) added the missing method-status card `methods/experimental/verify-planner.md` (AGENTS.md
methodology requires per-method records); (4) characterized verify-planner ladder-depth boundaries
(coarse jumps at 0.3/0.5/0.7 — documented as advisory-only over-verification risk, not binding).

**Evidence:** `npm test` = 24 eval scripts exit 0; `npm run audit` = 24/24; all 10 objective
minimum-deliverables still met; independent re-verification of router principles (cheap+high-stakes
→ not deep; one-shot high-stakes → upgrade; repeated failure → deep/upgrade; capability mismatch →
upgrade; easy+strong → recommend de-escalate); extraction fidelity sane; `files` whitelist 11/11
resolves (`npm pack --dry-run` itself blocked only by the npm-cache sandbox EPERM — not a repo issue).

**Decisions/risks:** skill + verify planner remain `experimental`, NOT `core` (no live-LLM-executor
run yet). The reviewer findings are the round's main independent evidence and are incorporated in
the changelog/report once they settle.

## Session 27 — verification planner FIELD test (channels provably catch planted errors)

**What changed:** added `evals/verify-field-test.js` — a mutation-style harness that actually RUNS
the verification channels the planner selects and asserts they discriminate: correct implementation
passes its channel, planted mutations are caught, self-review is never primary, independent
computation/reviewer channels disagree with mutated code. 4 subjects (aggregator, clamp+invariant,
one-shot contract with independent second opinion, string transform). All PASS.

**Why this exists:** Session 26 built the planner; unit tests only proved the ladder ORDER. The
objective's 反思原则 demands "能验证就验证" — a plan is only worth having if the channel it names
actually catches errors. This closes that evidence gap without needing a live LLM executor.

**Evidence:** `npm test` = 24 eval scripts, exit 0; `npm run audit` = 24/24 PASS, "skill healthy".
The field test also caught TWO mistakes in my own test-authoring (a difficulty-0.4 plan does not
include independent-computation by design; a "lo-bias clamp" mutation didn't actually violate the
invariant) — itself a demonstration that external verification beats self-review.

**Decisions:** verify planner promoted `candidate → experimental` on this evidence; NOT core (no
live-LLM-executor run yet; mutation corpus is small and hand-selected).

## Session 26 — verification-priority planner (independent from the router)

**What changed:** added `strategies/verify.js` (`verificationPlan(strategy, profile)` →
`{ primary, methods, note }`) — an independent post-route planner answering "how do we PROVE the
result, in priority order?" per the reflection-is-not-evidence ladder (external-test > compiler >
primary-source > independent-computation > multi-source > independent-reviewer > self-review, with
self-review always last and never primary). Deliberately decoupled from the router: the router
decides how hard to think, the planner decides how to verify. Wired into the CLI as a
`VERIFICATION PLAN:` block. Added `evals/verify-test.js` (10 cases, PASS).

**Why this exists:** the "-reflection is not evidence" constraint had no executable artifact — the
router never went beyond strategy selection. This is that gap closed: any strategy's output now
comes with a concrete, priority-ordered verification plan, and cheap/fast strategies honestly admit
low verification power instead of overstating their confidence.

**Evidence:** `npm test` = 24 checks, exit 0 (verify-test in chain). Benchmark vs no-reasoning
baseline: strategy accuracy 100% (13/13) vs 38.5%; model-action accuracy 100% vs 84.6%. Suite,
changelog (Session 26), and README all green after the change.

**Status:** skill remains `experimental`; verify planner is new and only unit-tested (no live-executor
verification run yet), so it is a `candidate` method — the plan quality against real tool verification
is the next measured claim.
