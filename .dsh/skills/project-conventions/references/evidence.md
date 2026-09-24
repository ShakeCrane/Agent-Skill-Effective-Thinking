# Evidence behind the rules

This is the honesty layer. A rule's `evidence` level is a claim about how much stands behind it, and
this file is where that claim can be checked, disputed, or withdrawn.

Read it when you want to know whether a rule may be traded away, when you are about to defend a rule
to the owner, or when you are adding a rule and need to know what "strong" is allowed to mean here.

**Levels** — `strong`: a normative source or a measured effect, reproduced across sources.
`moderate`: a primary source directly on point, or one measured effect with caveats. `weak`:
inferential or framing support only. `none`: no source — the owner's convention or a design choice.

---

## How to re-check a citation

Every load-bearing citation is machine-checked:

```bash
npm run test:project-conventions:cite   # re-fetches each source and looks for the quoted sentence
```

`evals/project-conventions/citations.json` holds one entry per claim, with the exact sentence the rule
rests on. The verifier fails on a **MISS** — the source was reached and the sentence is gone, which is
what a broken citation looks like. It also reports **NET** separately: a source that could not be
reached at all. Add `--offline-tolerant` to downgrade NET to a reported skip; the tool then says out
loud how much went unchecked rather than quietly passing. It is network-dependent, so it is
deliberately **not** part of `npm test`.

**Status of the last run (2026-09-24): 20 of 22 checks reconfirmed, 0 claims missing, 2 sources not
reached** (`sre.google` and a vendor blog, both host-level failures on this network). Those two are
**not verified now** — a previous run did verify them, and any rule resting on them is only as strong
as its last successful check.

Two things this taught, both recorded rather than smoothed over:

- The first run failed on keepachangelog.com because the page renders "Don't" with a typographic
  apostrophe (U+2019) and the needle used ASCII. The claim was present; the checker was wrong. The fix
  was to normalise quotation marks in the comparison, not to relax the check — a verifier that passes
  on a near-miss is worse than no verifier.
- Four of the earliest checks were written against publisher landing pages, which block automated
  retrieval. They were moved to Crossref metadata endpoints, which resolve reliably. That change
  **narrows what those four checks prove**: they now establish that the cited work exists with the
  cited title, not that its abstract says what the rule claims. The narrowed scope is written into the
  `claim` field of each entry, because a check whose scope is invisible is worse than no check.

---

## What is strong

- **The version digits are defined by compatibility, not by size.** The specification is unambiguous:
  MAJOR for incompatible API changes, MINOR for backwards-compatible added functionality, PATCH for
  backwards-compatible bug fixes, and `0.y.z` for initial development where "anything MAY change at
  any time". This is the entire basis of PC-8, PC-9 and PC-11, and it is why PC-10 exists as a
  labelled `PREFERENCE` rather than a rule: the owner's magnitude scheme is not a reading of the spec,
  it *inverts* it, and the honest thing is to say so instead of redefining SemVer. → PC-8, PC-9, PC-11,
  PC-12.
- **Published names are immutable.** Git's own documentation calls re-pointing a published tag "a big
  security issue, in that people MUST be able to trust their tag-names", and the spec forbids
  modifying a released version. Forward-fix is the only sanctioned remedy. → PC-12.
- **`git revert` has documented preconditions and a documented trap.** It requires a clean working
  tree; reverting a merge commit "declares that you will never want the tree changes brought in by the
  merge"; the docs require a recorded reason. → PC-15.
- **Deletion destroys production data without destructive intent.** Three primary postmortems: GitLab
  2017 (a wipe aimed at a secondary database hit the primary — roughly 300 GB in one to two seconds,
  about 18 hours of outage, backups that had been failing silently); AWS S3 2017 (a playbook command
  with one mistyped input); npm 2016 (272 packages unpublished, "hundreds of failures per minute",
  ~2.5 hours). **Only the GitLab postmortem is machine-checked in `citations.json`**; the other two are
  cited from the efficiency cluster's source table and are one level weaker here for that reason.
  `git clean` documentation shows that nested repositories — 27 of which existed in this repository's
  untracked archive — require a *second* `-f`, so the catastrophic form is one keystroke from the
  routine one. → PC-4.
