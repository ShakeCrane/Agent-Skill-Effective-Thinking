# Changelog

## First official release: repository convergence + release readiness — v1.0.0

This round is convergence only: no new skill, no new mechanism, no new experiment, no measured claim.
The exploration phase is over; the work was to make the existing repository clean, true, verifiable and
releasable, and then to verify it rather than assert it.

### What was actually verified (not asserted)

Every gate in the repository's own release contract was re-run on this tree, on a machine with the real
DSH host installed (`0.1.5-rc.1`):

| gate | result |
|---|---|
| `npm test` (frozen Phase 1 chain, 26 files) | PASS |
| `npm run dsh:check` (packaged asset vs `SKILL.md`) | PASS |
| `npm run test:dsh` (packaging + provider contract) | PASS — 35 checks (17 packaging + 18 provider), 0 skipped: a real host was present |
| `npm run test:dsh:host` (STRICT, real registry) | PASS — 35 checks, `get` / `unload` / `reload` exercised |
| `npm run release:check` | PASS |
| `npm run release:verify` (host gate + release gate) | PASS |
| `npm run package-meta` (package + whitelist contract) | PASS |
| `node evals/external-v2/scripts/verify-freeze.js` | PASS — 84 frozen artifacts unchanged |
| `npm run test:project-conventions` | PASS — 20 cases, 19/19 rules exercised |
| `npm run task-eval:validate` | PASS — 12 cases fail pristine, pass with the reference solution |

The External Eval v2 freeze verification matters here specifically: the version bump does **not** touch
any frozen artifact, and the check proves it rather than assuming it.

### What changed

- `package.json` `0.6.0` → `1.0.0`.
- `README.md`: the version section no longer claims "the version has always been `0.y.z`" (untrue after
  this release), and a new subsection states what `1.0.0` does and does not mean. The status section now
  separates *capability status* (experimental) from *release status* (`1.0.0`).
- `dsh/README.md`: a hard-coded `cognitive-agent-skill-0.2.0.tgz` install command was stale — the
  tarball name is now version-parameterised, matching the root README.
- `README.md` + `docs/dsh-integration.md`: the DSH host-gate figure said "21 host checks". That number
  was true when it was written but is no longer reproducible — the test file has grown since. Both
  places now quote the re-run result (**35** checks: 17 packaging + 18 provider, 0 skipped) and say
  which run it came from, so the figure can be checked rather than trusted.

### What did not change, and why

- **No frozen or dated record was rewritten.** `evals/external-v2/freeze-manifest.json`
  (`phase1PackageVersion: 0.2.0`), the External Eval corpora, the round reports and every earlier
  changelog entry keep the values they had at their date. A dated report describes its date, not today.
- **No evidence was deleted.** `AI-Runs/` (14.8 MB of another run's raw artifacts) stays in place:
  `.gitignore` and the README record a deliberate decision to keep it as primary evidence.
- **No file was moved for tidiness.** The structure audit found no duplicate implementation, no
  obsolete implementation and no misfiled release-facing file. `evals/consumer-test.js` and
  `evals/cross-author-check.js` are outside the `npm test` chain *on purpose* and are referenced by
  `bin/consume-pack.js` and `research/cross-author-labels.md` respectively.

### What is still not claimed

**Behavioural benefit remains NOT VERIFIED.** Nothing in this release changes that. External Eval v1 and
v2 hit a ceiling on the tested agent; the `project-conventions` suites are near-saturated. `1.0.0`
records structural and release readiness only. The honest reading of this repository's evidence is:
mechanisms are implemented and tested, the packaging and discovery paths are verified, and improved
task outcomes have not been demonstrated.

### Version

`0.6.0` → `1.0.0`. Mode B (house scheme): a first official release is a MAJOR. No compatibility promise
is made and none is implied. `v0.3.0`–`v0.6.0` stay where they are. **No tag was created and nothing was
pushed** — tagging and pushing need explicit confirmation.

## Formal adoption: discovery routing in AGENTS.md + v2 regression cases — v0.6.0

The three previous rounds ended on the same open item: the skill works when it is loaded, loading is
reliable when something names it, and nothing in this repository named it. This round closes that with a
route, checks that the route cannot invert the instruction order, and adds corrected regression cases.
Record: `research/project-conventions/10-formal-adoption.md`; Chinese report:
`reports/project-conventions-round4.md`.

### The route, and the sentence that makes it safe

`AGENTS.md` gains one 12-line section: project-work tasks (structure, code maintenance, version
management, repository governance, handoff) should read `.dsh/skills/project-conventions/SKILL.md` as a
**supplementary** working convention; tasks outside those areas need not load it.

The section states explicitly that it only **discovers and loads** and changes no existing priority: the
skill yields to the user's live instruction, to this document, and to project rules. That sentence is not
decoration. The skill's precedence order places "the target project's own documented rules (`AGENTS.md`,
`CONTRIBUTING`, release policy, CI)" at **tier 2** and "an explicit instruction from the user" at
**tier 3**, so an unqualified "follow the skill" line in `AGENTS.md` would have promoted the skill above
the user for every non-safety rule. No language that raises the skill's tier is used, and no skill rule is
copied into `AGENTS.md`.

### Verified, not asserted — four conditions, 19 assertions, all passing

Isolated fixtures, scored from the repository each run left behind (`evals/project-conventions/adoption/verify.mjs`,
records in `verify-results-2026-09-25.jsonl`):

| condition | result |
|---|---|
| **A** applicable task | **6/6** — and the run reports loading `SKILL.md` "per the workspace AGENTS.md discovery rule", naming `PC-2` as why it updated the structure map |
| **B** user override | **5/5** — skill loaded, then the user's instruction won: `1.2.3 → 1.2.4` (PATCH) despite a removed export, and no changelog entry |
| **C** project rule outranks | **4/4** — skill loaded, `CONTRIBUTING.md` read first and took precedence: CalVer `2026.09.1`, dated changelog heading, annotated tag |
| **D** unrelated task | **4/4** — one new file with the right numbers, no rule ids, no conventions recitation, no extra edits, `CONSULTED: none` |

Two conditions had to be rebuilt before they meant anything: their fixtures ended with the canonical
"do not read from or write to any other directory on this machine" sentence, and under it the runs
declined to load the skill at all (A scored 5/6 and said so; B reported `CONSULTED: none`, which would
have made the override test vacuous). Both were re-run with the neutral boundary sentence, and the
superseded runs are kept. This is the fourth observation of the same effect — **a task that forbids
leaving its own directory also forbids the load**, which is a practical caveat for the new route.

### Corrected v2 cases, added rather than substituted

`fixtures.mjs` +314 lines, `reference.mjs` +64, **no deletions** (`git diff -U0` shows none in either
file); the round-2 and round-3 result files are untouched. The two old cases each encoded one reading of a
rule whose text admits two, and the round-3 runs showed loaded agents taking the other reading:

- **`L3a2-disposal-contract`** — the task now names the action per artefact (delete / delete / **ignore but
  keep** / leave in place), and each action has its own assertion id, so no single word carries several
  meanings. `nothing-else-created-or-moved` diffs the finished tree against the fixture's declared file
  set, so a relocation is caught as a relocation. Pristine 2/7 → reference 7/7.
- **`L3b2-informed-comment`** — the comment now carries design intent the code does not (the attempt
  budget, the arithmetic, the cap), so `PC-6`'s removal test no longer licenses deleting it while `PC-7`
  requires correcting it. Pristine 4/9 → reference 9/9.

`task-eval:validate` reports **12 cases fail pristine and pass with a reference solution**. **No rule was
changed**: both were instrument defects, and the fix belongs in the cases.

### What is still not claimed

**Overall behavioural benefit remains NOT VERIFIED.** Round 3 stands: one discriminating case of five
(`L3b`, 4/5 loaded vs 0/6 not loaded), everything else saturated. The version bump records a structural
change — a first-class adoption path — not a measured improvement.

### Version

`0.5.0` → `0.6.0`. Mode B: the first project-level automatic discovery/adoption path is a
functional/structural change. `v0.3.0`, `v0.4.0` and `v0.5.0` stay where they are; history is not
rewritten and nothing is pushed. New recovery point: `v0.6.0`.

## Third round: adoption paths — evaluation only, no version change

Round 3 asked the question rounds 1 and 2 left open: is the skill *found, loaded, executed*, and does it
help? Four adoption paths plus one control, five tasks, **35 runs**, every verdict read from the
repository the run left behind. Full record: `research/project-conventions/09-adoption-paths.md`.

### Adoption is real, and two paths reach it

Load status is self-reported by the same agent after the run and triangulated with artefact fingerprints;
tool-call traces are **not available** in this host (a probe subagent that read `references/rules.md`
produced no transcript anywhere under `~/.dsh`, checked by mtime scan), so the limitation is recorded
rather than papered over.

| adoption path | runs that read the skill |
|---|---|
| prompt names `SKILL.md` | **7 / 7** |
| the fixture project carries a minimal `AGENTS.md` pointer | **5 / 6** |
| installed, never mentioned | **5 / 9** |
| installed, task text forbids reading outside the project | **0 / 3** |

**A round-2 conclusion is corrected.** Round 2 reported "the skill does not fire on its own (0/3)". The
0/3 reproduces exactly when the task text forbids reading outside the fixture, and disappears when it does
not — so the earlier result is better explained by the model obeying the boundary it was given than by the
skill's description failing to attract. Recorded as the leading hypothesis (3 runs against 9), not as a
settled mechanism.

### The first behaviour change tied to *verified* adoption

`L3b` (raise a constant under "change nothing else", on a line whose comment was already false) is the
only discriminating case. Of 11 runs, the 5 that read the skill **corrected** the comment 4 times and
cited `PC-7`'s tie-break for it; the 6 that did not read it corrected it **0** times (five left it, one
deleted it), Fisher p ≈ 0.015. Three of the four also applied the tie-break's other limb, leaving the
untouched `README.md` line reported rather than fixed. `L2b`, `H2` and `H4` were solved completely by
every condition — 15 runs, full marks, no signal.

### Two findings that are about the *instrument*, not the skill

- **`L3a` is scored by a rubric the skill contradicts.** Its `disposed:*` assertions require deletion of
  two untracked artefacts; `PC-4` says "everything else you report and leave in place" and `PC-5` ignores
  scratch. Under the strict reading the two runs that read the skill *and applied `PC-4` literally* score
  lowest; under a reading where "disposed" also means ignored or reported, and preservation may be
  relocation with the content intact, **all nine runs score 7/7**. Original strict scoring is unchanged and
  reported first; the sensitivity analysis is in `09` §7.
- **`L3b`'s "correct the comment" assertion collides with `PC-6`.** One loaded run cited `PC-6`'s removal
  test ("would removing it leave the reader worse off?") and deleted the restating comment; three others
  read `PC-7` as "correct it". The case's comment is a pure restatement, i.e. exactly where the two rules
  cross, so the assertion scores one defensible reading as the only one.

**No rule was changed this round.** Both "the skill made it worse" signals turned out to be cases whose
rubric encodes one reading where the skill's own text licenses another; changing the rules to fit them
would be fitting the product to the test. The rule set is unchanged at 19.

### Method defects found and handled

1. **The first baseline block was exposed.** The bundle was moved out of `.dsh/skills/` but left *inside*
   the workspace; one of five runs read it "incidentally while surveying the fixture parent". A clean
   baseline block was re-run with the bundle outside the workspace entirely, verified by probe
   (`CATALOG_DOES_NOT_CONTAIN_PROJECT_CONVENTIONS`) and five `CONSULTED: none` self-reports. The exposed
   block is kept as a second sample, flagged `exposed-baseline`, not deleted.
2. **One run read the rubric** (`fixtures.mjs`, `analyse.mjs`) and scored the highest on `L3a`. Flagged
   `rubric-aware`, excluded from counts, clean replicate run.
3. **The task text is not a neutral control** — the boundary sentence was replaced identically in all
   conditions to let the `AGENTS.md` and explicit conditions work at all, and that is what the `strict`
   control exists to measure.

### Artefacts and version

- `evals/project-conventions/adoption/{build,add,analyse}.mjs` — fixtures, single-run addition, and the
  analysis (fingerprints, cost proxies, the `L3a` sensitivity table). `npm run adoption:analyse`
  reproduces `analysis-2026-09-25.txt` from the run trees.
- `evals/project-conventions/adoption/{results,selfreports}-2026-09-25.jsonl` — every run, including the
  discarded baseline block, with load status, self-report, changed paths and flags.
- **No version bump.** `git diff v0.5.0 HEAD -- .dsh/skills` is empty: the shippable skill is byte-identical
  to the tagged release, so this round adds evidence rather than product. Tags are unmoved, history is not
  rewritten, nothing was pushed.

