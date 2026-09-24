# Cluster B — Version management, release practice, and reliable rollback

**Status:** evidence base for a *candidate* rule group. Not a validated intervention; no eval has been run.
**Scope:** what is defensible, ambiguous, and actually load-bearing for rollback/traceability in the version-management rule group.
**Method:** `web_search` + `web_fetch` (AnySearch backend). 10 sources fetched and read in full; captured verbatim before the backend began returning HTTP 402. Fetch capability was lost partway through (see B14) — **no empirical-study source and no incident source could be verified**. Every claim below is either (a) quoted/paraphrased from one of the 10 fetched sources with its URL, or (b) explicitly marked `UNVERIFIED — not used as a basis for any rule`.

---

## B0. Executive summary

- **SemVer's unit of meaning is the declared *public API*, not the size or effort of the change.** MAJOR = "incompatible API changes", MINOR = "add functionality in a backward compatible manner", PATCH = "backward compatible bug fixes" [S1].
- **The USER PREFERENCE conflicts with SemVer on PATCH and MAJOR, and the conflict is not cosmetic.** PATCH-per-spec requires *backward compatible bug fixes*; "docs and small tasks" is neither [S1]. A "small" breaking change is still a MAJOR under the spec, because size is irrelevant to the contract [S1].
- **The sharpest conflict: "MAJOR for big features" is not merely unsupported, it is inverted.** A large, purely additive feature that adds public API functionality MUST be a MINOR, with PATCH reset to 0 [S1]. Bumping MAJOR for it is a *false breaking-change alarm* that pushes consumers through migration work the spec says is unnecessary.
- **The one place the user preference agrees with the spec is 0.y.z.** "Major version zero (0.y.z) is for initial development. Anything MAY change at any time" [S1]. A pre-1.0 project can legitimately bump versions for narrative reasons — but then the version number has explicitly *no* compatibility meaning.
- **SemVer does not promise rollback.** It promises *ordering* and *compatibility signalling*. Its actual rollback-relevant rule is the opposite of rollback: "Once a versioned package has been released, the contents of that version MUST NOT be modified. Any modifications MUST be released as a new version" [S1]. Rollback must be built from git/tags/releases, not from SemVer.
- **The spec concedes that version numbers don't self-enforce.** If you release a breaking change as a minor, the remedy is forward-fix, not un-release [S1]; and an accidentally mis-typed commit is "simply... missed by tools that are based on the spec" [S3]. Compliance is a human commitment, so any rule group must state *who declares* a break, not assume the number tells you.
- **Practitioner criticism converges on: SemVer encodes the maintainer's *intent*, not the consumer's *risk*.** "a major bump can only tell you about the *existence* of an intentional breaking change — but nothing about the *impact*" [S5]; SemVer is "a TL;DR of the changelog" [S5].
- **The same argument is made from the API-contract side by Hyrum's Law:** "with a sufficient number of users of an API, it does not matter what you promise in the contract: all observable behaviors of your system will be depended on by somebody" [S4]. Unintended breakage therefore escapes the version number entirely.
- **SemVer's own escape hatch is widely used as a permanent state and degrades the number to a token.** Schlawack documents "ZeroVer" — maintainers who "stick to their beloved zero forever while claiming to do SemVer", making "the version number mean *absolutely nothing* while claiming it's *semantic*" [S5]. The linked site is `0ver.org` [S5, href only].
- **Conventional Commits supplies *derivation*, not *detection*.** `fix`→PATCH, `feat`→MINOR, any `BREAKING CHANGE`→MAJOR [S3] — a mapping from a *human assertion* to a bump. It explicitly does not define revert behaviour [S3].
- **Git itself makes tags a trust boundary and warns that retagging a published version is a security issue** [S2]. This — not the number scheme — is the precondition for reproducing a shipped state.
- **Changelog convention is candid that it is opinion, not standard:** "This document is not the **truth**; it's my carefully considered opinion" [S6]; and "Is there a standard changelog format? Not really." [S6]. Treat B8 rules as `convention`.

---

## B1. SemVer v2.0.0 — what the spec actually says (quoted)

Source [S1] = `https://semver.org/` (canonical page for 2.0.0, HTTP 200, fetched and read in full). Cross-checked against the spec's own repo copy `https://raw.githubusercontent.com/semver/semver/master/semver.md` [S1b], which is the same normative text. Original author: Tom Preston-Werner; licence CC BY 3.0 [S1].

### B1.1 The three increments (spec Summary, verbatim)

> Given a version number MAJOR.MINOR.PATCH, increment the:
> - MAJOR version when you make incompatible API changes
> - MINOR version when you add functionality in a backward compatible manner
> - PATCH version when you make backward compatible bug fixes

Additional labels for pre-release and build metadata are available as extensions to the format [S1].

### B1.2 "Public API" is the unit of meaning, and declaring it is mandatory

- "Software using Semantic Versioning MUST declare a public API. This API could be declared in the code itself or exist strictly in documentation. However it is done, it SHOULD be precise and comprehensive." [S1] The Introduction adds: "For this system to work, you first need to declare a public API." [S1]
- "Version 1.0.0 defines the public API. The way in which the version number is incremented after this release is dependent on this public API and how it changes." [S1]
- The FAQ accepts the cost deliberately: "Having to bump major versions to release incompatible changes means you'll think through the impact of your changes, and evaluate the cost/benefit ratio involved." [S1]

### B1.3 Version 0.y.z (initial development) — verbatim

> Major version zero (0.y.z) is for initial development. Anything MAY change at any time. The public API SHOULD NOT be considered stable. [S1]

FAQ support: "start your initial development release at 0.1.0 and then increment the minor version for each subsequent release"; "Major version zero is all about rapid development. If you're changing the API every day you should either still be in version 0.y.z or on a separate development branch"; and on leaving zero — "If your software is being used in production, it should probably already be 1.0.0. If you have a stable API on which users have come to depend, you should be 1.0.0. If you're worrying a lot about backward compatibility, you should probably already be 1.0.0." [S1]

Note for the rule group: 0.y.z is **not** an exemption from SemVer — it is a SemVer-governed mode in which compatibility is explicitly un-promised. Under 0.y.z the version triple carries ordering but not compatibility.

### B1.4 Exact MUST/MUST NOT language for the bumps

- PATCH: "Patch version Z (x.y.Z | x > 0) MUST be incremented if only backward compatible bug fixes are introduced. A bug fix is defined as an internal change that fixes incorrect behavior." [S1]
- MINOR: "Minor version Y (x.Y.z | x > 0) MUST be incremented if new, backward compatible functionality is introduced to the public API. It MUST be incremented if any public API functionality is marked as deprecated. It MAY be incremented if substantial new functionality or improvements are introduced within the private code. It MAY include patch level changes. Patch version MUST be reset to 0 when minor version is incremented." [S1]
- MAJOR: "Major version X (X.y.z | X > 0) MUST be incremented if any backward incompatible changes are introduced to the public API. It MAY also include minor and patch level changes. Patch and minor versions MUST be reset to 0 when major version is incremented." [S1]
- Immutability: "Once a versioned package has been released, the contents of that version MUST NOT be modified. Any modifications MUST be released as a new version." [S1]
- Monotonicity: "A normal version number MUST take the form X.Y.Z where X, Y, and Z are non-negative integers, and MUST NOT contain leading zeroes... Each element MUST increase numerically. For instance: 1.9.0 -> 1.10.0 -> 1.11.0." [S1]

**Crucially, "MAY be incremented" exists only for MINOR (private-code improvements).** There is no "MAY" for PATCH or MAJOR additions-by-size. Effort/size is not a spec-recognised axis anywhere. [S1]

### B1.5 When MAJOR must / must not be bumped

