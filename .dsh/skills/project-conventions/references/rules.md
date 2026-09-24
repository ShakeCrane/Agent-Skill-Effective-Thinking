# Rule records

The operative text of every rule is in [`../SKILL.md`](../SKILL.md). This file holds what would
drown it: the trigger, the action, how to check it, when it yields, and how much evidence stands
behind it.

Read this file when a rule is contested, when two rules collide, when you need to know whether a rule
is the owner's preference or an evidenced default, or when you are adding a rule.

---

## Rule schema

The project proposed `R = (T, C, A, K, V, E)` — Trigger, Context, Action, Constraint, Verification,
Exception. Applied to a real ruleset and checked against how agents are actually instructed, the
honest verdict is: **keep three fields, promote two to tags, and fold two away.**

```
PC-n · class · evidence · status
  Trigger   the moment this rule fires
  Action    what to do, stated positively
  Check     how to tell it was done — a command, an artefact, or the literal `none`
```

| Proposed | Verdict | Why |
|---|---|---|
| **T** Trigger | **keep — the strongest field** | Every official agent-instruction format is built on triggers: a skill loads on its description, `CLAUDE.md` path-scoped rules load on a matching path. Requirements engineering reached the same shape decades earlier — EARS' five patterns are trigger classes. A rule with no trigger is applied everywhere or nowhere. |
| **A** Action | **keep, and state it positively** | Steering by prohibition drags the forbidden behaviour into context and makes it more available. Every rule below says what to do; the prohibitions that survive are the ones that cannot be phrased positively, and they live in the action's own words. |
| **V** Verification | **keep, renamed to Check** | The only field that lets a rule fail. "Verification" invites a prose verdict; "Check" forces a question. Be honest about which kind each one is: a **mechanical** check names a command or an artefact, and a **judgement** check is a yes/no question put to yourself. The mechanical kind is stronger and there are fewer of them here than one would like — most rules in this set are judgement checks, and saying so is more useful than implying otherwise. Where nothing can be checked at all, write `none`, so the rule is *visibly* unfalsifiable rather than quietly so. |
| **C** Context | **fold into T** | No official instruction format has a context field, and on this ruleset it never said anything the trigger did not. Scope is either the trigger restated or a document-wide constant. It cost a line per rule and bought nothing. |
| **K** Constraint | **fold into `class`** | The strength of a prohibition is what matters, and that is one tag, not a paragraph. The *number* of hard constraints is the axis along which compliance is measured to fall, so constraint prose is a cost, not a feature. |
| **E** Exception | **fold into T** | An exception is a narrower trigger, not a caveat: "when X, do Y — except when Z" is "when X and not Z, do Y". The three rules below that genuinely yield say so inside their trigger, which removes a field and removes the chance of reading the exception without the rule. |
| — | **class** (promoted from K) | `HARD` · `DEFAULT` · `WHEN` · `PREFERENCE` · `HYPOTHESIS`. Without it, an owner's preference and a hard constraint read identically. |
| — | **status** (new) | `candidate` · `active` · `deprecated` (+ the id that replaced it). Rule sets rot; a deprecation pointer is how they rot visibly instead of silently. |
| — | **evidence** (new) | `strong` · `moderate` · `weak` · `none`. Without it, a convention borrows the authority of a measurement. |

**Honest label on the schema itself.** Its measured benefit is **reviewability and budgeting, not
compliance**. No retrieved source shows that a three-field rule is obeyed more often than a six-field
one. What the reduction buys is that a rule can be reviewed for falsifiability and counted against a
budget. Claiming more would be exactly the failure this file's evidence column exists to prevent.