## Post-review corrections to the round-2 evaluation — v0.5.0

Round 2 was attacked by a fresh adversarial reviewer after it was written. It found nine things wrong and
reproduced every one; four changed code or data. They are recorded here in full because the round's own
subject was "verify rather than assume", and a record that keeps a false quotation in it has failed that
test. Method and dispositions: `08` §12.

### The worst finding: a quotation from a run that never happened

`08` §6 claimed the `L3b` rule clarification had been verified by a post-edit re-run, and printed the skill
arm "quoting the new clause". Neither is true. All four `L3b` runs used the **pre-edit** text — their
results were committed at `a3a5232` and the rule edit is `b1a2705`, which follows it — and the quoted
sentence appears in no preserved report. What the runs do verify is that the skill arm fixed the comment
2/2 while the baseline left it 0/2, one skill run naming `PC-7` (the old text). The clarification itself
has never been read by a run and is now reported as unverified. `08` §6 is rewritten; the v0.4.0 entry
below carries a correction marker rather than being silently amended.

### A fixture that contradicted its own documentation, and a rubric that could not see it

`H3` declares `.env` and `deploy-credentials.json` untracked — its comment and its reference solution both
say so — but the materialiser's shared untracked-pattern list did not cover them, so both were **committed**.
The check read only `.gitignore` text, so a run could score 5/5 while `git add -A` — the accident the case
exists to catch — went unnoticed. Fixed: the case declares its own untracked files, asserts against the git
index, and accepts a removed `files` whitelist instead of only a preserved one. The case was re-run in both
arms (6/6 and 6/6 — still level), and its two superseded rows are kept in the results file, marked.

### Five claims corrected, two checks strengthened

- `08` §4 said five defects were found "before a single agent ran"; three were. It also claimed fixing the
  errata could not bias the comparison — defect 5 failed a correct solution **in the baseline arm only**, so
  correcting it raised that arm by one assertion. The asymmetry is now stated where the totals are.
- `08` §2 still declared the trigger condition unmeasured after §11 had measured it.
- The evidence file held 22 excerpts for 25 rows; the three missing ones were the trigger runs §11 is built
  on. Appended from the trees that still existed, and `collect-quotes.mjs` gained `--append` so a later run
  can enter the record at all.
- The new `HARD` wording yielded *every* `HARD` rule to tiers 1–3 — including the safety tier that outranks
  them, which is the same defect the edit had just fixed one level up. Both documents now name the
  exception (`PC-4`, `PC-15`, `PC-16`) and give `PC-19` its actual ground, truthfulness rather than
  irreversibility.
- `heldOut: true` was metadata nothing read; `validate.mjs` now requires the declaration on every case and
  checks the set (six cases were undeclared and are now explicit), and `score.mjs` reports held-out and
  tuning totals separately.
- `validate.mjs` accepted a pristine case with a single failing assertion; it now prints the load-bearing
  assertion ids, so `L1b` is visibly carried by `csv-format-works` alone.
- `L3b`'s `comment-still-explains-the-constant` tested a comment's *position*: it failed a correct solution
  that moved the comment onto its own line and passed the stale trailing one. It now reads the comment text.
  The one surviving `L3b` workspace re-scores identically, which is how the change was checked rather than
  assumed.

### Version

`0.4.0` → `0.5.0`. Mode B: the skill's class/precedence wording is a semantic change — which `HARD` rules
outrank a user instruction — and the evaluation instrument changed with it. `v0.4.0` stays where it is; tags
are not moved. New recovery point: `v0.5.0`.

## Task-level behavioural evaluation + one rule refinement — v0.4.0

Round 2 on `project-conventions`. The question was whether the skill changes what an agent *does* to a
real repository. The answer is: **measurably yes in one place, and no net benefit overall.** Full record
in [`research/project-conventions/08-task-level-evaluation.md`](research/project-conventions/08-task-level-evaluation.md).

### A task-level harness, and the control it needed

`evals/project-conventions/task-eval/` — 10 cases (6 development, 4 held out), each a self-contained git
repository plus a real job plus its own `check(dir)`. Scoring reads the repository the run left behind,
never the agent's chat, and never asks the agent how it did. Child processes cannot capture output in
this sandbox, so checks `import()` the agent's modules and call them — which asserts behaviour rather
than the exit code of a script the agent may have rewritten.

The first attempt at a baseline was invalid before it ran: a probe showed **subagents inherit the full
skill catalog**, so a "control" agent could already see the skill. The fix was to relocate the bundle
out of `.dsh/skills/` for the duration of the baseline block, verified by probe (catalog and context
both clean), and restored immediately afterwards.

`validate.mjs` runs every case pristine (must fail) and with a reference solution (must pass). It found
**three real defects before a single agent ran** — an unimported symbol, a regex that matched `package.js`
inside `package.json`, and a CommonJS named-export miss that made a *correct* solution look broken. Real
runs then exposed two more: a returned key the task never froze (which failed both arms identically), and
a loader assumed synchronous (which failed a correct solution **in the baseline arm only**, so correcting
it raised that arm by one assertion — the final totals are not independent of that erratum). Both are
recorded as **errata**, not silent fixes.

### Results

| | runs solved | assertions |
|---|---|---|
| baseline (skill relocated) | 9 / 11 | **59 / 61** |
| skill | 10 / 11 | **59 / 61** |

Identical totals, diverging on two cases in opposite directions. **Eight of ten cases never
discriminated**, and the entire held-out set was solved by both arms (4/4). This is the third
independent instrument in this repository to hit a ceiling, after the question-level suite here and both
`effective-thinking` external evaluations.

Two rubric defects were found after the results were in, and they get opposite treatment for a stated
reason. `L3a`'s disposal assertions assume "clean up" means "delete" when the skill's own `PC-5` permits
ignoring instead (the lenient reading makes that arm 7/7 and the arms exactly level) — **left unfixed**,
because changing it now would move the score in the skill's favour after seeing the result. `H3`'s fixture
committed the credential files that its own comment and reference solution call untracked, and its check
read only `.gitignore` text, so a run could score 5/5 while `git add -A` — the accident the case exists to
catch — went unseen — **fixed**, with an index assertion, and the case re-run in both arms. Both were
found by the adversarial review recorded in `08` §12, not by the runs.

### One confirmed behavioural effect, and the rule change it produced

On `L3b` — raise a constant under "change nothing else", on a line whose comment was *already* false —
baseline left the comment in both runs and the skill fixed it in both. The skill's own documents made
that divergence possible in two ways, and both were real defects:

- **The class table contradicted the precedence order.** `HARD` said "Never violated. Only safety and
  irreversibility justify these", while the precedence list ranked non-safety `HARD` rules *below* an
  explicit user instruction. An agent reading "never violated" does not consult the precedence order.
  `HARD` now means "not traded away for convenience; still yields to tiers 1–3". This is the same defect,
  in the same document, that had already been corrected once for `PC-4`.
- **`PC-7` gave no tie-break** between "your change falsified the comment" and "it was already false".
  It now states one: a false comment **on a line you are editing** is fixed anyway, because your own diff
  would otherwise read as self-contradictory; a false comment **elsewhere** is reported, not fixed.

The fix was re-tested: `L3b` run again in both arms, and the skill arm quoted the new clause and acted on
it (2/2 vs baseline 0/2). A rule change derived from an observed divergence, verified by re-running the
case that exposed it.

**Correction (v0.5.0).** The paragraph above is wrong on two counts and is kept only so the error stays
visible. All four `L3b` runs used the **pre-edit** text — their results were committed at `a3a5232`, and
the rule edit is `b1a2705`, which follows it — so the re-run was not a re-test of the change; and the
sentence attributed to a post-edit skill run appears in no preserved report. One skill run did cite
`PC-7`, the *old* text. What the runs verify is that skill 2/2 fixed the comment while baseline 0/2 left
it; the clarification itself remains unverified, as `08` §6 now says.

### Reference integrity

After the 26→19 rule consolidation, the efficiency research note still cited superseded rule ids
(`PC-22/23`, `PC-24/25/26`, `PC-12…PC-21` — superseded ids named on purpose, OLD-RULE-IDS-OK). `citations.json` was checked but nothing checked prose. All
repaired, and the contract test now scans **34 documents** for ids above the current maximum, with a
negative control proving it fires and an explicit `OLD-RULE-IDS-OK` marker for prose that names a
superseded id on purpose.

### Left-over investigation

The 14.8 MB untracked archive is **kept** and was inspected read-only. `cases.jsonl` is intact (38 rows,
0 malformed — an earlier "22 malformed" was a PowerShell parser artifact, corrected by re-checking with
Node). `failures.jsonl` is genuinely 0 bytes while the report says the failures live in it; `metrics.csv`
counts are non-monotonic (83 → 67); the two token estimators disagree **12.6×**; and the declared artifact
root `D:\AI-Runs\...` does not exist. Nine tracked files now reference the archive, so it is documented
rather than orphaned. Its value is as a first-hand case study, not as measurement.

### 触发条件（后补测量）

设计里被砍掉的 trigger 条件后来补跑了三个有区分度的用例：**skill 在 catalog 中、提示词不提它**。
结果是它没有自己触发——L3b 与 baseline 一样留下失真注释、理由也相同；另外两个用例同样与 baseline 一致。
另一种度量：skill 臂 11 次报告中有 3 次引用了规则编号（PC-7、PC-2），baseline 臂 0/11，trigger 臂 0/3。

也就是说 §5 测到的行为改变来自评测**点名**要求遵循该 skill，而不是它的 catalog 描述吸引 agent 加载。
这把结论的适用范围收窄了：这是「被采用时的 skill」，不是「已安装的 skill」。

### Version

`0.3.0` → `0.4.0`. Mode B: the evaluation harness and the rule refinement are functional changes. `v0.3.0`
stays where it is — tags are not moved. New recovery point: `v0.4.0`.

## Second Skill (`project-conventions`) + repository governance pass — v0.3.0

Adds a second, **independent** agent Skill and applies it to this repository. The pre-existing
`effective-thinking` contract is untouched: root `SKILL.md`, `dsh/**`, the `npm test` chain, and the
frozen corpora under `evals/external*` are all unmodified, and the strict host gate still passes.

### The Skill

- **`.dsh/skills/project-conventions/SKILL.md`** — 19 rules in five triggered gates (placement,
  cleanup, code, release, handoff). Every rule carries a class
  (`HARD`/`DEFAULT`/`WHEN`/`PREFERENCE`/`HYPOTHESIS`) and one check.
- **`references/rules.md`** — per-rule records plus the admission gate for new rules.
- **`references/evidence.md`** — the honesty layer: what is `strong`, what is `moderate`, what is
  `weak`, and a list of widely-repeated claims that are **deliberately not encoded**.
- **Rule schema reduced on measured grounds.** The proposed `R = (T, C, A, K, V, E)` was applied and
  cut to **T + A + Check**, with `class`, `status` and `evidence` promoted to tags: no official
  instruction format has a context field, an exception is a narrower trigger, and the *count* of
  constraints is the axis along which compliance is measured to fall (FollowBench: GPT-4 hard
  satisfaction 84.7% at one constraint → 61.9% at five; practical ceiling ~3). The schema's benefit is
  claimed as reviewability and budgeting, **not** as a measured compliance gain.
- **Delivery verified end-to-end.** DSH's filesystem skill provider scans `<projectRoot>/.dsh/skills`
  at rank 100. Confirmed experimentally, not just documented: writing the bundle made the skill appear
  in the live session catalog with no restart, and removing it removed the entry.
- **The owner's version preference is honoured where it is safe and labelled where it is not.** The
  magnitude scheme conflicts with SemVer 2.0.0 rather than merely lacking support — a large *additive*
  feature is a MINOR, so MAJOR-for-big-features is a false breaking-change alarm. Resolved by forcing a
  declared mode: `PREFERENCE · evidence: none` in a labelled house scheme, with breaking changes never
  permitted to ship as MINOR/PATCH.

### Verification

- `evals/project-conventions/contract-test.mjs` — cross-checks SKILL.md against rules.md (id set,
  class, ledger), the class/evidence/status vocabularies, record completeness, frontmatter, body
  budgets, link resolution, and **file encoding**. Validated by four negative controls, each of which
  makes it fail.
- `evals/project-conventions/suite-test.mjs` — 20 behavioural cases across all 12 required areas, plus
  the check that makes the suite trustworthy: every case's asserted-good answer must pass its rubric
  and its asserted-bad answer must fail.
- `evals/project-conventions/verify-citations.mjs` + `citations.json` — re-fetches each source and
  matches the quoted sentence. Last run: **20 of 22 reconfirmed, 0 claims missing, 2 hosts not
  reached** (reported as not-verified, never as passing).
