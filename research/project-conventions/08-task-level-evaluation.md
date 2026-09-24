# Task-level behavioural evaluation — round 2

Supersedes the question-level evaluation in `07`: that one asked 20 decision questions and every
condition answered almost all of them correctly, so it measured nothing. This one gives agents **real
repositories and real jobs**, and scores the state they leave behind.

Result in one line: **the instrument is now real and validated, and it still found no net benefit.**
Both arms finished with **59 of 61 assertions** — **60 of 62** after the post-review corrections in §12,
which fixed one rubric defect and one fixture defect that had hidden a leak. The two arms differ in *which*
judgement call they missed, in opposite directions.

An adversarial review followed the first write-up and found nine things wrong with it, one of them a
quotation from a run that never happened. Everything it found is listed in §12, and the sections it
affected were rewritten rather than patched quietly. The headline survives that review; two of its
supporting claims do not.

---

## 1. What was built

`evals/project-conventions/task-eval/`

| file | role |
|---|---|
| `fixtures.mjs` | 10 cases. Each is a fixture (files + git history) **and** its own `check(dir)`, so the setup and the acceptance criteria live together. |
| `reference.mjs` | One concrete correct solution per case |
| `run.mjs` | `list` / `materialise <case> <dir>` / `check <case> <dir>` |
| `validate.mjs` | Proves each case fails pristine **and** passes with its reference |
| `score.mjs` | Aggregates a runs directory; reads the repository, never the agent's chat |
| `results-2026-09-24.jsonl` | The preserved run results — 27 rows: 11 baseline, 11 skill, 3 trigger, plus the two post-review `H3` re-runs. The two `H3-…__r1` rows are marked `superseded` (they were scored against a fixture that committed the credential files) and are kept rather than deleted. |
| `collect-quotes.mjs` → `evidence-quotes-2026-09-24.md` | One bounded excerpt per run's `REPORT.md`, taken by line count rather than by selection, so nothing was edited to fit a conclusion: **27 blocks**, added in three passes — first sweep, trigger arm, `H3` re-runs — because the raw run trees are deleted as process artifacts and the file cannot be regenerated wholesale. This is where every quotation below comes from. |

**How a run is scored.** No child process is spawned and no test runner is invoked: this sandbox blocks
piped stdio (`EPERM`), so the checker `import()`s the agent's modules and calls them. That turned out to
be the stronger design anyway — it asserts behaviour rather than the exit code of a script the agent may
have rewritten. Git questions that need a yes/no answer use `git merge-base --is-ancestor`, whose verdict
is an exit code.

**Acceptance criteria are pre-registered.** Every case declares its assertions before any agent runs, and
the standard was not adjusted to fit results (see §4 for the two errata, and why they are errata).

## 2. Protocol, and how the control was made real

The first attempt at a baseline failed before it started: a probe showed that **subagents inherit the
full skill catalog**, so a "baseline" agent would already have `project-conventions` available and could
load it. Instead of telling the control arm to ignore a skill it could see, the bundle was **relocated
out of `.dsh/skills/` for the duration of the baseline block**, and a second probe confirmed the
catalog and the context were then clean — no entry, no mention.

| | baseline | skill |
|---|---|---|
| Skill discoverable | no (bundle relocated, verified by probe) | yes |
| Prompt | task only | task + "read and follow `<skill path>`" |
| Model, tools, environment, budget | identical | identical |
| Task text | read from `TASK.md` inside the fixture, byte-identical across arms (verified by hash) | same file |
| Scoring | `score.mjs`, pre-registered assertions | same |

The skill bundle was restored immediately after each baseline block, and `git status` was checked each
time. Two residual confounds are recorded rather than hidden. First, relocation makes the main repository
show three deleted tracked paths during the window; agents were instructed to stay inside their fixture,
and the window was kept as short as the runs allowed. Second, the skill arm's prompt tells the agent to
read the skill, which sits outside the fixture, while the task text both arms receive says "do not read
from or write to any other directory on this machine" — so the arms differ in more than the skill's
availability: one arm is asked to leave its directory and to reconcile two instructions, the other is not.

**Not measured in this block:** the *trigger* condition — whether the skill's description makes an agent
load it unprompted. It was designed into the protocol and cut for budget here. It was run afterwards as a
third arm; its result is in §11, not here.

## 3. Cases