**What the reduction does *not* buy.** The measured limit is not "rules per document" but
**constraints per instruction**: on FollowBench, hard-constraint satisfaction falls from 84.7% at one
constraint to 61.9% at five for GPT-4, and the paper puts the practical ceiling at roughly three
constraints for closed models and two for open ones. A 19-rule document is far past that if it is
read as one instruction — which is why the rules are **gate-triggered**: at any moment a working
agent is inside one gate and attending to two to four rules, not nineteen. The gate structure is
load-bearing, not decoration. **That claim is a design argument, not a measurement** — this skill's
own behavioural evaluation hit a ceiling and could not test it (see `evidence.md`, open question 4).

**Budgets this document respects** (`official docs`): a skill body should stay under 500 lines /
5k tokens; a `CLAUDE.md` should target under 200 lines, because "longer files consume more context
and reduce adherence". `SKILL.md` sits well inside both.

**Class vocabulary** — `HARD` (never violated; safety and irreversibility only) · `DEFAULT` (do it
unless you can state a reason not to) · `WHEN` (only under its condition) · `PREFERENCE` (the owner's
declared choice; beats `DEFAULT`/`WHEN`, never `HARD`) · `HYPOTHESIS` (recorded for observation, **not
enforced**).

**Evidence vocabulary** — `strong` (normative or measured, reproduced across sources) · `moderate`
(a primary source on point, or one measured effect with caveats) · `weak` (inferential or framing
support) · `none` (no source: the owner's convention, or a design choice). What each rests on, and
what is *not* known, is in [`evidence.md`](evidence.md). A rule at `evidence: none` must never be
defended as if it had some.

---

## Shared definitions

**Project-understanding document** (used by PC-2). The repository document whose stated job is to
explain the project to someone who has not read it: normally `README.md`, or a dedicated file
(`PROJECT.md`, `CONTEXT.md`, `ARCHITECTURE.md`) when one exists. Choose exactly one and name it in the
project's own `AGENTS.md` or equivalent, so the rule has a single target. If the project has none and
its structure is non-obvious, write the smallest file that carries the structure map and say where it
is. Do not add a second one beside a document that already does the job.

**Release point.** The immutable name of a shipped state: an annotated tag on a commit that passed the
project's checks. Distinct from a *release record* (notes, assets, a changelog entry), which may be
edited; the tag may not.

**Scratch artifact.** Any file whose value ends with the task that produced it: temp scripts, probe
output, debug dumps, generated logs, one-off reports, downloaded fixtures. If you would not defend it
in review, it is scratch.

---

## Gate 1 — Placement

### PC-1 · DEFAULT · evidence: weak · status: active
- **Trigger** — you are about to create a file.
- **Action** — place it in the deepest existing directory whose single responsibility covers it, and
  every sibling shares that responsibility. Add a top-level directory only when the file introduces a
  new function of the project.
- **Check** — can you state the target directory's responsibility in one phrase, and name its
  siblings as sharing it? If no existing directory fits without mixing two jobs, the new one is
  justified; otherwise it is not.
- **Yields to** — a project that organises by layer or by type and says so; a layout a tool requires.

### PC-2 · DEFAULT · evidence: weak · status: active
- **Trigger** — a directory is added, removed, renamed, or its responsibility changes.
- **Action** — update the structure map in the project-understanding document in the same change.
- **Check** — every directory named in the map exists, and every top-level directory appears in the
  map. Both halves matter: a map that omits a real directory is as wrong as one that invents a
  missing one.
- **Yields to** — a scratch directory the project already ignores need not be mapped; an *intended*
  future structure may be shown if it is labelled as intended.

### PC-3 · WHEN · evidence: weak · status: active
- **Trigger** — you are about to split a module, or introduce an abstraction, interface, layer, or
  configuration point.
- **Action** — name the seam before you cut: the two responsibilities for a split, the second caller
  or second implementation for an abstraction. Split on that seam; write the abstraction once you can
  name its second user.
- **Check** — can you describe each resulting module's job without using "and"? Can you name two
  concrete users of the abstraction today?
- **Yields to** — a boundary that exists for testability or a required plugin seam, which is justified
  by the requirement rather than by a second caller. Line count, file size, and "it feels long" are
  never the reason.

## Gate 2 — Cleanup

### PC-4 · HARD · evidence: strong · status: active
- **Trigger** — you are about to delete or overwrite any file.
- **Action** — delete what you created in this task, and what the project's own documentation declares
  disposable (build output, caches, generated artifacts). Everything else you report and leave in
  place. One narrow third limb: an artefact that is **empty** and that the project's own records
  already identify as an accidental by-product may be removed — and the removal is stated.
- **Check** — for each removal, point to its creation in this task, or to the document that calls it
  disposable, or to both its emptiness and a record naming it an accident. If none of the three holds,
  it stays.
- **Yields to** — the ambiguity is resolved in advance, in favour of the file, and that is the whole
  point: the rule trades a small amount of tidiness for the guarantee that nothing irreplaceable is
  destroyed by an agent that was being helpful. The evidence is not about carelessness — three primary
  postmortems destroyed production data with no destructive intent (see `evidence.md`).
- **Margin note — an earlier draft of this rule overclaimed.** It said "no trade-off available" while
  the same session deleted a zero-byte `nul` file that a *different* run had created and that no
  project document declares disposable: neither of the two original limbs covered it. Rather than
  pretend the exception did not exist, the third limb was added and the "no trade-off" claim was
  dropped. A rule whose justification does not cover its own first application is not a rule; it is an
  aspiration with a citation.
- **In this repository** — 27 nested `.git` directories sat inside the untracked run archive, so
  `git clean`'s second `-f` was live here.

### PC-5 · DEFAULT · evidence: weak · status: active
- **Trigger** — you are about to create a temporary, generated, or debug file; again when a unit of
  work is finishing; and again when you notice accumulated untracked material you did not create, or
  the owner asks for a tidy-up.
- **Action** — write scratch outside the repository or under a path the project already ignores. Then
  list the untracked and modified files, classify each as keep, ignore, or remove, and say which.
- **Check** — `git status --porcelain --untracked-files=all` lists only files you can name and
  justify. An unclassified leftover is what becomes permanent.
- **Yields to** — a tool that requires a path inside the tree: use an ignored path and say so.
  `git add -A` is never a substitute for the classification. On accumulation you did not create, the
  deliverable of this rule is the classification and the report — PC-4 still decides what may actually
  be removed, and an owner's "tidy up" is an instruction rather than an authorisation to skip that.
- **Why the third trigger exists** — the repository this skill was written in had 2,179 untracked
  entries at audit time, accumulated by a run that had itself decided to keep its working tree clean.
  A per-task rule alone would not have caught that; the owner's requirement was periodic cleanup, and
  the check is the same one either way.

## Gate 3 — Code

### PC-6 · DEFAULT · evidence: weak · status: active
- **Trigger** — you create a module, or a function whose contract a caller could misread from its name
  and signature; and again when you are about to write a comment.
- **Action** — state at the top what the unit is responsible for, in one sentence. Comment the **why**
  — the non-obvious constraint, the reason for this shape, the trap the next editor will fall into.
- **Check** — could a reader who has not seen the body say what this unit is for, and what it is not?
  For each comment: would removing it leave that reader worse off? If not, remove it.
- **Yields to** — a self-evident private helper needs no header; a public API's contract (parameters,
  returns, errors) belongs in the comment even when it repeats the signature, because that is
  documentation rather than narration.