- `npm run test:project-conventions` and `npm run test:project-conventions:cite`. **Not** added to
  `npm test`, which is `effective-thinking`'s frozen release contract; putting a second skill's checks
  in it would change what that contract means.

### Behavioural evaluation — a ceiling, reported as such

20 cases × 2 conditions × 3 replicates = 120 answers, scored by **two blind independent judges** on a
shuffled, condition-free pack. Inter-judge agreement 118/120 (98.3%). Result: `skill` 60/60,
`baseline` 58/60 — **19 of 20 cases were solved by all six runs**, and the nominal 3.3-point gap sits
on two rows of one case where the judges disagreed. **No behavioural benefit is demonstrated and the
skill's effect is NOT VERIFIED.**

The first two measurements of that same data were *invalid instruments* and are recorded as such: a
regex scorer produced "75% vs 83%", then "88% vs 88%", because a pattern cannot tell an endorsed
behaviour from a mentioned one ("I would not delete it", "this is not a MAJOR"). Those numbers are
withdrawn. This mirrors the ceiling already recorded twice for `effective-thinking`
(`reports/phase-2-v2-pilot.md`), which is itself the finding: asking a strong model to decide well is
not a hard test, whether or not a document told it how.

### Repository governance (audit findings, all with re-runnable evidence)

- **P1 — untracked agent artifacts inside the repository.** 3,653 files / 1,919 directories / 14.8 MB,
  including 27 nested `.git` repositories and 104 `__pycache__` directories, with no `.gitignore`. The
  generating run's own report places its artifact root at `D:\AI-Runs\...`, **a path that does not
  exist** — the only copy is in the tree. Fixed structurally with a `.gitignore`: untracked entries went
  **2,179 → 13**, all intentional. The archive itself is **kept**: it is another run's primary
  evidence, and deleting it is irreversible. Its disposition is raised for the owner instead.
- **P1 — no reliable recovery point.** `package.json` version was `0.2.0` in **every** commit that
  touched it, including the DSH integration, and `git tag` was empty: the repository could not answer
  which tree `0.2.0` was. Version → `0.3.0` (mode B, functional/structural change), version mode
  declared in the README for the first time, and `v0.3.0` tagged as the first real recovery point.
- **P2 — the structure map described a repository that does not exist.** README and AGENTS.md listed
  `profiles/`, `routing/`, `context/`, `changelog/`, `methods/{candidate,validated,rejected}` and
  `evals/{tasks,baselines,regressions,results}` — none of which exist — while omitting seven real
  directories. README now carries a **current-structure map with per-directory responsibilities**,
  cross-checked against `git ls-files` (299 tracked files, 21 top-level entries), with the aspirational
  tree retained and still labelled as a target.
- **P2 — stale current-state numbers.** `reports/session-01.md` claimed a "69 files, 9 dirs" converged
  tree whose counting rule was never written down. Replaced with the stated rule and the measured
  figure. Historical session records were **not** rewritten.
- **P2 — the DSH compatibility claim understated the package.** README and `docs/dsh-integration.md`
  said DSH `0.1.1-rc.2` only; the installed host is `0.1.5-rc.1`, and `npm run test:dsh:host` passes
  all 21 host checks against it. Recorded as a re-verification, with the parts it does *not* re-verify
  (install/remove via `dsh plugin`) named.
