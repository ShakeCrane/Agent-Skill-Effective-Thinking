# Cluster A — Software engineering evidence for project organization & code quality

Status: 2026-09-24 · Scope: rule groups (1) project organization and (2) code writing of the `project-conventions` skill — cohesion/coupling, directory & package structure, technical debt, comments, documentation-code drift, over-engineering, and the cost of each practice. Out of scope: version management (group 3), user handoff (group 4), skill-authoring mechanics.

Method: the harness `web_search` / `web_fetch` / `anysearch_search` tools were down for this entire session (HTTP 402 from the upstream extract service). Direct HTTPS was still available through Node's OpenSSL TLS stack — `curl.exe` and `Invoke-WebRequest` fail locally with schannel `SEC_E_NO_CREDENTIALS`, a TLS-credential fault that mimics "no network". Retrieval was therefore done with a small Node fetcher (direct TLS, redirects, gzip, PDF text extraction) plus four discovery APIs, each actually called: Crossref REST (`api.crossref.org`, title→DOI discovery), Unpaywall (`api.unpaywall.org`, OA status + authoritative metadata), OpenAlex (`api.openalex.org`, abstract reconstruction, since most IEEE/ACM full texts are paywalled), Semantic Scholar graph API (one abstract the publisher had elided).
Search strings actually used (Crossref `query.bibliographic`): "A Unified Framework for Coupling Measurement in Object-Oriented Systems"; "The Confounding Effect of Class Size on the Validity of Object-Oriented Metrics"; "empirical study relationship package structure defects"; "modularization empirical study software maintainability"; "Managing Technical Debt with the SQALE Method"; "Technical Debt From Metaphor to Theory and Practice"; "Detecting and Quantifying Different Types of Self-Admitted Technical Debt"; "self-admitted technical debt in documentation"; "empirical study reliability of technical debt estimation tools"; "Software Documentation Issues Unveiled"; "Software Documentation The Practitioners Perspective"; "Foundations for the Study of Software Architecture"; "An Empirical Study of Obsolete Comments"; "Exploring the impact of code comments on program comprehension"; "Quantifying the Effect of Code Smells on Maintenance Effort"; "How We Refactor and How We Know It"; "Do code smells reflect important maintainability aspects"; "shotgun surgery code smell empirical study"; "over-engineering software complexity unnecessary"; "package cohesion fault proneness empirical"; "file organization program comprehension empirical study"; "iComment bugs or bad comments"; "outdated comments code evolution empirical study"; "A Validation of Object-Oriented Design Metrics as Quality Indicators"; "To Comment or Not to Comment"; "Evaluating the usefulness of comments"; "comment smells detection". Also: arXiv API (3 topic queries, 0 useful hits) and Bing RSS (unusable Chinese-language results for quoted English queries).
Retrieval score of the 43 sources in A9: **32 retrieved with content** (2 of them local files), **9 metadata-only** (DOI verified; abstract elided or paper paywalled), **1 partially retrieved**, **1 unreachable**. "Fetched?" in A9 uses `yes` / `partial` / `meta` / `no` / `local-file`.
Evidence classes used throughout: `research finding` (peer-reviewed author claim, from full text or author abstract), `industrial practice`/`industrial report`, `practitioner opinion`, `standard/spec`, `sample observation` (local corpus), `my inference`, `user convention`. Correlational results are never presented as causal.

## A0. Executive summary (12 bullets)

1. The strongest argument for module decomposition is still conceptual, not quantitative: Parnas 1972 shows by worked example that decomposition by processing step makes one class of change touch every module, while information hiding confines it — a single designed example, not a measurement study [S1].
2. Cohesion/coupling metrics (CK suite, LCOM/CBO) do correlate with fault-proneness in early validations [S2][S3], but class size confounds those associations so strongly that El Emam et al. "question the results of previous object-oriented metrics validation studies" [S4]; Zhou et al. find size can *account for or reverse* the association with change-proneness [S5].
3. Controlled evidence that bad structure costs maintenance effort is weak: across 12 smells, 4 Java systems and 298 modified files, Sjøberg et al. found **no smell significantly associated with increased effort** after controlling file size and change count; file size and change count explained almost all modelled variation [S6].
4. Code smells reflect only some of the maintainability factors programmers themselves rate as important [S7] — "smell-clean" is not a proxy for "maintainable".
5. **No empirical study found** comparing feature/function-oriented directory structure against layer-oriented structure on any outcome. What exists is (a) package-level cohesion/coupling metric research on fault-proneness [S8][S9] and (b) practitioner conventions — Fowler's PDD layering [S10], Martin's "Screaming Architecture" [S11]. Treat "organize by function" as a convention with a plausible mechanism, not an evidenced optimum.
6. Technical debt is a *metaphor* whose origin is explicit about interest and repayment: "Shipping first time code is like going into debt… Every minute spent on not-quite-right code counts as interest on that debt" [S12]. Researchers themselves warn the metaphor is being extended beyond its range and is "to some extent also sidetracking research work" [S13][S14].
7. Self-admitted technical debt (SATD) is real and measurable in comments: 2.4%–31% of files across four large OSS projects [S15]; comments are the medium through which developers admit debt [S16][S17], and comment polarity carries priority information [S18].
8. Automated debt estimates are **not interchangeable**: leading TD tools disagree, which the authors say "limits the credibility and applicability of the findings" [S19]. Any agent rule that quantifies debt with one tool must call it a heuristic, not a measurement.
9. Comment evidence is genuinely mixed: Steidl et al. model comment *quality by category*, validated on a survey of 16 developers [S20]; comment clones appear even in well-known projects [S21]; and modules with many comments were **2–8× more often faulty** in three OSS systems [S22] — most plausibly comments-as-symptom-of-complexity, not comments-as-cause (my inference).
10. Staleness is the best-evidenced failure mode here: 74.6% of outdated comments are machine-detectable [S23], and most of >3,000 GitHub projects contain at least one outdated code-element reference at some point in their history [S24]; code-comment divergence "hinder[s] program comprehension" [S25].
11. Mitigations have thin evidence: conformance checking has one documented industrial use to steer cleanup and measure progress (single case, author also an original developer — high bias risk) [S26], while fitness functions [S27] and docs-as-code [S28] are practitioner methods with **no outcome evidence retrieved**.
12. Cost side: restructuring is overwhelmingly manual — tool support covered only 11% (Eclipse) and 9% (Mylyn) of refactorings [S29] — and documentation upkeep is repeatedly described as effort teams neglect [S30][S24]. Cheap, triggered checks should dominate an agent contract; expensive structural work needs a trigger, not a standing obligation.

