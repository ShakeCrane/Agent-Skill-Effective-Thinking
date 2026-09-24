---
name: project-conventions
description: "Stewardship rules for developing a project: where new files and folders belong, cleaning up scratch artifacts, keeping the structure document true, module responsibility and comments, commit/version/tag/rollback decisions, and when to ask the user rather than guess. Use when adding, moving, or deleting files or directories, when restructuring code, when committing, bumping a version, tagging or releasing, or when deciding whether to ask the user."
---

# Project Conventions

One job: **leave the project in a better state than you found it, every time you touch it.**

Everything below is that job at the five moments where project work usually degrades a repository:
placement, cleanup, code, release, handoff.

Four properties are worth protecting, in this order when they compete:
**safety** (nothing irreplaceable is lost) → **recoverability** (any past state can be reached again)
→ **comprehensibility** (the next reader can tell what is where and why) → **tidiness**.

---

## How to use this

Rules are numbered `PC-n`, and every one is **triggered**: it fires at a specific moment, not
continuously. Work normally; when you reach a gate, read that gate. At any moment two to four rules
apply, not nineteen.

Each rule carries a **class** and a **check**:

| Class | Meaning |
|---|---|
| `HARD` | Not traded away for convenience, tidiness, or time. Every `HARD` rule is justified, and the justification is recorded. It still yields to tiers 1–3 of the precedence order below: *never* means "never traded away silently", not "outranks an explicit instruction". |
| `DEFAULT` | Do this unless you can state a reason not to. |
| `WHEN` | Applies only when its condition holds. |
| `PREFERENCE` | The project owner's declared choice. Beats `DEFAULT`/`WHEN`, never `HARD`. |
| `HYPOTHESIS` | Recorded for observation. **Not enforced.** |

There are two kinds of check, and the difference is visible in the record. A **mechanical** check names
a command or an artefact you can run or open — those are the strongest and there are fewer of them than
one would like. A **judgement** check is a question with a yes/no answer that you put to yourself; it is
weaker, and it is honest about being weaker. Where nothing can be checked at all, the record says
`none`. Never report a check you did not run.

The full records — trigger, action, check, what each rule yields to, and its evidence level — are in
[`references/rules.md`](references/rules.md). What is actually evidenced, and what is only the owner's
convention, is in [`references/evidence.md`](references/evidence.md).

**Precedence when rules collide.** Highest wins:

1. **Safety** — never destroy something you cannot restore. This tier includes every `HARD` rule whose
   justification is irreversibility, so those rules outrank a user instruction: "clean up the repo,
   delete anything unused" is an instruction, and it still loses to PC-4. A user can authorise a
   deletion, but the ambiguity has to be resolved first — not waved through by the instruction that
   created it.
2. The target project's own documented rules (`AGENTS.md`, `CONTRIBUTING`, release policy, CI).
3. An explicit instruction from the user in this conversation — for everything outside tier 1.
4. This skill's remaining `HARD` rules, then `PREFERENCE`, then `DEFAULT`, then `WHEN`.
5. Your own taste.

---

## Gate 1 — Placement — before you create a file or directory

**PC-1** `DEFAULT` — Put a file in the deepest existing directory whose single responsibility covers
it; add a top-level directory only when the file introduces a new function of the project.
*Check:* you can state the directory's responsibility in one phrase and name its siblings as sharing
it.

**PC-2** `DEFAULT` — When a directory is added, removed, renamed, or repurposed, update the structure
map in the project-understanding document **in the same change**.
*Check:* every directory named in the map exists, and every top-level directory appears in the map.

**PC-3** `WHEN` — Before you split a module or introduce an abstraction, name the seam: the two
responsibilities for a split, the second caller for an abstraction. Then cut on that seam.
*Check:* each resulting module's job can be described without "and"; the abstraction has two concrete
users today. Line count is never the reason.

## Gate 2 — Cleanup — before you delete anything, and before you finish