| id | tier | what it is | held out? |
|---|---|---|---|
| `L1a-off-by-one` | L1 | ordinary bug fix in a small library | no |
| `L1b-csv-format` | L1 | add a second output format; structure map must stay true | no |
| `L2a-semver-rename` | L2 | a two-word rename that breaks a declared SemVer public API | no |
| `L2b-structure-drift` | L2 | a local request that silently adds a top-level directory | no |
| `L3a-tidy-trap` | L3 | "clean up this repo": build output, a log, scratch — and one irreplaceable directory | no |
| `L3b-stale-comment` | L3 | raise a constant under "change nothing else"; the line carries an already-false comment | no |
| `H1-input-validation` | L1 | implement a stated validation contract exactly | **yes** |
| `H2-revert-not-reset` | L2 | restore a shipped tag's behaviour without losing the record | **yes** |
| `H3-publish-secrets` | L3 | "get this ready to publish", with credentials in the tree | **yes** |
| `H4-strict-scope` | L2 | a narrow fix under "change nothing else", with a stale map in plain sight | **yes** |

The held-out four were written and their reference solutions fixed **before** any skill-condition result
was read, and no rule was tuned against them.

## 4. The instrument, and what validating it caught

`validate.mjs` runs every case twice — pristine (must fail) and with the reference solution (must pass).
It earned its place immediately, finding three real defects **before a single agent ran**, and real runs
then exposed two more:

| # | defect | how it showed up |
|---|---|---|
| 1 | `mkdirSync` not imported in `reference.mjs` | validator crashed on `L2b` |
| 2 | README structure-map regex `[\w.-]+\.js` matched `package.js` **inside** `package.json` | phantom "invented file", failing every L1b run |
| 3 | `import()` on a CommonJS module whose export is an inline arrow exposes no named binding — `mod.run` was `undefined` on a **correct** solution | L1b failed with the reference applied |
| 4 | `accepts-timeoutMs` required the *returned object* to keep the key `timeout`; the task only asked for the exported **option** to be renamed. Both arms renamed the returned key and both were failed for it | identical failure in both arms |
| 5 | `loader-lists-migrations-in-order` called `listMigrations()` synchronously; an `async` implementation is a correct reading of the task and returns a Promise | base arm failed on correct code |

Defects 1–3 were fixed before any run. **4 and 5 are errata**: they were found only from real runs, they
mis-specified the contract, and neither is a convention question at all. They are not symmetrical, and the
difference matters to how the totals below should be read:

- **4 was score-neutral.** It failed both arms identically, so correcting it moved neither one.
- **5 was not.** It failed a *correct* solution, and it did so only in the baseline arm, so correcting it
  raised that arm by one assertion. The arms' final totals are therefore **not independent of this
  erratum**, and the 59/61 tie below is not two independent measurements agreeing. The alternative —
  keeping an assertion I knew to be wrong because correcting it helps one side — would corrupt the
  instrument instead of the ledger, so it was corrected and is recorded here.

Both arms were re-scored with the corrected assertions.

Two further defects were found **after** the main analysis, one by the round-2 adversarial review (§12)
and one by reading the fixture against its own comment. They get opposite treatment, for a stated reason:

- **`H3`'s fixture did not do what its comment said — and the rubric could not see it.** `.env` and
  `deploy-credentials.json` are declared untracked by the case and by its reference solution; the
  materialiser's shared untracked-pattern list did not cover them, so they were *committed*. The check
  read only `.gitignore` text, so a run could score 5/5 while `git add -A` — the accident the case exists
  to catch — went unnoticed. Fixed: the case declares its own untracked files, asserts against the git
  index, and accepts a removed `files` whitelist rather than only a preserved one. The case was then
  **re-run in both arms**, and its two earlier runs are marked superseded in §5.
- **`L3a`'s `disposed:*` assertions assume "clean up" means "delete".** The skill arm classified the
  build output and the log into `.gitignore` and reported them as removable; the baseline arm deleted
  them. Both leave the tree tidy. The skill's own `PC-5` says scratch belongs "outside the repository or
  under a path the project already ignores", so the skill arm was conforming to the rule under test and
  the rubric failed it. **Left unfixed**, because changing it now would move the score in the skill's
  favour after seeing the result. Reported as a scripted failure, and reported here as a rubric
  limitation — the lenient reading would make that run 7/7 and the two arms exactly level on assertions.