## A1. Cohesion / coupling / module responsibility

### Findings

- **[A1-1]** Decomposition should be driven by what is likely to change, not by processing steps: in the conventional decomposition each module is "characterized by" a processing step, while the unconventional (information-hiding) decomposition hides "a design decision … likely to change". In the KWIC example the second and third anticipated changes "would result in changes in every module" under the conventional decomposition. — **research finding (primary text, fetched)** [S1] — *holds when* the decisions likely to change are identifiable; *fails when* requirements are unknown, and Parnas concedes the unconventional decomposition "will be less efficient in most cases" under a subroutine-per-module assumption.
- **[A1-2]** Parnas enumerates exactly the benefits this project cares about: (1) managerial — shorter development time, (2) product flexibility — "make drastic changes to one module without a need to change others", (3) comprehensibility — "study the system one module at a time". — **research finding (primary text)** [S1]. These are *expected* benefits asserted in 1972, not measured outcomes.
- **[A1-3]** CK metrics (WMC, DIT, NOC, CBO, RFC, LCOM) were grounded in an explicit ontological theory specifically because earlier metric sets were criticised for "lack of a theoretical base". — **research finding (author abstract)** [S2].
- **[A1-4]** Several CK metrics "appear to be useful to predict class fault-proneness during the early phases of the life-cycle" across eight medium-sized information-management systems built from identical requirements in C++. — **research finding (author abstract)** [S3] — *condition:* same requirements, same lifecycle, one language; not a general law (see A1-5/A1-6).
- **[A1-5]** **Size confound:** in a large C++ telecom framework, "before controlling for size, the results are very similar to previous studies" — prior validations reproduce and then collapse once class size is controlled; the authors explicitly "question the results of previous object-oriented metrics validation studies". — **research finding (author abstract)** [S4].
- **[A1-6]** The confound recurs for a different outcome: on Eclipse, class size "generally leads to an overestimate of the associations between OO metrics and change-proneness", and for many metrics "completely accounts for their associations … or results in a change of the direction". — **research finding (author abstract)** [S5]. A published rebuttal comment exists [S31], so this is an active debate, not settled science.
- **[A1-7]** Coupling and cohesion each required dedicated measurement frameworks with agreed terminology (Briand/Daly/Wüst 1999 coupling, 1998 cohesion) — evidence that these are contested constructs needing definition, not properties an agent can eyeball. — **metadata only; content UNVERIFIED** [S32][S33].
- **[A1-8]** Metric-based structural judgements are tool-relative: TD tools "essentially check software against a particular ruleset", and their diverse estimates "limit[] the credibility and applicability of the findings" when a single tool is used. — **research finding (author abstract)** [S19].
- **[A1-9]** Martin's REP/CCP/CRP package principles are widely repeated practitioner doctrine, but I could **not** retrieve a primary source in this session (no book text, no official page). — **practitioner opinion, UNVERIFIED** (see A10).

### Counterexamples & negative results

- **[A1-N1] The decisive negative result.** Six professional developers, three maintenance tasks each, four functionally equivalent Java systems, 298 files modified: "None of the 12 investigated smells was significantly associated with increased effort after we adjusted for file size and the number of changes"; Refused Bequest was associated with *decreased* effort. — **research finding (author abstract)** [S6]. This bounds what any "restructure for cohesion" rule may claim.
- **[A1-N2]** Smells cover only part of maintainability: from expert assessments of four Java systems plus observations and interviews with professionals, code smells reflect some but not all factors programmers consider important. — **research finding (author abstract)** [S7].
- **[A1-N3]** A "good practice marker" correlated with *worse* outcomes: highly-commented modules were the more faulty ones [S22] — bidirectional inference from practice-markers to outcomes fails.

### Implications (candidate rules)

- **A1-R1 (moderate).** Before splitting or creating a module, state the design decision it hides and one anticipated change it localises; if no change can be named, do not split. *Check:* the split cites a named change, not a line count. Derived from [S1], consistent with the local PC-3 seam rule [S34].
- **A1-R2 (moderate).** Do not gate work on numeric cohesion/coupling thresholds (LCOM, CBO ceilings); size-confounding [S4][S5] and cross-tool disagreement [S19] make such gates uninterpretable. Metrics may prompt a human/agent to read code, never decide.
- **A1-R3 (moderate).** When claiming a structural change improved maintainability, state what was *not* controlled for (file size, change count) [S4][S6].
- **A1-R4 (weak, convention).** Describe each module's responsibility in one phrase without "and" and name the siblings sharing that responsibility [S34, PC-1] — consistent with Parnas's criterion [S1], not itself measured.

## A2. Directory / package structure by function

### Findings