- **External checks beat self-review, and self-correction without one can hurt.** Peer-reviewed:
  intrinsic self-correction without external feedback fails on reasoning tasks, and "at times, their
  performance even degrades", while tool-grounded critique is where the measured improvement comes
  from. → PC-19.
- **Model judges carry a length bias.** The same judge family that agrees with humans about 80% of the
  time exhibits position, verbosity, and self-enhancement bias. A skill that rewards narration and then
  grades itself with a model judge builds in a pull toward more words. This is evidence about *judges*,
  not about the rule it constrains: **PC-18 remains `evidence: none`** — it is the owner's preference,
  and the finding above only tells you which way to lean when writing to them.
- **Stale comments and stale references are the best-evidenced failure mode in the whole ruleset.**
  74.6% of outdated comments are machine-detectable; across more than 3,000 sampled GitHub projects,
  most contain at least one outdated code-element reference at some point in their history; and
  comment-code divergence is measured to hinder comprehension. This is what makes PC-7 enforceable
  rather than aspirational — the check is reading the comment against the code, and the failure is both
  common and findable. → PC-7.

## What is moderate

- **Clarification helps, but only behind a gate, and the default failure is under-asking.** ClarifyGPT
  lifts GPT-4 Pass@1 on MBPP-sanitized from 70.96% to 80.80%, applied only after an ambiguity
  detector. CLAM's finding is the direction of the baseline: models "rarely ask users to clarify
  ambiguous questions and instead provide incorrect answers". A 1,642-trace multi-agent taxonomy
  quantifies a "failed to ask for clarification" mode and contains **no** over-asking mode. → PC-17.
  The caveat is real: half of ClarifyGPT's evidence uses a *simulated* user, and no retrieved source
  measures what a clarifying question costs.
- **Comment quality is a matter of category, not of count.** A comment model built on categories,
  validated against a survey of developers, supports the claim that a comment should answer the
  question its category claims — a why, a contract, or a detail — rather than the claim that more
  comments are better. This is the strength of the *comment* half only. **PC-6 stays `weak`**, because
  its other half — that stating a module's responsibility improves anything — has no measured support
  at all, and a rule is only as strong as its weakest load-bearing claim. Staleness, a different and
  much better-evidenced claim, is recorded under "What is strong" above.
- **Annotated tags are the release tag and lightweight tags are not.** Vendor documentation states the
  distinction and notes that tooling such as `git describe` ignores lightweight tags. → PC-14.
- **One logical change per commit is prescribed with a mechanical reason**: a commit has one type, and
  the type drives the version derivation, so a mixed commit cannot be classified without losing
  information. Whether finer granularity improves review quality is **not** established by any source
  retrieved. → PC-13.
- **Recoverability is a repository property.** Tag immutability, a pinned toolchain, enumerable release
  contents and a reproducible build are what make returning to a past state *possible*. No retrieved
  source shows that tagging releases reduces incidents; the defensible claim is narrower — without a
  release point, rollback is not possible, not that it becomes rare. → PC-16.

## What is weak

The placement and code-shape rules — PC-1, PC-2, PC-3, PC-5, PC-6 — rest on the reasoning that a
function-organised tree is navigable and that structure should be earned, not on a measured outcome.
They are `DEFAULT` and `WHEN` precisely because of that. Treat them as strong defaults that a project's
own convention can override (precedence rule 2), not as findings.

Two results are worth stating plainly, because both cut against the received wisdom this skill encodes:

- **No comparative study was found on feature-first versus layer-first directory structure.** There is
  package-level metric research on fault-proneness and there are practitioner conventions arguing both
  ways, but nothing measuring the two arrangements against each other on any outcome. The user's
  "organise top-level folders by function" is therefore recorded as a **user convention**, and PC-1 is
  `weak`.
- **The link from bad structure to maintenance effort is much weaker than assumed.** In the one
  controlled experiment located — six professional developers, four Java systems, 298 modified files —
  **none** of twelve code smells was significantly associated with increased effort once file size and
  change count were controlled; those two variables explained almost all modelled variation. That does
  not show structure is irrelevant; it shows the causal claim is unproven and that a rule justified by
  "bad structure costs effort" is justified by something not established here.

One result is counter-intuitive and is recorded rather than smoothed over: well-commented modules were
measured 2–8 times *more* frequently faulty across three open-source systems. The plausible reading is
that complexity attracts comments rather than that comments cause faults — an inference, not a finding.
Either way it is not support for comment volume as a quality signal, and PC-6's removal test is the
rule that survives it.

One honest asymmetry worth recording: the project's own principle "organise top-level folders by
function" is *plausible and widely practised*, but no retrieved study establishes that it produces
better maintenance outcomes than organising by layer. The rule is kept because the owner asked for it
and it is cheap to follow; it is not kept because it was measured.

## What has no evidence at all

These are `evidence: none` and must never be defended as findings:

- **PC-10** (magnitude-based versioning) — the owner's convention. It conflicts with the specification
  by construction, which is why PC-8 forces the mode to be declared.
- **PC-18** (report in plain language at boundaries) — **no source retrieved measures progress
  narration for coding agents at all.** Two searches returned index metadata only. The adjacent
  verified datapoint is a warning, not support: length is a named bias in model judges.

## Widely repeated, deliberately excluded

Recorded so they are not quietly reintroduced. Each is plausible, checkable in principle, and
**unverified here**:

| Claim | Status | Why it is excluded |
|---|---|---|
| "It takes ~23 minutes to resume after an interruption." | Source real, content unreachable | The paper (Mark, Gudith & Klocke, CHI 2008) is metadata-verified, but the publisher returned 403 and the available PDF has no text map. No number is used. |
| "Instructions degrade past ~60–100 lines." | **Unverified** | Traces to a page with no provenance. Use instead the documented budgets: 200 lines for a context file (with the vendor stating longer files "reduce adherence"), 500 lines / 5k tokens for a skill body, and the measured per-instruction constraint ceiling below. |
| "Read the context file before acting." | Contradicted by an unreached lead | A reported evaluation suggests reading an `AGENTS.md` can reduce success and raise cost. Not settled; the behaviour is not encoded either way. |
| "Deploy more often." | Partially supported, misused | Speed and stability are reported as correlated rather than traded off, but the same source warns that making frequency a *goal* invites gaming it, and the numeric thresholds were not retrieved. |
| "Over-clarification is the main risk." | Contradicted | The measured failure direction is under-asking. |
| A 2025 agent database-deletion incident | **Unanswered** | Six retrieval attempts failed. Nothing about it is described anywhere in this skill. |

## The one measured number that shapes the document itself

A multi-level constraint-following benchmark puts the practical ceiling at **roughly three constraints**
per instruction for closed models and about two for open ones: hard-satisfaction falls from 84.7% at
one constraint to 61.9% at five for GPT-4, and from 80.3% to 53.2% for GPT-3.5. This is why the rules
are gate-triggered rather than stated as one standing list: at any moment an agent is inside one gate
with two to four rules live. It is also why the schema was reduced to trigger, action and check — the
number of constraints is the axis along which compliance is measured to fall.

## Limits of this evidence base

- **Delegated research, re-verified in part.** The five evidence clusters were researched by separate
  agents. Work reports are not evidence, so the load-bearing citations were re-fetched and re-matched
  here (`citations.json`, 20 of 22 reconfirmed on the last run). Citations outside that file have not
  been independently re-checked and should be treated as one level weaker than stated.