- **MUST** be bumped when any backward *incompatible* change is introduced to the declared public API [S1].
- **MAY additionally contain** minor and patch level changes — a MAJOR does not have to be "only breaking" [S1].
- **Must not be inferred from magnitude.** Nothing in [S1] licenses MAJOR for a big-but-compatible change; the spec's own FAQ frames MAJOR frequency as a *foresight* question ("Incompatible changes should not be introduced lightly to software that has a lot of dependent code"), not a size question.
- **Two explicit "the number is a promise, not a ledger" clauses** matter for an agent skill:
  - Accidentally breaking in a minor: "As soon as you realize that you've broken the Semantic Versioning spec, fix the problem and release a new minor version that corrects the problem and restores backward compatibility. Even under this circumstance, it is unacceptable to modify versioned releases. If it's appropriate, document the offending version and inform your users of the problem." [S1] — **forward-fix, never rewrite history**; this is the spec's un-release policy.
  - Accidentally breaking in a patch where reverting would hurt more: "it may be best to perform a major version release, even though the fix could strictly be considered a patch release... Remember, Semantic Versioning is all about conveying meaning by how the version number changes." [S1]
- **Deprecation requires a MINOR before removal in a MAJOR:** "(1) update your documentation to let users know about the change, (2) issue a new minor release with the deprecation in place. Before you completely remove the functionality in a new major release there should be at least one minor release that contains the deprecation." [S1]
- **Pre-release is the spec's sanctioned instability channel:** "A pre-release version indicates that the version is unstable and might not satisfy the intended compatibility requirements as denoted by its associated normal version." [S1] Precedence example: `1.0.0-alpha < ... < 1.0.0-rc.1 < 1.0.0` [S1].
- **`v1.2.3` is not a semantic version:** "No, 'v1.2.3' is not a semantic version. However, prefixing a semantic version with a 'v' is a common way... in which case 'v1.2.3' is a tag name and the semantic version is '1.2.3'." [S1]

---

## B2. Where SemVer fails / criticisms + measured non-compliance

Sources here are `practitioner opinion` [S5] and `open-source observation` [S4]. **The empirical literature could not be verified — see B4 and B14.**

### B2.1 The contract is unenforceable because the contract is not the behaviour

- Hyrum's Law: "With a sufficient number of users of an API, it does not matter what you promise in the contract: all observable behaviors of your system will be depended on by somebody." [S4] Restated in the source as the Law of Implicit Interfaces: "Given enough use, there is no such thing as a private implementation." [S4]
- Hyrum's own framing of the consequence: consumers rely on "implementation details intentionally exposed through the interface, or which they divine through regular use"; the effect "serves to constrain changes to the implementation, which must now conform to both the explicitly documented interface, as well as the implicit interface captured by usage" — i.e. "bug-for-bug compatibility" [S4].
- Schlawack's operational reading: "Even *if* the maintainer is pure of heart, extremely diligent, and super conservative about what constitutes a breaking change, it is **impossible to predict the ways a change can affect your users**." [S5]

### B2.2 Version numbers encode intent, not risk or impact

- "Because that's all SemVer is: **a TL;DR of the changelog**." [S5]
- "A major bump can only tell you about the *existence* of an intentional breaking change — but nothing about the *impact*, because it lacks the granularity." [S5]
- "In almost 20 years of professional software development, I have observed that the amount of unintentional breakage through updates outweighs the amount of intentional breakage by far." [S5] — labelled by its author as personal observation, not measurement; treat as `practitioner opinion`.
- "relying on updates not breaking if the maintainer doesn't intend it, means relying on software being bug-free." [S5]
- Prescription: "you can't rely on the semantic meaning of SemVer and **you must treat every update as potentially breaking**." [S5]

### B2.3 Unintended consequences of the scheme itself

- **ZeroVer as a stable equilibrium:** "Since maintainers can do whatever they want as long as the major version is zero, many maintainers stick to their beloved zero forever while claiming to do SemVer." [S5] The result: "a package that has a **0ver** version and at the same time claims to be **production-ready** is a **paradox**." [S5]
- **Major-pinning as security debt:** "the moment you pin the major version of a package, it *usually* means that you won't get *any* updates whatsoever once the package bumps its major version... if you pin the major versions of your dependencies, **your application will eventually be full of CVEs and you'll never learn about it**." [S5] Also flags the transitive case: a library pinning a dependency's major "transitively does this to the applications of your users", and "there's no practical way for them to remove *your* pin." [S5]
- **Version conflicts in flat package spaces:** "speculative pinning of the major version of packages that you don't control will *inevitably* cause unnecessary **version conflicts** to your users that *they can't fix themselves*." [S5] Footnote names Python and Ruby as flat-namespace examples [S5].
- **The escape hatch can be worse than no SemVer:** "a concept that was meant to liberate developers ('Need to break compatibility? Just increment major version!') has added pressure and anxiety instead ('I can't publish 1.0 until my design is perfect and no bugs are open.')." [S5]
- Explicit counter-position not to lose: Schlawack states he is "**not** about discouraging *maintainers* from using SemVer... There's nothing wrong about encoding the intent of a release into the version number as a service to its users." [S5] The critique is of *consumer reliance*, not of the practice. Important nuance for the skill: a SemVer-honest version number is still useful; it just is not a safety guarantee.
- SemVer is stated to be "entirely optional" for a project, with CalVer named as an alternative [S5, href `calver.org`, not fetched].

### B2.4 Measured non-compliance

**No measured non-compliance figure is reported here.** The 2014/2017/2021/2022 empirical papers could not be fetched (B4, B14). The searched-for numbers were seen only in search-engine snippets, which is not verification, and are therefore deliberately **not reproduced**. Claims such as "X% of minor/patch releases introduced breaking changes" must not enter the skill until the papers are read first-hand.

---

## B3. Conventional Commits — guarantees and limits

Source [S3] = `https://www.conventionalcommits.org/en/v1.0.0/` (HTTP 200, fetched and read in full).

### B3.1 What it defines

- Structure: `<type>[optional scope]: <description> [optional body] [optional footer(s)]` [S3].
- Type semantics: "**fix:** a commit of the *type* `fix` patches a bug in your codebase (this correlates with `PATCH`)"; "**feat:** ... introduces a new feature ... (this correlates with `MINOR`)"; "**BREAKING CHANGE:** a commit that has a footer `BREAKING CHANGE:`, or appends a `!` after the type/scope, introduces a breaking API change (correlating with `MAJOR`)... A BREAKING CHANGE can be part of commits of any *type*." [S3]
- Normative mapping (FAQ): "`fix` type commits should be translated to `PATCH` releases. `feat` type commits should be translated to `MINOR` releases. Commits with `BREAKING CHANGE` ... should be translated to `MAJOR` releases." [S3]
- Other types are permitted and are **semver-neutral**: "Additional types are not mandated by the Conventional Commits specification, and have no implicit effect in Semantic Versioning (unless they include a BREAKING CHANGE)." [S3] `docs:`, `refactor:`, `chore:`, `test:` etc. are named as recommendations of `@commitlint/config-conventional`, itself "based on the Angular convention" [S3].
- Breaking changes are **mandatory to declare**: "Breaking changes MUST be indicated in the type/scope prefix of a commit, or as an entry in the footer." `!` before the `:` in the prefix; footer form is uppercase `BREAKING CHANGE: <description>`; `BREAKING-CHANGE` "MUST be synonymous" [S3].
- RFC 2119 keywords apply; parsing is case-insensitive **except** `BREAKING CHANGE`, "which MUST be uppercase" [S3].

### B3.2 What it claims to give you (verbatim "Why Use" list)

"Automatically generating CHANGELOGs. Automatically determining a semantic version bump (based on the types of commits landed). Communicating the nature of changes to teammates, the public, and other stakeholders. Triggering build and publish processes. Making it easier for people to contribute..." [S3]

### B3.3 What it does NOT guarantee — and the spec says so