- **[A2-1]** Layer-first modularisation is presented by Fowler as the common convention — "one of the most common ways to modularize an information-rich program is to separate it into three broad layers: presentation (UI), domain logic …, and data access" — and he discusses when it helps or hurts. — **practitioner opinion (fetched)** [S10]. Popularity is not evidence of superiority; the page offers no measurements.
- **[A2-2]** "Screaming architecture" (top level should announce the use cases; framework/layer structure is secondary) is an opinion essay; my extraction reached the opening blueprint analogy but the body is navigation-heavy. — **practitioner opinion, partially fetched** [S11].
- **[A2-3]** "Deep modules" (large behaviour behind a small interface) is the module-design vocabulary a shipped agent-skill bundle actually uses, defining *depth* behaviourally as leverage per unit of interface learned, and warning against shallow pass-through modules. — **sample observation, local file** [S35]; the underlying book is practitioner opinion [S36].
- **[A2-4]** Peer-reviewed work on package-level structure exists and targets fault-proneness (package-modularization metrics, IST 2015; client-usage context in package cohesion, ASE 2016), but publisher abstracts were elided and no OA copy existed, so only the bibliographic record is verified. — **metadata only; content UNVERIFIED** [S8][S9].
- **[A2-5]** No study was found comparing feature/function-first against layer-first organisation on defect, cost or comprehension outcomes. — **insufficient evidence** (searches listed in Method).

### Counterexamples & negative results

- **[A2-N1]** Package/file-level metrics inherit the same size-confound threat as class-level metrics [S4][S5], so "our packages have low coupling" claims face the same validity problem.
- **[A2-N2]** "Organize by function" cannot be validated by tidiness checks: the only measured structure properties here are correlations, and the one controlled structure→effort study found no effect [S6].

### Implications (candidate rules)

- **A2-R1 (moderate, convention-backed).** "Put a file in the deepest existing directory whose single responsibility covers it; add a top-level directory only when the file introduces a new function of the project" [S34, PC-1] is defensible as a *predictability* rule — evidence supports comprehensibility as a goal [S1], not a specific folder taxonomy.
- **A2-R2 (moderate).** Make the structure map a derived, checkable artefact (every named directory exists; every top-level directory appears) [S34, PC-2], because the dominant documented failure is staleness, not initial misplacement [S24].
- **A2-R3 (weak).** Do not state "feature folders beat layers" as evidence-backed guidance in the skill; label it a project convention carrying the mechanism from [S1].

## A3. Technical debt

### Findings

- **[A3-1]** Definition, in the originator's words: "Although immature code may work fine … excess quantities will make a program unmasterable… Shipping first time code is like going into debt. A little debt speeds development so long as it is paid back promptly with a rewrite… Every minute spent on not-quite-right code counts as interest on that debt." — **industrial experience report (primary, fetched)** [S12]; one project's experience report, not a study.
- **[A3-2]** SATD is empirically present: in Eclipse, Chromium OS, Apache HTTP Server and ArgoUML it "exists in 2.4%–31% of the files"; the study also examines why it is introduced and how likely it is to be removed (the abstract sentence on developer experience is truncated in my fetch). — **research finding (author abstract)** [S15].
- **[A3-3]** Large-scale follow-up work studies diffusion and evolution of SATD on top of Potdar & Shihab's comment heuristics [S16]; related work classifies SATD *types* [S17] and documents SATD in issue trackers [S37] (both metadata-only here).
- **[A3-4]** SATD comments carry more than existence: polarity is studied as a proxy for severity/priority via manual analysis of 1,038 SATD comments plus a survey of 46 professional developers. — **research finding (author abstract)** [S18].
- **[A3-5]** The framing literature organises a technical-debt *landscape* because the term came to describe "a wide range of phenomena" [S14], and a dedicated critique argues the metaphor is used "beyond its range of applicability" [S13]. — **research findings (author abstracts)**.
- **[A3-6]** Tooling reality (current SonarQube Server documentation): maintainability, reliability and security are measured "on the basis of statistics on the detected … issues"; ratings are driven by the worst issue severity present (e.g. "A = 0 or more info issues … E = at least one blocker issue"); remediation effort sums per-rule effort in minutes assuming an 8-hour day. — **standard/spec (vendor documentation, fetched)** [S38]. The number is a severity-weighted count, not a measured cost.
- **[A3-7]** Reliability: the motivation of the agreement study is that "diverse estimates of TD and the identification of different mitigation actions limits the credibility and applicability of the findings". — **research finding (publisher landing page + abstract, fetched)** [S19].
- **[A3-8]** The SQALE method definition document was **not retrievable** (repository README 404, no vendor spec page fetched), so no claim is made about SQALE beyond SonarQube's current documented model [S38]. — **insufficient evidence / UNVERIFIED**.

### Counterexamples & negative results

- **[A3-N1]** A debt estimate can be internally consistent and still wrong for decisions — tool disagreement is measured, not hypothesised [S19].
- **[A3-N2]** Debt is sometimes correct: the origin text endorses shipping not-quite-right code when repaid promptly [S12], so treating every detected debt item as a defect contradicts its own source.

### Implications (candidate rules)

- **A3-R1 (strong).** Never present one tool's debt number as measured fact; name the tool and its ruleset, and cross-check with a second tool or a manual read when it drives a decision [S19][S38].
- **A3-R2 (moderate).** Record debt where the code lives (comment) or where work is tracked (issue), and state the *payment trigger* — the future change that must address it — mirroring how developers actually admit debt [S15][S16][S37] and Cunningham's repayment framing [S12].
- **A3-R3 (weak).** Do not add debt-ratio thresholds as gates [S38][S19].

## A4. Comments — what the evidence supports

### Findings

