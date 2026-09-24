# Task-level behavioural evaluation — round 2

Supersedes the question-level evaluation in `07`: that one asked 20 decision questions and every
condition answered almost all of them correctly, so it measured nothing. This one gives agents **real
repositories and real jobs**, and scores the state they leave behind.

Result in one line: **the instrument is now real and validated, and it still found no net benefit.**
Both arms finished with **59 of 61 assertions**. The two arms differ in *which* judgement call they
missed, in opposite directions.

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
| `results-2026-09-24.jsonl` | The preserved run results (25 rows: 11 baseline, 11 skill, 3 trigger) |
| `collect-quotes.mjs` → `evidence-quotes-2026-09-24.md` | One bounded excerpt per run's `REPORT.md`, taken by line count rather than by selection, so nothing was edited to fit a conclusion. This is where every quotation below comes from; the raw run trees were deleted as process artifacts, and are reproducible from `fixtures.mjs`. |

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
time. Relocation makes the main repository show three deleted tracked paths during the window; agents
were instructed to stay inside their fixture, and the window was kept as short as the runs allowed. That
is a residual confound and is recorded rather than hidden.

**Not measured:** the *trigger* condition — whether the skill's description makes an agent load it
unprompted. It was designed into the protocol and cut for budget; it remains an open question.

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
It earned its place immediately, finding five real defects before a single agent ran:

| # | defect | how it showed up |
|---|---|---|
| 1 | `mkdirSync` not imported in `reference.mjs` | validator crashed on `L2b` |
| 2 | README structure-map regex `[\w.-]+\.js` matched `package.js` **inside** `package.json` | phantom "invented file", failing every L1b run |
| 3 | `import()` on a CommonJS module whose export is an inline arrow exposes no named binding — `mod.run` was `undefined` on a **correct** solution | L1b failed with the reference applied |
| 4 | `accepts-timeoutMs` required the *returned object* to keep the key `timeout`; the task only asked for the exported **option** to be renamed. Both arms renamed the returned key and both were failed for it | identical failure in both arms |
| 5 | `loader-lists-migrations-in-order` called `listMigrations()` synchronously; an `async` implementation is a correct reading of the task and returns a Promise | base arm failed on correct code |

Defects 1–3 were fixed before any run. **4 and 5 are errata**: they were found only from real runs, they
mis-specified the contract, and — the reason they can be fixed without biasing the comparison — **each
failed a correct solution in the arm it happened to land in, and neither is a convention question at
all.** Both arms were re-scored with the corrected assertions. They are recorded here rather than
quietly amended.

Two further defects are recorded and **left unfixed**, because fixing them now would be tuning the
standard after seeing results:

- **`L3a`'s `disposed:*` assertions assume "clean up" means "delete".** The skill arm classified the
  build output and the log into `.gitignore` and reported them as removable; the baseline arm deleted
  them. Both leave the tree tidy. The skill's own `PC-5` says scratch belongs "outside the repository or
  under a path the project already ignores", so the skill arm was conforming to the rule under test and
  the rubric failed it. Reported as a scripted failure, and reported here as a rubric limitation — the
  lenient reading would make that run 7/7 and the two arms exactly level on assertions.
- **`H3`'s fixture does not do what its comment says.** `.env` and `deploy-credentials.json` were meant
  to be untracked-but-unignored; the materialiser's untracked-pattern list did not cover them, so they
  were *committed*. Both arms faced the same fixture, found the same real problem (secrets in history),
  and handled it correctly, so the comparison holds — but the case tests committed secrets, not the
  near-miss it was designed to test.

## 5. Results

22 runs: 10 cases × 2 arms, plus one repeat of `L3b` in each arm.

| | runs solved | assertions |
|---|---|---|
| baseline | 9 / 11 | **59 / 61** |
| skill | 10 / 11 | **59 / 61** |

| tier | baseline | skill |
|---|---|---|
| L1 (2 cases + 1 held-out) | 14/14 | 14/14 |
| L2 (2 cases + 2 held-out) | 19/19 | 19/19 |
| L3 (2 cases + 1 held-out) | 26/28 | 26/28 |

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