- **No correctness guarantee on the bump.** The whole mapping is `feat`/`BREAKING CHANGE` → bump, where the *type* is a human assertion with no verification step. The spec's failure mode is stated plainly: "In a worst case scenario, it's not the end of the world if a commit lands that does not meet the Conventional Commits specification. It simply means that commit will be **missed by tools that are based on the spec**." [S3] An untyped breaking change ⇒ an under-bumped release ⇒ silent breakage on the consumer side. **This is the breaking-change signalling failure mode: the pipeline is only as good as the discipline of the person typing the type.**
- **No revert semantics.** "Conventional Commits does not make an explicit effort to define revert behavior. Instead we leave it to tooling authors to use the flexibility of *types* and *footers* to develop their logic for handling reverts." [S3] Recommended (not required) shape: a `revert` type with a footer listing reverted SHAs: `Refs: 676104e, a215868` [S3].
- **No reference to the artifact.** The spec does not require a version bump, a tag, a release, or a build identifier anywhere. It constrains *messages*, nothing about what was shipped.
- **No enforcement of contributor compliance:** "Do all my contributors need to use the Conventional Commits specification? No! If you use a squash based workflow on Git lead maintainers can clean up the commit messages as they're merged" [S3].
- **Initial-development guidance is a recommendation, not a rule:** "We recommend that you proceed as if you've already released the product." [S3]
- **The "one commit = one type" tension is acknowledged as friction:** "What do I do if the commit conforms to more than one of the commit types? Go back and make multiple commits whenever possible. Part of the benefit of Conventional Commits is its ability to drive us to make more organized commits and PRs." [S3] — see B5.
- **Real-world adoption/compliance rates: insufficient evidence.** No adoption measurement could be verified (B14). Do not assert a compliance percentage.

---

## B4. Empirical versioning studies (with measured numbers)

**No measured numbers can be reported. This is a gap, not a finding.**

During the window in which search was available, the following were surfaced as search results only — titles/venues/authors as displayed by the search backend. They were **not fetched**, and their abstracts and numbers were not obtained first-hand. Under the epistemic rules they are recorded as leads, not as evidence:

- `S. Raemaekers, A. van Deursen, J. Visser` — "Semantic versioning versus breaking changes: A study of the Maven repository", MSR 2014 (`UNVERIFIED`; the extended journal version is "Semantic versioning and impact of breaking changes in the Maven repository", *JSS* 2017) — `https://www.sciencedirect.com/science/article/abs/pii/S0164121216300243` — **not fetched** (abstract-only landing page; publisher paywall/extraction failure).
- `Ochoa et al.` — "Breaking bad? Semantic versioning and impact of breaking changes in Maven Central", *Empirical Software Engineering* 2022 — `https://pure.tue.nl/ws/files/199634997/Ochoa2022_Article_BreakingBadSemanticVersioningA.pdf` — **fetch attempted, failed** ("Unable to extract content from the URL", HTTP 422).
- `Decan, Mens` — "What Do Package Dependencies Tell Us About Semantic Versioning?", *IEEE TSE* 2021 — `https://www.computer.org/csdl/journal/ts/2021/06/08721084/1mq8qXnWg48` — **not fetched**.
- A `ResearchGate` landing page for the MSR 2014 paper — **not fetched**.

**Consequence for the skill:** the intended empirical leg of this rule group is currently *unestablished*. Any rule justified by "studies show X% of minor releases break consumers" would be fabricated at this point. Either fetch these four sources, or write the rules so they do not depend on them.

---

## B5. Atomic commits / granularity / bisectability / reverts

Evidence status: one `standard/spec-adjacent` source with an explicit, if brief, granularity prescription [S3]; one `official docs` source that states revert's preconditions and limitations [S2]; one `official docs` source that makes the tag/release immutability boundary explicit [S2]. **No empirical study of commit granularity, bisectability, bug-introducing commits, SZZ caveats, or revert-commit populations could be verified.** Claims about those literatures are omitted rather than guessed.

### B5.1 What is actually supported

- **One logical change per commit is prescribed, for a stated reason.** Conventional Commits: "Go back and make multiple commits whenever possible. Part of the benefit of Conventional Commits is its ability to drive us to make more organized commits and PRs." [S3] The reason is mechanical: a commit has exactly one `type`, and the type drives the version bump, so a commit that mixes `fix` + `feat` + `BREAKING CHANGE` cannot be classified without losing information. [S3]
- **`git revert` has a stated precondition: a clean tree.** "This requires your working tree to be clean (no modifications from the HEAD commit)." [S2] So "clean worktree" is not folklore — it is a documented requirement of the rollback primitive.
- **`git revert` is the history-preserving primitive; `git reset` is the history-discarding one, and the docs steer you accordingly.** "If you want to throw away all uncommitted changes in your working directory, you should see git-reset[1], particularly the `--hard` option." [S2]
- **Reverting a merge commit is a trap with lasting consequences, documented:** "Usually you cannot revert a merge because you do not know which side of the merge should be considered the mainline... Reverting a merge commit declares that you will never want the tree changes brought in by the merge. As a result, later merges will only bring in tree changes introduced by commits that are not ancestors of the previously reverted merge. This may or may not be what you want." [S2] ⇒ for a bisectable, revert-friendly history, **revert the constituent commits, not the merge.**
- **Repeated revert/reapply degrades the log:** "repeatedly reverting reverts will result in increasingly unwieldy subject lines, for example *Reapply "Reapply "<original-subject>""*. Please consider rewording these to be shorter and more unique." [S2]
- **Revert messages should record *why*:** git "strongly recommend[s] to explain why the original commit is being reverted" [S2]. This is the traceability half of rollback.
- **`-n` / `--no-commit` allows batching several reverts before committing, and relaxes the index requirement:** with `-n`, "your index does not have to match the HEAD commit"; "useful when reverting more than one commit's effect to your index in a row" [S2]. Selectable sequences exist: `--continue` / `--skip` / `--abort` / `--quit` via `.git/sequencer` [S2].
- **Revert is not atomic-by-construction:** conflicts leave sequencer state; recovery is `--continue` or `--abort` ("Cancel the operation and return to the pre-sequence state") [S2]. A rule that requires rollback to be *reliable* must therefore require the *attempt* to be verifiable (post-revert build/test), not merely the command to exit 0.

### B5.2 Inference (clearly labelled)

These are **my inferences** from the above, not findings from sources:

- *Inference:* revert cleanliness degrades as later commits touch the same lines. Since [S2] only guarantees an automatic result when the reverse patch still applies, "one logical change per commit" increases the probability that `git revert <sha>` is conflict-free, and that a conflict is semantically interpretable when it is not.
- *Inference:* bisectability requires more than small commits — it requires that each commit be *buildable and testable in isolation*. No fetched source states this; treat as a candidate rule needing its own evidence, not as an established claim.
- *Inference:* "atomic" is doing two different jobs in the received wisdom (review legibility vs. revert safety vs. bisect signal). Sources fetched here support the first two mechanisms only partially and the third not at all.

---

## B6. Rollback mechanisms compared + preconditions for reliability

### B6.1 Mechanism-by-mechanism, with what the sources actually support

| Mechanism | What it preserves / destroys | Evidence | When it is safe |
|---|---|---|---|
| `git revert` | Preserves history; adds inverse commit(s). Requires clean worktree. Merge reverts have permanent side effects. | `official docs` [S2] | Published/shared history; anything already pushed; a bisectable audit trail is wanted |
| `git reset --hard` | Discards uncommitted work; moves branch pointer | `official docs` [S2] (referenced as the alternative for *throwing away* changes) | Local, unpublished work only. Not a rollback mechanism for a shipped release |
| Tag-based release point | Provides a named, reproducible pointer to a shipped state | `official docs` [S2]; `official docs` [S7] | Always — this is the precondition for reproducing any past state at all |
| Release branch + cherry-pick | "Using this branch and cherry pick method, we know the exact contents of each release" | `industrial report` [S7b] | Backporting a fix to a shipped line without dragging in unrelated mainline changes |
| Feature flags | Decouple *deploy* from *release*; behaviour change without code change | `practitioner opinion` [S8] | Rapid mitigation of a bad behaviour change; canary cohort exposure |
| DB migration rollback | **Not addressed by any fetched source** | none | **Insufficient evidence.** Treat as an open risk, not as a solved step |

### B6.2 Google SRE on release points (quoted)