- **[A4-1]** Comment quality is category-dependent, not count-dependent: a category-based quality model with tailored metrics (ML classification on Java and C/C++), validated by a survey among 16 experienced developers plus a case study. — **research finding (author abstract)** [S20]; n=16 is a small validation base — treat as a starting taxonomy.
- **[A4-2]** Comments are the substrate of self-admitted debt: SATD is detected *in source comments* [S15][S16] and comment polarity carries priority signal [S18], so policies that discard comments destroy information developers actively record.
- **[A4-3]** Comment duplication is a real smell class: clones occur "even [in] well known projects", and manual analysis "revealed several issues in real Java projects". — **research finding (author abstract)** [S21]; a parallel taxonomy of inline comment smells exists but was metadata-only here [S43].
- **[A4-4]** Code-comment inconsistency is common enough to be a research target; documentation and code "often diverge, hindering program comprehension", leading to misuse "especially in the case of APIs of reusable libraries". The tool evaluation is described by its authors as *preliminary*. — **research finding (author abstract)** [S25].
- **[A4-5]** Stale comments are detectable: a 64-feature ML method detects 74.6% of outdated comments, and 77.2% of its detections are comments that genuinely require updating. — **research finding (author abstract)** [S23]; rates are from the authors' own evaluation, transfer to other projects is unknown.
- **[A4-6]** Reference-level staleness is pervasive at repository scale — see A5-1 [S24].
- **[A4-7]** The user-supplied title "To Comment or Not to Comment?" (attributed to Steidl et al., ICSME 2013) **does not resolve**: Crossref title search returns no such record, while Steidl, Hummel & Juergens' actual 2013 paper is "Quality analysis of source code comments" (ICPC 2013) [S20]. No record was found either for "Do Comments Follow Commenting Conventions?" or a Wen et al. "Exploring the impact of code comments on program comprehension". — **user convention appears mis-attributed; UNVERIFIED — do not cite these titles.**

### Counterexamples & negative results

- **[A4-N1] The key negative result.** "The empirical results show that the risk of being faulty in well-commented modules is about 2 to 8 times greater than non-commented modules", based on three major OSS projects and their fault data; the paper's own framing is that good comments can be a *sign* of hard-to-understand code. — **research finding (author abstract)** [S22]. This is **correlation in OSS repositories** and does not show that comments cause faults; my inference is that comment density proxies for algorithmic complexity. The only defensible rule from it: high comment density is a prompt to read the code.
- **[A4-N2]** Comments and code do not obviously co-evolve, but the classic co-evolution study (Fluri, Würsch & Gall, WCRE 2007) could not be retrieved (OA copy at zora.uzh.ch timed out), so it is cited as a record only. — **metadata only** [S39].

### Implications (candidate rules)

- **A4-R1 (moderate).** Require a comment to match its category (intent/why, contract/API, implementation detail) rather than imposing any comment-density rule [S20][S25]. *Check:* for each comment a reviewer can name the question it answers.
- **A4-R2 (strong).** Treat a code change that invalidates a nearby comment as part of the same change, and prefer a *check* over a promise: the only mechanisms with measured detection capability are automated inconsistency/outdated-comment detectors [S23][S25], and stale references survive in most projects without them [S24].
- **A4-R3 (weak→moderate).** Keep comments that record admitted debt and its payment trigger; that is their documented use [S15][S16].
- **A4-R4 (moderate, negative rule).** Never justify quality by comment quantity — modules with the most comments were the more faulty ones [S22].

## A5. Documentation-code drift / architecture erosion

### Findings

- **[A5-1]** Outdated documentation is "a pervasive problem": across **more than 3,000 GitHub projects**, "most projects contain at least one outdated code element reference at some point in their history"; keeping documentation in sync "takes considerable effort, especially for large codebases". Reported issues led to real documentation fixes. — **research finding (author abstract)** [S24].
- **[A5-2]** Architecture as a documented object has three components — elements, form, and **rationale** ("the underlying basis for the architecture in terms of the system constraints"). — **research finding (author abstract, seminal)** [S40]; a foundation, not a drift measurement.
- **[A5-3]** Documentation problems are not mainly stylistic: mining 878 documentation-related artifacts from mailing lists, Stack Overflow, issue repositories and pull requests produces a detailed taxonomy of documentation issues (artifacts were chosen over surveys to avoid survey bias). — **research finding (author abstract)** [S30].
- **[A5-4]** The practitioner-facing follow-up frames the quality problem as "insufficient and inadequate content and obsolete, ambiguous information". — **research finding (author abstract)** [S41].
- **[A5-5]** The smallest documentation unit drifts too: code and documentation "often diverge" [S25], and outdated comments are machine-detectable at 74.6% [S23].
- **[A5-6]** Conformance checking has one documented industrial use: the reflexion method reverse-engineered an industrial Java application's architecture, specified a target architecture, and was used to "steer the refactoring of the code and … measure progress" — goal: clean up obsolete code after a migration and provide architectural documentation for new developers. — **industrial report (author abstract)** [S26]. Bias caveat stated by the author: the study was conducted by the same person who is both an architecture-erosion researcher and one of the two original developers. Single case, no control.
- **[A5-7]** Fitness functions — making "fit" explicit "with as much automation as possible" — is the central prescription of the evolutionary-architecture book. — **practitioner opinion (book site, fetched)** [S27].
- **[A5-8]** Docs-as-code (documentation in version control, plain-text markup, code review, automated tests) is a documented community methodology with stated benefits (writers integrate with teams, shared ownership). — **industrial practice / community guide (fetched)** [S28]; the page offers no outcome measurements.

### Counterexamples & negative results