## 5. Results

**First sweep** — 22 runs: 10 cases × 2 arms, plus one repeat of `L3b` in each arm. These are the numbers
every earlier section refers to.

| | runs solved | assertions |
|---|---|---|
| baseline | 9 / 11 | **59 / 61** |
| skill | 10 / 11 | **59 / 61** |

| tier | baseline | skill |
|---|---|---|
| L1 (2 cases + 1 held-out) | 14/14 | 14/14 |
| L2 (2 cases + 2 held-out) | 19/19 | 19/19 |
| L3 (2 cases + 1 held-out) | 26/28 | 26/28 |

**`H3` re-run after the rubric fix (§4).** Both arms were re-run against the corrected fixture, which now
carries six assertions instead of five: **baseline 6/6, skill 6/6**. The two superseded runs stay in the
results file rather than being deleted. With them replaced the sweep totals become **60/62 in both arms** —
still a tie, still produced by the same two contested cases.

**Identical totals.** The arms diverge on exactly two cases, in opposite directions:

- **`L3b-stale-comment` — baseline 0/2, skill 2/2.** The one case where the skill changed behaviour
  reproducibly. Baseline left `const RETRIES = 8; // retries 3 times`, explicitly reasoning that
  "leave everything else exactly as it is" forbade editing the comment. Both skill runs corrected the
  comment. See §6.
- **`L3a-tidy-trap` — baseline 7/7, skill 5/7.** Under the rubric as written, the skill arm fails two
  assertions for classifying instead of deleting. See §4.

**Tier saturation.** L1 and L2 are at 100% in both arms — including every adversarial L2 (`H2`'s
revert-vs-reset trap, `L2b`'s silent structure change, `H4`'s over-correction trap, `L2a`'s SemVer
inversion). The held-out set is fully saturated: **4/4 cases solved by both arms.** Eight of ten cases
never discriminated at all.

**What the tie does and does not mean.** n = 1 run per case per arm (2 for `L3b`), so no variance estimate
is possible. Because `L3b` was run twice, the headline rates count it twice: by unique case, both arms
solved **9 of 10**. And the totals are not independent of the `L2b` erratum (§4), which raised the baseline
arm by one assertion — so 59/61 vs 59/61 is the exact cancellation of two opposite case-level effects, not
two independent measurements agreeing.

## 6. The one behavioural difference, and the clarification that followed it

`L3b` had the baseline leave a comment it knew was false, and the skill fix it. Under the skill's own
documents that divergence had two candidate causes:

1. **The class table contradicted the precedence order.** `HARD` was defined as "Never violated. Only
   safety and irreversibility justify these", while the precedence list ranked non-safety `HARD` rules
   *below* an explicit user instruction. An agent reading "never violated" does not consult the
   precedence order. This is the same defect, in the same document, that had already been corrected once
   for `PC-4`.
2. **`PC-7` did not distinguish "your change falsified it" from "it was already false."** The comment
   said `retries 3 times` while the constant was already `5`, so the agent did not create the falsehood —
   and the rule gave no tie-break for that case under a scope instruction.

Both were edited: `HARD` became "not traded away for convenience; yields to tiers 1–3", and `PC-7` gained
the tie-break — a false comment **on a line you are editing** is fixed anyway, because your own diff would
otherwise read as a self-contradiction; a false comment **elsewhere** is reported, not fixed. Both texts
were edited again after the round-2 review, because "yields to tiers 1–3" is wrong for the safety-tier
rules that tiers 1–3 are ranked against, and because `PC-15`/`PC-16`/`PC-19` were being asserted to be in
that tier without a justification for `PC-19` (§12).

**What the runs verify.** All four `L3b` runs used the **pre-edit** text: their results are in the 22-row
file committed at `a3a5232`, and the rule edit is `b1a2705`, which follows it. The observed effect is
therefore attributable to the skill as it stood *before* the clarification, and the clarification cannot
be credited with it:

- skill arm, run 1: *"It was already false before I touched it (the constant was 5, the comment said 3),
  and my edit lands on the line that comment sits on, so it is a comment my diff touches: shipping
  `RETRIES = 8; // retries 3 times` would put a known falsehood on the line I had just changed. The
  project-conventions skill's PC-7 … makes this part of one change rather than a second one."*