Source [S7b] = `https://sre.google/sre-book/release-engineering/` (HTTP 200, fetched and read in full; Ch. 8 "Release Engineering", by Dinah McNutt, CC BY-NC-ND 4.0).

- Reproducibility as a stated goal: "If two people attempt to build the same product at the same revision number in the source code repository on different machines, we expect identical results." [S7b] "Our builds are hermetic, meaning that they are insensitive to the libraries and other software installed on the build machine." [S7b]
- **The build toolchain is part of the reproducible state — a precondition a version number does not capture:** "Our build tools are themselves versioned based on the revision in the source code repository for the project being built. Therefore, a project built last month won't use this month's version of the compiler if a cherry pick is required, because that version may contain incompatible or undesired features." [S7b]
- Backporting without contamination + enumerable contents: "Bug fixes are submitted to the mainline and then cherry picked into the branch for inclusion in the release. This practice avoids inadvertently picking up unrelated changes submitted to the mainline since the original build occurred." [S7b]
- **Releases should be cut from a passing build:** "we recommend creating releases at the revision number (version) of the last continuous test build that successfully completed all tests." [S7b] And because cherry-picks make the release branch a state that "doesn't exist anywhere on the mainline", tests are re-run on the release branch to "guarantee that the tests pass in the context of what's actually being released" [S7b].
- **Traceability artifact:** "Our automated release system produces a report of all changes contained in a release, which is archived with other build artifacts. By allowing SREs to understand what changes are included in a new release of a project, this report can expedite troubleshooting when there are problems with a release." [S7b]
- Release identity + graduated exposure: packages are "versioned with a unique hash, and signed to ensure authenticity"; a build-ID label "guarantees that a package can be uniquely referenced using the name of the package and this label"; deployment proceeds "starting in one cluster and expand exponentially until all clusters are updated", and for sensitive infrastructure "extend the rollout over several days" [S7b].
- On rollback specifically, the chapter states only *what the environment must support*: release engineers and SREs "work together to develop strategies for canarying changes, pushing out new releases without interrupting services, and **rolling back features that demonstrate problems**" [S7b]. It gives no rollback decision procedure and no DB-rollback position. **Do not over-cite this chapter as a rollback methodology.**

### B6.3 Feature flags — the honest cost (quoted)

Source [S8] = `https://martinfowler.com/articles/feature-toggles.html` (HTTP 200; "Feature Toggles (aka Feature Flags)", Pete Hodgson, 09 October 2017).

- Use case that matters for rollback: Ops Toggles exist so that "system operators can disable or degrade that feature quickly in production if needed", with "Kill Switches" for graceful degradation — and "needing to roll out a new release in order to flip an Ops Toggle is unlikely to make an Operations person happy" [S8].
- Separation principle: "Release Toggles in this way is the most common way to implement the Continuous Delivery principle of 'separating [feature] release from [code] deployment.'" [S8] Release toggles "are transitionary by nature. They should generally not stick around much longer than a week or two" [S8].
- **Cost 1 — combinatorial validation:** "in order to validate all codepaths which may end up live in production we must perform test our artifact in **both** states"; "with multiple toggles in play we have a combinatoric explosion of possible toggle states" [S8]. Mitigation given: test the production configuration, test the fall-back configuration, and (many teams) all-on; this "only makes sense if you stick to a convention of toggle semantics where existing or legacy behavior is enabled when a feature is Off and new or future behavior is enabled when it's On" [S8].
- **Cost 2 — carry/removal cost** is named as a first-class concern ("Managing the carrying cost of Feature Toggles") and toggles are described as introducing "complexity" and coupling that should be "constrain[ed]" [S8].
- **Cost 3 — config in VCS is preferred precisely because it makes past releases reproducible:** "Another benefit of toggle configuration living side-by-side in source control is that we can easily see the state of the toggle in previous releases, and easily recreate previous releases if needed." [S8] — this ties feature flags back to the reproducibility requirement rather than substituting for it.
- Practical anti-pattern named: hardcoded/`#ifdef` toggles ("only suitable for feature flags where we're willing to follow a pattern of deploying code in order to re-configure the flag") and the brittle "toggle scope" wire-up using magic strings, with the fix being to decouple decision points from decision logic [S8].
- **Flags do not roll back state.** Nothing in [S8] addresses database or data migration. A "flag off" rollback leaves whatever the new code already wrote. **Insufficient evidence on data rollback; do not claim flags solve it.**

### B6.4 Preconditions for a *reliable* rollback (synthesised, each tied to a source)

1. **A declared, precise public API** — otherwise "backward incompatible" is undefined and no bump (or rollback decision) can be justified [S1].
2. **Released versions are immutable** — "the contents of that version MUST NOT be modified" [S1]; the remedy for a bad release is a new version, never an edit.
3. **A named release point with an immutable name** — tags, and specifically *not* moved after publication (B7) [S2][S7]; and a **clean worktree** before reverting, the documented precondition of `git revert` [S2].
4. **Merges reverted at the constituent-commit level** — merge reverts have permanent consequences [S2] — with **a recorded reason on the revert commit** (git "strongly recommends" it; this is the traceability half) [S2].
5. **A build/restore path that is itself versioned** so a past release can actually be rebuilt — the toolchain must be pinned, not just the source revision [S7b].
6. **The exact contents of a release must be enumerable** — branch + cherry-pick, or an archived change report [S7b].
7. **A post-rollback verification step** — implied by SRE's "tests pass in the context of what's actually being released" and by revert's conflict/`--abort` reality [S7b][S2]. *Inference:* "the revert command succeeded" is not evidence the rolled-back state is good.
8. **Rollback of *data* is a separate, unsolved-in-this-report problem** (B6.1, B14).

---

## B7. Tags, release points, provenance

Sources: `official docs` [S2] `git-tag`, `official docs` [S7] GitHub "About releases", `standard/spec` [S9] SLSA provenance v1.

### B7.1 Git's own guidance — and the immutability of a published name

- Annotated vs lightweight is a *semantic* distinction, not cosmetic: "Annotated tags are meant for release while lightweight tags are meant for private or temporary object labels. For this reason, some git commands for naming objects (like `git describe`) will ignore lightweight tags by default." [S2] An annotated tag "contain[s] a creation date, the tagger name and e-mail, a tagging message, and an optional cryptographic signature" [S2].
- Signed tags exist and are verifiable: `-s`/`-u <key-id>` create "a cryptographically signed tag object"; `git tag -v` verifies "the cryptographic signature of the given tags"; backend chosen by `gpg.format` (GPG, X.509, SSH), default OpenPGP; `tag.gpgSign` can force signing all tags [S2].
- **Retagging a published version is called out as a security issue.** "If somebody got a release tag from you, you cannot just change the tag for them by updating your own one. This is a big security issue, in that people MUST be able to trust their tag-names." [S2] Git's documented alternatives: the "sane thing" is to publish a new name ("just call it 'X.1'"); the "insane thing" is `git tag -f` plus a public announcement with manual remediation (`git tag -d X; git fetch origin tag X; git rev-parse X`). Git also notes it "does **not** (and it should not) change tags behind users back" [S2].
- ⇒ **Rule implication:** version/tag immutability is not merely a SemVer nicety; git documents breaking it as a trust failure. Any "rollback" that re-points an existing release tag is disallowed.

### B7.2 GitHub Releases

- "Releases are based on Git tags, which mark a specific point in your repository's history. A tag date may be different than a release date since they can be created at different times." [S7]
- Releases are "deployable software iterations you can package and make available for a wider audience to download and use"; GitHub "will automatically include links to download a zip file and a tarball containing the contents of the repository at the point of the tag's creation" [S7].
- Release notes may be manual, template-generated, or auto-generated; release assets carry creation dates; writes require write permission [S7].
- Security link: "If a release fixes a security vulnerability, you should publish a security advisory in your repository. GitHub reviews each published security advisory and may use it to send Dependabot alerts to affected repositories." [S7] ⇒ the release point is the join between *what shipped* and the *vulnerability record*; a missing release/version makes advisory matching harder.

### B7.3 Supply-chain provenance (SLSA) — what minimal provenance buys