- **[A5-N1]** No controlled study was found showing that docs-as-code, fitness functions, or automated doc tests *reduce* drift or defects. The drift literature establishes prevalence and detectability; the reachable mitigation literature is practitioner-level [S27][S28] plus one self-biased single case [S26]. — **insufficient evidence for mitigation effectiveness.**
- **[A5-N2]** Detection is not prevention: the reported reason documentation goes stale is that "developers are unaware of when their source code modifications render the documentation obsolete" [S24] — an awareness/trigger failure, which is exactly what an agent gate can fix and a human process usually cannot.

### Implications (candidate rules)

- **A5-R1 (strong).** Any change that renames, moves or deletes a code element must update the documents referencing it *in the same change* — the failure mode with the largest measured base rate [S24][S23].
- **A5-R2 (moderate).** Keep the structure document rationale-bearing (elements + form + rationale [S40]), not a bare directory listing, since the recurring complaints are missing, obsolete and ambiguous content [S30][S41].
- **A5-R3 (moderate).** Prefer checks that can run (reference existence; "every top-level directory appears in the map" [S34, PC-2]) over prose promises; the one industrial success used automated conformance measurement to steer work [S26], and fitness functions formalise this [S27].
- **A5-R4 (weak).** Where a documentation claim can be executed (runnable example, generated API surface), make it a test — docs-as-code lists "automated tests" [S28], but the benefit is unmeasured.

## A6. Over-modularization and over-engineering

### Findings

- **[A6-1]** The main counterweight to "more structure is better" is the smell→effort null result: after controlling size and change count, none of 12 smells increased effort and one decreased it [S6]. Over-structuring is not directly measured, but the assumed benefit of smell-elimination is removed.
- **[A6-2]** Smell-based assessment is incomplete rather than wrong: smells reflect some maintainability factors and miss others [S7], so "clean smells" cannot certify a design.
- **[A6-3]** Structure metrics can reverse sign under the size confound [S4][S5]: an agent optimising a coupling number may be moving a quantity that does not track the outcome.
- **[A6-4]** Debt estimates are unstable across tools [S19] — structural cleanliness is not a quantity that can be reliably optimised.
- **[A6-5]** Reducing unnecessary architecture complexity is itself a research topic (decision support for reducing "unnecessary IT complexity" of application architectures), i.e. the problem is recognised — record verified only. — **metadata only** [S42].
- **[A6-6]** A concrete practice-backfires result: well-commented modules were 2–8× more frequently faulty [S22] (association, not causation; my inference: comments proxy for complexity).

### Counterexamples & negative results

- **[A6-N1] No study found** measuring the cost of premature abstraction/YAGNI violations, or comparing over-modularised against appropriately-modularised systems on any outcome; searches for over-engineering and shotgun-surgery empirics returned only detection-method work. — **insufficient evidence.** A rule citing "premature abstraction is costly" as research-backed would over-claim; the best support is indirect [S1][S6][S22].
- **[A6-N2]** Parnas's own caveat cuts against maximal decomposition: the information-hiding decomposition "will be less efficient in most cases" under the subroutine-per-module assumption [S1].

### Implications (candidate rules)

- **A6-R1 (moderate).** Require a second concrete user before introducing an abstraction, and a named change before splitting a module (the local PC-3 seam rule already demands this [S34]); evidence base [S1] plus the absence of measured benefit for extra structure [S6].
- **A6-R2 (moderate).** Never use line count as a split criterion [S34]; size dominates effort explanations in the one controlled study [S6].
- **A6-R3 (weak).** Treat "reduce smells" as one input among several, not a goal: smells cover only part of maintainability [S7] and eliminating them did not reduce measured effort [S6].

## A7. Cost model (what each practice costs, and when it pays)

| practice | measured/attested cost | when it pays | class & refs |
|---|---|---|---|
| Restructuring / refactoring | Overwhelmingly manual: tool support used for only **11%** (Eclipse) and **9%** (Mylyn) of refactorings; study drew on >39,000 developers, 240,000 tool-assisted refactorings, 2,500 developer hours, 12,000 version-control commits | When it localises a *named* anticipated change [S1]; not when it only improves a metric [S4][S6] | research finding [S29][S1] |
| Comment writing / maintenance | Categories must be judged individually (model + metrics + 16-developer survey) [S20]; comment clones and issues appear even in well-known projects [S21]; staleness must be detected mechanically (74.6% recall) [S23] | Highest for intent/why and admitted debt + trigger [S20][S15]; low as volume [S22] | research findings [S20][S21][S23][S22] |
| Documentation upkeep | Keeping docs in sync "takes considerable effort, especially for large codebases" [S24]; creation/maintenance "often neglected" [S30]; obsolete/ambiguous content is the recurring complaint [S41] | For element references developers must rely on — the measured drift surface [S24] | research findings [S24][S30][S41] |
| Architecture / structure documentation | Rationale is the documented third component of architecture [S40]; conformance measurement was used to steer and measure progress in one industrial cleanup [S26] | During migrations/cleanups with a defined target architecture [S26] | research + single industrial case [S40][S26] |
| Debt measurement tooling | Vendor model = severity-weighted issue statistics + per-rule effort minutes (8-hour day) [S38]; cross-tool disagreement undermines single-tool estimates [S19] | As a trend signal inside one tool, never as a decision quantity [S19][S38] | standard/spec + research [S38][S19] |
| Adding structure (abstractions, layers, splits) | No measured cost study found; assumed benefit unsupported by the effort study [S6]; Parnas notes the unconventional decomposition is "less efficient in most cases" [S1] | When it hides a decision likely to change [S1] | research finding (indirect) [S6][S1] |