### PC-7 · HARD · evidence: strong · status: active
- **Trigger** — your change makes a nearby comment, docstring, or structure-map line untrue.
- **Action** — correct it in the same change.
- **Check** — every comment your diff touches or travels past is still true of the code beneath it.
- **Yields to** — a frozen historical record. A changelog entry or a dated report describes the state
  at its date and must **not** be rewritten to match today. This exemption is narrow: it covers records
  whose date is part of their meaning, not "a document I would rather not update". Softening a comment
  into vagueness is not a correction.
- **Why strong** — staleness is the best-evidenced failure mode in this whole ruleset: 74.6% of
  outdated comments are machine-detectable, most of more than 3,000 sampled GitHub projects contain at
  least one outdated code-element reference at some point in their history, and comment-code
  divergence is measured to hinder comprehension. Most of these are detectable by exactly the check
  above — reading the comment against the code — which is why the rule is enforceable rather than
  aspirational.

## Gate 4 — Release

### PC-8 · HARD · evidence: strong · status: active
- **Trigger** — before you change any version number, or describe what one means.
- **Action** — establish and record the mode. **(A) SemVer-bound**: the project declares a public API
  and claims SemVer compliance, so the specification's digit rules bind. **(B) house scheme**: the
  number is an ordered identifier and no compatibility semantics are claimed. At `0.y.z`, no
  compatibility is promised either way — say so rather than letting a reader assume it.