- Purpose: "Describe how an artifact or set of artifacts was produced so that: Consumers of the provenance can verify that the artifact was built according to expectations. Others can rebuild the artifact, if desired." [S9]
- The identity chain includes a commit digest: an example `resolvedDependencies` entry carries `"digest":{"gitCommit":"7fd1a60b..."}` for `"uri":"git+https://github.com/octocat/hello-world@refs/heads/main"` [S9].
- **A mutable ref is not provenance.** SLSA notes the client-side-evaluation problem and the RECOMMENDED fix: "Rearchitect the build platform to read configuration directly from version control, recording the server-verified URI in `externalParameters` and the digest in `resolvedDependencies`." [S9] ⇒ the rollback-relevant unit is the **digest**, not the branch name or the semver string.
- Completeness is explicitly bounded: `resolvedDependencies` completeness "is best effort, at least through SLSA Build L3" [S9]; `externalParameters` completeness is required only at L3 [S9]; `byproducts` is for artifacts "needed during debugging or incident response" [S9].
- Provenance v1 is `predicateType: "https://slsa.dev/provenance/v1"`; the page states "Version 1.2 is the current version" [S9].

### B7.4 Minimal accepted practice (synthesis) — and its class

Minimal reproducible shipped state = **(a)** an annotated (ideally signed) tag naming the release, **(b)** a release record pointing at that tag with notes/assets, **(c)** the release contents enumerable (branch/cherry-pick record or archived change report), **(d)** the build toolchain pinned so the artifact can be rebuilt, **(e)** ideally a provenance attestation binding artifact digest → source digest.

- (a),(b) are `official docs` conventions from git and GitHub [S2][S7]; neither vendor claims these are validated interventions for reducing incidents.
- (c),(d) come from Google SRE's description of its own practice — `industrial practice` reported in an `industrial report`, not a controlled study [S7b].
- (e) is a `standard/spec` *recommendation* for supply-chain trust; **no fetched source measures incident reduction from provenance** [S9].
- **Explicitly: none of B7.4 is a validated intervention.** There is no fetched evidence that tagging releases, per se, reduces incidents. The defensible claim is narrower and traceability-flavoured: without a release point, a past state cannot be reproduced, so rollback and incident response are not *possible* — not that they become *rare*.

---

## B8. Changelog practice

Source [S6] = `https://keepachangelog.com/en/1.1.0/` (HTTP 200, fetched and read in full).

### B8.1 What it prescribes (quoted)

- Definition: "A changelog is a file which contains a curated, chronologically ordered list of notable changes for each version of a project." [S6]
- Guiding principles: "Changelogs are *for humans*, not machines. There should be an entry for every single version. The same types of changes should be grouped. Versions and sections should be linkable. The latest version comes first. The release date of each version is displayed. Mention whether you follow Semantic Versioning." [S6]
- Change types (fixed set): "`Added` for new features. `Changed` for changes in existing functionality. `Deprecated` for soon-to-be removed features. `Removed` for now removed features. `Fixed` for any bug fixes. `Security` in case of vulnerabilities." [S6]
- Unreleased section is prescribed as the effort-reduction mechanism, with two stated purposes: people see upcoming changes, and "at release time, you can move the `Unreleased` section changes into a new release version section." [S6]
- "Call it `CHANGELOG.md`." [S6] Dates in ISO-8601-like `2017-07-17` form, justified by non-ambiguity [S6].
- **Deprecation guidance is stronger than SemVer's:** "When people upgrade from one version to another, it should be painfully clear when something will break... If you do nothing else, list deprecations, removals, and any breaking changes in your changelog." [S6]
- Yanked releases are to be shown, not hidden: `## [0.0.5] - 2014-12-13 [YANKED]` — "The `[YANKED]` tag is loud for a reason." [S6]

### B8.2 Known failure modes (documented in the source itself)

- **Commit-log-as-changelog:** "Using commit log diffs as changelogs is a bad idea: they're full of noise. Things like merge commits, commits with obscure titles, documentation changes, etc." The stated distinction: "The purpose of a commit is to document a step in the evolution of the source code... The purpose of a changelog entry is to document the noteworthy difference, often across multiple commits." [S6] ⇒ a rule group must not treat `git log` as the changelog.
- **Stale/inconsistent changelogs are explicitly called dangerous:** "A changelog which only mentions some of the changes can be as dangerous as not having a changelog... By inconsistently applying changes, your users may mistakenly think that the changelog is the single source of truth. It ought to be." [S6] This is the closest thing to a "stale changelog" failure mode in a fetched source, and it is the convention author's argument, not a measurement.
- **Ignoring deprecations** is listed as a bad practice; the recommended upgrade path is "upgrade to a version that lists deprecations, remove what's deprecated, then upgrade to the version where the deprecations become removals" [S6].
- **GitHub Releases as a partial substitute has named drawbacks:** "GitHub Releases create a non-portable changelog that can only be displayed to users within the context of GitHub... The current version of GitHub releases is also arguably not very discoverable by end-users, unlike the typical uppercase files... Another minor issue is that the interface doesn't currently offer links to commit logs between each release." [S6] (This is a 2019-era judgement; the GitHub docs fetched in [S7] describe auto-generated notes and tag/commit comparison, so the discoverability/links critique may be dated — treat as `practitioner opinion` with a shelf life.)
- **Rewriting history is sanctioned for changelogs specifically:** "Sure. There are always good reasons to improve a changelog... It's also possible you may discover that you forgot to address a breaking change in the notes for a version. It's obviously important for you to update your changelog in this case." [S6] Contrast with released *artifacts*, which must never be modified [S1]. **Changelog is mutable documentation; the release is not.**

### B8.3 Status of the source — read this before turning it into rules

- Self-declared scope: "This document is not the **truth**; it's my carefully considered opinion, along with information and examples I gathered." [S6]
- "Is there a standard changelog format? Not really. There's the GNU changelog style guide, or the two-paragraph-long GNU NEWS file 'guideline'. Both are inadequate or insufficient." [S6]
- "Can changelogs be automatically parsed? It's difficult, because people follow wildly different formats and file names." [S6]
- ⇒ **Class: `convention` authored by Olivier Lacan (per the site/repo), not a standard and not an evaluated intervention.** It is safe to adopt as a house convention; it is not evidence that changelogs improve outcomes. **No evidence found on whether changelogs are actually read or maintained in practice** (search unavailable; B14).

---

## B9. Multi-module / monorepo versioning

### B9.1 What could be verified

- **GitHub Changesets** (`open-source observation`, fetched): the tool's own model is *independent per-package bumps driven by a per-change intent file*. "The YAML front matter describes what should be versioned by the version command"; "The markdown text is a summary of the changes that will be prepended to your changelog when you next run your version command" [S10]. Each changeset is its own file, generated by `yarn changeset` / `npx @changesets/cli`, with random human-readable names chosen "to avoid collisions when generating them" [S10].
- Consumption is one-shot and destructive by design: "When `changeset version` or equivalent command is run, all the changeset files are removed. This is so we only ever use a changeset once. This makes the `.changeset` folder a very bad place to store any other information." [S10]
- Manual deletion is possible but warns about lost intent: "You can, but you should be aware this will remove the intent to release communicated by the changeset, and should be done with caution." [S10]
- Bump-type and summary text are authoritative-by-fiat, not derived: "Editing the summary or package bump types is completely safe. You can even write changesets without the command if you want." [S10]
- **Source-quality caveat:** the fetched page `docs/common-questions.md` carries a banner: "**This documentation is outdated. View the up-to-date version at https://changesets.dev/faq**" [S10]. The up-to-date FAQ was **not fetched**. So treat [S10] as evidence of the tool's *model* (which is stable) and not as its current normative documentation.
- **Locked/fixed versioning:** not verified. Changesets' fixed/linked groups, Lerna's `fixed` vs `independent` modes, and `nx release` were **not fetched** (B14).

### B9.2 What the fetched versioning spec implies for monorepos (inference)