**My inference from the table:** the best evidence-to-cost ratio belongs to *cheap checks* — reference/staleness checks on docs and comments [S24][S23] and "name the change you are localising" gates [S1]. The worst belongs to *quantitative structural gates* [S19][S38][S4]. Restructuring and documentation rewrites are expensive and manual [S29][S24], so they should be triggered by a concrete change rather than performed as hygiene.

## A8. Implications summary table

| candidate rule | evidence strength | supporting refs | known failure mode |
|---|---|---|---|
| Split a module only when you can name the design decision it hides and a change it localises | moderate (seminal example, not measurement) | S1, S34 | requirements unknown at design time; over-splitting is slower [S1, A6-N2] |
| No numeric cohesion/coupling threshold as a gate | moderate | S4, S5, S19, S31 | metrics remain useful as reading prompts; teams may want them anyway |
| Report debt numbers as tool-specific heuristics, never as facts | strong | S19, S38 | informal cross-tool comparisons still happen |
| Record debt in the medium developers use (comment/issue) with a payment trigger | moderate | S15, S16, S37, S12 | comment rot — needs the staleness rule below |
| Update docs/comments referencing a code element in the same change | strong | S24, S23, S25 | detection ≠ prevention; needs a check that fires [S24] |
| Structure map must be derived and checked (dirs exist / all top-level listed) | moderate (local convention + drift evidence) | S34, S24, S40 | small repos may not need a map; map rots silently without a check |
| A comment must answer the question its category claims (why / contract / detail) | moderate | S20, S25 | taxonomy validated on 16 developers; may not transfer |
| Never justify quality by comment volume; high density ⇒ read the code | moderate (correlation only) | S22 | density is confounded by complexity (my inference) |
| Abstraction requires a second concrete user (no speculative generality) | weak | S34, S6, S1 | no direct study; a real second user may be imminent |
| Prefer executable checks (reference checks, example tests) over prose promises | moderate mechanism / weak outcome | S26, S27, S28 | no controlled evidence that fitness functions reduce drift |
| "Organize by feature, not by layer" | weak — convention, not evidence | S10, S11, S8, S9 | no comparative study found; layer-first is the common real-world convention [S10] |
| Keep rules triggered rather than standing | moderate | S29, S24 | over-triggering burns turns; under-triggering misses drift |

## A9. Sources