- **Check** — can you point to where the project states its mode, and its public API if it claims one?
  If not, the mode is undeclared: declare it, or ask (PC-17) before bumping.
- **Yields to** — nothing. Every other release rule depends on this one; under an undeclared mode a
  bump is arbitrary, which is how projects end up at `0.x` forever while calling themselves SemVer.

### PC-9 · HARD · evidence: strong · status: active
- **Trigger** — mode A, and you are choosing the digit.
- **Action** — backward-incompatible public-API change → MAJOR. Backward-compatible addition or
  deprecation → MINOR, with PATCH reset to 0. Backward-compatible bug fix → PATCH.
- **Check** — name the public-API change and say whether an existing consumer can break on it.
- **Yields to** — the deprecation ordering: deprecation ships in a MINOR and removal only in a later
  MAJOR. Size never picks the digit; a long, purely additive feature is a MINOR, and bumping MAJOR for
  it is a false breaking-change alarm that pushes consumers through migration the spec says is
  unnecessary.

### PC-10 · PREFERENCE · evidence: none · status: active
- **Trigger** — mode B, and you are choosing the digit.
- **Action** — apply the owner's scheme: major features and major refactors → MAJOR; functional or
  structural change → MINOR; documentation and small tasks → PATCH.
- **Check** — is the mode declaration of PC-8 present, and does it state that the number carries no
  compatibility guarantee?
- **Yields to** — PC-11 unconditionally. This rule carries **no supporting evidence**: it is the
  owner's stated convention. It is recorded because the owner asked for it, and it is safe only
  because PC-8 forces it to be labelled as not-SemVer rather than passed off as one.

### PC-11 · HARD · evidence: strong · status: active
- **Trigger** — a release contains any change a consumer could break on.
- **Action** — treat it as incompatible regardless of how small the diff is.
- **Check** — name every consumer-visible surface the release touches. One removed export, config key,
  default, or code path is enough.
- **Yields to** — nothing. "It was only one parameter" is the shape of the most dangerous release
  there is: a breaking change shipped under a PATCH, silently delivered to every consumer whose
  range allows it.

### PC-12 · HARD · evidence: strong · status: active
- **Trigger** — a version has been released, or a tag published.
- **Action** — fix forward. A bad release gets a new version.
- **Check** — does the tag still resolve to the commit it named when it was published?
- **Yields to** — an unpushed, unpublished tag in your own working copy, which may be corrected if you
  say explicitly that you did. Git treats re-pointing a published tag as a trust failure, not a
  nicety: every dependency range naming the old tag becomes a lie.

### PC-13 · DEFAULT · evidence: moderate · status: active
- **Trigger** — you are about to commit.
- **Action** — one logical change per commit, following the message convention the project already
  uses.
- **Check** — can the commit be described by a single type, and reverted without collateral damage?
- **Yields to** — a mechanical mass edit (rename, format, move), which may be one commit even when it
  touches many files; say what it is. A commit mixing unrelated changes cannot be classified,
  reviewed, or reverted on its own.