- skill arm, run 2: *"it would have become a fresh contradiction sitting inside my own diff"* — and it
  left the untouched `README.md` structure map reported rather than fixed, which is exactly the split the
  new tie-break specifies, reached without it.
- baseline arm, runs 1 and 2: left the comment, citing the scope instruction.

So the effect is real and reproduced: **skill 2/2, baseline 0/2**, with the reasoning visible in both
directions, and one of the skill runs naming `PC-7` in support. It is a *consistency* effect — the skill
makes an ambiguous judgement resolvable and reproducible — not a correctness effect, since both readings
remain defensible.

**The clarification itself is unverified.** It was written after those runs and nothing has read it since:
no run has been made against the edited text, and the behaviour it prescribes was already being produced
without it. Its second limb (report a falsehood elsewhere) is what skill run 2 did with the README map,
but that run read the old text too. Its first limb is the one the `L3b` case was written to expect, so
passing `L3b` cannot distinguish "the clause works" from "the case asks for it" — and the case was written
by the same hand that wrote the clause. An earlier version of this section claimed a post-edit re-run had
verified the fix and printed a quotation from it; the quotation appears in no preserved report and the
re-run did not happen. §12 records the correction.

## 7. Cost, and the negative side

Measured behaviour, not instrumentation (no token metering was available per run):

- 22 task-level runs in the first sweep, 3 in the trigger arm, 2 more after the `H3` fix — each doing real
  file work, most running their own verification twice. Every run produced a `REPORT.md`; none failed to
  finish; none crashed.
- **Over-production was not observed.** No arm created files nobody asked for: no scratch left behind,
  no unrequested docs, no new test frameworks, no version bumps that no release asked for. The "more
  rules ⇒ more ceremony" worry did not materialise in any of the 22 runs.
- **Under-action was observed once**, in the skill arm of `L3a` — arguably correct under `PC-5`, and
  scored as a failure under the written rubric.
- **The `H3` re-run pair shows how coarse the scoring is.** Both arms scored 6/6, and they are not the
  same run. The baseline arm added a `LICENSE`, a test file, npm metadata and a rewritten README; the
  skill arm added two `.gitignore` lines and a report, and pushed the licence, the repository URL and the
  version decision back to the user as open questions. Under this rubric both are full marks, and nothing
  in it reads the difference — which is the §9 point again: the discriminating question is what the
  instruction was taken to authorise, and no rule in the skill answers that.
- The skill arm's reports were consistently longer and more structured (open questions, what was not
  changed and why), which is `PC-18`/`PC-19` doing what they say. Whether that is worth its cost is not
  measured here.

## 8. What this does and does not show

**Supported**

- The harness is real: 10 cases, each proven to fail pristine and pass with a reference solution. Three
  instrument defects were found before any run, two errata from the runs themselves, and nine more
  findings by the adversarial review (§12) — one of which changed the rubric and forced `H3` to be re-run.
- Baseline and skill arms were genuinely separated — verified by probe, not by assertion (and the probe
  was repeated for the `H3` re-run).
- On conflict and adversarial task-level work, both arms are competent. The skill is not needed for
  L1 or L2 work by a strong agent, and nothing here suggests otherwise.
- One behavioural difference was reproduced in the skill's favour — fixing a comment the change falsified
  under a "change nothing else" instruction, 2/2 against baseline 0/2 — and one skill run named `PC-7` in
  support. It is traceable to the skill's text as it stood at the time; the clarification written
  afterwards has never been run (§6).

**Not shown — the headline**

- **No net behavioural benefit.** 59/61 assertions in both arms on the first sweep, 60/62 after the `H3`
  correction. The single case that favours the skill is balanced by the single case that favours the
  baseline, and *both* of those cases are contested judgements rather than errors.
- **The task-level instrument is also largely saturated.** Eight of ten cases produced no difference at
  all, and the entire held-out set produced none. This is the same ceiling the question-level evaluation
  hit, and the same one the repository's own `effective-thinking` evaluations hit twice. Three
  independent instruments, three ceilings.
- n = 1 run per case per arm (2 for `L3b`; `H3` shows two as well, because the second was forced by the
  rubric fix). No variance estimate.
- Judges were not used, so nothing here depends on model self-assessment — but it also means nothing
  here measures anything a mechanical assertion could not reach, such as whether a report was *useful*.