| id | title | authors/site | year | class | URL | fetched? |
|---|---|---|---|---|---|---|
| S1 | On the Criteria To Be Used in Decomposing Systems into Modules | D. L. Parnas (CACM) | 1972 | peer-reviewed | https://www.win.tue.nl/~wstomv/edu/2ip30/references/criteria_for_modularization.pdf · DOI https://doi.org/10.1145/361598.361623 (ACM PDF returned 403 Cloudflare) | yes (full text, mirror) |
| S2 | A metrics suite for object oriented design | Chidamber & Kemerer (IEEE TSE) | 1994 | peer-reviewed | https://doi.org/10.1109/32.295895 · abstract via https://api.openalex.org/works/doi:10.1109/32.295895 | yes (abstract) |
| S3 | A validation of object-oriented design metrics as quality indicators | Basili, Briand, Melo (IEEE TSE) | 1996 | peer-reviewed | https://doi.org/10.1109/32.544352 | yes (abstract); the UMD PDF https://www.cs.umd.edu/~basili/publications/journals/J66.pdf is a scanned image (200 OK, no extractable text) |
| S4 | The confounding effect of class size on the validity of object-oriented metrics | El Emam, Benlarbi, Goel, Rai (IEEE TSE) | 2001 | peer-reviewed | https://doi.org/10.1109/32.935855 | yes (abstract) |
| S5 | Examining the Potentially Confounding Effect of Class Size on the Associations between OO Metrics and Change-Proneness | Zhou, Leung, Xu (IEEE TSE) | 2009 | peer-reviewed | https://doi.org/10.1109/TSE.2009.32 | yes (abstract) |
| S6 | Quantifying the Effect of Code Smells on Maintenance Effort | Sjøberg, Yamashita, Anda, et al. (IEEE TSE) | 2013 | peer-reviewed | https://doi.org/10.1109/TSE.2012.89 | yes (abstract) |
| S7 | Do code smells reflect important maintainability aspects? | Yamashita & Moonen (ICSM) | 2012 | peer-reviewed | https://doi.org/10.1109/ICSM.2012.6405287 | yes (abstract, fetch truncated) |
| S8 | An empirical analysis of package-modularization metrics: Implications for software fault-proneness | Zhao, Yang, Lu, et al. (IST) | 2015 | peer-reviewed | https://doi.org/10.1016/j.infsof.2014.09.006 | meta only (abstract elided by publisher; OpenAlex/S2/Unpaywall all empty) |
| S9 | Understanding the value of considering client usage context in package cohesion for fault-proneness prediction | Zhao, Yang, Lu (Automated Software Engineering) | 2016 | peer-reviewed | https://doi.org/10.1007/s10515-016-0198-6 | meta only |
| S10 | Presentation Domain Data Layering | Martin Fowler (martinfowler.com bliki) | 2015 | practitioner opinion | https://martinfowler.com/bliki/PresentationDomainDataLayering.html | yes |
| S11 | Screaming Architecture | Robert C. Martin (blog.cleancoder.com) | 2011 | practitioner opinion | https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html | partial (nav-heavy page; only opening extracted) |
| S12 | The WyCash Portfolio Management System (OOPSLA '92 experience report) | Ward Cunningham | 1992 | industrial report | https://c2.com/doc/oopsla92.html | yes (verbatim debt passage) |
| S13 | On the limits of the technical debt metaphor: some guidance on going beyond | Schmid (MTD) | 2013 | peer-reviewed | https://doi.org/10.1109/MTD.2013.6608681 | yes (abstract) |
| S14 | Technical Debt: From Metaphor to Theory and Practice | Kruchten, Nord, Ozkaya, et al. (IEEE Software) | 2012 | peer-reviewed | https://doi.org/10.1109/MS.2012.167 | yes (abstract) |
| S15 | An Exploratory Study on Self-Admitted Technical Debt | Potdar & Shihab (ICSME) | 2014 | peer-reviewed | https://doi.org/10.1109/ICSME.2014.31 | yes (abstract; Unpaywall: closed, no OA copy) |
| S16 | A large-scale empirical study on self-admitted technical debt | Bavota & Russo (MSR) | 2016 | peer-reviewed | https://doi.org/10.1145/2901739.2901742 | yes (abstract) |
| S17 | Detecting and quantifying different types of self-admitted technical debt | Maldonado & Shihab (MTD) | 2015 | peer-reviewed | https://doi.org/10.1109/MTD.2015.7332619 | meta only |
| S18 | Self-Admitted Technical Debt and comments' polarity: an empirical study | Cassee, Zampetti, Novielli, et al. (EMSE) | 2022 | peer-reviewed | https://doi.org/10.1007/s10664-022-10183-w | yes (abstract) |
| S19 | Evaluating the agreement among technical debt measurement tools | Amanatidis, Mittas, Moschou, et al. (EMSE 25:4161–4204) | 2020 | peer-reviewed | https://doi.org/10.1007/s10664-020-09869-w | yes (publisher landing page + abstract) |
| S20 | Quality analysis of source code comments | Steidl, Hummel, Juergens (ICPC) | 2013 | peer-reviewed | https://doi.org/10.1109/ICPC.2013.6613836 | yes (abstract) |
| S21 | Replicomment (comment clones) | Blasi & Gorla (ICPC) | 2018 | peer-reviewed | https://doi.org/10.1145/3196321.3196360 | yes (abstract) |
| S22 | An Empirical Analysis on Fault-Proneness of Well-Commented Modules | Aman (IWESEP) | 2012 | peer-reviewed | https://doi.org/10.1109/IWESEP.2012.12 | yes (abstract) |
| S23 | Automatic Detection of Outdated Comments During Code Changes | Liu, Chen, Chen (COMPSAC) | 2018 | peer-reviewed | https://doi.org/10.1109/COMPSAC.2018.00028 | yes (abstract) |
| S24 | Detecting outdated code element references in software repository documentation | Tan, Wagner, Treude (EMSE) | 2023 | peer-reviewed | https://doi.org/10.1007/s10664-023-10397-6 | yes (abstract) |
| S25 | Towards Detecting Inconsistent Comments in Java Source Code Automatically (upDoc) | Stulova, Blasi, Gorla (SCAM) | 2020 | peer-reviewed | https://doi.org/10.1109/SCAM51674.2020.00012 | yes (abstract) |
| S26 | Industrial experience on code clean-up using architectural conformance checking | Koschke (ECSA companion) | 2018 | industrial report | https://doi.org/10.1145/3241403.3241453 | yes (abstract) |
| S27 | Building Evolutionary Architectures (book site: fitness functions) | Ford, Parsons, Kua (evolutionaryarchitecture.com) | n.d. | practitioner opinion | https://evolutionaryarchitecture.com/ | yes |
| S28 | Docs as Code | Write the Docs community guide | n.d. | industrial practice | https://www.writethedocs.org/guide/docs-as-code/ | yes |
| S29 | How We Refactor, and How We Know It | Murphy-Hill, Parnin, Black (IEEE TSE) | 2012 | peer-reviewed | https://doi.org/10.1109/TSE.2011.41 | yes (abstract) |
| S30 | Software Documentation Issues Unveiled | Aghajani, Nagy, Vega-Márquez, et al. (ICSE) | 2019 | peer-reviewed | https://doi.org/10.1109/ICSE.2019.00122 | yes (abstract) |
| S31 | Comments on "The Confounding Effect of Class Size on the Validity of Object-Oriented Metrics" | Evanco (IEEE TSE) | 2003 | peer-reviewed | https://doi.org/10.1109/TSE.2003.1214331 | meta only |
| S32 | A unified framework for coupling measurement in object-oriented systems | Briand, Daly, Wüst (IEEE TSE) | 1999 | peer-reviewed | https://doi.org/10.1109/32.748920 | meta only (Unpaywall: closed) |
| S33 | A Unified Framework for Cohesion Measurement in Object-Oriented Systems | Briand, Daly, Wüst (EMSE) | 1998 | peer-reviewed | https://doi.org/10.1023/A:1009783721306 | meta only |
| S34 | project-conventions/SKILL.md (PC-1…PC-n rule records, classes, checks) | this repo, `.dsh/skills/project-conventions/` | 2026 | sample observation (local) | `<repo root>\.dsh\skills\project-conventions\SKILL.md` | local-file |
| S35 | codebase-design/SKILL.md (deep-module vocabulary: depth, seam, leverage, locality) | mattpocock-skills-dsh bundle | n.d. | sample observation (local) | `<local dsh-web profile>\node_modules\mattpocock-skills-dsh\skills\codebase-design\SKILL.md` | local-file |
| S36 | A Philosophy of Software Design (book page, 2nd ed.) | John Ousterhout (Stanford) | 2021 | practitioner opinion | https://web.stanford.edu/~ouster/cgi-bin/book.php | yes (page; book text not fetched) |
| S37 | On the documentation of self-admitted technical debt in issues | Xavier, Montandon, Ferreira, et al. (EMSE) | 2022 | peer-reviewed | https://doi.org/10.1007/s10664-022-10203-9 | meta only (OpenAlex abstract empty) |
| S38 | Understanding measures and metrics (ratings, remediation effort, 8-hour day) | SonarSource (SonarQube Server docs) | 2026 | standard/spec (vendor) | https://docs.sonarsource.com/sonarqube-server/latest/user-guide/code-metrics/metrics-definition/ | yes |
| S39 | Do Code and Comments Co-Evolve? On the Relation between Source Code and Comment Changes | Fluri, Würsch, Gall (WCRE) | 2007 | peer-reviewed | https://doi.org/10.1109/WCRE.2007.21 · OA copy https://www.zora.uzh.ch/id/eprint/72263/1/20121211115644_merlin-id_2530.pdf | no (OA host ETIMEDOUT; record verified via Crossref/Unpaywall) |
| S40 | Foundations for the study of software architecture | Perry & Wolf (ACM SIGSOFT SEN) | 1992 | peer-reviewed | https://doi.org/10.1145/141874.141884 | yes (abstract) |
| S41 | Software documentation (ICSE 2020 practitioners'-perspective paper; usually cited with the longer subtitle) | Aghajani, Nagy, Linares-Vásquez, et al. | 2020 | peer-reviewed | https://doi.org/10.1145/3377811.3380405 | yes (abstract) |
| S42 | Decision Support for Reducing Unnecessary IT Complexity of Application Architectures | Wehling, Wille, Seidl (ICSAW) | 2017 | peer-reviewed | https://doi.org/10.1109/ICSAW.2017.47 | meta only |
| S43 | Towards Automated Detection of Inline Code Comment Smells | Oztas, Torun, Tüzün (EASE) | 2025 | peer-reviewed | https://doi.org/10.1145/3756681.3756988 | meta only |

Discovery/verification endpoints actually fetched: `https://api.crossref.org/works?query.bibliographic=…`; `https://api.unpaywall.org/v2/{doi}?email=…`; `https://api.openalex.org/works/doi:{doi}?select=…`; `https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields=…`. Chidamber & Kemerer's 1992 MIT working-paper record was also fetched (https://hdl.handle.net/1721.1/48424; its PDF bitstream returned HTTP 405, so no text).

## A10. Limitations / unverified

**Answered by fetched sources:** A1-1…A1-8; A3-1…A3-7; A4-1…A4-6 and A4-N1; A5-1…A5-6; A6-1…A6-3 and A6-6; the A7 rows for restructuring, comments, documentation and tooling.
**Answered only by local documents:** the *form* of the candidate rules (trigger + class + check, PC-n numbering, seam and structure-map checks) [S34] and the deep-module vocabulary [S35]. Both are single-sample artefacts; neither is evidence that the mechanics work.

Unresolved items:
1. **Feature-vs-layer structure: no comparative study found** (four Crossref phrasings, arXiv, Bing). Treat the user's "organize top-level folders by function" as `user convention`.
2. **Cost of premature abstraction / YAGNI violations: no study found**, and no study measuring over-modularisation directly — only indirect negatives [S6][S22].
3. **Mitigation effectiveness (docs-as-code, fitness functions, automated doc tests): not established.** [S27][S28] describe methods without outcome data; [S26] is one self-biased case.
4. **SQALE method definition not retrieved** (GitHub README 404; no vendor spec page). No claim is made about SQALE beyond SonarQube's current documented model [S38].
5. **Martin's REP/CCP/CRP package principles: no primary source retrieved.** Widely repeated, but UNVERIFIED here and not citable as evidence.
6. **Three user-supplied titles do not resolve** and appear mis-attributed: "To Comment or Not to Comment?" (Steidl et al., ICSME 2013 — the real 2013 paper is ICPC [S20]), "Do Comments Follow Commenting Conventions?", and Wen et al. "Exploring the impact of code comments on program comprehension". No Crossref/OpenAlex record for any of them. **Do not cite them.**
7. **"Documentation smells" literature not located**; the drift works found are framed as outdated/inconsistent references [S24][S23][S25], not a smell taxonomy.
8. **Paywalls:** 9 sources are metadata-only (S8, S9, S17, S31, S32, S33, S37, S42, S43). Findings for those rest on titles/venues alone and are marked UNVERIFIED wherever referenced.
9. **Correlational designs.** S4/S5/S6/S22/S24 are OSS or single-organisation studies; S6 is the only controlled experiment found (six professionals) and it found *no* effect. No source establishes causation between structure and outcomes.
10. **Tool/API limits hit:** harness `web_search`/`web_fetch`/`anysearch_search` = HTTP 402 all session; `curl.exe` and `Invoke-WebRequest` = schannel `SEC_E_NO_CREDENTIALS`; Semantic Scholar = 429 on most calls (only 2 succeeded); Bing RSS = unrelated Chinese results for quoted English queries; arXiv API = 0 results on three topic queries; `zora.uzh.ch` and `dblp.org` timed out or returned empty bodies once each; `dl.acm.org` PDFs and a `cs.umd.edu` course PDF = 403; `dspace.mit.edu` bitstream = 405; `en.wikipedia.org` and `r.jina.ai` are unreachable from this host (DNS-poisoned) and the local v2ray HTTP proxy at 127.0.0.1:10808 was intermittent.
11. **The most decision-relevant gap for the new skill:** no measurement shows that any of the four intended principles (understandability, maintainability, recoverability, collaboration-certainty) is improved by the specific mechanics proposed — structure-map upkeep, periodic temp-file cleanup, or comment-category rules. The literature supports the *failure modes* (drift, staleness, size confounding) far better than the *remedies*.