### PC-14 · DEFAULT · evidence: moderate · status: active
- **Trigger** — you are cutting a release.
- **Action** — an annotated tag on a commit that passed the project's checks, with the release
  contents enumerable afterwards.
- **Check** — does the tag carry a message, a tagger and a date, and can you list what the release
  contains? A lightweight tag is ignored by default by tooling such as `git describe`.
- **Yields to** — a private, temporary marker, which is a lightweight tag by definition and is not a
  release. Do not tag a commit you have not verified.

### PC-15 · HARD · evidence: strong · status: active
- **Trigger** — you need to undo something already published or shared.
- **Action** — start from a clean worktree. Use `git revert`; revert the constituent commits of a
  merge, never the merge commit; record **why** in the revert message; then run a real check.
- **Check** — is the tree clean before you start, does the revert commit say why, and does the
  reverted state pass the project's checks afterwards?
- **Yields to** — unpublished local work, which may be reset instead; that is not a rollback. Never
  `git reset` published history, and never treat a zero exit code as evidence: a merge revert
  permanently declares that side of the merge unwanted, and later merges will not bring those changes
  back.

### PC-16 · HARD · evidence: moderate · status: active
- **Trigger** — someone asks whether the project can be rolled back, or you are about to claim
  recoverability.
- **Action** — point at the concrete recovery point: a tag, a release record, a known-good commit.
- **Check** — can you name the exact commit you would return to, and does it resolve?
- **Yields to** — nothing. The version number is not a recovery point. Rollback is a property of the
  repository — immutable tags, revertible commits, a build that can be reproduced — and never a
  property of the numbering scheme. If there is no recovery point, that *is* the finding: report it.

## Gate 5 — Handoff

### PC-17 · DEFAULT · evidence: moderate · status: active
- **Trigger** — you are unsure whether to ask the user or proceed; before asking about a name, a
  convention, or a preference; and when you are stuck on a technical question the project does not
  answer.
- **Action** — look for the project's existing answer first: `AGENTS.md`/`CONTRIBUTING`, config, tests,
  sibling code, git history. If the project cannot settle it, **find a reliable external answer** — the
  tool's own documentation, its `--help`, its source — before asking or guessing. Then ask only when
  all three hold: the answer changes the **deliverable**; neither the repository nor a reliable source
  settles it; and guessing wrong is expensive or hard to undo. Otherwise decide, and flag the
  assumption in one line.
- **Check** — can you name which deliverable output changes depending on the answer, why the repository
  and the external sources could not answer it, and where you looked?
- **Yields to** — irreversible, safety-relevant, or externally visible choices, which are always asked.
  Read the direction of the known failure carefully: the measured default is **under-asking**, not
  over-asking — models "rarely ask users to clarify ambiguous questions and instead provide incorrect
  answers", and in a 1,642-trace multi-agent taxonomy the "failed to ask for clarification" mode
  appears while no over-asking mode does. This rule exists to make the question *targeted*, not rare.
  "Important" is not one of the three conditions; it is the word they replace.
- **Names, labels, and user-visible strings — a deliberate carve-out.** The owner's requirement was
  "do not presume to guess on naming, preference, or detail; check the existing convention first".
  Read against the three conditions, a name the repository does not settle would otherwise be decided
  silently, which is the exact behaviour the requirement forbids. The resolution is: follow the
  project's vocabulary where it has one; where it does not, **decide and state which name you chose and
  why** — the opposite of a silent guess. It escalates to a question when the name is externally
  visible or expensive to change later. This is a documented narrowing of the requirement, not an
  accidental one: the raw requirement ("ask on important, unresolvable matters") has no operational
  test for "important", and a rule with no test is the failure this whole file exists to prevent.

### PC-18 · PREFERENCE · evidence: none · status: active
- **Trigger** — a meaningful unit of work finishes, or you call a tool whose effect the user must know
  about: a write, a deletion, a publish, a paid call, a permission change.