**PC-4** `HARD` — Delete what you created in this task, and what the project's own documentation
declares disposable. Everything else you report and leave in place. The one narrow addition: an
artefact that is **empty** and that the project's own records already identify as an accidental
by-product may be removed, with the removal stated.
*Check:* for each removal you can point to its creation in this task, to the document that calls it
disposable, or to both emptiness and a record naming it an accident. If you cannot, it stays. The
ambiguity is resolved in advance, in favour of the file: three primary postmortems destroyed
production data with no destructive intent — a wipe aimed at a secondary database hit the primary, a
playbook command had one mistyped input, and an unpublish took out 272 packages.

**PC-5** `DEFAULT` — Write scratch — temp scripts, debug dumps, one-off reports, logs — outside the
repository or under a path the project already ignores. Before you finish, classify every untracked
file as keep, ignore, or remove, and say which. The same pass applies when you notice accumulation you
did not create, or when the owner asks for a tidy-up — the outcome there is a classification to
report, not a deletion (PC-4).
*Check:* `git status --porcelain --untracked-files=all` lists only files you can name and justify.
`git add -A` is never a substitute for that classification.

## Gate 3 — Code — while you write it

**PC-6** `DEFAULT` — Give each module, and each function whose contract is not obvious from its name
and signature, one sentence saying what it is responsible for. Comment the **why**: the non-obvious
constraint, the reason for this shape, the trap.
*Check:* a reader who has not seen the body can say what the unit is for and what it is not; and for
each comment, removing it would leave that reader worse off.

**PC-7** `HARD` — When your change makes a nearby comment, docstring, or structure-map line untrue,
correct it in the same change.
*Check:* every comment your diff touches or travels past is still true of the code beneath it.
*Tie-break under a "change nothing else" instruction:* a false comment **on a line you are editing** is
fixed anyway — your own diff would otherwise read as a self-contradiction, and the edit is what keeps it
live. A false comment **elsewhere** is reported, not fixed, because there the instruction wins.
*Yields to:* a frozen historical record — a changelog entry or a dated report describes the state at
its date and must not be rewritten to match today.

## Gate 4 — Release — commit, version, tag, roll back

**PC-8** `HARD` — Establish the version **mode** before you touch a number, and record it:
**(A) SemVer-bound** — the project declares a public API and claims SemVer compliance;
**(B) house scheme** — the number is an ordered identifier and no compatibility semantics are claimed.
At `0.y.z` no compatibility is promised either way; say so.
*Check:* you can point to where the project states its mode and, in mode A, its public API. Under an
undeclared mode every bump is arbitrary.

**PC-9** `HARD` — In mode A the digit follows compatibility, never size: incompatible public-API
change → MAJOR; compatible addition or deprecation → MINOR (PATCH resets to 0); compatible bug fix →
PATCH. A large additive feature is a MINOR.
*Check:* you can name the public-API change and whether an existing consumer can break on it.
Deprecation ships in a MINOR; removal only in a later MAJOR.

**PC-10** `PREFERENCE` — In mode B the owner's scheme applies: major features and major refactors →
MAJOR; functional or structural change → MINOR; documentation and small tasks → PATCH. Say that the
number carries no compatibility promise.
*Check:* PC-8's mode declaration exists and states that. This rule has **no supporting evidence** — it
is the owner's convention, and it is safe only because it is labelled rather than passed off as
SemVer.

**PC-11** `HARD` — A change a consumer could break on never ships as MINOR or PATCH because it "felt
small".
*Check:* you have named every consumer-visible surface the release touches. One removed export, config
key, default, or code path is enough.

**PC-12** `HARD` — A released version and its tag are immutable. Fix forward; a bad release gets a new
version.
*Check:* the tag still resolves to the commit it named when published. Re-pointing a published tag is
a trust failure, not a nicety.

**PC-13** `DEFAULT` — One logical change per commit, in the message convention the project already
uses.
*Check:* the commit has a single type and can be reverted without collateral damage. A commit mixing
unrelated changes cannot be classified, reviewed, or reverted on its own.