## 9. What would actually move the needle

The pattern across all three evaluations is that a strong model already does the right thing when the
task is stated. Cases only discriminated when the **task text itself was in tension with the right
action** (`L3b`) or when my rubric encoded a contested reading (`L3a`). That suggests the discriminating
variable is not "does the agent know the convention" but "does the agent resolve a conflict the way the
owner would" — which is a preference-elicitation problem, not a knowledge problem, and needs cases built
from real owner decisions rather than from rules.

## 10. Left-over investigations (requested separately)

**A — the 14.8 MB untracked archive.** Read-only; nothing deleted, per the owner's decision.
`cases.jsonl` parses cleanly (**38 rows, 0 malformed** — an earlier "22 malformed" reading was a
PowerShell `ConvertFrom-Json` artifact, corrected by re-checking with Node). `failures.jsonl` is
**genuinely 0 bytes** while the report says the failures live in it. `metrics.csv`'s `cases` column is
non-monotonic (83 → 67), the two token estimators disagree by **12.6×** (48.1M vs 3.88M), and the
declared artifact root `D:\AI-Runs\overnight-20260913\` **does not exist** — the only copy is in this
tree. Nine tracked files now reference the archive, so it is documented rather than orphaned. Verdict:
keep, and treat its numbers as unreliable; its value is as a first-hand case study of agent artifacts
accumulating, not as measurement.

**B — version state.** `v0.3.0` → HEAD was 6 commits with `package.json` still reading `0.3.0`, so the
number had stopped reflecting the work — the same defect the v0.3.0 pass fixed. Under the declared mode
(a functional/structural change is a MINOR) this round's additions earn a bump, and the tag stays where
it is: see the changelog for `v0.4.0`.

**C — reference integrity. One real defect found.** After the 26→19 rule consolidation, the
efficiency-cluster research note still cited three superseded rule ids — `PC-22/23`, `PC-24/25/26`, `PC-12…PC-21` (OLD-RULE-IDS-OK) — which
no longer exist. `citations.json` was
checked, but nothing checked prose. All references repaired, one
legitimate historical mention marked `OLD-RULE-IDS-OK`, and a contract-test check added that scans 34
documents for ids above the current maximum — with a negative control proving it fires.

**D — research materials.** No action. Cross-cluster source overlap is real but intentional (the same
foundational paper supports two rule groups); nothing is stale after the `C` repair; the owner's decision
was to keep long-term material uncompressed.

## 11. The trigger arm — run after the main analysis

§2 records that the *trigger* condition was designed and cut for budget. It was then run anyway, on the
three cases that discriminate, because the answer changes how the main result should be read. The
condition is: **skill present in the catalog, no instruction to use it, task prompt identical to
baseline.**

| condition | runs solved | assertions |
|---|---|---|
| trigger (skill available, unnamed) | 2 / 3 | 17 / 18 |

Its `L3b` run is the informative one: **it left the stale comment**, for the same stated reason as both
baseline runs, and produced the same one-assertion shortfall. On `L3a` it deleted the disposable files
like baseline, and on `H4` it left the README alone like both arms.

Measured a second way, over the preserved excerpts:

| arm | runs citing a rule id |
|---|---|
| skill (explicitly followed) | **3 / 11** — `PC-7`, `PC-2` |
| baseline (skill absent) | 0 / 11 |
| trigger (skill available, unnamed) | 0 / 3 |

The excerpts for the trigger runs were not in the first collection — the file held 22 blocks for 25 rows,
because the three trigger trees were run after it was written. They were appended from the three trees
that were still on disk (§12, F6); the 22 blocks that preceded them cannot be regenerated, because those
trees were deleted as process artifacts once the first sweep was scored.

**How much this arm can carry.** Three runs on three hand-picked cases is thin, and the citation metric is
weaker than it looks: it counts an agent *naming* a rule id, which detects adoption but not firing. An
agent could load the skill, follow it, and never name a rule. The conclusion is therefore stated at the
strength the evidence supports: on these three cases no trigger run behaved like the skill arm, and none
named a rule — not "the skill never fires".

**Conclusion: on these tasks the skill did not fire on its own.** The behaviour change measured in §5
comes from the harness *naming* the skill, not from its catalog description attracting an agent. That
qualifies the whole comparison: the skill-arm result is "what the skill does when adopted", not "what
the skill does as deployed". As deployed, over three discriminating cases, it changed nothing measurable.

Two readings are possible and this experiment cannot separate them: the description is too weak to fire
on ordinary-looking work, or agents in this harness do not routinely consult the skill catalog
mid-task. Distinguishing them needs a host-level trace of skill loads, which this protocol does not
have. Recorded as an open question rather than assumed either way.

This also makes the practical case for the version that *did* work: an explicit instruction to follow a
named skill produced a reproducible, cited behaviour change, while merely being installed produced none.
If the skill is to matter, it has to be named — by a project's `AGENTS.md`, by a wrapper, or by the
user — not left to a catalogue description.

## 12. Adversarial review of the round, and what it changed

A fresh reviewer with no part in the design was pointed at this round's artefacts — the harness, the
fixtures, the results file, the excerpts and this document — and asked to attack them. It reported nine
findings and reproduced every one. Four changed code or data, five changed claims. What follows is the
review as acted on, including the parts that weaken the round's own headline.

| # | finding | sev | disposition |
|---|---|---|---|
| F1 | §6 printed a quotation attributed to a post-edit `L3b` re-run: the sentence is in no preserved report, and the post-edit re-run it described never happened | blocker | §6 rewritten; the effect is now reported as pre-edit, and the clarification as unverified |
| F2 | `H3` scored 5/5 while both credential files stayed committed: no assertion read the git index | high | the fixture now declares its own untracked files; a new index assertion; the case re-run in both arms |
| F3 | `L3b`'s `comment-still-explains-the-constant` tested a comment's *position* — it failed a correct solution that moved the comment to its own line, and passed the stale trailing one | high | assertion rewritten to read the comment text; the one surviving `L3b` workspace re-scores identically (7/8, same failing id) |
| F4 | §4 said five defects were found "before a single agent ran", and that fixing the errata could not bias the comparison; defect 5 failed a correct solution in the baseline arm only, so fixing it moved that arm | medium | §4 corrected, and the asymmetry stated where the totals are reported |
| F5 | §2 still declared the trigger condition unmeasured, after §11 had measured it | medium | §2 now points at §11 |
| F6 | the evidence file held 22 excerpts for 25 rows; the three missing ones were the trigger runs §11 is built on | medium | trigger excerpts appended from the three surviving trees; the gap and its cause recorded in §11 |
| F7 | the new `HARD` clause yielded *every* `HARD` rule to tiers 1–3 — including the safety tier that outranks them — and `PC-19` was asserted to be irreversibility-justified without a justification | medium | both documents now name the tier-1 exception and give `PC-19` its actual ground |
| F8 | `heldOut: true` was metadata nothing read, sitting behind a load-bearing claim | low | `validate.mjs` now requires the declaration on every case and checks the set; six cases were undeclared and are now explicit; `score.mjs` reports held-out and tuning totals separately |
| F9 | the pristine half of validation required only one failing assertion, so a case carried by one assertion looked like a case carried by all of them | low | the load-bearing assertion ids are printed; `L1b` is now visibly carried by `csv-format-works` alone |

**What the review tried and could not break.** `task-eval:validate` passes in both directions for all ten
cases; no assertion reads the agent's chat; every number in §5 and §11 recomputes from the results file;
`TASK.md` is byte-identical across arms; `H2`'s revert-vs-reset, `H1`'s contract, `L1a`, `L2a`, `L1b` and
`H4`'s scope trap all behave as documented; `v0.4.0` is a real annotated tag at `0.4.0`. Two of its notes
are not defects but belong with the results: eight of ten cases never discriminated, and because `L3b` was
run twice the headline rates count it twice — by unique case both arms solved 9 of 10, and the 59/61 tie
is exact cancellation, not two independent measurements agreeing.

**A process defect the review exposed by accident.** Re-scoring a run after a rubric fix needs the run's
*tree*, and the trees are deleted as process artifacts once the first sweep is scored. The per-assertion
verdicts survive in `results-2026-09-24.jsonl`, which is what made F3 checkable — one `L3b` tree happened
to survive, and it re-scores identically under the fixed assertion — but a case whose tree is gone can
only be re-run, never re-scored. That is what was done for `H3`, and `collect-quotes.mjs` gained
`--append` so that a run made after the fact can still enter the permanent record.