- **Action** — say what happened, the evidence for it, and any risk, in plain language.
- **Check** — could the user act on this message without asking a follow-up?
- **Yields to** — nothing, but note the tension this rule creates and the evidence behind it: no source
  retrieved measures progress narration at all, and length is a *named bias* in model judges — longer
  output is rewarded independently of quality. So: no play-by-play, no restating your plan, no
  narrating a search you are about to run. This is the owner's preference and carries **no supporting
  evidence**; it is recorded as a choice, not defended as a finding.

### PC-19 · HARD · evidence: strong · status: active
- **Trigger** — you are about to state something about the project's state, or report work as complete.
- **Action** — attach either a label — `confirmed` / `likely` / `inferred` / `unknown` — or the check
  you actually ran, named.
- **Check** — does each claim carry a label or a check? Can you name the command, the run, or the
  source behind it?
- **Yields to** — everyday description of what you just did, which needs no label; claims about the
  project's state do. Written, saved, generated and commanded are not done. "The output looks right"
  is not a check. Prefer a real run over a re-reading: intrinsic self-correction without external
  feedback is measured to fail and at times to *degrade* performance, and a tool-grounded critique is
  where the improvement comes from — so the check has to touch something outside your own reasoning.

---

## Adding a rule

The owner sends new material in ordinary language: a fact, an experience, a preference, a constraint,
a failure case, a technical correction. **Do not append it.** Run this gate in order, and stop as soon
as a step rejects it.

1. **Classify.** A hard constraint, a default, a conditional heuristic, a preference, a hypothesis, or
   a failure-diagnostic ("if you see X, suspect Y")? A misclassified rule is worse than a missing one.
2. **Search for an existing rule that already covers it.** If one does, edit *that* rule — sharpen the
   trigger, tighten the check — instead of adding a second. Two rules covering one behaviour will
   diverge.
3. **Check conflicts.** Compare it against every rule whose trigger overlaps. Resolve by the precedence
   order in `SKILL.md` and write the resolution into the affected rule's trigger ("yields to"). An
   unresolved conflict is a bug in the skill: vendor documentation is explicit that when two rules
   contradict, the model may pick one arbitrarily.
4. **Assign evidence honestly.** `strong` / `moderate` / `weak` / `none`. A preference the owner stated
   is legitimate — labelled `PREFERENCE · evidence: none`, never described as validated. If the claim
   is widely repeated but you could not reach the source, it is `none`, and it belongs in
   `evidence.md`'s unverified list.
5. **Decide whether it changes a decision.** If you cannot write a check that could fail, it is not a
   rule yet. Record it as a `HYPOTHESIS`, observe it, and promote or discard it later.
6. **Ask, if it is load-bearing.** A rule that will change how every future change is made, and whose
   intent you are inferring rather than quoting, goes to the user (PC-17) before it is written.
7. **Give it an id, and make the entry earn its place.** Add the record here, add the operative line to
   `SKILL.md`, and run `npm run test:project-conventions`. It fails if the two files disagree about the
   id set, the class, or the evidence level.
8. **Consolidate before you finish.** Look for a rule this one makes redundant and delete it — mark the
   removal `deprecated` with a `replaced-by` id rather than removing it silently. A skill that only
   grows stops being read, and the measured constraint ceiling is the reason that matters.

### Lifecycle

`candidate` → `active` → `deprecated`. New rules enter at `candidate` and are observed before they are
enforced. A rule is promoted to `active` when a check for it exists and has been run at least once.
There is no automatic retirement in any rule system examined — deprecation is always a deliberate act,
which is why step 8 is a step and not a hope.

### Ledger