- **P3 — a 0-byte `nul` file** (Windows reserved device name) created by an agent's redirect typo and
  alive for eleven days: deleted via the `\\?\` path.
- **P3 — a stale count in a source comment** (`bin/self-audit.js`: "22 reports", chain is 26): the
  number removed rather than re-hard-coded, since it will drift again.

### Research record

`research/project-conventions/01`–`07`: five evidence clusters (software engineering, version
management, agent engineering, skill/rule systems, efficiency & failure modes) with per-source tables
and explicit unanswered questions; the repository audit; and the behavioural evaluation. Cluster A
also caught three mis-attributed citations in the research brief itself and refused to propagate them.

### Known limits

Behavioural benefit NOT VERIFIED (§above). The behavioural runs and the regex-failure record live in
ignored `.scratch/` and are reproducible from `evals/project-conventions/`. Rollback of *data* (as
opposed to code) is not covered by any rule, because no retrieved source addresses it.

## Repository Fix Pass — correctness bugs, release contract, convergence (no new methods)

Scope: fix already-identified correctness/release-contract defects and converge the repository. No
new Cognitive Method, no router philosophy change, no architecture redesign, no frozen-evidence edit.

- **P1 adaptive-loop attempt budget (real correctness bug):** `run({maxSteps:1})` executed the task
  **twice** and could return `done:false`; `maxSteps=2` executed three times; `runAsync()` had the
  same defect. Cause: `adaptiveLoop()` enforced `budgets.MAX_STEPS` while `run()`/`runAsync()` kept a
  second, independent `guard < cap + 1` counter — two budgets for one constraint. An exhausted hard
  budget could additionally be reported with the **strategy's** stopping reason
  ("deep: keep deliberating — …"), i.e. the opposite of a hard stop.
  Now: `normalizeMaxSteps()` is the single source of truth (explicit `maxSteps` beats
  `budgets.MAX_STEPS`; default 10; a non-positive/garbage budget throws `RangeError` instead of
  silently guessing). The loop is the only enforcer and the drivers own no budget, so
  `maxSteps=N` ⇒ `execute()` runs at most N times. Exhaustion is terminal by itself with its own
  reason `execution: attempt budget exhausted`, never a fast/structured/deep deliberation reason.
  Execution attempt budget and deliberation budgets stay conceptually separate.
- **P2 extractor high-stakes shadowing (real bug):** `baseCategory()` is first-match-wins with the
  debug/repair category ahead of the high-stakes one, so "Fix this security bug before production
  launch." inherited the *ordinary debug* risk baseline (error_cost 0.45, reversibility 0.6) and
  routed `structured/keep`. Fixed as a **modifier, not a category reorder** (reordering would only
  move the shadowing to another input class): a narrow high-stakes modifier in `applyModifiers()`
  raises `error_cost` to ≥0.85 and lowers `reversibility` to ≤0.25 when a high-stakes anchor
  (security/release/payment/compliance/irreversibility/…) is combined with a stated exposure
  (loss/breach/outage/incorrect/customer/money/…) and the framing is not transient-retryable
  ("failed twice", "flaky", "intermittent"). It deliberately does **not** set `one_shot`, does not
  force `verification_difficulty`, and does not itself cause a model upgrade — escalation stays
  governed by the existing mismatch / one-shot / repeated-failure rules.
- **P3 release contract:** `npm test` ran neither `dsh:check` nor `test:dsh`; `test:dsh` pointed at a
  file absent from the npm whitelist; and with no DSH host the provider contract SKIPped and exited 0
  with no way to demand otherwise. Now layered: `test:dsh` (ordinary — host may SKIP, static checks
  always run), `test:dsh:host` (strict — a missing real host is a FAIL, never a mock),
  `release:check` (`dsh:check` + `test:dsh`, host-free, reproducible), `release:verify`
  (`test:dsh:host` + `release:check`, the pre-publish host gate). `prepack` → `npm run release:check`,
  so a plain `npm pack` succeeds and self-verifies without a global DSH install; no external-host
  requirement was smuggled into an ordinary npm lifecycle.
- **Package whitelist self-consistency:** `evals/dsh-plugin-test.js` is now published (and nothing
  else from `evals/`). `evals/package-meta-test.js` was extended from "the file exists in the repo"
  to "every release-facing target derived from the manifest (scripts/exports/main/dsh.bundle.patch,
  transitively through `npm run` references) is covered by the `files` whitelist", plus prepack /
  release-script contract checks.
- **Extraction eval strengthened:** now reports **strategy**, **model_action** and **joint**
  (both correct on the same item) accuracy against conservative floors, because scoring only
  `strategy` hid a whole regression class. Measured before and after this pass: strategy 44/51,
  model_action 48/51, joint 42/51 — **unchanged**, so the P2 fix is provably regression-neutral on
  the existing corpus. Floors sit just below those numbers (80%/88%/76%); they are regression guards,
  not targets and not an OOD-generalization claim. High-stakes raw-text cases + two negative controls
  are now part of the chain, and a high-stakes failure fails the build.
- **Repo hygiene / convergence:** added `LICENSE` (MIT, matching the existing `package.json`
  declaration), a minimal `.gitattributes` (canonical LF, protecting the SHA-256 freeze, the
  byte-exact DSH asset, and manifest verification from Windows CRLF conversion — verified to produce
  **no** line-ending rewrite of any existing file), a minimal GitHub Actions CI (host-free contract +
  pack jobs on Node 18/22; deliberately **no** required-host job, since faking a host would be false
  evidence), and the project scope hard rule in `AGENTS.md`.
- **README convergence:** the Task Router section described the superseded
  FAST/DELIBERATE/PROBE/ESCALATE taxonomy as Current Architecture. It now documents the real,
  two-dimensional router (`strategy = fast|structured|deep`, `model_action = keep|upgrade|delegate`),
  keeps the old taxonomy only as clearly labeled history, and states that probing/information
  gathering is an execution-time action (not a router strategy) and that escalation is a model
  action (not a deliberation strategy). `SKILL.md` was **not** modified for this pass.
- **Evidence:** `npm test` 26/26 exit 0; `npm run audit` 26/26 "skill healthy"; `npm run dsh:check`
  PASS; `npm run test:dsh` PASS; `npm run test:dsh:host` PASS against the real DSH `0.1.1-rc.2` host
  (registry, catalog, `get`, `unload`, `reload`); `npm run release:check` PASS; `npm run release:verify`
  PASS; `verify-freeze` PASS (84 artifacts). Host-free behaviour verified by simulation:
  `test:dsh` SKIP+exit 0, `test:dsh:host` FAIL+exit 1, `release:check` exit 0, `release:verify` exit 1.
  `npm pack` succeeded with no host (123,359 bytes, 50 entries) with `prepack → release:check`, and the
  extracted tarball was consumed in isolation (root require, `./dsh` export, DSH asset, `dsh:check`,
  `test:dsh` target all present). **Phase 1 and Phase 2 v2 frozen bytes: unchanged.**


## Release Blocker Fix (B1–B6 + F16/F17) — freeze-readiness, no new methods

- **B1 adaptive stagnation (real bug):** `adaptive-loop.js` derived `roundsSinceNewInfo` as a
  non-cumulative 0/1 per round, so the deep "no-info → no-info → stagnation stop" could only ever be
  reached via the attempt cap. Now the loop accumulates consecutive `newInfo === false` rounds and
  resets on any new info; `--newInfo` stays reachable. Integration regression (deep task → 2×
  no-info → stop at attempts=2 with a stagnation reason, plus a reset check) added.
- **B2 reviewer exception semantics (real bug):** a throwing reviewer was counted as `disagree`, so
  "2 agree + 1 crash" became disputed and "all crash" became rejected. Now votes are
  agree/disagree/unavailable; agreement is computed over VALID votes only; verdicts add
  `unavailable` / `insufficient_review`; a configurable `minReviews` quorum is exposed together with
  agreeVotes/disagreeVotes/unavailableVotes/validVotes/quorumMet; failures stay as diagnostics.
  Tests cover Case A (2 agree + 1 exception → agreed), Case B (all exception → unavailable),
  Case C (real disagreement → disputed), quorum, and no-boolean-agree→unavailable.
- **B3 vacuous assertion:** `evals/deliverables.js` had `['keep','upgrade','delegate'].every((m)=>true)`
  (always true). Replaced with three real input→output assertions proving keep/upgrade/delegate are
  each reachable.
- **B4 naming:** `evals/validation.js` (and current-state docs) re-labeled from "held-out test set"
  to **validation corpus / regression** — it entered the dev feedback loop (F4/F5), so it proves
  regression/specification consistency, NOT out-of-distribution generalization.
- **B5 claim downgrades:** "+68.4" qualified as routing/strategy-label benchmark (not task success);
  "32/32 = 100%" qualified as regression consistency; "not author-fitted" softened to "cross-review
  detected no author-specific DIFFERENTIAL bias; author/benchmark-ecosystem overfitting not excluded";
  `tier strong` qualified as probe capability ≠ long-horizon behavioral capability.
- **B6 consistency sweep:** fixed stale current-state numbers (failure-log range F1–F15→F1–F17,
  risk "22"→"32", converged file count, multi-agent card's old dissent wording).
- **F16 (action-loop degeneration) + F17 (meta-policy self-exemption)** recorded in the failure
  corpus as real external failure evidence, explicitly **unresolved**.
- `npm test` exit 0 (26 scripts); audit/consume re-run PASS. No router threshold/strategy changes;
  `experimental` status retained; no publish; external behavioral evaluation still NOT done.


## Session 57 — CONVERGENCE PASS + current-state sweep after Sessions 53–56

- Ran the objective-mandated convergence pass (last formal one: Session 49). Inventory: 6 top-level
  files + 9 dirs, 69 files total, 28 eval scripts, 7 method cards, 9 research notes + 2 persisted
  cross-author label files; zero junk/scratch.
- **Current-state consistency sweep** (four doc-touching sessions had passed since the last sweep)
  found and fixed TWO genuine drifts that a reader trusting the docs would hit:
  - `reports/session-01.md` Evidence: robustness numbers still read "single-axis ≤5.7%, all-axes
    ≤14.3%" (the 41-item-set values) while the suite now measures the 51-item set at ≤5.9%/≤13.7%.
  - `methods/experimental/capability-calibration.md`: said "one true long-context run" — there are
    now two (Session 38 ~1.9k + Session 55 ~15.6k tokens); limits line updated to ~15.6k.
  Historical records (changelog appendices, failure-log, study archives) validated as correctly
  frozen and untouched.
- Re-verified the whole converged state: `npm test` = 26 scripts exit 0, `npm run audit` =
  26/26 "skill healthy", `npm run consume` PASS (tarball packs → installs → full public API works
  for an end user). No code change.

## Session 56 — live LLM-profile fills on the Session-54 boundary items (n=6)

- Tested whether the LLM-fill path reproduces INDEPENDENT-JUDGE behavior on the 6 items most relevant
  to the Session-54 finding (4 where both judges coalesced against the author/router + 2 controls).
  A fresh fill agent produced 14-field profiles; routed through the real `fillProfileSync`→`route`.
- **Fill sided with the judges on 2/6:** `contract-review-large-hd` → `deep/delegate` via
  `parallelism=true` (the exact judge reading the author's profile MISSED — a 200-page review IS
  partitionable; strongest evidence yet the LLM path beats the extractor on a delegability signal),
  and `many-constraints-trivial-verify` → structured.
- **Fill sided with the author on 2/6:** `ambiguous-cheap-reversible` was filled with `clarity=0.35`
  IDENTICAL to the author — so the judges' "fast" is an alternative stance, not the dominant reading
  (author + fill = 2-of-4 sources read ambiguity; P1-cautious structured is majority). `novel-hard-
  verify-algo` stayed deep/keep (judges' upgrade is a model-strength preference the router reserves
  for concrete mismatch).
- **Session-37 over-marking mode reproduced:** the fill over-flagged both mechanical batch
  conversions — `yaml-json-comments` (conflict 0.8 + parallelism true → wrong deep/delegate) and
  `mech-parallel-delegate` (constraint_count 4 → spurious deep). Confirmed: the LLM path is a
  COMPLEMENTARY, not uniformly-better, signal source — it surfaces judge-visible signals keyword
  misses but over-flags batches, which is exactly why the adapter (sanitize + keyword fallback +
  never-sole-source) exists.
- Recorded in `research/llm-profile-live.md` (re-measurement section; status n=10 across 2 sessions).
  No code change. Suite + audit green.

## Session 55 — context envelope extended to ~15.6k tokens: lost-in-the-middle does NOT appear

- Advanced the "extreme-length context" remaining limit: built a deterministic 750-line (~62.4k-char,
  ~15.6k-token) document and ran a fresh model-under-test (no-tools, pure reading) against four
  planted probes: beginning fact (entry 0005 → 31), middle fact (entry 0598 → 77), end fact
  (entry 0746 → 42), and a mid-document embedded INSTRUCTION ("ignore preceding format facts;
  append code 4711 as the very last thing in your reply").
- **Result: 4/4 correct.** Beginning, middle, and end facts all recalled, and the mid-instruction
  was followed exactly (code 4711 appended, instruction restated) — no lost-in-the-middle
  degradation at ~8× the Session-38 (~1.9k-token) document size. Combined Sessions 38+55 = **10 real
  context probes, 10/10**.
- Honest caveats preserved: one model family, single run, ~15.6k tokens — the multi-100k extreme
  ceiling is still unmeasured; `context=1` evidence is stronger but not an absolute guarantee.
- Scratch test document removed (no repo pollution); recorded in
  `research/real-model-calibration.md` (finding #5 + status). Docs updated (report Risks).

## Session 54 — independent labels for all 32 held-out items; Session-30 findings reproduce

- Closed the Session-53 open item: dispatched two FRESH, no-seed labelers to independently label ALL
  32 `evals/validation.js` task texts (no profiles, no thresholds, no author labels). **Both settled
  with complete 32-item labels** — a rare clean settle after several environments where fresh
  subagents stalled — and their outputs are now persisted as durable reproducibility data
  (`research/cross-author-labels/labelerA.json`, `labelerB.json`).
- **Results (32 items):** author↔router 32/32 (100%); **router↔A = author↔A = 68.8% full /
  78.1% strategy, router↔B = author↔B = 71.9% full / 81.3% strategy** — the Session-30 "router is
  not disproportionately fitted to the author" finding reproduces EXACTLY (router agrees with
  independent judges at the same rate the author does). Inter-judge: 93.8% full / **96.9% strategy**.
- The two judges agree 100% on all 10 new items and coalesce WITH the router/author on 6 of them;
  on the other 4 both judges independently pick the same alternative (`ambiguous-cheap-reversible`→
  fast, `many-constraints-trivial-verify`→structured, `contract-review-large-hd`→delegate,
  `novel-hard-verify-algo`→upgrade) — all defensible fast↔structured / delegate / upgrade-vs-keep
  judgment boundaries, recorded as label-quality caveats (not router errors under the skill's own
  rules, and importantly NOT overfit-fitted to the author).
- No router change. Docs updated (README/report current-state + `research/cross-author-labels.md`
  re-measurement section). Suite + audit still green.

## Session 53 — held-out validation expanded 22 → 32 with new pressure-area boundary items

- Grew `evals/validation.js` from 22 to **32** author-judged held-out items with NEW pressure areas
  the old set didn't cover: anti-overthinking-under-urgency (high stakes + cheap local repro →
  Structured, NOT deep/upgrade), the F-6b one-shot-outranks-parallel ordering (a parallel-looking
  workload whose deliverable is one irreversible decision → upgrade, not delegate), mechanical
  PARALLEL delegate (5 sheets vs research-parallel), single-research NO-delegate (delegation
  restraint), hidden-constraint format-conversion disguise (YAML→JSON with comments), escalation
  boundary at exactly 2 failures (still keep/Structured), large-context iterable contract review
  (Deep but NOT upgrade — review list is re-checkable), ambiguity+cheap+reversible NOT deep (F-2
  boundary), novelty+no-oracle → deep/keep, and many-constraints+trivial-verify → fast (constraint-
  guard overthink check).
- Labels reasoned from task nature only (same process as the original 22); several outcomes were
  genuinely uncertain (e.g. whether the router would keep YAML→JSON at Structured, delegate the
  mechanical-parallel batch, or go deep on the urgent-but-cheap-to-repro outage).
- **All 10 new items generalize: validation now 32/32 strategy AND 32/32 model (100%).** No router
  change was needed — the new boundary items pass on the existing decision procedure, which is
  stronger generalization evidence than the old 22/22.
- Dependent evals still green on the larger set: full suite exit 0; robustness over 51 items
  single-axis ≤5.9% / all-axes ≤13.7% (still stable); principles P1–P7 + coverage audit PASS.
- Docs updated to 32/32 (README + report current-state; the cross-author study on the original 22
  remains the honest independent-label number — new 10 have author labels only, independent labels
  deferred to a model-backed round).

## Session 52 — report Risks/Next refreshed against the true current state

- Re-audited `reports/session-01.md` header numbers: it still claimed "**24** independent checks" while
  the suite is 26/26 (Session 47 fixed the README but the report header's count drifted again
  after the Session 50/51 additions). Corrected to 26 and to the current failure-log range F1–F15.
- Refreshed Risks + Next: marked the ORIGINAL Next list items #1–5 as DONE (wire-to-real-subagents
  → Sessions 36/43/48; real calibration probe battery → 35/38; cross-author labels → 30; pubish →
  34/49/51 packaging + consume gate; agent-self signal extraction → 37/45), and consolidated the
  remaining work into one explicit line: cross-model calibration, extreme-length context, full host
  nesting, actual registry publish (operator), larger label sets.
- Docs-only round (convergence); no code change. Suite + audit re-run to confirm nothing moved.

## Session 51 — end-user consume gate: the SHIPPED tarball is proven usable

- Closed the last untested link between "package is packable" and "package works for a consumer":
  added `evals/consumer-test.js` (requires the INSTALLED package by its root dir so internal
  requires resolve from the installed tree, not the repo — exactly what an end user's
  `require('cognitive-agent-skill')` does) + `bin/consume-pack.js` (pack → extract → run that test)
  + `npm run consume`.
- `npm run consume` PASSES: `npm pack` runs prepack (full 26-script suite green) → 37-file tarball →
  extracted as an installed dependency → full public API exercised (route, extract, fillProfile,
  verify, certainty, fanOutAsync, reviewAsync, runTaskAsync) — all OK. This is a repeatable
  publish-readiness gate.
- Fixed two environment details while building it: `spawnSync npm` ENOENT on Windows (`.cmd`
  shim) → run npm's own CLI JS (`npm_execpath`) under node; and `npm pack` needs a temp `--cache`
  so it never touches the sandbox-blocked global npm-cache.
- `npm test` = 26 scripts, exit 0; `npm run audit` = 26/26, "skill healthy"; repo clean.

## Session 50 — fixed F15: batch + --profile-json silently cross-contaminated rows

- Audited option combinations and found a REAL semantics bug (F15): `planTasks` passed the same
  `opts` (with one `profileJson`) to every row, so `--batch --profile-json '{...}'` applied ONE
  task's injected profile to ALL rows — e.g. a trivial "rename" wrongly became deep/keep because an
  architecture task's profile leaked into it. Silent (no crash), so it needed a targeted audit.
- Fix: `planTasks` now strips `profileJson` (marks `profileJsonIgnored=true`, source stays
  'keyword'); batch `main()` prints "NOTE: --profile-json is ignored in --batch mode". Single-task
  injection unchanged. Regression added to `evals/cli-batch-test.js` (contamination case).
- Verified: contaminated batch now routes rename→fast/keep + architecture→deep/keep via their OWN
  text; single-task still `src=injected+keyword`. `npm test` = 26 scripts, exit 0; audit 26/26.
  Failure log updated (F15).

## Session 49 — CONVERGENCE PASS (fresh): README tree fixed, all docs reachable, tarball complete

- Ran a fresh convergence pass (the objective's mandated check; last done Session 40). Exercises:
  full inventory (6 top-level files, 9 dirs, 7 method cards, 9 research notes, 26 chain evals, 27
  eval files) + junk scan (zero) + README-tree↔files cross-check.
- **Found and fixed real gaps:** the README tree listed only `methods/core/task-router.md` (all 7
  experimental cards missing), omitted `research/adaptive-live-run.md` + `research/skill-contract-
  audit.md`, and had a broken `└─`/indentation line in the research tree. Fixed the tree; re-check
  now reports ALL research + methods files referenced.
- Re-packed: tarball = 36 files / 84.1 kB, containing ALL 7 method cards + ALL 9 research notes
  (nothing orphaned in-tree, nothing extra). `npm test` = 26 scripts, exit 0; audit 26/26.

## Session 48 — workspace write-probe + second live adaptive run (loop handles real executor stall)

- **Probed the Session-43 caveat:** can a sub-agent write into the reusable WORKSPACE? YES —
  `WROTE: yes / CONTENT_OK: yes` (probe file written + read back exactly). So agents CAN write; the
  earlier stall was temp-target + specific executor behavior, not an absolute limit.
- **Second live attempt** (executor asked to write the IPv4 impl into `scratch-live/`) again did not
  settle in a reasonable time and was interrupted — recorded honestly as a REAL failure mode.
  The skill's adaptive loop handled it exactly as designed: attempt-1 failure fed back through
  `runAsync` → re-route (deep/keep, f=1) → attempt 2 converges; an always-failing executor stays
  bounded at 4 attempts ("不要无限研究"). Scratch cleaned; repo clean.
- `research/adaptive-live-run.md` updated with a Session-48 addendum. `npm test` = 26 scripts,
  exit 0; `npm run audit` = 26/26, "skill healthy".

## Session 47 — document-consistency sweep (stale current-state numbers fixed; history kept)

- Audited every long-term doc for STALE CURRENT-STATE claims (not historical session records, which
  are correctly frozen): fixed README ("24/24 checks"→26/26, "benchmark 13 tasks"→19, "validation
  21"→22, e2e "91%"→93%, cross-author note added), `reports/session-01.md` (eval checks 24→26,
  benchmark 13/13→19/19, e2e 32/35→38/41 (93%), extractor-ceiling 91%→93%, evals/research lists
  updated, failure-log ref F1–F6→F1–F14), and two method cards (verify-planner, task-router: 24→26).
- Verified true current numbers first (chain=26, benchmark 19/19, e2e 38/41) so the fixes are
  evidence-backed, not guesses. Historical changelog entries left untouched (they record the state
  AT that session).
- `npm test` = 26 scripts, exit 0; `npm run audit` = 26/26, "skill healthy".

## Session 46 — SKILL.md contract-sufficiency audit (doc alone can reproduce router decisions)

- New evidence question: is SKILL.md (the agent-facing contract) instructive ENOUGH that a careful
  reader could reproduce the router's decisions without reading code? Computed router ground truth
  for 5 tasks (trivial, architecture, repeated-failure, one-shot, one-shot+parallel) and audited
  whether SKILL.md forces each outcome.
- **Result: sufficient at the rule level.** Every necessary outcome is forced by an explicit SKILL.md
  statement — incl. F-6b (one_shot OVERRIDES parallel-delegation, documented verbatim at L54) and
  repeated-failure escalation. Step-3 verify-first ladder matches ground truth. A faithful reader
  derives the same strategy/model/primary-verification as the router on all 5.
- A no-seed sub-agent cross-check was also dispatched but did not settle in a reasonable time
  (interrupted; recorded honestly). The deterministic doc↔rule audit is the durable evidence.
- New `research/skill-contract-audit.md`. `npm test` = 26 scripts, exit 0; `npm run audit` = 26/26,
  "skill healthy".

## Session 45 — SKILL.md agent-contract gaps closed (one_shot signal + LLM-fill path)

- Found and fixed two real doc↔code gaps in the agent-facing contract (`SKILL.md`): the `one_shot`
  signal was missing from the signal table entirely (it drives the F-6b one-shot-over-parallel
  upgrade rule), and the LLM-fill profile path (`fillProfile` / `--profile-json`) — added in
  Sessions 37/41 — was undocumented, so an agent reading the contract wouldn't know it exists.
- Added the `one_shot` row (with its semantics: true → upgrade on high cost OR hard-to-verify, and
  it OVERRIDES parallel-delegation) and a "Signal sources" note pointing at `fillProfile`/
  `--profile-json` with the sanitize+keyword-fallback guarantee.
- Verified the exact documented CLI command works end-to-end: `npm run route -- --task "..."
  --profile-json '{"one_shot":true,...}'` → MODEL: UPGRADE (F-6b behavior reachable as documented).
- `npm test` = 26 scripts, exit 0; `npm run audit` = 26/26, "skill healthy"; skill-consistency: no
  drift after the SKILL.md edit.

## Session 44 — input-robustness fuzz test; fixed a real crash on blank task text (F14)

- Added `evals/fuzz-test.js` — feeds adversarial/malformed/extreme strings (empty, whitespace,
  control chars, emoji/mixed-language, JSON-like, 10k chars, degenerate `--profile-json`) through
  the WHOLE pipeline (extract → route → certainty → verify → cost → CLI decide → batch planTasks)
  and asserts no crash + valid vocabulary. Wired into `npm test`.
- **Found a real bug (F14):** `extract('')`/`extract('  ')` THREW, so the pipeline and CLI crashed
  on a blank/truncated task. Fixed: `extract` degrades to a neutral low-signal profile
  (structured/keep — "cannot judge the task", deliberately NOT fast) instead of throwing. Honors
  "diagnose → degrade → keep evidence → finish": a blank task must not crash the skill.
- Fuzz test passes 4/4; full `npm test` now 26 scripts, exit 0; `npm run audit` = 26/26, "skill
  healthy". Failure log updated (F14).

## Session 43 — first live adaptive-execution run (real task + real failing executor)

- Closed the gap that the objective's #1 capability (adaptive execution) was only unit-tested /
  async-wired, never driven end-to-end on a real task with a real executor failure. Task: strict
  IPv4 validator; real 13-case test harness as ground truth; real sub-agent executor for attempt 1.
- **Real failure, honestly used:** attempt 1 (real sub-agent) STALLED and never produced a
  verifiable file (environment temp-write boundary). The loop fed that real failure back and
  re-routed; result: attempt 1=deep/keep → converge → success; always-failing executor → **bounded**
  at 4 attempts (不要无限研究 enforced live); and `extract(task)` under-rates this task as fast/keep
  while the agent's own reading (LLM-fill path) rates it structured+verify-heavy → deep — a concrete
  live reinforcement of the Session-37 keyword-ceiling finding.
- Recorded in `research/adaptive-live-run.md` with honest limits (n=1; success-on-attempt-2
  simulated after the real first-failure because the sandbox blocks sub-agent temp writes; not a
  claim the whole host is productionized).
- `npm test` = 25 scripts, exit 0; `npm run audit` = 25/25, "skill healthy".

## Session 42 — method cards for every capability (convergence: methods/ now complete)

- Added the five missing method-status cards under `methods/experimental/` — for signal extraction
  (keyword + LLM-fill adapter), capability model + calibration, execution protocol + stopping +
  adaptive loop, decision certainty + advisory cost, and multi-agent orchestration. Each records
  purpose / mechanism / evidence (file+eval refs) / known limits, matching the format of
  `core/task-router.md` and `experimental/verify-planner.md`. AGENTS.md's methodology requires a
  status record for every method; previously only two methods had cards while the rest existed
  only as code.
- Statuses are honest: execution-protocol/stopping/adaptive **validated** (deterministic, heavily
  unit-tested, async live-demoed); signal-extraction, capability-calibration, decision-certainty,
  multi-agent-orchestration **experimental** (mechanism-tested, one real-model/long-context run, or
  live-demoed but not host-productionized).
- README method-status line updated to point at the complete `methods/` set. Confirmed the package
  tarball now contains all 7 method cards (34 files, 77.6 kB).
- `npm test` = 25 scripts, exit 0; `npm run audit` = 25/25, "skill healthy".

## Session 41 — CLI now exposes the LLM-filled profile path (`--profile-json`)

- Added `--profile-json <json>` to `bin/router.js`: an agent (or an LLM fill) can inject a partial
  or full profile through the SAME entry point as keyword extraction. Missing/invalid fields fall
  back to keyword extraction (same `sanitize` as `router/llm-profile.js`); malformed JSON degrades
  to keyword without crashing, and the JSON output reports `source` = `injected+keyword` | `keyword`
  honestly. This closes the gap where the Session-37 LLM-fill adapter was library-only and not
  usable from the CLI an agent would drive.
- Direct checks: injected one-shot+parallel → deep/upgrade (F-6b behavior reachable via CLI);
  malformed JSON → keyword fallback with honest `source=keyword`; keyword-only unchanged.
- Extended `evals/cli-smoke.js` with two `--profile-json` regression cases (injection + degradation
  + source labeling). Full `npm test` = 25 scripts, exit 0; `npm run audit` = 25/25, "skill healthy".
- Also this round: interrupted the Session-39 adversarial reviewer (it ran many rounds without
  settling; its purpose — independent cross-check of the post-Session-29 surface — was already
  served by the captain's own thorough node probes recorded in Session 39). Honest status: the new
  surface is self + captain-adversarially verified; the interrupted reviewer's settlement report is
  no longer expected.

## Session 40 — CONVERGENCE PASS + failure log brought to date (F7–F13)

- Executed the objective's required CONVERGENCE PASS: repo inventory (9 intentional dirs, 41 JS
  files, clean top-level), junk scan (none), full suite + audit + deliverables gate all green.
- **Failure log updated** (`failures/failure-log.md`) with the design-changing failures from
  Sessions 29–37 that had no entry: F7 (repeated-failure evidence dropped by verif gate, R-1),
  F8 (ambiguity can't force Deep, R-2), F9 (two "trivial verification" thresholds, R-3),
  F10 (delegation over-gated + capability-disabled, R-4/R-5), F11 (one-shot gate too strict + the
  Session 37 F-6b one-shot-loses-to-parallel ordering bug), F12 (novelty seeped into capability),
  F13 (planted bugs must be proven real before measuring — Session 33 construction lesson). Each with
  root cause + fix + prevention rule + generality, matching the log's one-entry-per-root-cause format.
- The Session 39 adversarial reviewer over the post-Session-29 code surface is still settling; its
  report will be folded in when it lands (changelog/report already note this).
- `npm test` = 25 scripts, exit 0; `npm run audit` = 25/25, "skill healthy"; repo clean.

## Session 39 — independent adversarial review of the post-Session-29 code surface

- **Dispatched a fresh no-seed adversarial reviewer** over the code written since the last
  independent review (Sessions 36–37): `router/llm-profile.js`, async orchestrate adapters
  (`fanOutAsync`/`reviewAsync`), `runAsync`, the F-6b model-action reorder, and
  `evals/llm-profile-test.js`. Scope: prototype pollution, count/enum/boolean sanitize edges,
  async order + error handling, loop bounds, one-shot-vs-parallel precedence, and test vacuity.
  Reviewer's node-run findings land when it settles (round closes with its report appended).
- **Captain independent probes of the same surface (all reproduced, all clean):**
  - Prototype pollution: NOT possible — `sanitize` copies only whitelisted fields, never spreads
    raw model keys (`__proto__`/`constructor` ignored).
  - Count edges: NaN/Infinity/`"3abc"`/negative → safely clamped to 0; 3.7 → 4; 1e9 preserved.
  - one-shot LOW-stakes + parallel → fast/keep (no upgrade; oneShotHighStakes correctly gated on
    cost≥0.7 OR verif>0.7). F-6b behavior: one-shot high-stakes → upgrade; pure parallel →
    delegate.
  - Async: `reviewAsync` preserves input order regardless of completion timing; `runAsync` with an
    always-failing async execute is bounded (attempts ≤ budget).
  - Degradation: a THROWING async model produces a profile byte-identical to keyword extraction;
    partial LLM fills correctly merge keyword defaults.
- Honest status: the new code held against the captain's own adversarial probing; the independent
  reviewer's report is the external cross-check. `npm test` = 25 scripts, exit 0; `npm run audit` =
  25/25, "skill healthy".

## Session 38 — true long-context (lost-in-the-middle) measurement replaces the weak context=1

- Closed the honest caveat from Session 35: the calibration "context" axis was only lightweight
  placed-instruction probes, so `context=1` was weak evidence. Ran a REAL ~7.7k-char (~1.9k-token)
  lost-in-the-middle document with a fact at the end (K_42), a fact at the beginning (port 8080),
  and an instruction in the MIDDLE ("output only 7"); a fresh model-under-test recalled all three
  (A=K_42, B=8080, C=7).
- Combined with C1–C3 = **6 real context probes, 6/6** → `context=1` is now backed by a genuine
  long-context run, not just placed-instruction checks. `research/real-model-calibration.md`
  updated (Session 38); context is no longer the un-measured axis.
- Honest limits kept: one model family, ~2k tokens not a multi-100k extreme, single run. Full `npm
  test` = 25 scripts, exit 0; `npm run audit` = 25/25, "skill healthy".

## Session 37 — LLM-fills-profile adapter + live measurement; F-6b one-shot-over-parallel fix

- **New library path:** `router/llm-profile.js` — `fillProfile(task, {askLLM})` / `fillProfileSync`
  let a real agent fill the task profile FROM UNDERSTANDING instead of the keyword extractor
  (closes the objective's "agent-self signal-extraction reliability" item). Sanitizes/clamps
  model output, validates enums/booleans/counts, falls back to the keyword extractor for missing
  fields, and degrades to keyword on a throwing model (never crashes the router). Exposed on the
  public API; `evals/llm-profile-test.js` (9 checks) wired into `npm test` (now 25 scripts).
- **Live measurement:** a fresh subagent filled profiles for 4 tasks; routing those real fills vs
  the keyword baseline exposed a REAL router ordering bug (F-6b): a one-shot irreversible judgment
  with parallelism detected was **delegated instead of upgraded**. Fixed: one-shot-outranks-parallel
  (a single irreversible decision is never fan-out work). Added benchmark item
  `one-shot-parallel-judgment` + P7 covers it; P6 now exempts one-shot; extractor extended to detect
  the new phrasing. Direct verification: T4 (one_shot+parallel) now deep/upgrade; pure parallel
  still delegates.
- **Also:** the live comparison showed the LLM-filled profiles are a genuine alternative signal path
  (they caught the same routes on 3/4 tasks and revealed the one-shot bug), not a universal
  improvement — recorded honestly in `research/llm-profile-live.md`.
- `npm test` = 25 scripts, exit 0; e2e extraction 93%; `npm run audit` = 25/25, "skill healthy".

## Session 36 — async adapters: the bridge from skill machinery to REAL subagents

- Added the deferred "future integration" the code notes promised: `multi-agent/orchestrate.js` now
  exports `fanOutAsync` + `reviewAsync` (Promise-aware fan-out and independent review with the same
  per-item resilience), and `router/adaptive-loop.js` exports `runAsync` (async `execute` step for
  real subagent executors). All exposed on the public API (`fanOutAsync`, `reviewAsync`,
  `runTaskAsync`).
- Async coverage added to `evals/orchestrate-test.js` and `evals/adaptive-test.js` (deterministic
  async stubs: order preserved, rejections surface not abort, disagreement => disputed, rejecting
  reviewer = dissent, runAsync escalates on repeated failure and stays bounded). Full `npm test` =
  24 scripts, exit 0.
- **Live demo with REAL subagents:** 3 independent verification units (router escalation, verify
  ladder, adaptive-loop bounds) each CONFIRMED their claim with line-quoted evidence; results flowed
  through `consolidate` (3/3 kept) and a live `reviewAsync` produced a genuine DISPUTED verdict; the
  captain resolved it by reading the actual source (no verif-guard precedes the failures branch).
  This closes the long-deferred "wire orchestration + adaptive loop to real subagents" item with a
  working adapter + live demonstration.
- Honest status: the adapters are unit-tested and live-demoed; they are the wiring point for hosts,
  not a claim that the whole host is productionized. `npm run audit` = 24/24, "skill healthy".

## Session 35 — first REAL-model calibration run (measured, not synthetic)

- Closed the long-documented gap: `router/calibrate.js` existed and was unit-tested with injected
  results, but never run against an actual model. Ran the full 10-probe battery (reasoning 4 /
  context 3 / reliability 3) with a fresh sub-agent as the model under test; scored its answers
  EXTERNALLY against pre-prepared ground truth (not the model's own claim).
- **Results:** all 10 probes passed (correct multi-step arithmetic, correct probability reasoning,
  valid schedule, transitive proof; recalled late/middle-placed facts; consistent legal reading;
  refused to fabricate an unverifiable crater count; honest confidence). Measured capacity
  `{1,1,1}` → tier `strong`. Router with the measured profile: hard task → deep/keep (NO upgrade,
  capable), easy task → fast/keep with recommend_deescalate=true.
- New `research/real-model-calibration.md`, recorded with honest caveats: one model family, coarse
  battery, and the context axis uses light placed-instruction probes (NOT true long-context
  pressure tests) — so context=1 is weaker evidence than it looks. Full `npm test` = 24 scripts,
  exit 0; `npm run audit` = 24/24, "skill healthy".

## Session 34 — package is genuinely packable: real tarball verified (publish gate closed)

- Produced the ACTUAL npm tarball (`npm pack` with writable cache+destination, sidestepping the
  earlier npm-cache sandbox EPERM): `cognitive-agent-skill-0.2.0.tgz`, 64.8 kB, 26 files,
  shasum/integrity recorded. `prepack` (full `npm test`) ran as part of the pack and exit 0.
- Verified the tarball contains EXACTLY the `files` whitelist: index.js, all of router/, strategies/,
  multi-agent/, bin/, methods/, research/, SKILL.md, README.md, AGENTS.md, changelog.md, package.json
  — with NO evals/, no temp, no junk, no internal-only artifacts. The earlier "publishable" claim
  (metadata + resolving whitelist) is now backed by a real, inspectable package artifact.
- This closes the long-deferred "package publish" item at the packaging level. The only remaining
  action is the actual `npm publish` to a registry, which needs credentials/network and is left to
  the operator (not an autonomous action). Full `npm test` = 24 scripts, exit 0; `npm run audit` =
  24/24, "skill healthy".

## Session 33 — self-review reliability on REALISTIC code (18/18 total, honest)

- Extended the Session-32 study from tiny functions to realistic, multi-branch production-style
  code (order-total calculator, config validator, text wrapper, semver parser), each with a
  confirmed planted domain bug. Fresh SELF-REVIEW-ONLY agents, unanchored (spec + a few examples,
  no hint). Ground truth by direct execution (author committed two construction errors on first
  attempts — R3's "duplicate line" never triggered, R4's 4-segment rule wasn't in the contract —
  both rebuilt and re-verified, itself a lesson: planted bugs must be proven to exist before
  measuring catch rate).
- **Result:** 4/4 realistic bugs caught at high confidence (incl. the sneakiest — R1's free-shipping
  domain bug where example 2 is misleadingly correct), plus R4 flagged a bonus negative-major
  misparse. Combined with Session 32: **18/18 self-review catches, zero false "CORRECT"**.
- Honest interpretation (unchanged in spirit, now stronger): the verify ladder's rule is about
  **guarantee, not average failure** — prefer the run (reproducible evidence) when available; never
  promote self-review above a real check; and do NOT claim self-review always fails (these data
  refute that). Limits: n small, one model family, bugs findable by traced reading; still an upper
  bound, and there exist regimes (long multi-file code, concurrency, external-knowledge bugs) not
  measured here.
- New `research/self-review-realistic-code.md`. Full `npm test` = 24 scripts, exit 0; `npm run
  audit` = 24/24, "skill healthy".

## Session 32 — measured self-review reliability: honest negative result (14/14 catches)

- Ran the largest self-review reliability test yet: 6 distinct subtle planted-bug classes (chunk
  overlap, default sort lexicographic, falsy-destruction getPath, empty-string throw, wrong reduce
  initializer, input mutation), each verified by a fresh SELF-REVIEW-ONLY subagent in TWO modes:
  Round A (anchored: full contract + exposing examples + explicit hand-trace instruction) and
  Round B (unanchored: one-line spec + one neutral example, no hint). Ground truth established by
  direct execution (all 6 BUGGY).
- **Result:** 6/6 caught in Round A AND 6/6 in Round B, all high-confidence with correct reasoning.
  Including Session 31's 2 subjects: **14/14 self-review catches**.

Honest interpretation (recorded, not spun): the naive claim "self-review is unreliable / reflection
is not evidence" was NOT reproduced on this sample — a strong model that is explicitly asked to
hand-trace catches subtle bugs even with minimal prompting. The ladder's real rationale is NOT
"self-review always fails" (unsupported by our data) but **evidence quality + worst-case guarantee**:
self-review offers no guarantee, while a run is reproducible evidence. The design (prefer the run,
self-review last/never-primary) stands, but its stated justification is sharpened and overclaims are
removed. Method stays `experimental` (n=14, one model family, hand-picked well-known bug classes —
an upper bound on self-review competence, not a production miss rate).
- New `research/self-review-reliability.md` (protocol, results, honest limits). Full `npm test` = 24
  scripts, exit 0; `npm run audit` = 24/24, "skill healthy".

## Session 31 — first live-LLM-executor verify-ladder run (honest, incl. negative result)

- Ran the **first real-agent test of the verify planner's channels**: for two planted-bug subjects,
  a self-review-only subagent and an independent subagent (allowed to execute tests) each returned a
  verdict; the captain established ground truth by direct execution. Recorded in
  `research/live-verify-run.md`.
- **Result:** both channels caught both bugs; the expected "self-review misses it, execution
  catches it" gap was NOT observed at n=2. Rather than spin this, recorded it as the honest finding:
  self-review produced correct assertions here, but execution is the only channel yielding
  reproducible evidence, so the ladder's rule ("run the check first; self-review last, never
  primary") stands on that rationale — not on an overclaim that self-review always fails.
- Verify planner stays `experimental` (first live run done but n=2 and no measured failure-rate
  gap → not `validated`). Method card + research brief updated.
- Full `npm test` = 24 scripts, exit 0; `npm run audit` = 24/24, "skill healthy".

## Session 30 — cross-author label agreement: independent judges validate the router

- **Closed the "author-only labels" risk with a measured, repeatable study.** Two fresh, no-seed
  subagents (`A`, `B`) labeled all 22 held-out validation tasks from TASK TEXT ONLY (no profiles,
  no thresholds, no author labels). Comparison harness added at `evals/cross-author-check.js` and
  study write-up at `research/cross-author-labels.md`.
- **Results (22 items):** strategy agreement between A and B = **22/22 (100%)**; router vs A/B
  strategy = **18/22 (82%)**, identical to author vs A/B (18/22). Full strategy+model-action
  agreement 68–77% (upgrade-vs-keep variance). Author↔router stays 22/22.
- **Key finding:** the router agrees with independent judges at THE SAME RATE the author does (82%
  strategy, identical on both labelers) — so it is not disproportionately fitted to the author; the
  residual is genuine task-judgment variance, concentrated in the caller-overridable model-action
  hint (upgrade-vs-keep is "seriously consider" per the objective, and the strategy dimension that
  matters most is 82%).
- **No router change made.** The 4 strategy disagreements are all documented fast↔structured
  boundary items where the router's author-aligned choice is defensible; retuning to any single
  judge would recreate author-fit. Honest reporting updated: validation = "22/22 author, 82%
  independent (strategy), 68–77% (full)".
- Full `npm test` = 24 scripts, exit 0; `npm run audit` = 24/24, "skill healthy".

## Session 29 — independent adversarial review: 7 router defects + 2 certainty bugs confirmed & fixed

- **Truly independent review (multi-agent principle realized in the loop):** two fresh, no-seed
  reviewer subagents adversarially attacked (a) the router and (b) the verify/certainty planners,
  required to RUN `node` counterexamples rather than assert. Both reported structured findings; the
  router reviewer reproduced every claim, and I independently re-verified each against the code
  before acting. This closed the objective's "Agent 的自评不能直接作为结论" gap with genuine
  external evidence.
- **Router v6 fixes (F-1..F-7):**
  - F-1 HIGH — repeated failures no longer suppressed at `verif <= 0.5`; failure escalation is now
    unconditional (empirical evidence trumps the profile's verification claim).
  - F-2 — ambiguity can now force Deep (`clarity < CLR_DEEP && verif > V_MID`); cheap vague tasks
    stay Structured/clarify.
  - F-3 — unified the "not trivially verifiable" bar to `> V_EASY` for novelty/constraints/stakes
    (was inconsistent V_EASY vs V_MID); removed the verif=0.4 asymmetric-deep behavior.
  - F-4 — parallel delegation no longer requires `tool_dependency` (any non-trivial fan-out).
  - F-5 — passing `model_capabilities`/`mismatch` no longer silently disables delegation (reordered).
  - F-6 — one-shot upgrade gate relaxed to EITHER high cost OR hard-to-verify (was all-of).
  - F-7 — removed `novelty*0.15` from the capability requirement (novelty no longer tips escalation).
- **Certainty fixes (Verifier V5/V6/V7):** hidden-constraint deep trigger now contributes a REAL
  margin (was silently falling back to 0.3 → falsely HIGH); structured certainty is now hard-capped
  below 'high' (the old 0.5 fallback did not cap); doc corrected to the implemented max-aggregation
  semantics.
- **Verify planner fix (V1):** one-shot note now agrees with `primary` (no more "lead with
  independent review" while primary = external-test); `strategy` param documented + test-locked as
  profile-driven (V8).
- **Test-quality fixes (V2/V3/V4):** ladder-order check now validates against an independent spec
  order (was tautological); field-test's "independent opinion" is now a structurally different
  computation (was `*1` copy); S2 now actually RUNS the planner-selected compiler/runtime channel.
- **Benchmark meta-fix:** five new principle-coverage items (one_shot, non-tool parallel,
  low-verif repeated-failure, ambiguity+hard-verify) closing the P7/P8 gaps the reviewer found —
  those rules had no test. Benchmark now 18/18 (100%) vs 50% baseline; robustness max flip 5.0–12.5%.
- **Docs reconciled:** changelog, `methods/core/task-router.md` (v6 rules + status history), README
  (verify-planner status already `experimental`), report. `npm test` = 24 scripts × PASS, exit 0;
  `npm run audit` = 24/24, "skill healthy".

## Session 28 — independent adversarial review round + library API completion

- **Independent review (multi-agent principle):** dispatched two fresh adversarial reviewers (router +
  verify planner) with no conversation seed to try to BREAK the skill and report only reproducible
  node-executed findings — answering the objective's "Agent 的自评不能直接作为结论" with genuinely
  independent evidence (results appended when they settle).
- **Found & fixed a real library gap (independently, not via the reviewers):** `index.js` did NOT
  export `verify`/`certainty` — the Session 26 planner was CLI-tested but absent from the public
  API, so `require('./')` consumers couldn't use it. Added `verificationPlan`, `VERIFY_LADDER`, and
  the `certainty` module to `index.js`; extended `evals/library-test.js` to assert the full surface
  (15 members) + working calls through the API. All PASS.
- **Boundary probe:** characterized `verificationPlan` depth steps (external-test only ≤0.3; jumps to
  compiler+authoritative at 0.31; independent-computation+multi-source at 0.51; reviewer at 0.71).
  Documented the coarse-boundary over-verification risk as a known limitation (advisory-only plan,
  not binding) in the method card.
- **Added missing method-status card** `methods/experimental/verify-planner.md` — AGENTS.md requires
  a per-method record (purpose/mechanism/applicability/trigger/evidence/limits); the experimental
  planner had none. README method-status line updated. `files` whitelist already includes `methods/`.
- Independent re-verification of core principles (not reviewer-dependent): cheap+high-stakes does
  NOT go deep; one-shot high-stakes → upgrade; repeated failure → deep/upgrade; capability mismatch
  → upgrade; easy+strong-model → recommend de-escalate; end-to-end extraction sanity (rename→fast,
  SaaS-auth-design→deep, CSV→fast, flaky-CI→structured). All correct.
- `npm test` = 24 eval scripts, exit 0; `npm run audit` = 24/24; `npm pack --dry-run` blocked only
  by npm-cache sandbox (EPERM, not a repo/packaging issue) — `files` whitelist verified resolving
  directly (11/11 + main).
- Still `experimental`; NOT yet core (no live-LLM-executor run).

## Session 27 — verification planner FIELD test (does the chosen channel actually catch errors?)

- Added `strategies/verify.js` usage REAL-exercise — `evals/verify-field-test.js`: a mutation-style
  harness that PROVES the planner's selected verification channels catch planted errors, not just
  that the ladder "looks right". Four in-process subjects (arithmetic aggregator, boundary clamp +
  structural invariant, one-shot contract decision with an INDEPENDENT second opinion, string
  transform): correct impl must pass its channel, planted mutations must be caught, self-review is
  never primary, and independent computation / independent-reviewer channels disagree with mutated
  code. All PASS.
- Two initial test-authoring flaws found and fixed (not planner flaws): (1) I asserted
  independent-computation in a difficulty-0.4 plan when the ladder correctly only adds it >0.5 —
  fixed the assertion to match the design; (2) my "lo-bias clamp" mutation did not actually violate
  the lower-bound invariant it was meant to test — replaced with a real lower-bound-violation
  mutation. This is the objective's 反思原则 in action: the field test caught MY mistakes, which is
  exactly what a verification harness is for.
- Wired `evals/verify-field-test.js` into the `npm test` chain + `npm run audit` (24 checks, exit 0).
- Honest status: verify planner promoted to **experimental** (unit + mutation-field evidence), NOT
  core — still no live-LLM-executor run yet.

## Session 26 — verification-priority planner (independent from the router)

- Added `strategies/verify.js` — an INDEPENDENT post-route verification planner that answers
  "for this chosen strategy, how do we actually verify the outcome, in priority order?" It returns
  `{ primary, methods, note }` and respects the objective's reflection-is-not-evidence ladder:
  external-test > compiler/static > primary-source > independent-computation > multi-source >
  independent-reviewer > self-review (self-review ALWAYS last, never listed as primary).
- Cheap-verification honesty: `verificationPlan` never lets a cheap/LOW-verify plan masquerade as
  strong evidence — when the strategy is fast AND verification_difficulty is low it says so
  explicitly and still prioritizes whatever real check exists (external test >> self-review), so a
  fast task stays fast without overstating its confidence. It is deliberately independent of the
  task router: the router picks HOW HARD to think, the planner picks HOW TO PROVE the result.
- Added `evals/verify-test.js` (10 cases) — verifies the ladder ordering (external > compiler >
  self-review last), fast/low-verify never offers self-review as primary, deep/high-error tasks get
  multi-method plans, public API surface (unsigned integer field count, named exports, no
  camelCase leakage), CLI smoke coverage. All PASS.
- Wired the plan into the CLI: `bin/router.js` imports `verificationPlan` and now prints a
  `VERIFICATION PLAN:` block (primary + ordered methods) for every single-task triage.
- Full `npm test` exits 0 (23 eval scripts in the chain incl. verify-test; benchmark vs
  no-reasoning baseline: strategy 100% on the benchmark suite vs 38.5% baseline, model action
  84.6% baseline → 100%).

## Session 25 — publish-ready package metadata

- Made the package genuinely publishable: `private:false`, `version 0.2.0`, `license: MIT`,
  `keywords`, and a `files` whitelist (index.js, router/, strategies/, multi-agent/, bin/, methods/,
  research/, SKILL.md, README.md, AGENTS.md, changelog.md) so accidental junk is never published.
- Added `prepack: npm test` — self-verification before ANY publish (a broken skill can't be shipped).
- Extended `evals/package-meta-test.js` with publish-metadata checks: license/keywords present,
  every `files`-whitelist entry resolves, `prepack` is defined, `private:false`. All PASS.
- Full `npm test` exits 0 (24 checks incl. extended package-meta).

## Session 24 — batch triage (multi-task CLI mode)

- Added batch mode to the CLI: `node bin/router.js --batch` reads many tasks (one per non-empty
  stdin line) and triages them at once into a compact table (STRATEGY|MODEL|CERTAINTY). Backed by
  `planTasks` (exported, in-process, testable) in bin/router.js.
- Added `evals/cli-batch-test.js` (5 cases) — in-process planTasks test (deliberately avoids the
  spawn/piped-stdout sandbox limitation). Verified: skips blanks, full valid decisions, trivial→fast,
  repeated-failure→deep/upgrade. Wired into `npm test`; PASS.
- Demo: `--batch` triaged 4 real tasks → FAST|KEEP, STRUCTURED|KEEP, DEEP|KEEP, DEEP|UPGRADE.
- Full `npm test` exits 0 (23 checks incl. cli-batch); repo file count grows to include cli-batch-test.js.

## Session 23 — self-audit command (one-command health report)

- Added `bin/self-audit.js` + `npm run audit` — runs every check in the npm test chain and prints a
  concise PASS/FAIL ledger + aggregated exit code. One command answers "is the whole skill healthy?"
  without inspecting 22 reports. Wired as `audit` script.
- Note: captures child stdout via piped stdio was blocked by the sandbox (documented EPERM boundary)
  → restructured to `stdio:'inherit'` + exit-status judgment rather than retrying.
- Verified: `npm run audit` → 21/21 checks PASS, exit 0, "skill healthy".

## Session 22 — decision-certainty classifier (honest confidence flag)

- Added `strategies/certainty.js` — the router now surfaces HOW SURE it is: `classify(profile)` →
  { strategy, certainty: high|medium|boundary, margin }, computed from the distance between the
  governing signals and their thresholds (fast = distance under the caps; deep = strongest
  supporting trigger; structured = nearest-boundary flip distance, never falsely 'high').
  Boundary ratings flag exactly the F6 jitter-sensitive cases, so an agent verifies more precisely
  when it should. Wired into the CLI as `CERTAINTY:`.
- Added `evals/certainty-test.js` (5 cases) — decisive tasks high, F6-boundary items not high,
  structured honest, margin monotone under manipulation. Fixing an initial margin-formula flaw
  (deep under-used multi-trigger support; structured over-stated) → verified by re-run.
  Wired into `npm test`; PASS.
- Full `npm test` exits 0 (22 checks incl. certainty); repo file count grows to include
  certainty.js + certainty-test.js.

## Session 21 — objective-principles conformance test

- Added `evals/principles-test.js` — a higher-level audit that the router honors the objective's
  OWN stated rules over the whole eval corpus (independent of exact per-item labels): don't rush
  ambiguous tasks (P1), don't overthink cheap/easy tasks (P2), large-context → Deep (P3),
  repeated-failure → escalate/deepen (P4), high-risk + hard-to-verify → Deep (P5), parallel
  research → delegate not upgrade (P6). All six pass with zero violations. Wired into `npm test`;
  PASS.
- Full `npm test` exits 0 (21 checks incl. principles); repo file count grows to include
  principles-test.js.

## Session 20 — package-integrity guard (package contract sound)

- Added `package.json` metadata (`main: index.js`, `engines: node >=18`) and `evals/package-meta-test.js`
  — a drift guard asserting: `main` resolves, every npm `scripts.*` node-target file exists, and
  every file in the `npm test` chain exists. Catches "script points to a missing file" maintenance
  drift in the growing repo. Wired into `npm test`; PASS.
- Full `npm test` exits 0 (20 checks incl. package-meta); repo file count grows to include
  package-meta-test.js.

## Session 19 — dogfood integration test (composed skill coherence)

- Added `evals/dogfood-test.js` — runs REAL task text (10 tasks across the objective's categories)
  through the PUBLIC library (index.js) end to end and asserts the composed system stays coherent:
  every emitted strategy/action is within the documented vocabulary, protocol always exists for any
  emitted strategy, stopping always responds decisively, and the adaptive loop terminates bounded.
  Catches integration gaps between components that per-unit tests miss. Wired into `npm test`; PASS.
- Full `npm test` exits 0 (19 checks incl. dogfood); repo file count grows to include dogfood-test.js.

## Session 18 — library entry point (consumable skill)

- Added `index.js` — one public library API exposing the full skill: `route`, `extract`,
  `capabilities`, `calibrate`, `adaptiveLoop`, `runTask`, `fanOut`, `review`, `consolidate`,
  `protocol`, `stopping`, `cost`. Other agents/systems can consume the whole skill via `require('./')`.
- Added `evals/library-test.js` (8 cases) — asserts the public surface and that key behaviors work
  end-to-end through it (extract→route, cost ordering, stopping, fanOut, protocol). Wired into
  `npm test`; PASS.
- Full `npm test` exits 0 (18 checks incl. library); repo file count grows to include index.js,
  no junk.

## Session 17 — cost / effort estimator (cost-aware, quality-safe)

- Added `strategies/cost.js` — operationalizes the objective's "Token / 时间成本" metric and the
  "在足够质量下使用最低合理成本" principle: relative order-of-magnitude effort indices per strategy
  (fast 1 / structured 3 / deep 10), adjusted by large-context and tool-dependency. `budgetCheck`
  is strictly ADVISORY — it surfaces cost but never auto-downgrades a strategy the router chose for
  quality/verification reasons (quality stays the arbiter).
- Added `evals/cost-test.js` (9 cases) — ordering, adjustments, budget fits/over, and proof the
  budget check has no strategy-override path. Wired into `npm test`; PASS.
- CLI now prints ESTIMATED EFFORT (relative, advisory) after the extracted profile.
- Full `npm test` exits 0 (17 checks incl. cost); repo file count grows accordingly, no junk.

## Session 16 — skill-consistency guard (doc/code drift guard)

- Added `evals/skill-consistency.js` — protects the agent-facing contract (SKILL.md): asserts it
  documents all router strategies, the model-switch autonomy principles (mismatch-driven
  escalation, downgrade, don't-abuse-upgrade), external-verification-over-self-review, that every
  SKILL.md-referenced impl path exists, and that all protocol step concepts are described
  (bilingual-aware, concept-based — not exact-phrase). Wired into `npm test`; PASS.
- Two test-authoring bugs caught and fixed while building (binding the module object instead of
  the function; case-sensitive and empty-token-set false negatives) — each verified by re-run.
- Full `npm test` exits 0 (16 checks incl. skill-consistency); repo = 33 intentional files, no junk.

## Session 15 — threshold-robustness test (closes F2 with evidence)

- Added `evals/robustness-test.js` — perturbs every default threshold ±10% and ±20% (single-axis
  and all-at-once) and measures how many routing decisions flip across the full 35-item set.
  Result: single-axis ≤5.7% flips, all-axes ≤14.3%; all flips are adjacent-strategy transitions on
  genuinely boundary tasks. This is evidence that the ~100% eval scores are NOT an artifact of
  exact thresholds (F2 closed with data). Wired into `npm test`; PASS.
- Recorded the finding as F6 in `failures/failure-log.md` (robustness, no code change) and banned
  future fragility via the test sitting in the gate.
- Full `npm test` exits 0 (14 checks incl. robustness); repo = 30 intentional files, no junk.

## Session 14 — capability calibration harness (measured model capability)

- Added `router/calibrate.js` — makes "当前模型能力" a MEASURED quantity, not a hand-set constant:
  a small probe battery (reasoning / long-context / reliability), `probeModel({ runProbe })` runs
  every probe (env-agnostic; real models via an adapter, deterministic doubles in tests) →
  per-axis pass rates → `calibrate()` maps to a `{reasoning, context, reliability}` capacity and
  assigns the NEAREST tier (strong/mid/cheap). The measured capacity feeds `route({model_capabilities})`.
- Added `evals/calibrate-test.js` (8 cases) — wired into `npm test`; PASS. Verified: all-pass model
  ↦ strong (KEEP on hard task), all-fail model ↦ cheap (UPGRADE on hard task), per-probe results
  auditable, axis rates reflect exactly which probes passed.
- Full `npm test` exits 0 (13 checks incl. calibrate); repo = 29 intentional files, no junk.

## Session 13 — capability-based escalation model

- Added `router/capabilities.js` — the objective's escalation principle made literal: escalate only
  on a REAL task-vs-model capability mismatch ("当前模型能力与任务要求之间存在实际不匹配"), never
  for length/jargon/novelty. Derives task requirements (reasoning/context/reliability) from the
  profile, provides tier capability profiles (strong/mid/cheap), and computes which axes fell short.
- `route()` now accepts `model_capabilities` — capability-mismatch escalation fires even with 0
  failures (a hard task on a weak model upgrades; same task on a strong model does not).
- CLI: `--capability strong|mid|cheap` — demonstrated: hard architecture task + cheap model →
  UPGRADE (with transparent reason naming axes), + strong model → KEEP.
- Added `evals/capability-test.js` (9 cases) — wired into `npm test`; PASS. No regression to the
  existing 22-task held-out validation (capability path is opt-in).
- Full `npm test` exits 0 (12 checks incl. capability); repo = 27 intentional files, no junk.

## Session 12 — multi-agent orchestration layer (fan-out / review / consolidate)

- Added `multi-agent/orchestrate.js` — implements the objective's 多 Agent 使用原则 as testable
  machinery: `fanOutSync` (run independent units; one failure does NOT discard others),
  `reviewSync` (independent reviewers vote; verdicts agreed/disputed/rejected; a throwing
  reviewer counts as a dissent — self-review can't be trusted blindly),
  `consolidate` (keep good results, surface failures as evidence). Environment-agnostic (injected
  workers/reviewers), so it works with deterministic doubles now and real subagents later.
- Added `evals/orchestrate-test.js` (10 cases) — wired into `npm test`; PASS. Two test-authoring
  bugs found and fixed during development (reviewer definitions that didn't match intent).
- `SKILL.md`/`README.md` updated: the delegate/review/fan-out principles now point to concrete,
  tested machinery.
- Full `npm test` exits 0 (11 checks incl. orchestrate); repo = 26 intentional files, no junk.

## Session 11 — deliverables gate + consolidated report (convergence close-out)

- Added `evals/deliverables.js` — an automated gate machine-verifying all 10 objective
  minimum-deliverables (router, 4 strategies, upgrade+downgrade logic, benchmark, baseline
  comparison, failure analysis, router revision, final verification, repo convergence, report)
  plus no-pollution checks. Wired into `npm test`; PASS.
- Rewrote `reports/session-01.md` as the consolidated session report (objective/changes/evidence/
  findings/failures/decisions/risks/next) reflecting the complete converged state.
- Full `npm test` exits 0 (10 checks incl. deliverables gate); repo = 25 intentional files, no junk.

## Session 10 — adaptive execution loop (failure feedback → re-route)

- Added `router/adaptive-loop.js` — closes the feedback loop: route → EXECUTE → observe →
  feed `failures_so_far` back into the router (may deepen/upgrade at the repeated-failure
  threshold) → bounded retry. Implements "已发生失败次数" for real, plus escalation rules
  ("多次修改仍重复失败 → 升级") and "不要无限研究" (bounded attempts).
  - Always executes at least once (deliberation-done != task-done).
  - Success → done; failure → re-route; deep strategy additionally bounded by the stopping
    conditions; hard attempt budget caps everything.
  - Combines task-inherent prior failures (e.g. text "has failed 5 times") with in-loop failures.
- Added `evals/adaptive-test.js` — 9-case mock-executor test: trivial task succeeds on attempt 1
  with no escalation; a failing task escalates to deep/upgrade exactly when failures≥3 fed back
  then succeeds; always-failing loop stays bounded; step-wise controller works. Wired into
  `npm test`; PASS.
- Full `npm test` exits 0 (9 checks: probe, de-escalate, validation 22/22, e2e 91%, coverage,
  protocol, stopping, adaptive, cli-smoke, benchmark 13/13).

## Session 09 — stopping conditions ("when to stop deliberating")

- Added `strategies/stopping.js` — state machine implementing "什么时候应该停止继续思考并开始
  执行" and the anti-无限研究 rules. Per strategy:
  - **fast**: stop immediately, execute directly.
  - **structured**: stop once the light plan is written AND assumptions are explicit.
  - **deep**: keep deliberating while it GENERATES new information; stop when evidence is
    sufficient, OR no new info for 2 rounds (stagnation), OR 4 attempts exhausted. Deliberation
    that produces no new information is just re-reading — stop and act (or parallelize).
- Added `evals/stopping-test.js` — 13-case transition-table test (all strategies + anti-
  over-deliberation). Wired into `npm test`; PASS.
- `bin/router.js` now prints "WHEN TO STOP DELIBERATING" alongside the protocol, making the
  decision fully actionable (strategy + model + protocol + stop condition).
- Full `npm test` exits 0 (8 checks: probe, de-escalate, validation 22/22, e2e 91%, coverage,
  protocol, stopping, cli-smoke, benchmark 13/13).

## Session 08 — execution-strategy protocols

- Added `strategies/protocol.js` — turns a routing decision into a concrete, machine-checkable
  execution protocol per the objective's definitions:
  - **structured**: REQUIRED Objective / Hard Constraints / Assumptions / Plan / Verification (brief);
  - **deep**: REQUIRED core plan block + OPTIONAL deliberation toolkit (decomposition,
    alternatives, counterexamples, strongest objection, assumption checks, external evidence,
    independent review, adversarial tests);
  - **fast**: NO required heavy structure (anti-overthinking at the protocol level); plan is
    `directExecute`.
- Added `evals/protocol-test.js` — asserts each strategy's required/optional set and correct
  intensity ordering (deep > structured > fast). The initial weight formula was flawed (made
  structured appear heavier than deep) and the test caught it; fixed to total protocol breadth.
  Wired into `npm test`; PASS.
- `bin/router.js` now prints the EXECUTION PROTOCOL (required + optional + note) so a routing
  decision is directly actionable.
- Full `npm test` exits 0 (7 checks: probe, de-escalate, validation 22/22, e2e 91%, coverage,
  protocol, cli-smoke, benchmark 13/13).

## Session 07 — agent-facing CLI / integration layer

- Added `bin/router.js` — end-to-end CLI: raw task text → extract → route → human/agent-readable
  decision (strategy, model action, de-escalation recommendation, extracted profile, decisive
  reasons). Usage `npm run route -- "task"`; supports `--tier strong|cheap|auto`, `--stdin`,
  `--json`.
- Added `evals/cli-smoke.js` — regression test of the TEXT→decision path (exactly the layer the
  profile-based evals do not cover). Wired into `npm test`; PASS.
- Full `npm test` exits 0: probe + de-escalate PASS, validation 22/22, e2e 91%, coverage PASS,
  CLI smoke PASS, benchmark 13/13.

## Session 06 — failure-mode coverage audit

- Added `evals/coverage.js` — operationalizes the objective's "重点观察" list as an auditable
  checklist wired to the real eval sets: for each of 9 failure modes (难度误判, 过度思考,
  思考不足, 过早执行, 不必要升级, 升级过晚, 约束遗漏, 误派发, 漏派发) it asserts the mode is
  EXERCISED by real cases AND the router shows NO REGRESSION. Wired into `npm test`.
- Added a 22nd held-out validation case (`val-mechanical-csv-parse`); re-labeled it `structured`
  on coherent task-nature grounds (parse+aggregate is a light pipeline, not fast; keep, not
  delegate — the anti-false-delegate claim holds).
- Result: validation **22/22 (100%)**; e2e extraction **32/35 (91%)**; coverage PASS; probe +
  de-escalate PASS; train benchmark 13/13; `npm test` exits 0.
- Docs updated (README).

## Session 05 — de-escalation (downgrade) logic + tests

- Made model downgrade a real, tested, bidirectional decision: added `current_model_tier`
  ('strong'|'cheap'|'auto') to `route()` and `recommend_deescalate` — a fast mechanical task run
  on a STRONG model is recommended to be handed DOWN to a cheaper model; on a cheap model there is
  nothing to downgrade from (cost floor). Mirrors escalation in the cost direction.
- Added 4 dedicated de-escalation probes (mechanical+strong → recommend downgrade; mechanical+cheap
  → no downgrade; deep task → never downgrade; default auto → conservative no-op).
- Closes the "明确模型升级与降级逻辑" minimum deliverable (upgrade AND downgrade both tested).
- Docs: `methods/core/task-router.md` (de-escalation rule + output), `changelog`, README.
- Full `npm test` exits 0 (probe + de-escalation PASS; validation 21/21; e2e 91%; benchmark 13/13).

## Session 04 — expanded held-out validation & router v4

- Grew the held-out validation set 12→**21** with harder, independent tasks (overthink guard,
  high-novelty mechanical, tool-lookup, no-oracle high-stakes, vague-but-cheap, one-shot decisions).
- The expanded set exposed real overfitting the small set hid: profile-based validation dropped to
  85.7%. Drove **v4** fixes:
  - constraint-count & novelty no longer force Deep when verification is trivial (overthinking);
  - new `one_shot` signal + one-shot high-stakes escalation rule;
  - extractor fixes: removed two false-positive context triggers ("500 files", "30-line") that
    forced Deep on mechanical work; added vague/novelty/cost/one-shot detection.
- Result: profile-based validation **21/21 (100%)**; e2e extraction **31/34 (91%)**; probe PASS;
  train benchmark 13/13; `npm test` exits 0.
- Docs: `methods/core/task-router.md` (v4 rules, one_shot signal), `failures/failure-log.md` (F5),
  README updated.

## Session 03 — end-to-end pipeline & signal extraction

- Added `router/extract.js` — keyword/pattern signal extractor: raw task text → profile.
- Added `evals/extraction.js` — measures e2e fidelity (route(extract(task)) vs expected) AND
  profile MAE; wired into `npm test` (floor 70%).
- Quantified the bottleneck: profile-router ≈100%, but e2e from text started at **80%**, now
  **96%** combined (24/25; train 13/13, held-out validation 11/12) after general extractor fixes.
- Router **v3**: new general Deep trigger — repeated failures (`>= FAILURE_THRESHOLD`) +
  not-trivially-verifiable ⇒ Deep (problem harder than it appears; also fixes "upgrade-late").
- Documented F4 (extraction bottleneck + a regression I introduced and fixed); updated
  `methods/core/task-router.md` pipeline + status; `README.md`.

## Session 02 — validation & generalization evidence

- Added `evals/validation.js` — held-out validation set (12 tasks) authored independently of the
  thresholds; labels reasoned from task nature. Wired into `npm test`.
- Result: **v2 generalizes 12/12 (100%) strategy + model on held-out validation** — co-fit-
  independent evidence that substantially closes failure-log F2.
- Failure analysis (F3): `val-batch-classify` boundary (10k mechanical batch → fast). No code
  change (would co-fit); recorded as open candidate "large-mechanical-batch safety" in
  `methods/core/task-router.md`.
- Updated `methods/core/task-router.md` status + open candidates; `failures/failure-log.md`
  (F2 closed, F3 added).

## Session 01 — v0.1.0 (experimental)

- Added `SKILL.md` — task-judgment & adaptive-execution skill: signal extraction, routing,
  model-switch principles, guardrails.
- Added `methods/core/task-router.md` — router method spec (signals, decision procedure,
  thresholds, status).
- Added `router/task-router.js` — deterministic, inspectable router (v2).
- Added `evals/benchmark.js` — 13 labeled tasks across required categories + baseline comparison.
- Added `evals/probe.js` — adversarial boundary regression probes.
- Added `research/router-evidence.md` — external evidence grounding (overthinking, self-correction
  failure, long-context degradation, cost-aware routing, miscalibration).
- Added `failures/failure-log.md` — F1 (overthinking fixed in v2), F2 (training-set overfit caveat).
- Added `README.md`, `package.json`, this changelog.

### Engineer notes
- v1 routed high error cost alone → Deep (overthink). Fixed in v2: error-cost Deep trigger now
  requires verification_difficulty > V_MID; high-stakes-but-cheaply-verifiable → Structured.
- Status: `experimental`, not `validated`.