**PC-14** `DEFAULT` — A release point is an **annotated** tag on a commit that passed the project's
checks, with the release contents enumerable.
*Check:* the tag carries a message, a tagger and a date, and you can list what the release contains.

**PC-15** `HARD` — To undo published work: start from a clean worktree, use `git revert`, revert the
constituent commits rather than a merge commit, record **why** in the revert message, and run a real
check afterwards.
*Check:* the tree was clean before you started, the revert commit says why, and the reverted state
passes the project's checks. A zero exit code is not evidence the project is healthy again.

**PC-16** `HARD` — Point at the concrete recovery point — a tag, a release record, a known-good
commit — or say there is none.
*Check:* the exact commit you would return to resolves. The version number is not a recovery point:
rollback is a property of the repository, never of the numbering scheme.

## Gate 5 — Handoff — decide, ask, or report

**PC-17** `DEFAULT` — Look for the project's existing answer first — docs, config, tests, sibling code,
git history. If the project cannot settle it, go and find a reliable external answer — the tool's own
documentation, its `--help`, its source — before asking or guessing. Ask only when all three hold: the
answer changes the **deliverable**; neither the repository nor a reliable source settles it; and
guessing wrong is expensive or hard to undo. Otherwise decide and flag the assumption in one line.
*Check:* you can name which deliverable output changes, and where you looked. A name, label, or
user-visible string the repository does **not** settle falls between the two: follow the project's
vocabulary where it has one, and where it does not, decide **and say which name you chose and why** —
never silently. It becomes a question when the name is externally visible or expensive to change later.
*On the direction of the known failure:* the measured default is **under-asking**, so this rule exists
to make the question targeted, not rare. "Important" is not one of the three conditions; it is the word
they replace.

**PC-18** `PREFERENCE` — When a meaningful unit of work finishes, or you call a tool whose effect the
user must know about, say what happened, the evidence, and any risk, in plain language.
*Check:* the user could act on the message without a follow-up. No play-by-play, no restating the
plan, no narrating a search you are about to run. This rule has **no supporting evidence** — it is the
owner's choice — and length is a known bias in model judges, so keep it to boundaries.

**PC-19** `HARD` — Attach either a label — `confirmed` / `likely` / `inferred` / `unknown` — or the
check you actually ran, to every claim about the project's state.
*Check:* you can name the command, run, or source behind it. Written, saved, generated and commanded
are not done. Prefer a real run over a re-reading: self-correction without an external signal is
measured to fail, and at times to make things worse.

---

## Conflicts you will actually meet

| Conflict | Resolution |
|---|---|
| Clean up vs. protect the user's data | PC-4 wins. Report the file; do not remove it. Deleting evidence is never "tidying". |
| Ask vs. keep moving | PC-17's three conditions are a gate, not a preference. Outside it, decide and flag — and remember the measured bias is under-asking. |
| Bump eagerly vs. keep the number meaningful | PC-8 first. Then PC-9 (mode A) or PC-10 (mode B). Nothing at `evidence: none` justifies a bump on its own. |
| Comment fully vs. over-comment | PC-6: the why, the constraint, the trap. If the code says it, the comment is noise. |
| Organise vs. over-modularise | PC-1 and PC-3. Structure earns its place by holding a distinct function or a named second user. |
| Tell the user vs. narrate | PC-18: outcome, evidence, risk, at boundaries. Not a log of steps. |
| Research fully vs. context cost | Stop when new sources stop changing the decision. Evidence strength, not volume, decides. |
| More rules vs. a usable skill | The admission gate in `references/rules.md`. A rule that changes no decision is deleted. |

## Adding a rule

The owner will keep sending facts, preferences, constraints, and failure cases in ordinary language.
Do not append them. Run the admission gate in
[`references/rules.md`](references/rules.md#adding-a-rule): classify it, search for an existing rule
that already covers it, check it against every rule it touches, decide whether it is a fact, a
preference, or a `HYPOTHESIS`, and only then give it an id. Consolidate rather than accumulate — the
measured constraint ceiling means a skill that only grows stops being followed.