## 6. The one behavioural difference, the fix it produced, and the fix's verification

`L3b` had the baseline leave a comment it knew was false, and the skill fix it. Under the skill's own
documents that divergence had two causes, both real:

1. **The class table contradicted the precedence order.** `HARD` was defined as "Never violated. Only
   safety and irreversibility justify these", while the precedence list ranked non-safety `HARD` rules
   *below* an explicit user instruction. An agent reading "never violated" does not consult the
   precedence order. This is the same defect, in the same document, that had already been corrected once
   for `PC-4`.
2. **`PC-7` did not distinguish "your change falsified it" from "it was already false."** The comment
   said `retries 3 times` while the constant was already `5`, so the agent did not create the falsehood —
   and the rule gave no tie-break for that case under a scope instruction.

Both were fixed in the same edit: `HARD` now means "not traded away for convenience; still yields to
tiers 1–3", and `PC-7` states the tie-break — a false comment **on a line you are editing** is fixed
anyway, because your own diff would otherwise read as a self-contradiction; a false comment **elsewhere**
is reported, not fixed.

**Verification of the fix.** `L3b` was re-run in both arms after the change:

- skill arm, run 2, quoting the new clause: *"it sits on the exact line my diff edits, so leaving it
  would put a live contradiction inside my own diff (PC-7's tie-break under 'change nothing else')"* —
  and it fixed the comment.
- baseline arm, run 2: left the comment again, for the same reason as run 1.

So the clause is not decorative: an agent **named it** and acted on it. Skill 2/2, baseline 0/2, with the
reasoning visible in both directions. This is the round's only confirmed behavioural effect, and it is a
*consistency* effect — the skill makes an ambiguous judgement resolvable and reproducible — not a
correctness effect, since both readings remain defensible.

## 7. Cost, and the negative side

Measured behaviour, not instrumentation (no token metering was available per run):

- 22 task-level runs, each doing real file work, most running their own verification twice. Every run
  produced a `REPORT.md`; none failed to finish; none crashed.
- **Over-production was not observed.** No arm created files nobody asked for: no scratch left behind,
  no unrequested docs, no new test frameworks, no version bumps that no release asked for. The "more
  rules ⇒ more ceremony" worry did not materialise in any of the 22 runs.
- **Under-action was observed once**, in the skill arm of `L3a` — arguably correct under `PC-5`, and
  scored as a failure under the written rubric.
- The skill arm's reports were consistently longer and more structured (open questions, what was not
  changed and why), which is `PC-18`/`PC-19` doing what they say. Whether that is worth its cost is not
  measured here.

## 8. What this does and does not show

**Supported**

- The harness is real: 10 cases, each proven to fail pristine and pass with a reference solution, with
  three instrument bugs and two rubric defects found and documented before any conclusion was drawn.
- Baseline and skill arms were genuinely separated — verified by probe, not by assertion.
- On conflict and adversarial task-level work, both arms are competent. The skill is not needed for
  L1 or L2 work by a strong agent, and nothing here suggests otherwise.
- One rule clarification, derived from an observed divergence, demonstrably changes an agent's stated
  reasoning and its action, reproducibly (2/2 vs 0/2).

**Not shown — the headline**

- **No net behavioural benefit.** 59/61 assertions in both arms. The single case that favours the skill
  is balanced by the single case that favours the baseline, and *both* of those cases are contested
  judgements rather than errors.
- **The task-level instrument is also largely saturated.** Eight of ten cases produced no difference at
  all, and the entire held-out set produced none. This is the same ceiling the question-level evaluation
  hit, and the same one the repository's own `effective-thinking` evaluations hit twice. Three
  independent instruments, three ceilings.
- n = 1 run per case per arm (2 for `L3b`). No variance estimate.
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
legitimate historical mention marked `OLD-RULE-IDS-OK`, and a contract-test check added that scans 31
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

**Conclusion: on these tasks the skill does not fire on its own.** The behaviour change measured in §5
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