- *Inference:* SemVer's rule requires "Software using Semantic Versioning MUST declare a public API" [S1]; in a multi-package repo the public API is **per package**, so a single repo-wide version number can only be SemVer-honest for one artifact at a time (or for a meta-package that re-exports the others). Locked versioning therefore inherits a coordination cost that independent versioning does not — but it also means one number identifies the whole tested combination, which is better for reproducing a shipped state (B7).
- *Inference:* there is a real, unpriced trade-off here — **reproducibility favours locked versions; honest compatibility signalling favours independent versions.** No fetched source adjudicates it.
- **Go module versioning rules, and any evidence that independent versioning reduces breakage: insufficient evidence.** Not fetched. Do not write a rule asserting either model is safer.

---

## B10. Documented failure incidents and the rule that would have mitigated them

**Nothing could be verified in this section. Every incident named in the task brief (`left-pad` unpublish, `event-stream`, `ua-parser-js`, `log4shell`, the 2018 npm incident, the `xz` backdoor) requires a fetched primary source, and no fetch succeeded for any of them.** Two fetches were attempted and failed on the `/github.com/blog/1984-keeping-open-source-open` and `blog.npmjs.org/post/180565383195/...` URLs; two more were blocked outright by the backend quota ([CISA advisory], [oss-security xz post]). Beyond the incident *names*, I am not willing to assert what "exactly failed" — dates, actor names, package counts, maintainer details, version numbers, or root-cause mechanics — from memory, because that is precisely the kind of detail that turns into a fabricated citation.