| id | class | evidence | gate | fires on |
|---|---|---|---|---|
| PC-1 | DEFAULT | weak | Placement | creating a file |
| PC-2 | DEFAULT | weak | Placement | structure changed |
| PC-3 | WHEN | weak | Placement | splitting a module / adding an abstraction |
| PC-4 | HARD | strong | Cleanup | deleting or overwriting a file |
| PC-5 | DEFAULT | weak | Cleanup | creating scratch / finishing work |
| PC-6 | DEFAULT | weak | Code | new module or non-obvious function / writing a comment |
| PC-7 | HARD | strong | Code | a change falsifies a comment |
| PC-8 | HARD | strong | Release | before touching a version |
| PC-9 | HARD | strong | Release | mode A digit choice |
| PC-10 | PREFERENCE | none | Release | mode B digit choice |
| PC-11 | HARD | strong | Release | a breaking change in the release |
| PC-12 | HARD | strong | Release | a released version or tag |
| PC-13 | DEFAULT | moderate | Release | committing |
| PC-14 | DEFAULT | moderate | Release | cutting a release |
| PC-15 | HARD | strong | Release | undoing published work |
| PC-16 | HARD | moderate | Release | claiming recoverability |
| PC-17 | DEFAULT | moderate | Handoff | unsure whether to ask / about to ask |
| PC-18 | PREFERENCE | none | Handoff | unit of work finishes / significant tool call |
| PC-19 | HARD | strong | Handoff | stating project state / reporting completion |

Precedence across gates, when they fire at once: **safety first, and that tier contains every `HARD`
rule justified by irreversibility** — PC-4 above all, then PC-15, PC-16 and PC-19, all of which outrank
an explicit user instruction for the reason given in `SKILL.md`. After that: the project's own rules,
then the user's instruction, then this skill's remaining `HARD` rules, then `PREFERENCE`, then
`DEFAULT`, then `WHEN`.

This ordering was wrong in the first draft, and the fix is worth recording. The draft listed "user
instruction" above "this skill's `HARD` rules", which — read literally — made conflict-01 resolve the
opposite way from the one the conflict table claims: "delete anything unused" would have outranked
PC-4. The contradiction was found by walking the precedence list against the conflict table rather
than by reading either alone. A precedence order that contradicts the document's own worked example is
worse than no order, because it is trusted.

### Rules deliberately not written

Recorded so they are not rediscovered and added by accident. Each is plausible, widely repeated, and
**not verified**:

- **"Read `AGENTS.md` before acting."** A reported but never-retrieved evaluation suggests a context
  file can reduce success and raise cost. Until that is settled, the behaviour stays out rather than
  being asserted — adding it would be exactly the unevidenced-rule failure this file guards against.
- **"Budget tool calls / tokens."** No source retrieved. Any number would be invented.
- **"Aim to deploy more often."** Speed and stability are reported as correlated rather than traded
  off, but the same source warns that making deployment frequency a *goal* invites gaming it — and the
  numeric thresholds were not retrieved. Releasing more often is not a rule here.
- **"Comment every function."** Contradicted by PC-6's removal test.
- **"Always ask before a destructive action."** Subsumed by PC-4's absolute form, which needs no
  threshold and cannot be gamed by calling something small.
- **"Never refactor."** Not supported either: PC-3 permits a split as soon as a seam can be named.
- **"Report technical-debt numbers."** Tool disagreement is measured and the authors say it "limits the
  credibility and applicability" of single-tool findings, so a debt *number* is a heuristic, not a
  measurement. Rather than encode a quantification rule, this skill encodes no debt metric at all —
  outside its four rule groups, and a rule that only produces a number changes no decision.
- **"Keep comments dense" / "comment every function".** Not merely unsupported but pointed the other
  way: in three open-source systems, well-commented modules were measured 2–8× *more* frequently
  faulty. That is a correlation best explained by complexity attracting comments, so the honest rule is
  the one already present — comment the why, and never treat comment volume as a quality signal.
- **Numeric cohesion or coupling thresholds.** Size confounds the object-oriented metric literature
  badly enough that a later study questioned the earlier validations outright. No threshold is encoded.