- **The research brief itself contained mis-attributed citations.** Three titles supplied to the
  software-engineering researcher — including "To Comment or Not to Comment?" attributed to Steidl et
  al., ICSME 2013 — did not resolve; the real 2013 paper is a different one at a different venue. They
  were refused rather than propagated. The lesson is recorded because it is the failure this file
  exists to catch: an authoritative-sounding citation travelling unchecked from a brief into a rule.
- **Two research questions were never answered**: progress narration (no HCI source reached) and any
  token/tool-call budget (no source reached). Both are marked accordingly above rather than filled in.
- **The first-hand repository findings are n=1.** The untracked 14.8 MB run archive, its zero-byte
  `failures.jsonl`, its non-monotonic `cases` counter, and its declared artifact root that does not
  exist, are measurements of *this* repository, not a population estimate. They are existence proofs
  and measurement warnings.
- **The software-engineering cluster carries the weakest retrieval.** Nine of its 43 sources are
  metadata-only (paywalled or elided abstracts) and its findings rest on abstracts rather than full
  texts. Where this file calls a placement or comment rule `weak`, that is the honest level.
- **Effect sizes are not transferable.** Nearly every measured number above comes from a specific
  model family on a specific benchmark. None of them predict what *this* skill will do for *this*
  project, and none are claimed to.
- **The behavioural result is a ceiling, not a benefit.** See `research/project-conventions/07`: both
  conditions solved 19 of 20 cases, so the skill's behavioural effect is **NOT VERIFIED**.
- **An adversarial review is only as good as the revision it reviewed.** The independent review of this
  skill ran while the artefact was still moving: three commits landed and four files were rewritten
  mid-review, so three of its first reads were of revisions that no longer existed and had to be redone.
  Freeze the review set — tag it, or hand over a commit hash — before commissioning the review. The
  findings it did produce were real and are the reason this file no longer contradicts the rule records.

## What the independent review changed

Recorded because a review whose findings are not traceable is indistinguishable from no review. Seven
findings were accepted and fixed; the two that mattered most were in the *verification* layer, not the
rules:

1. `evidence.md` claimed PC-7 at two different levels in two sections. The contract test could not see
   it, because nothing parsed that file. → contradiction removed, **and** a check added that no rule is
   claimed at two levels. Doing that surfaced two more of the same class (PC-18, PC-6) that the review
   had not found.
2. Fourteen of twenty-two citations named rule ids from a numbering that no longer existed — including
   the sole citation backing PC-4, which was labelled `—`. Setting every id to a non-existent value left
   both tests green. → ids remapped, **and** checks added that every citation resolves and every
   `strong`/`moderate` rule has at least one.
3. The suite's discrimination check was defeatable in one move: a bad example of `"no"` passed it,
   because failing by *missing a required token* proves nothing about detecting the failure mode.
   → the bad example must now commit the forbidden act, at substance, with the three defeating
   mutations kept as permanent controls.

Three further findings were requirement-coverage gaps rather than defects: help-seeking had no rule text
behind its test case; the owner's "do not guess on naming" was being inverted without an explicit
carve-out; and `AGENTS.md` kept a second, stale structure map after the audit decided there should be
one. All three are fixed in the rules and the files above.

## Open questions that would change a rule

Answering any of these would raise or retire a rule; they are `HYPOTHESIS`-grade until then.

1. Does reading the project's convention file before acting improve or worsen outcomes?
2. Does progress narration help or annoy users of coding agents — and at what cadence?
3. Do structure-document updates actually stay in sync, and does their drift predict maintenance cost?
4. Does the trigger-gated gate structure measurably beat a flat list of the same rules? The document
   asserts the gate structure is load-bearing; nobody has measured it for this skill.
5. Does an agent follow a rule with a named command check more often than one with a prose check?