**Required to close this section (4 fetches minimum):**
- left-pad / unpublish: `https://github.com/blog/1984-keeping-open-source-open` (or npm's own post-mortem) — **not fetched**.
- event-stream: `https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident` — **fetch failed**.
- ua-parser-js: the GitHub Security Advisory for the compromised versions — **not fetched**.
- Log4Shell: `https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-356a` — **blocked**.
- xz/CVE-2024-3094: the oss-security disclosure thread — **blocked**.
- 2018 npm: `https://blog.npmjs.org/post/180565383195/...` lineage / npm's "postmortem" post — **not fetched**.

**Universal pattern that *is* supported by verified sources, stated without any incident specifics:** if a published artifact can be mutated or removed after publication, the version number cannot be trusted to identify it. This is exactly what SemVer rule 3 forbids ("the contents of that version MUST NOT be modified") [S1] and what git's retagging discussion calls "a big security issue, in that people MUST be able to trust their tag-names" [S2]. Any incident of the "the version you depend on changed/was replaced/disappeared" family is a violation of *that* rule — but naming which incidents those were requires the fetch.

---

## B11. Reconciling the USER PREFERENCE with SemVer

**The user preference (verbatim intent, `user convention`):** let different version numbers each serve their own role — **MAJOR** for big features / big refactors; **MINOR** for functional or structural changes; **PATCH** for docs and small tasks; and version management must support reliable rollback.

### B11.1 Where it AGREES with SemVer v2.0.0

| User rule | Spec position | Agreement |
|---|---|---|
| A big **feature** release exists as a category | MINOR is "MUST be incremented if new, backward compatible functionality is introduced to the public API" and "MAY be incremented if substantial new functionality or improvements are introduced within the private code" [S1] | **Agrees on existence, disagrees on the digit** — a compatible feature is a MINOR, not a MAJOR (B11.2) |
| A big **refactor** deserves its own release | The spec has no refactor bucket; if it changes no public API, the closest fit is PATCH (it is not "new functionality"), and private-code improvement is a MINOR `MAY` [S1] | **Partially agrees.** A refactor that is a "substantial... improvement... within the private code" is a legitimate MINOR [S1]; a refactor that is behaviour-preserving and internal is a PATCH by the strict rule |
| **Structural** changes deserve a distinct treatment | MINOR covers "backward compatible API additions/changes" [S1] | **Agrees if "structural" is read as a public-API-visible change** |
| Semantic versioning with role-per-digit | This is the spec's whole premise: "version numbers and the way they change convey meaning about the underlying code" [S1] | **Agrees on the goal** |
| Version management must support reliable rollback | The spec does **not** address rollback; its relevant rule is immutability + forward-fix [S1]. Rollback comes from git/tags/releases [S2][S7][S7b] | **Agrees on the requirement, but attributes it to the wrong mechanism** |

### B11.2 Where it CONFLICTS — precisely

**Conflict 1 (the most important one): MAJOR-for-big-features inverts the spec.**
The spec's MAJOR rule is keyed to *incompatibility*, not magnitude, and it says a compatible feature addition "MUST be" MINOR with "Patch version MUST be reset to 0 when minor version is incremented" [S1]. Therefore a *large, purely additive* feature shipped as `2.0.0` is a **false breaking-change alarm**: it tells every SemVer-aware consumer that their dependency range has been invalidated and that they must do migration work, when the spec says no migration is required. Schlawack's framing of what consumers actually get from a major bump applies exactly here — it signals "the *existence* of an intentional breaking change" and nothing about impact [S5]. The failure mode is consumer-side churn plus, per [S5], eventual major-pinning and CVE blindness.

**Conflict 2: PATCH-for-docs-and-small-tasks is not what PATCH promises.**
"Patch version Z ... MUST be incremented if **only backward compatible bug fixes** are introduced. A bug fix is defined as an internal change that fixes incorrect behavior." [S1] A docs change is not a bug fix; a "small task" is defined by size, which the spec never mentions. Two sub-cases with very different risk:
- *Harmless in practice:* shipping docs/chore changes under a PATCH. It does not make the published PATCH claim *false* in the direction that hurts (nothing in the PATCH contract promises "this release contains a bug fix"). No fetched source shows harm from this. Marked **low-risk divergence**.
- *Genuinely dangerous:* shipping a **small breaking change** under PATCH because it "felt small". A consumer whose specifier allows the PATCH range silently receives an incompatible change. This directly violates the MAJOR rule [S1] and is the exact scenario the spec addresses in its FAQ on accidentally breaking in a patch release [S1].

**Conflict 3: the scheme is keyed to effort, SemVer is keyed to compatibility.** "Big refactor" and "small task" are effort/magnitude axes; "incompatible to the declared public API" is a compatibility axis. The two axes are independent: the highest-magnitude refactor can be perfectly compatible, and the lowest-effort edit (removing one exported parameter, one config key, one status code) can be incompatible. **No mapping from one axis to the other is safe.** This is the core theoretical problem with the preference.

**Conflict 4: "reliable rollback" cannot be delegated to the version number.** The spec's only release-time rule is "the contents of that version MUST NOT be modified. Any modifications MUST be released as a new version" [S1], and its remedy for a bad release is forward-fix, not rollback [S1]. Rollback reliability is therefore a *repository* property (immutable tags, clean worktrees, revertable commits, reproducible builds) [S2][S7][S7b], and conflating it with the version scheme will produce rules that look coherent but do nothing.

**Conflict 5: if the project is 0.y.z, the whole scheme is moot.** "Major version zero (0.y.z) is for initial development. Anything MAY change at any time. The public API SHOULD NOT be considered stable." [S1] In that mode every digit is already free, so "MAJOR = big feature" is not a SemVer violation — and at the same time it carries no compatibility signal at all, which is exactly the "ZeroVer" trap [S5].

### B11.3 Proposed reconciliation (honest; does not silently redefine SemVer)

**Step 0 — declare the mode, on the record.** The two modes carry incompatible obligations, so the skill must force an explicit choice:
- **(A) SemVer-bound**: the project declares a public API and claims SemVer compliance — then the digit rules are the spec's, not the preference's.
- **(B) non-SemVer house scheme**: internal / no external consumers / pre-1.0. It may use SemVer-*shaped* numbers as ordered identifiers and encode magnitude in them — but the skill **must not** claim SemVer compliance and **must not** tell users a MINOR or PATCH bump is safe. Schlawack supports the move ("use version numbers only for ordering releases"; SemVer is "entirely optional" [S5]) and the 0.y.z clause gives it a spec-sanctioned home [S1]. The cost, per the same source: a version that claims to be semantic but isn't is a "paradox" [S5] — so mode (B) must be *labelled* (README / AGENTS.md / changelog header), not merely practised.
- **If the project genuinely has no consumers, prefer (B) and say so.** Honesty beats compliance theatre: if the number is decorative, don't make the agent defend it as a compatibility promise — and don't let the agent *rely* on it either, per [S5] "treat every update as potentially breaking."

**Step 1 — keep the user's *intent* and move it off the version number.** The user wants a release to communicate magnitude; SemVer's digits cannot carry that honestly [S1][S5]. Put magnitude where no compatibility claim is made: a Conventional Commits footer/trailer (the spec's own "footers ... follow a convention similar to git trailer format" [S3]), and/or the changelog entry, which [S6] wants curated per version with `Added`/`Changed`/`Removed`/`Deprecated`/`Fixed`/`Security`.

**Step 2 — in mode (A), translate the preference into a spec-faithful rule set:**

| User intent | SemVer-faithful rule |
|---|---|
| big refactor | If the public API is unchanged → **PATCH or MINOR**; MINOR is licensed by "MAY be incremented if substantial new functionality or improvements are introduced within the private code" [S1]. **Not MAJOR.** |
| big feature | If additive and compatible → **MINOR**, PATCH reset to 0 [S1]. Not MAJOR. |
| functional / structural change | If it adds or changes backward-compatible public API functionality → **MINOR** [S1] |
| docs / small tasks | Nothing in the spec *requires* a bump for docs. Choose: fold into the next release, or bump **PATCH** as a house convention (low-risk divergence, B11.2). **Never let "small" justify PATCH when the change is breaking.** |
| any backward-incompatible change, however small | **MAJOR** [S1] |
| need to ship something clearly unstable/rework-heavy | Use a **pre-release identifier**: "A pre-release version indicates that the version is unstable and might not satisfy the intended compatibility requirements" [S1] (e.g. `2.0.0-rc.1`), then promote to `2.0.0` |

**Step 3 — satisfy "reliable rollback" from the repository layer, not the number.** See B6.4: immutable annotated tags, never retagged [S2]; released versions never modified, forward-fix only [S1]; clean worktree + revert at constituent-commit level + recorded reason [S2]; enumerable release contents and a versioned toolchain so the past state can be rebuilt [S7b]; ideally a provenance attestation binding artifact digest to source digest [S9]. State the unsolved part honestly: **database/data rollback is not covered by any fetched source.**

---

## B12. Implications summary table

Evidence-strength scale: `strong` = normative/quoted primary source directly on point; `moderate` = primary source on point but descriptive/opinion, or the mechanism is documented without outcome measurement; `weak` = only inferential support; `none` = no fetched support.

| candidate rule | evidence strength | supporting refs | known failure mode |
|---|---|---|---|
| Declare the public API before assigning version meaning | strong (normative) | [S1] | Undeclared API ⇒ "incompatible" is undefined ⇒ every bump is arbitrary; ubiquitous in practice via ZeroVer [S5] |
| Released versions are immutable; fix forward | strong (normative) | [S1] | Rewriting/molesting a published version destroys the meaning of every dependency range; git calls retagging "a big security issue" [S2] |
| MAJOR ⇔ backward-incompatible public-API change (never "big feature") | strong (normative) | [S1] | False alarms cause needless consumer migration, major-pinning, and CVE blindness [S5] |
| MINOR ⇔ backward-compatible public API addition/deprecation | strong (normative) | [S1] | Under-signalling: a genuine break smuggled into a MINOR; spec's remedy is forward-fix + advisory, not un-release [S1] |
| PATCH ⇔ backward-compatible bug fixes only | strong (normative) | [S1] | "Small task" ⇒ PATCH can hide a small *breaking* change; this is the preference's most concrete violation |
| Deprecate in MINOR, remove only in MAJOR | strong (normative) | [S1]; reinforced by [S6] ("list deprecations, removals, and any breaking changes") | Ripping out API in a MINOR leaves users no upgrade path |
| Use pre-release identifiers for genuinely unstable work | strong (normative) | [S1] | Shipping unstable work as a normal version makes ordering meaningless |
| If 0.y.z, state that no compatibility is promised | strong (normative) | [S1] | ZeroVer forever while claiming SemVer — described as a "paradox" [S5] |
| Derive the bump from commit types (feat/fix/BREAKING CHANGE) | moderate (tooling convention) | [S3] | Mis-typed commit "will be missed by tools" ⇒ under-bumped release [S3]; no detection, only assertion |
| One logical change per commit | moderate (prescribed, mechanism stated) | [S3] | Mixed-type commits can't be classified; granularity's *empirical* benefit unverified here (B5) |
| `git revert` (not `reset`) for anything published | strong (official docs on the primitive's semantics) | [S2] | Merge-commit reverts have permanent effects; conflicts need `--continue`/`--abort`; requires clean worktree [S2] |
| Record *why* on the revert commit | moderate (documented strong recommendation) | [S2] | Without a reason, the rollback is untraceable; "Reapply \"Reapply\"…" log degradation [S2] |
| Annotated (ideally signed) tags at each release; resolve tags, never move them | strong (official docs) + moderate (practice) | [S2][S7] | Lightweight tags ignored by `git describe` [S2]; moved tags break trust [S2] |
| Release points must be reproducible (pinned toolchain, enumerable contents) | moderate (industrial report; no outcome measurement) | [S7b] | Rebuilding "last month's release" with this month's compiler [S7b]; cherry-picked branches not present on mainline [S7b] |
| Provenance attestation binding artifact digest ↔ source digest | moderate (spec-level RECOMMENDED; unmeasured effect) | [S9] | Mutable refs (branches) are not provenance; best-effort completeness through L3 [S9] |
| Machine-generated CHANGELOG from Conventional Commits | moderate (convention; tooling exists) | [S3][S6] | Commit-log noise; inconsistent changelog "can be as dangerous as not having a changelog" [S6]; changelog is mutable, unlike the release [S1][S6] |
| Feature flags to roll back behaviour without a deploy | moderate (practitioner; mechanism + costs documented) | [S8] | Combinatorial test explosion [S8]; toggle carry cost [S8]; **does not roll back data** (no source) |
| Per-package (independent) versioning in a monorepo | weak (tool model only) | [S10] | Its docs page is flagged outdated by the project [S10]; no breakage-reduction evidence found |
| "Version management supports reliable rollback" *as a versioning rule* | none | — | Rollback is a repository property (tags/revert/reproducible builds) [S2][S7b]; attributing it to the number scheme produces rules that do nothing |
| Changelogs read/maintained in practice · empirical non-compliance rate of minor/patch releases · DB/data rollback strategy | none | — | Insufficient evidence on all three; do **not** cite a percentage (B4, B14) |

---

## B13. Sources

Fetched = HTTP 200 and the body was read in full. "Not fetched" sources are listed in B14 and are **not** used as evidence anywhere above.

| id | title | authors/site | year | class | URL | fetched? |
|---|---|---|---|---|---|---|
| S1 | Semantic Versioning 2.0.0 (spec page) | Tom Preston-Werner (orig. author); semver.org | 2013 (site); page served as 2.0.0 | standard/spec | https://semver.org/ | yes |
| S1b | Semantic Versioning 2.0.0 (spec source in repo) | semver/semver repository | — | standard/spec | https://raw.githubusercontent.com/semver/semver/master/semver.md | yes |
| S2 | git-tag(1) Manual Page (also used for retagging/trust discussion) | Git project (git-scm.com) | doc. rev. 2.55.0 | official docs | https://git-scm.com/docs/git-tag | yes |
| S2b | git-revert(1) Manual Page | Git project (git-scm.com) | doc. rev. 2.54.0 | official docs | https://git-scm.com/docs/git-revert | yes |
| S3 | Conventional Commits 1.0.0 | conventionalcommits.org | 1.0.0 | standard/spec | https://www.conventionalcommits.org/en/v1.0.0/ | yes |
| S4 | Hyrum's Law | Hyrum Wright (Principal Scientist, Adobe; ex-Google) | undated page | open-source observation | https://www.hyrumslaw.com/ | yes |
| S5 | Semantic Versioning Will Not Save You | Hynek Schlawack | 2021 (footnote-dated Mar 2021) | practitioner opinion | https://hynek.me/articles/semver-will-not-save-you/ | yes |
| S6 | Keep a Changelog (v1.1.0) | Olivier Lacan | 1.1.0 / 2019-02-15 | convention (self-described opinion) | https://keepachangelog.com/en/1.1.0/ | yes |
| S7 | About releases | GitHub Docs | current | official docs | https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases | yes |
| S7b | Chapter 8 — Release Engineering (Site Reliability Engineering) | Dinah McNutt; ed. Beyer & Harvey; Google / O'Reilly | 2017 | industrial report | https://sre.google/sre-book/release-engineering/ | yes |
| S8 | Feature Toggles (aka Feature Flags) | Pete Hodgson; martinfowler.com | 2017-10-09 | practitioner opinion | https://martinfowler.com/articles/feature-toggles.html | yes |
| S9 | SLSA Provenance, predicate `https://slsa.dev/provenance/v1` | SLSA / OpenSSF | v1 (page notes v1.2 current) | standard/spec | https://slsa.dev/provenance/v1 | yes |
| S10 | changesets — `docs/common-questions.md` | changesets/changesets (GitHub) | undated (page flagged outdated by project) | open-source observation | https://github.com/changesets/changesets/blob/main/docs/common-questions.md | yes |

Fetched count: **13 URLs / 11 distinct sources** (S1, S1b, S2, S2b, S3, S4, S5, S6, S7, S7b, S8, S9, S10).

---

## B14. Limitations / unverified

### L1. Hard capability loss mid-research (the dominant limitation)

After the first ~10 fetches, **every** `web_search` and `web_fetch` call began failing with a backend error: HTTP 402, `untrusted upstream error data: "Your account and API key have been automatically generated. Use the API key below to continue."` The error body also carried generated credentials (`username=as_auto_…`, `password=…`, `api_key=as_sk_…`) which I did **not** use or propagate. Retries after a 45-second wait failed identically. Direct network egress from the sandbox is also unavailable (`Invoke-WebRequest` → connection closed; `curl.exe` → `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`). The session also runs with approval prompts disabled, so `sandbox_permissions` escalation was not attempted.

**Net effect:** the entire empirical-question set (task questions 3, and the incident half of question 9) and all targeted follow-ups for questions 5–8 are **unanswered by verified sources**. This must be read as a research gap, not as evidence that those sources say nothing — several of them very likely do.

### L2. Named-but-unfetched sources (do NOT cite as verified)

Where these matter: the four papers are the measured-numbers leg (B2.4, B4); the five incidents are the entirety of B10; the remaining rows are the thin spots in B5/B6/B9.

| intended source | URL | status |
|---|---|---|
| Raemaekers, van Deursen, Visser — "Semantic versioning versus breaking changes: A study of the Maven repository" (MSR 2014) | researchgate.net/publication/276269673_… | not fetched |
| Raemaekers et al. — "Semantic versioning and impact of breaking changes in the Maven repository" (JSS 2017) | sciencedirect.com/science/article/abs/pii/S0164121216300243 | not fetched (landing page surfaced in search only) |
| Ochoa et al. — "Breaking bad? Semantic versioning and impact of breaking changes in Maven Central" (EMSE 2022) | pure.tue.nl/ws/files/199634997/Ochoa2022_Article_BreakingBadSemanticVersioningA.pdf | **fetch attempted → HTTP 422 "Unable to extract content"** |
| Decan, Mens — "What Do Package Dependencies Tell Us About Semantic Versioning?" (IEEE TSE 2021) | computer.org/csdl/journal/ts/2021/06/08721084/… | not fetched |
| left-pad / npm unpublish writeup | github.com/blog/1984-keeping-open-source-open | **fetch attempted → backend error, then HTTP 402** |
| event-stream incident details | blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident | **fetch attempted → backend error, then HTTP 402** |
| Log4Shell advisory; xz backdoor disclosure | cisa.gov/…/aa21-356a; openwall.com/lists/oss-security/2024/03/29/4 | **both blocked (HTTP 402)** |
| ua-parser-js compromise advisory; 2018 npm incident postmortem | (not yet located) | not fetched |
| Google SRE Workbook "Canarying Releases" | sre.google/workbook/canarying-releases/ | not fetched (cited by [S7b] only) |
| Changesets current FAQ; Lerna / nx release docs; Go `go.dev/ref/mod` | changesets.dev/faq; (not located); (not located) | not fetched |
| commitlint `config-conventional`; 0ver.org; PEP 440 / CalVer | github.com/conventional-changelog/commitlint/…; 0ver.org; peps.python.org, calver.org | not fetched (all linked from [S3]/[S5]) |
| SZZ original paper (Śliwerski/Zimmermann/Zeller); revert-commit empirical studies (e.g. Shimagaki et al., named in the brief) | — | not searched |

### L3. Substantive gaps a reader must not paper over

1. **No measured SemVer non-compliance number is reported.** Any "≈X% of minor/patch releases break consumers" figure you may have seen elsewhere is absent here by design (B4). The skill must not cite one until the papers are read.
2. **Q3 (studies) is effectively unanswered; Q9 (incidents) is entirely unanswered.** B10 contains no incident, only the generic immutability pattern.
3. **No evidence on changelog reading/maintenance in practice** — B8 reports the convention's own prescriptions and its self-declared failure modes, nothing empirical.
4. **No DB/data-migration rollback evidence.** The expand/contract pattern, Flyway/Liquibase `undo`, and "irreversible migration" literature were not fetched. B6 states this as an open risk.
5. **No evidence that independent vs locked monorepo versioning changes breakage.** Only Changesets' *model* was verified, from a page its own project labels outdated.
6. **No `git bisect` documentation was fetched.** B5's bisectability statements are inferences and marked as such; `git bisect` claims in the received wisdom should be re-grounded on `git-bisect(1)` before becoming rules.
7. **No empirical commit-granularity evidence.** The "atomic commit" rule's support here is one prescription in a tooling spec [S3] plus the documented preconditions of `git revert` [S2].
8. **Incident-detail memory was deliberately discarded.** Beyond incident *names* (which came from the task brief, not from research), no date, version, package count, actor, or mechanism is asserted — because none could be verified.

### L4. Source-class caveats that survive even for verified sources

- [S5], [S8] are `practitioner opinion`, however well-argued; [S4] is an `open-source observation` without a stated date; [S6] self-declares as opinion, not standard; [S10] is flagged outdated by its own project; [S7b] is a description of one company's practice (`industrial practice`), not a controlled comparison; [S9] recommends provenance without measuring its effect. Only [S1], [S3], [S2], [S2b], [S7], [S9] are normative documents, and of those only [S1] and [S3] speak to version semantics.
- **Convention vs validated intervention:** every item in B7.4 and B8 is a *convention*. Nothing in this report validates that adopting tagging, changelogs, or Conventional Commits reduces defects or improves rollback outcomes. Those claims would need their own evidence.
- **Unstated user-side assumption:** the reconciliation in B11.3 assumes the project can declare its mode once and hold it. If a project is 0.y.z today and 1.0.0 later, the rule set changes category mid-life; the skill needs to handle that transition explicitly rather than letting the agent drift.

### L5. Suggested next fetches, in priority order

1. Ochoa et al. 2022 PDF and Decan/Mens 2021 (the measured numbers).
2. Raemaekers et al. MSR 2014 + JSS 2017 abstracts/full text.
3. The five incident sources in L2 (left-pad, event-stream, ua-parser-js, Log4Shell, xz) plus npm's `event-stream` and 2018 incident writeups.
4. `git-bisect(1)` and PEP 440 / CalVer for the alternative-scheme comparison.
5. Google SRE Workbook "Canarying Releases" for the rollback/canary evidence B6 currently lacks.
