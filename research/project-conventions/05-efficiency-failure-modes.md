# Cluster E — Efficiency costs and failure modes that constrain the Skill

Status: `research` — mixed evidence. Directionally supported findings are marked; unsupported
premises are marked `UNANSWERED` or `UNVERIFIED` rather than filled in.
Scope: the cost side of the six intended rule groups (folder-by-function, periodic temp cleanup,
structure diagram, keep comments, versioning with rollback, report to the user), plus the
efficiency and failure-mode literature that constrains them.

Method:
- The DSH `web_search` / `web_fetch` / `anysearch_search` tools returned **HTTP 402 from the
  upstream extract service for the entire session** and were unusable. `curl.exe` and
  `Invoke-WebRequest` also fail on this host with a **local TLS credential error**
  (`schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`), which makes the sandbox look
  offline when it is not.
- Working path used instead: **Node.js `fetch` (own OpenSSL stack, unaffected)**. Every external
  source below marked `fetched ✔` was retrieved over HTTPS with that path and its content read in
  this session. Discovery used the **arXiv Atom API, Crossref API, GitHub API** (OpenAlex and
  Semantic Scholar were HTTP 429 rate-limited; Bing/DDG/Ecosia/Brave returned geo-mangled or
  bot-blocked HTML and were discarded as unusable).
- Offline first-hand corpus: `AI-Runs/overnight-20260913/` in this repository — a documented
  7.8-hour autonomous agent run — plus direct read-only measurement of the repo.
- **Nothing in this file is reconstructed from memory.** Where a claim could not be sourced it is
  labelled `UNANSWERED` / `UNVERIFIED` and no number, incident, or DORA finding is invented.

Source-class labels used: `peer-reviewed`, `preprint (arXiv)`, `official postmortem`,
`industrial report`, `news report`, `practitioner opinion`, `open-source observation`,
`official documentation`, `first-hand observation (this repository)`, `first-hand measurement`.

---

## E0. Executive summary

1. **Agentic task cost is large, measurable, and dominated by interaction count, not per-call
   size.** On SWE-Bench Pro, mean API cost was **$1.98/task (GPT-5)** vs **$11.32/task
   (Claude Sonnet 4.5)** — **5.7×** — at a mean **3.13M input tokens / 64 API calls** and
   **2.80M / 78 calls** respectively (`[E9]`). Scaffolds that raise per-call reasoning but cut
   round-trips win on total tokens (`[E8]` Obs. 2).
2. **Failure costs 3–4× more than success.** A failed SWE-Agent/GPT-4o-mini attempt consumed
   **8.8M tokens and 658.0 s** vs **1.8M and 167.2 s** on success; the paper names the cause
   "**expensive failures**" plus a missing "futility detection" capability (`[E8]` Obs. 4, Table 3).
3. **Long input growth is structural.** "**Token Snowball**: even small per-call additions to the
   prompt accumulate" because scaffolds append every response to the next prompt — so cost grows
   roughly linearly per call even when no progress is made (`[E8]` Obs. 3, Fig. 1).
4. **More thinking genuinely hurts past a point, but the magnitudes I could verify are
   direction-only.** "Marginal returns diminish substantially at higher budgets"; models
   "**abandon previously correct answers**"; "optimal thinking length varies across problem
   difficulty"; moderate budgets can "reduce computation significantly while maintaining
   comparable accuracy" (`[E2]`). Concrete effect sizes were **not** obtained — abstracts only.
5. **The over-clarification premise is not supported — the evidence points the other way.**
   In the MAST taxonomy over **1642 traces**, the quantified clarification failure is
   "**FM-2.2 Fail to ask for clarification 6.80%**" (`[E7]`). Across all 14 modes there is **no
   "asks too many questions" mode**. An anti-over-asking rule is therefore a design choice, not an
   evidence-backed one.
6. **The quantified long-horizon risks are running too long and not finishing.** The two most
   prevalent MAST modes are "**FM-1.3 Step repetition 15.7%**" and "**FM-1.5 Unaware of
   termination conditions 12.4%**" (`[E7]`) — together ≈28% of annotated failures. This is the
   strongest empirical support in this cluster for *stopping* rules.
7. **DORA's own guidance contradicts a frequency-maximising release rule.** "Speed and stability
   are **not** tradeoffs … the metrics are **correlated** for most teams" (`[E5]`) — but DORA also
   states the boundary conditions itself: naming deployment frequency as a goal "ignoring
   Goodhart's law … increases the likelihood that teams will try to game the metrics"; the metrics
   are "best suited for measuring **one application or service at a time**"; and
   "**focusing on measurement at the expense of improvement**" is a listed pitfall (`[E5]`).
8. **The specific 2024 DORA cluster thresholds are `UNANSWERED`.** The overview page's key findings
   were retrieved (`[E4]`); the 2024 report PDF failed to fetch twice, so no elite/high/medium/low
   deployment-frequency or change-failure-rate figures are quoted here.
9. **Automated deletion has cost real production data, three times over, with primary postmortems.**
   GitLab 2017-01-31: a directory wipe aimed at the *secondary* PostgreSQL host hit the **primary**;
   **~300 GB** removed in 1–2 s, **~18 h** outage, data from 17:20–23:30 UTC lost, est. **~5000
   projects / ~5000 comments / ~700 users** (`[E6]`). AWS S3 2017-02-28: a playbook capacity-removal
   command with "**one of the inputs … entered incorrectly**" removed a larger server set, taking
   GET/LIST/PUT/DELETE down for ~4 h 17 m (`[E12]`). npm 2016-03-22: one author unpublished
   **272 packages** → "**hundreds of failures per minute**", **2.5 h** disruption (`[E11]`).
10. **Guardrails are documented and specific, and `git clean` already ships them.**
    `-n/--dry-run` shows what would happen; without `-d` git "**will not recurse into untracked
    directories to avoid removing too much**"; `-x` *also* deletes ignored files; and "Git will
    refuse to modify untracked **nested git repositories** … unless a **second** `-f` is given"
    (`[E13]`). AWS's own fix was a **minimum-capacity floor**, not a warning (`[E12]`).
11. **This repository is a live instance of the cleanup problem, and cleanup alone would be the
    wrong response.** Measured 2026-09-24: the run archive holds **3653 files / 1919 directories /
    14.77 MB**, including **27 nested `.git` repositories** and **104 `__pycache__` directories**,
    with **no `.gitignore`** at the repo root, so `git status -uall` reports **2178 untracked
    entries** (`[L9]`). Those 2178 paths include the *only surviving copy* of the run's evidence.
12. **The run's cost and progress self-reports are not trustworthy, in its own files.** Two token
    figures disagree by **12.6×** (49,000,000 subagent-measured vs 3,879,627 byte-proxy) (`[L2]`,
    `[L6]`, `[L7]`); `metrics.csv` `cases` goes **83 → 67** (non-monotonic) and its note column
    counts (30/32/35/38 runs) disagree with `STATE.json`'s `cases_completed: 105` (`[L5]`, `[L6]`);
    and `failures.jsonl` is **0 bytes** while the report says the 3 infra failures are in it
    (`[L1]` §15, `[L9]`). This is the single most useful constraint on any "report to the user"
    rule: **volume of reporting is not reliability of reporting.**

---

## E1. Agent cost structure (numbers)

### Measured per-task cost on a coding benchmark — `[E9]` `open-source observation`
SWE-Bench Pro (731 tasks, 11 repos); SWE-Agent scaffold v1.1.0, 250-turn limit, **no cost limit**;
both runs 2025-10-13; **616 paired instances** where both models submitted a patch (114 unsubmitted
excluded); costs are **Scale AI internal litellm pricing, not public list prices**.

| Metric | GPT-5 | Claude Sonnet 4.5 | ratio |
|---|---|---|---|
| Mean cost / task | **$1.98** | **$11.32** | 5.7× |
| Median cost / task | $1.74 | $10.75 | 6.2× |
| Cost per *resolve* | $4.65 | $25.45 | 5.5× |
| Total spend (616 tasks) | $1,217.90 | $6,973.20 | 5.7× |
| Mean input tokens | 3,134,425 | 2,802,336 | 0.9× |
| Mean API calls | 64 | 78 | 1.2× |
| Mean output tokens | 7,101 | 17,705 | 2.5× |
| Mean steps | 65 | 78 | 1.2× |
| Mean tool-wait (s) | 295.8 | 265.7 | 0.9× |
| `create` actions | 1.4 | 6.1 | 4.5× |
| Thoughts (bytes) | 3,230 | 12,339 | 3.8× |

What this number covers: **API cost + token volume + tool wall-time for one benchmark task.**
What it does **not** cover (stated in the source): wall-clock per instance and LLM inference latency
were "not recorded anywhere"; GPT-5's hidden reasoning tokens are billed but not counted; no
input/output cost split. It is also **benchmark cost, not production cost**.

### Where the cost actually goes — `[E8]` `preprint (arXiv)`
SWE-Effi, 5 scaffolds × 3 LLMs, 50 stratified issues from SWE-bench-Verified, 15 permutations:
- `SWE-Agent + Qwen3-32B`: **28%** resolve, **35.5** calls, **440K** input tokens.
- `SWE-Agent + GPT-4o-mini`: **10%** resolve, **181** calls, **>8.1M** input tokens — "**more than
  18×** the token cost" for a lower resolve rate.
- `OpenHands + Qwen3-32B`: 34% resolve, EuTB 22.7%; with GPT-4o-mini: 11.9% resolve, EuTB
  **6.8%**.
- `AutoCodeRover + Qwen3-32B`: **38%** resolve using only **14.7** calls and **55.5K** input tokens.
- **Failed vs resolved (Table 3):** SWE-Agent/GPT-4o-mini failed **8.8M tokens / 658.0 s** vs
  resolved **1.8M / 167.2 s** (>4×); OpenHands/Llama-3.3-70B failed **238.9 s** vs **79 s**;
  AutoCodeRover failures "nearly three times as long as a success".
- **Latency model** (regression on **515,041** API calls, R²=0.79): `1.457 s` fixed +
  `4.266e-5 × input tokens` + `4.999e-3 × output tokens`. Budget caps used: **2M tokens**,
  **$1.00**, **30 min**.
- Stated limits: 50 of 500 issues; "initial runs sometimes took upwards of **two weeks** to
  complete with **several hundred dollars** in API costs".

### Time horizon as the unit of difficulty — `[E3]` `industrial report`
METR defines the task-completion time horizon as the human-expert task duration at which an agent is
predicted to succeed at a given reliability; the 50% horizon is where the fitted logistic crosses
50% success. Tasks come from RE-Bench, HCAST and shorter novel software tasks (>100 tasks),
**6 independent runs per task (~1000 runs)**, human baselines = geometric mean of successful
completion times. METR publishes that "**Measurements above 16 hrs are unreliable with our current
task suite**" and that agents are "typically several times faster than humans on tasks they complete
successfully". **Per-model horizon values were not extracted** — they live in an interactive graph I
could not read. `UNANSWERED` for specific horizon numbers.

### Measurement limits on this host — `[L4]` `first-hand observation (this repository)`
- `KI-23`: **0/36** runs had reliable action/tool counts; `elapsedMs` was dominated by orchestrator
  round-trip latency (v1 runs all ≈242 s) → efficiency channel recorded `UNMEASURABLE`.
- `KI-34` / `KI-37`: the host **cannot enforce tool/action budgets**, and **token/cost are not
  exposed** → the protocol records `null` rather than estimating.
- `KI-24`: the *skill's own* cost was measured as artifact bytes — treatment median **5411** vs
  controlB **3280** (**+65%**), increment concentrated in verification artifacts, "**value
  undetermined**" because the corpus had no discriminating failures.

---

## E2. Over-planning / over-thinking (measured)

**Direction supported; effect sizes not obtained.**

- `[E1]` `preprint (arXiv)` — Chen et al., *Do NOT Think That Much for 2+3=? On the Overthinking of
  o1-Like LLMs* (arXiv:2412.21187, v1 2024-12-30, v2 2025-02-01; 14 authors). Claims: "the **first
  comprehensive study** on the prevalent issue of overthinking in these models, where excessive
  computational resources are allocated for simple problems with minimal benefit"; introduces
  efficiency metrics "from both outcome and process perspectives"; a self-training mitigation
  "successfully reduces computational overhead **while preserving model performance**" across GSM8K,
  MATH500, GPQA, AIME. **Verified: title/authors/IDs/claims-as-written. Not verified: any numeric
  effect size** (abstract only).
- `[E2]` `preprint (arXiv)` — Zhou et al., *When More Thinking Hurts: Overthinking in LLM Test-Time
  Compute Scaling* (arXiv:2604.10739, submitted **2026-04-12**, 11 pages, 7 figures). Claims:
  "marginal returns **diminish substantially** at higher budgets"; models exhibit overthinking
  "where extended reasoning is associated with **abandoning previously correct answers**";
  "optimal thinking length **varies across problem difficulty**, suggesting that uniform compute
  allocation is suboptimal"; "stopping at moderate budgets can reduce computation significantly
  while maintaining comparable accuracy". **Not verified: effect sizes.**
- **`UNANSWERED` — budget forcing, and per-difficulty numeric curves.** No source retrieved.
- `[L4]` `first-hand observation` — **null result at current difficulty**: `KI-29` records that v1's
  anti-overthinking probe produced `created=0` and that v2 negative controls (9 runs) showed "no
  over-thinking, no scope creep, no TODO chasing, no extra files", and instructs not to re-verify
  anti-overthinking on simple corpora. `KI-27`/`KI-28` attribute this to a corpus ceiling rather
  than to the absence of the behaviour.

**Reading for the Skill.** "Think less on easy, cheaply verifiable tasks" is directionally
supported. A *hard token/step cap* is **not** supported by any number I verified, and on this host
is not even enforceable (`[L4]` `KI-34`).

---

## E3. Over-clarification and human-interruption cost

- **Evidence runs opposite to the premise.** `[E7]` `preprint (arXiv)` — MAST, over **1642 annotated
  traces** from 7 frameworks, contains **FM-2.2 "Fail to ask for clarification" at 6.80%**
  ("Inability to request additional information when faced with unclear or incomplete data,
  potentially resulting in incorrect actions"). Its 14 modes include **no** over-clarification mode.
  A taxonomy built to catalogue agent failure did not surface over-asking.
- Related and larger: **FM-1.1 Disobey task specification 11.8%**, which MAST attributes partly to
  "**poor user prompt specifications**" (`[E7]`).
- **The interruption-cost literature could not be verified.** `[E14]` `fetched ✔` — Crossref
  record for **DOI 10.1145/1357054.1357072**, title *"The cost of interrupted work"*, authors
  **Gloria Mark** (UC Irvine), **Daniela Gudith**, **Ulrich Klocke** (Humboldt University Berlin),
  CHI 2008, pages 107–110, `proceedings-article`, published 2008-04-06, `is-referenced-by-count`
  **539**. So the paper is real and correctly attributed.
  **But its content is not.** `[E16]` ACM DL returned **HTTP 403**; `[E15]` the UCI PDF was fetched
  **HTTP 200** yet contains **no `/ToUnicode` CMap** (verified: a CMap-aware extractor found
  `cmaps=0`), so its text is not machine-extractable.
  → **`UNVERIFIED`: the widely repeated "≈23 minutes to return to the interrupted task" figure.**
  I could not locate a primary statement of that number. It is frequently attributed to this line of
  work; treat it as **unsupported until someone quotes it from the paper**. Do not put it in the
  Skill.
- `[L4]` `first-hand observation` — `KI-20`: the only criterion that separated conditions in the v1
  pilot (`d1.constraints`) was achieved **equally** by a three-line reminder (controlB): "对 'skill
  有增量' 无支持". A reminder/asking effect is real but is not skill-specific.
- `[L2]` `first-hand observation` — an agent **choosing not to interrupt** is documented: Track C
  deliberately skipped the live restart experiment because "service was running (user session);
  no disruption". Interruption cost was respected without being measured.
- `UNANSWERED` — any rate at which agents ask unnecessary questions, and any human-time or
  context-switch cost figure.

---

## E4. Over-commenting / doc rot

**`UNANSWERED` for all measured claims.** I retrieved **no** study on documentation that nobody
reads, doc rot, write-only documentation, or the maintenance burden of comments. No number is
quoted here rather than a fabricated one.

What I *can* evidence, all `first-hand observation (this repository)`:

- **A dangling documentation reference in the very skill under development.** `[L10]`: the skill
  `project-conventions` tells the reader, in `SKILL.md` line 32–33, that "What is actually
  evidenced, and what is only the owner's convention, is in
  `references/evidence.md`. **Read those when a rule is contested**". `references/evidence.md`
  **does not exist** — the directory contains only `SKILL.md` and `references/rules.md`. `rules.md`
  line 49 repeats the reference ("a rule with `evidence: none` must never be defended as if it had
  some") and line 404 points to "`evidence.md` → open questions". **Four references, zero files.**
  This is a concrete instance of the failure the comment rule is meant to prevent: the document is
  not stale, it is *wrong about its own contents*.
- **Documentation counted as output.** `[L4]` `KI-16`: the v1 pilot counted `TASK.md` (which embeds
  the whole `SKILL.md`) as a run artifact, inflating the treatment by **~7 KB** — documentation
  volume was silently measured as work product.
- **Documentation as a judging source.** `[L4]` `KI-40`: of 65 criteria, sourcing was repo contract
  **44** / task text **15** / visible tests **6** — i.e. the majority of acceptance criteria were
  derived from project documents, which makes those documents load-bearing whether or not anyone
  reads them for pleasure.
- **A doc that under-describes the artifact it names.** `[L1]` §15 says failures live in
  "`failures.jsonl`（含 failures-infra.jsonl 3 条）", but `[L9]` measures `failures.jsonl` at
  **0 bytes** while the 3 records are in the separate `failures-infra.jsonl` (2349 bytes). The
  index and the tree disagree.

Reading for the Skill: the defensible version of the comment rule is **the contradiction half** —
"a comment that contradicts its code is a defect" — because a contradiction is *checkable*
(`[L10]` PC-10 does exactly this). "Keep comments" as a volume instruction has no evidence behind it
in this session. Also note `[L10]`'s own framing: "a rule that changes no decision is deleted".

---

## E5. Over-modularization / premature abstraction

**The strongest available support is practitioner opinion, and it should be labelled as such.**

- `[E10]` `practitioner opinion` — Sandi Metz, *The Wrong Abstraction* (posted 2016-01-20; originally
  written for the Chainline Newsletter; the idea originates in her RailsConf 2014 talk "all the
  little things"). Verbatim claims: "**duplication is far cheaper than the wrong abstraction**" and
  the advice "**prefer duplication over the wrong abstraction**". The described degradation: a
  programmer extracts duplication and names it; a later requirement is "almost perfect" for the
  abstraction; a parameter is added plus a conditional; "another additional parameter. Another new
  conditional. **Loop until code becomes incomprehensible**." The proposed remedy is the reverse
  move: "Re-introduce duplication by **inlining the abstracted code back into every caller**", then
  delete unneeded branches, then re-extract. The stated driver is the **sunk cost fallacy**.
  **This is opinion and argument by pattern, not a measurement.** No controlled study, no effect
  size, no sample. It is nonetheless the most-cited statement of the position and it is honestly
  labelled here.
- **`UNANSWERED` — "abstraction smells", shotgun surgery, and any empirical refutation.** I retrieved
  no peer-reviewed evidence either supporting or refuting the claim that "the wrong abstraction is
  worse than duplication".
- Adjacent, weak, and only tangentially relevant: `[E7]` shows **FM-1.2 Disobey role specification**
  at **1.5%**, the lowest-prevalence mode — a bare signal that "the wrong unit of responsibility"
  is a real but *rare* annotated failure class, and it is about agent roles, not code modules.

Reading for the Skill: `[L10]` **PC-11** ("Before adding an abstraction, name its second caller. One
caller means write it inline.") is a **design choice** on a rule-of-three-style heuristic. Its
justification should cite Metz as practitioner opinion, **not** as research. `[L10]`'s rules.md
line 49 already sets the correct standard: a rule with `evidence: none` must never be defended as
if it had some.

---

## E6. Over-versioning and release-process cost (DORA + boundary conditions)

The strongest empirical base in this cluster — and it is **more conditional than it is usually
reported to be.**

**What DORA claims — `[E5]` `industrial report` (DORA/Google Cloud; author Nathen Harvey; page last
updated 2026-01-05):**
- The metric set is now **five**, "shifting from the original four keys to the current five-metric
  model" (MTTR was replaced by **Failed deployment recovery time**, and **Deployment rework rate**
  was added) — the metric set itself is not stable over time.
- Throughput: change lead time, **deployment frequency**, failed deployment recovery time.
  Instability: **change fail rate**, deployment rework rate.
- The headline correlation: "DORA's research has repeatedly demonstrated that **speed and stability
  are not tradeoffs**. In fact, we see that the metrics are **correlated for most teams**. Top
  performers do well across all five metrics, and low performers do poorly."

**The boundary conditions — stated by DORA itself, in the same document:**
- "**Setting metrics as a goal.** Ignoring **Goodhart's law** and making broad statements like,
  'Every application must deploy multiple times per day by year's end,' increases the likelihood
  that teams will try to **game** the metrics."
- "**Context matters.** … best suited for measuring **one application or service at a time** …
  While it may be tempting to blend metrics across multiple teams–or entire organizations–these
  differences in context mean that doing so can be **problematic**."
- "**Focusing on measurement at the expense of improvement.** … Building integrations to multiple
  systems to get precise data … **might not be worth the initial investment.**"
- Other listed pitfalls: "Having one metric to rule them all"; "Using industry as a shield against
  improving"; "Making disparate comparisons"; "Having siloed ownership"; "Competing".
- The recommended lever is **batch size**, not frequency: "Teams should make each change as small as
  possible".

**2024 report key findings — `[E4]` `industrial report` (page last updated 2026-04-13):**
- AI adoption "significantly increases individual productivity, flow, and job satisfaction" but
  "**also negatively impacts software delivery stability and throughput**", "reminding teams that
  fundamentals like **small batch sizes** and **robust testing** remain crucial."
- "**Stable priorities are critical for well-being**": unstable priorities cause "meaningful
  decreases in productivity and substantial increases in burnout", and this is "highly resistant to
  mitigation and persists even in environments with strong leaders and **high-quality
  documentation**."
- Platform engineering improves productivity "**but monitor stability**" — it "can also lead to
  decreased change stability and throughput".

**`UNANSWERED` — the numeric 2024 cluster thresholds** (elite/high/medium/low deployment frequency,
change failure rate percentages, year-over-year deltas). The report PDF failed to fetch twice
(`[F1]`). **No such figure is quoted or estimated here.**

**`UNANSWERED` — release fatigue, version-number inflation, LTS burden.** No source retrieved.

Reading for the Skill: a version/release rule may legitimately require **recoverability** (a
rollback point, immutable tags, one logical change per commit). It must **not** require a
**deployment cadence**, because DORA's own text flags exactly that as Goodhart-gaming, and its own
scope limit is one service at a time. `[L10]` PC-8…PC-16 already follow this shape — they govern
*what a version number may claim* and *how to reverse it*, not how often to ship.

---

## E7. Automated cleanup and deletion risk (real incidents + guardrails)

Three primary incidents, all fetched and read in this session. **None of them needed a
`rm -rf`-style intent** — every one was an ordinary operation with one wrong input or one wrong
target.

### 1. GitLab.com, 2017-01-31 — `[E6]` `official postmortem`
- **What happened.** An engineer ran `pg_basebackup` work against the wrong host: "an engineer
  proceeds to wipe the PostgreSQL database directory, **errantly thinking they were doing so on the
  secondary. Unfortunately this process was executed on the primary instead.** The engineer
  terminated the process a second or two after noticing their mistake, but at this point around
  **300 GB of data had already been removed.**"
- **Impact.** GitLab.com unavailable **many hours (~18 h)**; data written 17:20–23:30 UTC lost;
  "at least **5000 projects, 5000 comments, and roughly 700 users**". Restore used an LVM snapshot
  ~6 h old; copying it took **~18 hours** (throttled network disks, ~60 Mbps).
- **Root cause chain (their own 5 Whys, abridged).** Replication broke under spam load → secondary
  had to be rebuilt manually → wiping the wrong directory. Compounding it: **the `pg_dump` backups
  had been failing silently** (client 9.2 vs server 9.6) and the failure emails were **rejected by
  DMARC**, so "we were never aware of the backups failing, until it was too late"; Azure disk
  snapshots were **not enabled on the database hosts** "as we assumed that our other backup
  procedures were sufficient"; and "**there was no ownership, as a result nobody was responsible
  for testing this procedure.**"
- **Guardrails.** Their own conclusion is the important one and it is *not* command-blocking:
  "one could alias `rm` to something safer but in doing so would only protect themselves against
  accidentally running `rm -rf /important-data`, **not against disk corruption or any of the many
  other ways you can lose data**." Their stated direction: "An ideal environment is one in which you
  *can* make mistakes but easily and quickly recover from them" — hourly LVM snapshots, Azure disk
  snapshots on DB hosts, Prometheus monitoring for backups, documented replication runbooks,
  automated testing of restoring backups, and **assigning an owner for data durability**.
- **Corrections to the brief.** This is the **2017-01-31** incident (postmortem published
  2017-02-10), not "the 2016 GitLab database deletion incident"; and the "2017 GitLab.com spam
  incident" named in the brief is **the same event** — the spam-driven load spike was a
  contributing cause, not a separate incident. A separate earlier outage did occur on
  **2016-11-28** (cited in the same postmortem as `project_authorizations` bloat).

### 2. AWS S3, 2017-02-28 — `[E12]` `official postmortem`
- **What happened.** "At **9:37AM PST**, an authorized S3 team member **using an established
  playbook** executed a command which was intended to remove a small number of servers … one of the
  inputs to the command was **entered incorrectly** and a **larger set of servers was removed than
  intended.**" The removed hosts supported the **index** subsystem (metadata/location for all
  objects; required for GET, LIST, PUT, DELETE) and the **placement** subsystem.
- **Impact.** Full restart required; GET/LIST/DELETE began serving at **12:26PM**, fully recovered
  **1:18PM**; placement finished **1:54PM** (~**4 h 17 m**). Also impacted the S3 console, EC2 new
  instance launches, EBS volume creation from snapshots, and Lambda.
- **Root cause.** Not the typo alone: "the tool used **allowed too much capacity to be removed too
  quickly**", and "we have not completely restarted the index subsystem … for many years", so
  recovery time was far longer than the team expected.
- **Guardrail actually shipped (the model to copy).** "We have **modified this tool to remove
  capacity more slowly** and added **safeguards to prevent capacity from being removed when it will
  take any subsystem below its minimum required capacity level.** This will prevent an incorrect
  input from triggering a similar event in the future. We are also auditing our other operational
  tools to ensure we have similar safety checks." Plus reprioritised cell partitioning to cut blast
  radius. → **A rate limit plus a floor, enforced by the tool, not by the operator's care.**

### 3. npm / left-pad, 2016-03-22 — `[E11]` `official postmortem` (vendor)
- **What happened.** "without warning to developers of dependent projects, Azer unpublished his
  `kik` package and **272 other packages**. One of those was `left-pad`." npm "began observing
  **hundreds of failures per minute**" after 2:30 PM PT; dependents including `babel` and `atom`
  pulled it via `line-numbers`, which pinned `0.0.3`.
- **Impact.** "The duration of the disruption was **2.5 hours**." Recovery required re-publishing
  the exact 0.0.3 version, which "required **relying on a backup**, since re-publishing isn't
  otherwise possible."
- **Guardrail.** Registry immutability for published versions, and dependency-range discipline.
  The lesson for a Skill: **a deletion you are entitled to perform can break thousands of
  consumers you cannot see**, and the fix was possible only because an out-of-band copy existed.

### Documented guardrails that already exist — `[E13]` `official documentation`
`git clean` ships an explicit, checkable ladder. Verbatim from the manual:
- `-n`, `--dry-run`: "Don't actually remove anything, just show what would be done."
- Without `-d`: "Normally, when no `<pathspec>` is specified, git clean **will not recurse into
  untracked directories to avoid removing too much.**"
- `-x`: "ignored files are also removed."
- `-X`: "Remove only files ignored by Git."
- `-f`/`--force`: "git clean will refuse to delete files or directories unless given `-f`. **Git
  will refuse to modify untracked nested git repositories (directories with a `.git` subdirectory)
  unless a second `-f` is given.**"

That last clause is the directly relevant one here: destroying this repository's **27 nested `.git`
repositories** (measured, `[L9]`) requires `-ff` — i.e. **the catastrophic form of the command is
one keystroke away from the merely aggressive form**, which is precisely the hazard pattern in all
three incidents above.

### First-hand cleanup risk in this repository — `[L9]`, `[L1]`, `[L2]`
The four facts below are the concrete case for `PC-5`; scale and self-report detail is in E8 (FT-1,
FT-2, FT-3, FT-13).

- **Scale and containment failure.** The run's own constraint says artifacts go to
  `D:\AI-Runs\overnight-20260913\` (`[L7]` l.11, `[L1]` l.5) — that path **does not exist**; the
  artifacts are in the repository instead: **3653 files / 1919 dirs / 14.77 MB / 27 nested `.git` /
  104 `__pycache__`**, with **no `.gitignore`**, giving **2178 untracked entries** (`[L9]`).
- **The artifacts are the only copy.** The declared root is fictional, so the repository copy is the
  sole surviving evidence of a 7.8-hour run. **Deleting it to "tidy up" would destroy this cluster's
  evidence base** — the concrete case for `PC-5`: report, do not remove.
- **A file normal tooling cannot delete.** A 0-byte file named **`nul`** (a Windows reserved device
  name) was created at the repo root by an agent's `>nul` redirect typo, deletable only via the
  `\\?\` prefix; the run's report declined to remove it under its own delete-nothing rule
  (`[L1]` §15, `[L2]`). `[L9]` measures it **ABSENT** on 2026-09-24 — it survived from 2026-09-14
  until recently and has since been removed. An agent-created artifact the environment's own
  deletion tools handle badly.
- **Residue with no penalty.** `[L4]` `KI-36`: runs left `verify.old`, `probe*`, `tmp.js` and a
  root-level `probe-existing.txt`; two controlB sandboxes **forbade shell deletion**, so the agent
  routed around it in Node and **reported that honestly**; "无判据惩罚" — no criterion penalised the
  residue, so it was invisible to scoring.
- **`UNANSWERED`** — the Steam `rm -rf` incident, `git clean -fdx` disaster reports, and any
  research on safe file deletion or test-data cleanup practice. **No source retrieved for any of
  these; none is described here.**

---

## E8. Long-horizon autonomous agent failure taxonomy (real cases)

### Published taxonomy — `[E7]` `preprint (arXiv)`
*Why Do Multi-Agent LLM Systems Fail?* (arXiv:2503.13657, v1 2025-03-17, v3 2025-10-26; Cemri,
Pan, Yang, Agrawal, Chopra, Tiwari, Keutzer, Parameswaran, Klein, Ramchandran, Zaharia, Gonzalez,
Stoica). Built by Grounded Theory over **150 traces** averaging **>15,000 lines** each, with
**>20 h of annotation per expert**; **3 IAA rounds** (~10 h resolving disagreement alone);
**κ = 0.88**; LLM annotator (o1) **94% accuracy, κ = 0.77**, out-of-domain κ = **0.79**;
**MAST-Data = 1642 traces across 7 frameworks**. Category correlations are low (**0.17–0.32**),
supporting distinctness. Intervention case studies reached **max +15.6%**; fixing ChatDev's role
specification alone gave **+9.4%** success with the same prompt and model. MetaGPT vs ChatDev:
MetaGPT had **60–68% fewer** FC1/FC2 failures but **1.56× more** FC3 failures.

| category | id | mode | prevalence |
|---|---|---|---|
| **FC1 System Design** | FM-1.1 | Disobey task specification | **11.8%** |
| | FM-1.2 | Disobey role specification | 1.5% |
| | FM-1.3 | **Step repetition** | **15.7%** |
| | FM-1.4 | Loss of conversation history | 2.80% |
| | FM-1.5 | **Unaware of termination conditions** | **12.4%** |
| **FC2 Inter-Agent Misalignment** | FM-2.1 | Conversation reset | 2.20% |
| | FM-2.2 | **Fail to ask for clarification** | **6.80%** |
| | FM-2.3 | Task derailment | 7.40% |
| | FM-2.4 | Information withholding | 0.85% |
| | FM-2.5 | Ignored other agent's input | 1.90% |
| | FM-2.6 | **Reasoning-action mismatch** | **13.2%** |
| **FC3 Task Verification** | FM-3.1 | Premature termination | 6.20% |
| | FM-3.2 | No or incomplete verification | 8.20% |
| | FM-3.3 | Incorrect verification | 9.10% |

Stated conclusion: failures "often stem from **system design issues**, not just LLM limitations";
"a well-designed MAS should interpret high-level objectives with minimal but clear user input";
and a verifier "is **not a silver bullet**" — a ChatDev chess program passed compilation checks
while failing at actual game rules.

**`UNANSWERED` — the Replit 2025 database-deletion incident.** Six independent retrieval attempts
failed: Tom's Hardware **404**, Ars Technica **405**, Business Insider and The Guardian **fetch
failed**, Fortune **404**, AI Incident Database **404**, `en.wikipedia.org/wiki/Replit` **fetch
failed**. **I did not retrieve any report of this incident and therefore describe nothing about
it** — no date, no mechanism, no quotation. Treat any account of it in this repo as unsourced until
someone fetches a primary or reputable report.

**`UNANSWERED`** — Anthropic/OpenAI autonomous-long-task safety write-ups; METR evaluation reports
beyond the time-horizon page; any other published incident report.

### First-hand taxonomy — `[L1]`–`[L9]` `first-hand observation (this repository)`
From a documented **7.8-hour** autonomous run (2026-09-13 21:51 → 2026-09-14 05:40 +08:00),
113–121 subagent spawns, `HEAD` unchanged at `c868111…` (verified, `[L9]`), no commits or pushes.

- **FT-1 Containment failure / fictional artifact root.** Constraint and report both name
  `D:\AI-Runs\overnight-20260913\`; that path does not exist; 14.77 MB sits in the repository
  (`[L7]` l.11, `[L1]` l.5, `[L9]`). *Mitigated by:* writing the artifact root into the plan **and
  checking it resolves**, not by declaring it.
- **FT-2 Cost self-report is internally inconsistent by 12.6×.** `subagent_measured_total`
  **49,000,000** (`[L2]`) vs `est_tokens` **3,879,627** from the byte proxy `bytes/3.5`
  (`[L7]` l.18, `[L6]`). The report itself notes the orchestrator figure is an estimate and that a
  byte-delta method "实测出负值后弃用" (`[L1]` §2). *Mitigated by:* reporting the estimator and its
  disagreeing alternative, never a single authoritative-looking number.
- **FT-3 Progress telemetry is non-monotonic and disagrees across files.** `metrics.csv` `cases`
  runs 0→4→21→51→**83→67**→105 and `workers` 57→**25**; its own notes say 30, then 32, then 35,
  then 38 dual-reviewed runs, while `STATE.json` says `cases_completed: 105, pass: 105`
  (`[L5]`, `[L6]`). *Mitigated by:* one declared counter, defined once.
- **FT-4 Crash-retry on a polluted sandbox** — `FARM-INCIDENT-1` (`[L3]` line 1). A spawn ending
  "Model request failed" had **partially executed**: it renamed `.txt` files in the
  `case-1001__skill` sandbox before dying. The retry worker found a contaminated workspace and
  honestly reported a no-op; the first blind reviewer **attributed the renames to the retry worker
  and issued a P1 FAIL (false_confidence)**. Root cause: "orchestrator retried a crashed spawn
  **without rematerializing the sandbox**; rename preserved mtimes so forensic attribution was
  ambiguous". Resolution: run voided, sandbox re-materialised, fresh worker + 2 fresh reviews →
  PASS ×2. Recorded prevention rule: "**ALWAYS re-materialize a run sandbox before retrying any
  failed worker spawn; failed spawns must be treated as potentially side-effecting**" — explicitly
  scoped as "local to farm harness (process rule), **not a Cognitive-Skill behavior finding**".
- **FT-5 Reviewer attribution failure** — `REVIEW-NEARMISS-1` (`[L3]` line 2). A blind reviewer
  issued a P1 against an innocent worker; "single-mechanism forensics (mtime) is insufficient for
  rename attribution on NTFS"; the recorded lesson is that reviewers need an explicit
  **INCONCLUSIVE-when-attribution-uncertain** rule for environment-contaminated workspaces.
  *This is the failure mode of a verification rule: verification machinery can manufacture false
  findings.*
- **FT-6 Evidence-precision overstatement** — `PATTERN-EVIDENCE-PRECISION` (`[L3]` line 3,
  `[L1]` §6). Across **32 reviewed runs** the most common P3 class: stack-frame columns claimed
  `27:18` when actually `27:22`; `23` vs `24` evictions; `16` vs `18` pushes; `5` vs `6` decision
  blocks; an unsupported "clamp always yields +0.0" refuted by an empty-cart edge; and a baseline
  run declaring a **called** function `draft_7` dead code, refuted independently by both reviewers.
  "approx **14 instances across >=9 runs**". **None changed task outcomes** — core conclusions were
  re-run and confirmed — but the pattern is systematic. Candidate improvement recorded: "require
  re-verification of exact quotes/counts before reporting".
- **FT-7 Action-loop degeneration / declared-action gap** — `KI-25` (`[L4]` line 46). The agent
  decides to call a tool and repeatedly narrates "now executing" **without emitting the call**,
  sometimes aware it is looping; the skill "只治理审议，不治理'承诺动作是否真实执行'"; status
  `unknown/unresolved`; not auto-detectable on this host.
- **FT-8 Meta-strategy self-exemption** — `KI-26` (`[L4]` line 47). The host designs stopping
  policies for first-order tasks but keeps "发现下一件工作" and auto-continuing after declaring
  completion; "一阶停止策略不约束宿主自身".
- **FT-9 High-concurrency dispatch unreliability** — `KI-30` (`[L4]` line 56). **8 of 12** subagents
  in the first wave **failed silently** (no closing message); cleared as invalid and re-dispatched
  at ≤5 concurrency, all succeeded.
- **FT-10 Ceiling-limited corpus** — `KI-27`, `KI-28` (`[L4]` lines 48–49), `[L1]` §5.
  **38 PASS / 0 FAIL / 0 INCONCLUSIVE**, reviewer split **0**, arbiters **0**, condition means
  **95.4–97.6**. The run records this as a corpus-sensitivity failure
  (`PILOT SENSITIVITY FAIL — CEILING-LIMITED`), **not** as evidence the skill works. Any claim that
  the skill helps must not rest on this.
- **FT-11 Self-verification loop** — `KI-33` (`[L4]` line 59). Corpus construction, freezing,
  execution, judging and reporting were closed by **the same agent**; blinding "削弱但不能消除结果
  感知报告".
- **FT-12 Budgets cannot be enforced** — `KI-34`, `KI-37` (`[L4]` lines 60, 68). The host cannot
  enforce tool/action budgets; token and cost are not exposed; the protocol's own rule is to record
  `null` and **never fabricate**.
- **FT-13 Residue without penalty** — `KI-36` (`[L4]` line 67). See E7.
- **FT-14 Deliberate non-interruption** — `[L2]` `trackC.live_restart_experiment`: the live restart
  experiment was **skipped** because the service was running in the user's session. Documented
  restraint, though unmeasured.

---

## E9. Diminishing returns of pre-action research

**Thin. State it plainly.**

Supported:
- `[E7]` `preprint (arXiv)` — the two most prevalent MAST modes are **FM-1.3 Step repetition 15.7%**
  and **FM-1.5 Unaware of termination conditions 12.4%** (≈28% of annotated failures). This is the
  strongest quantitative support available here for rules that **stop** a loop.
- `[E8]` `preprint (arXiv)` — agents "**enter expensive, repetitive loops, consuming massive amounts
  of compute until an external budget limit is reached**", and the paper names the missing
  capability "**futility detection**", proposing scaffolds "learn to abort or redirect unproductive
  trajectories before problem-solving spirals out of control." The remedy proposed is a
  **progress/ stagnation signal**, not a shorter absolute budget.
- `[E2]` `preprint (arXiv)` — diminishing marginal utility of additional reasoning tokens at higher
  budgets; moderate budgets can be comparable in accuracy.
- `[E8]` — the efficiency paper's own framing: "Is a 1% improvement in resolve rate worth a 5x
  increase in cost?"

Not supported / not found:
- **`UNANSWERED` — "research saturation", analysis paralysis in agents, and the cost of tool/search
  loops specifically.** No source retrieved. Nothing is asserted.
- `[L4]` `first-hand observation` — `KI-29` is a **null result**: at the current difficulty there is
  no measured over-thinking or scope creep to reduce. `KI-09` records a persistent semantic ceiling
  in the keyword extractor that no amount of added deliberation fixed.

**Design tension to record (not a finding).** This repository's own `AGENTS.md` mandates research
before acting for non-simple tasks, while the evidence above supports *stopping* conditions. A Skill
that adds both must say which one wins and when. `[L10]`'s guidance is the usable form: "**Stop when
new sources stop changing the decision.** Evidence strength, not volume, decides."

---

## E10. Human-intervention cost

**`UNANSWERED` quantitatively.** No verified figure for human review cost, interruption cost, or
human-in-the-loop throughput was obtained. Specifically:
- The one directly relevant paper (`[E14]`, Mark/Gudith/Klocke, CHI 2008, verified metadata) could
  not be read: ACM DL **403** (`[E16]`), UCI PDF **not text-extractable** (`[E15]`).
- The "≈23 minutes to resume" figure is **`UNVERIFIED`** — see E3. Do not use it.

What the first-hand corpus does support:
- `[L2]`, `[L6]` — review load is **2 blind reviews per run**: **76 reviewer units for 38 runs**.
  Verification is the dominant human-equivalent cost.
- `[L2]` `trackD` — reviewer disagreement is real and productive but costly to resolve:
  R1 issued **68** findings, R2 **77**, reconciled to **33 consensus** (P0×1, P1×9, P2×27, P3×32),
  with **4 refuted** and **1 uncertain** — roughly a **4.4×** compression from raw findings to
  consensus, and one reviewer's own top-tier claim (`CC-01`, `angleData` semantics inverted) was
  **refuted against the source** ("明确自洽"). **A second reviewer caught a false positive that a
  single reviewer would have shipped.**
- `[L3]` `REVIEW-NEARMISS-1` is the mirror image: **the reviewer itself produced a false P1** when it
  could not distinguish contamination from misconduct. Human-equivalent review is therefore both
  the main safeguard and a source of false findings — the honest conclusion is that it is **both**,
  and the corpus does not settle which dominates.
- `[L4]` `KI-33` shows what happens when the human is removed entirely: a self-verification loop.

---

## E11. Implications summary table

| candidate rule | risk it mitigates | cost it adds | evidence strength | known failure mode |
|---|---|---|---|---|
| **Organize folders by function** (`PC-1/2/3`, `[L10]`) | files landing where they were easiest to write; structure map going stale | an extra decision per file; renames churn diffs and imports | **weak** — no external evidence retrieved; supports are design choices | over-modularisation (`[E10]` practitioner opinion); premature directories before needs are known (`AGENTS.md` itself warns of this) |
| **Update the structure diagram in the project-understanding doc** (`PC-3`) | readers/agents navigating a stale map | a doc edit on every structural change; the doc can outlive its accuracy | **weak–moderate** — the *negative* case is first-hand and concrete: `[L10]` `evidence.md` is referenced 4× and **does not exist**; `[L1]` §15 misstates where `failures.jsonl` lives (`[L9]`: 0 bytes) | the map becomes a **claim** that is wrong, which is worse than no map; `[L4]` `KI-40` shows docs are already load-bearing for 44/65 criteria |
| **Periodic temp-file cleanup** (`PC-5/6/7`) | unbounded artifact growth — measured here at **3653 files / 14.77 MB / 2178 untracked** (`[L9]`) | deletion is the single most dangerous act documented in this cluster: GitLab **300 GB / 18 h / ~5000 projects** (`[E6]`), npm **272 packages / 2.5 h** (`[E11]`), S3 **~4 h 17 m** (`[E12]`) | **strong** for the risk; **strong** for the danger | deleting the **only copy** — the repo's artifacts are orphaned from their declared root (`[L9]`); residue is invisible to scoring (`[L4]` `KI-36`) |
| **Keep comments** (`PC-9/10`) | loss of non-obvious constraints; comments contradicting code | comment volume; **stale comments are a defect generator** | **none** for "keep comments" as a volume rule — `UNANSWERED` (E4) | the rule is unfalsifiable as written; only the **contradiction** half (`PC-10`) is checkable |
| **Version management with reliable rollback** (`PC-8…PC-16`) | unrecoverable history; immutability loss; SemVer mis-claims | commit/tag ceremony; rollback needs a clean worktree | **moderate** — DORA's correlation findings (`[E5]`) support recoverability and small batches; the *specific* numbers are `UNANSWERED` | a frequency/cadence mandate becomes **Goodhart-gamed**, which DORA names as a pitfall (`[E5]`); `PC-19` warns that "written, saved, generated, commanded are not done" |
| **Report to the user** (`PC-18/19`) | silent failures; unverifiable completion claims | output volume; interruption of the user's attention | **moderate** — the counter-evidence is strong and first-hand: two token figures disagreeing **12.6×** (`[L2]`,`[L6]`,`[L7]`), non-monotonic counters (`[L5]`), **14 instances of evidence-precision overstatement across ≥9 runs** (`[L3]`) | **reporting more does not make reporting truer**; `PATTERN-EVIDENCE-PRECISION` is the documented weak tail (`[L1]` §6) |
| **Ask the user rather than guess** (`PC-17`) | expensive irreversible guesses | interruption cost; `UNVERIFIED` magnitude | **weak for the risk, inverted for the direction** — MAST's quantified mode is *under*-asking, **FM-2.2 6.80%** (`[E7]`); no over-asking mode exists | asking at the wrong moment; `[L4]` `KI-20` shows a 3-line reminder reproduces the effect, so the rule must be a **gate**, not a disposition |
| **Deep modules / name the second caller** (`PC-4/11`) | premature abstraction; hard-to-test seams | a deliberate pause before extracting; duplication retained | **weak** — strongest support is `[E10]` `practitioner opinion`, explicitly labelled | sinking cost into a wrong abstraction (`[E10]`); conversely, no evidence retrieved that duplication is actually cheaper |

---

## E12. Anti-patterns the Skill must explicitly forbid

Each is labelled with what actually backs it.

1. **Forbid: running a destructive cleanup without a dry run.** Evidence: `[E13]` documents
   `-n/--dry-run`; S3's fix was a tool-level floor and rate limit, not a warning (`[E12]`). **Strong.**
2. **Forbid: `git clean -fdx` / `-ff` without an explicit, enumerated target list.** Evidence: `-x`
   also removes ignored files; the **second `-f`** is what unlocks nested git repositories (`[E13]`),
   and this repo has **27** of them (`[L9]`). **Strong.**
3. **Forbid: deleting anything whose only copy is the one being deleted.** Evidence: GitLab
   discovered its backups had been failing silently under a DMARC rejection (`[E6]`); npm's fix
   required an out-of-band backup (`[E11]`); the artifacts here are the sole copy after their
   declared root turned out not to exist (`[L9]`). **Strong.** This is `PC-5` and it should be
   `HARD`.
4. **Forbid: claiming a version bump by magnitude instead of by compatibility.** Evidence: DORA's
   own Goodhart pitfall (`[E5]`) plus `PC-8…PC-16` (`[L10]`). **Moderate** (design choice on a
   documented-by-DORA hazard).
5. **Forbid: mandating a deployment/release cadence.** Evidence: "Setting metrics as a goal.
   Ignoring Goodhart's law … 'Every application must deploy multiple times per day by year's end'"
   is a DORA-listed pitfall (`[E5]`). **Strong.**
6. **Forbid: reporting a count, quote, or line reference that was not re-read immediately before
   reporting.** Evidence: `PATTERN-EVIDENCE-PRECISION`, **~14 instances across ≥9 runs**, incl.
   `27:18` vs `27:22` and a called function declared dead (`[L3]`, `[L1]` §6). **Strong, first-hand.**
7. **Forbid: retrying a failed agent spawn in the same sandbox.** Evidence: `FARM-INCIDENT-1`
   (`[L3]`). **Strong, first-hand**, though explicitly scoped as a harness process rule.
8. **Forbid: issuing a confident verdict when attribution is uncertain.** Evidence:
   `REVIEW-NEARMISS-1` — a reviewer's false P1 against an innocent worker (`[L3]`). **Strong,
   first-hand.**
9. **Forbid: presenting a self-verified result as independently verified.** Evidence: `KI-33`
   self-verification loop; `KI-28` ceiling-limited corpus where **38/38 PASS** was a corpus failure,
   not a result (`[L4]`, `[L1]` §5). **Strong, first-hand.**
10. **Forbid: narrating an action instead of performing it.** Evidence: `KI-25` declared-action gap,
    still unresolved (`[L4]`). **Moderate, first-hand.**
11. **Forbid: quoting the "≈23 minutes to resume after interruption" figure.** Evidence: the
    underlying paper is real (`[E14]`) but its content could not be retrieved
    (`[E15]` no CMap, `[E16]` 403); the figure is **`UNVERIFIED`**. **Design choice grounded in a
    verified gap.**
12. **Forbid: describing the Replit 2025 incident as established fact.** Evidence: six retrieval
    attempts failed (E8). **Design choice grounded in a verified gap.**
13. **Forbid: defending the second-caller abstraction rule as research-backed.** Evidence: the
    support is `[E10]`, labelled `practitioner opinion`; `[L10]` rules.md line 49 already requires
    that "a rule with `evidence: none` must never be defended as if it had some". **Design choice.**
14. **Forbid: adding an anti-over-clarification rule as if evidence-backed.** Evidence: the
    quantified direction is the opposite (`[E7]` FM-2.2 6.80%); if the rule is kept, it is a
    **design choice** and must be labelled so.

---

## E13. Sources

| id | title | authors/site | year | class | URL | fetched? |
|---|---|---|---|---|---|---|
| E1 | Do NOT Think That Much for 2+3=? On the Overthinking of o1-Like LLMs | Chen, Xu, Liang, He, Pang, Yu, Song, Liu, Zhou, Zhang, Wang, Tu, Mi, Yu | 2024 (v2 2025) | preprint (arXiv) | https://arxiv.org/abs/2412.21187 | ✔ HTTP 200, abstract read |
| E2 | When More Thinking Hurts: Overthinking in LLM Test-Time Compute Scaling | Zhou, Ling, Chen, Wang, Fan, Wang | 2026 | preprint (arXiv) | https://arxiv.org/abs/2604.10739 | ✔ HTTP 200, abstract read |
| E3 | Task-Completion Time Horizons of Frontier AI Models | METR | 2026 (updated 05-08) | industrial report | https://metr.org/time-horizons/ | ✔ HTTP 200, prose read (graph values not readable) |
| E4 | DORA Research: 2024 / Accelerate State of DevOps Report (overview) | DORA / Google Cloud | 2024 (page updated 2026-04-13) | industrial report | https://dora.dev/research/2024/dora-report/ | ✔ HTTP 200, key findings read |
| E5 | DORA's software delivery performance metrics | Nathen Harvey / DORA | updated 2026-01-05 | industrial report (official guidance) | https://dora.dev/guides/dora-metrics/ | ✔ HTTP 200, full text read |
| E6 | Postmortem of database outage of January 31 | GitLab | 2017 | official postmortem | https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/ | ✔ HTTP 200, full text read |
| E7 | Why Do Multi-Agent LLM Systems Fail? (MAST) | Cemri, Pan, Yang, Agrawal, Chopra, Tiwari, Keutzer, Parameswaran, Klein, Ramchandran, Zaharia, Gonzalez, Stoica | 2025 (v3) | preprint (arXiv) | https://arxiv.org/abs/2503.13657 · https://arxiv.org/html/2503.13657v3 | ✔ both HTTP 200, v3 full text read |
| E8 | SWE-Effi: Re-Evaluating Software AI Agent System Effectiveness Under Resource Constraints | Fan, Vasilevski, Lin, Chen, Chen, Zhong, Zhang, He, Hassan | 2025 | preprint (arXiv) | https://arxiv.org/html/2509.09853v2 | ✔ HTTP 200, full text read |
| E9 | SWE-Bench Pro cost / token / time analysis (`report.txt`) | nilenso | 2025 | open-source observation | https://nilenso.github.io/swe-bench-pro-cost-token-time-analysis/report.txt | ✔ HTTP 200, full text read |
| E10 | The Wrong Abstraction | Sandi Metz | 2016 | practitioner opinion | https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction | ✔ HTTP 200, full text read |
| E11 | kik, left-pad, and npm | npm, Inc. (blog archive) | 2016 | official postmortem (vendor) | https://blog.npmjs.org/post/141577284765/kik-left-pad-and-npm | ✔ HTTP 200, full text read |
| E12 | Summary of the Amazon S3 Service Disruption in the Northern Virginia (US-EAST-1) Region | AWS | 2017 | official postmortem | https://aws.amazon.com/message/41926/ | ✔ HTTP 200, full text read |
| E13 | git-clean — Remove untracked files from the working tree | Git project | current | official documentation | https://git-scm.com/docs/git-clean | ✔ HTTP 200, options read |
| E14 | The cost of interrupted work (Crossref metadata record) | Mark, Gudith, Klocke (CHI 2008, pp. 107–110) | 2008 | bibliographic record | https://api.crossref.org/works/10.1145/1357054.1357072 | ✔ HTTP 200, metadata verified |
| E15 | The Cost of Interrupted Work: More Speed and Stress (PDF) | Mark, Gudith, Klocke | 2008 | PDF, **content not extractable** | https://www.ics.uci.edu/~gmark/chi08-mark.pdf | ✔ HTTP 200 but **text unrecoverable** (no `/ToUnicode` CMap; CMap-aware extractor found `cmaps=0`) |
| E16 | ACM DL landing page for 10.1145/1357054.1357072 | ACM | 2008 | paywall/blocked | https://dl.acm.org/doi/10.1145/1357054.1357072 | ✘ **HTTP 403** |
| L1 | MORNING_REPORT.md (7.8 h overnight farm report) | this repository | 2026-09-14 | first-hand observation (this repository) | `AI-Runs/overnight-20260913/MORNING_REPORT.md` | ✔ read (150 lines) |
| L2 | synthesis/summary.json | this repository | 2026-09-14 | first-hand observation | `AI-Runs/overnight-20260913/synthesis/summary.json` | ✔ read (166 lines) |
| L3 | synthesis/failures-infra.jsonl | this repository | 2026-09-14 | first-hand observation | `AI-Runs/overnight-20260913/synthesis/failures-infra.jsonl` | ✔ read (3 records) |
| L4 | synthesis/KNOWN_ISSUES.md | this repository | 2026 | first-hand observation | `AI-Runs/overnight-20260913/synthesis/KNOWN_ISSUES.md` | ✔ read (91 lines) |
| L5 | checkpoint/metrics.csv | this repository | 2026-09-14 | first-hand observation | `AI-Runs/overnight-20260913/checkpoint/metrics.csv` | ✔ read (7 checkpoints) |
| L6 | checkpoint/STATE.json | this repository | 2026-09-14 | first-hand observation | `AI-Runs/overnight-20260913/checkpoint/STATE.json` | ✔ read (16 lines) |
| L7 | FARM_STATE.md | this repository | 2026-09-13 | first-hand observation | `AI-Runs/overnight-20260913/FARM_STATE.md` | ✔ read (33 lines) |
| L8 | synthesis/cases.jsonl; synthesis/failures.jsonl | this repository | 2026-09-14 | first-hand observation | `AI-Runs/overnight-20260913/synthesis/` | ✔ measured only: cases **38 lines / 64,535 B**; failures **0 lines / 0 B** (not read) |
| L9 | Direct read-only measurement of this repository | this session | 2026-09-24 | first-hand measurement | `<repo root>` | ✔ measured |
| L10 | `project-conventions` skill (`SKILL.md`, `references/rules.md`); `references/evidence.md` **missing** | this repository | 2026 | first-hand observation | `.dsh/skills/project-conventions/` | ✔ read/grepped |

Retrieval failures with no claim drawn (listed so the gap is auditable):
`F1` DORA 2024 report PDF — fetch failed twice (timeout). `F2` Replit incident — Tom's Hardware 404,
Ars Technica 405, Business Insider / The Guardian fetch failed, Fortune 404, AI Incident Database
404, Wikipedia fetch failed. `F3` `https://openreview.net/forum?id=6ICFqmixlS` — HTTP 200 but a
JS-only shell (282 chars of text), content **not** verified. `F4` OpenAlex and Semantic Scholar
search APIs — **HTTP 429** rate-limited throughout. `F5` Steam `rm -rf` incident — no source
retrieved. `F6` `web_search` / `web_fetch` / `anysearch_search` — **HTTP 402** all session.

---

## E14. Limitations / what I could not verify

**Method limits.**
- The DSH web tools were unavailable for the whole session (**HTTP 402**), and `curl`/
  `Invoke-WebRequest` fail on this host with a local TLS credential error. An independent Node-based
  HTTPS path was verified working and used for every `fetched ✔` source. This means the *set* of
  sources is biased toward pages reachable by direct URL and structured APIs; **open-web search was
  effectively unavailable** (Bing/DDG/Ecosia/Brave were geo-mangled or bot-blocked from this IP).
  A cluster with better search access would find more.
- OpenAlex and Semantic Scholar were rate-limited (**429**) for the whole session, so paper
  *discovery* relied on known identifiers and the arXiv/Crossref APIs.

**Explicitly unverified — do not treat as findings.**
1. The **"≈23 minutes to resume an interrupted task"** figure. The paper is real and correctly
   attributed (`[E14]`), but I could not read it (`[E15]`/`[E16]`). **No primary statement of this
   number was located.** This is the clearest case in this cluster of a widely repeated belief that
   I could not support.
2. **Any detail of the Replit 2025 incident** — no report retrieved, nothing described.
3. **Numeric effect sizes** for over-thinking (`[E1]`, `[E2]` — abstracts only) and the
   **over-difficulty compute curves**. Direction is supported; magnitude is not.
4. **2024 DORA cluster thresholds** (deployment frequency bands, change failure rate percentages).
   **No figure quoted.**
5. The **Steam `rm -rf` incident**, `git clean -fdx` disaster reports, and safe-deletion /
   test-data-cleanup research.
6. METR's **per-model time-horizon values** (interactive graph not readable).
7. Anthropic/OpenAI autonomous-long-task safety write-ups; Replit's own incident report.

**`UNANSWERED` questions, in full.**
- Q1 partially: benchmark cost is quantified; **production** cost, per-task latency, and tool-call
  counts in real (non-benchmark) use are not.
- Q2 partially: direction yes, **effect sizes no**; budget forcing not retrieved.
- Q3 mostly: **no rate of unnecessary agent questions found**; interruption cost figure unverified.
- Q4 fully: **no measured documentation-rot or comment-maintenance evidence retrieved.**
- Q5 mostly: **no empirical support or refutation** of "the wrong abstraction is worse than
  duplication"; only practitioner opinion.
- Q6 partially: DORA's *qualitative* correlation and boundary conditions verified; **numeric
  thresholds not**; release fatigue / version inflation / LTS burden not retrieved.
- Q7 partially: three primary incidents verified with guardrails; **Steam and `git clean` disasters
  not**; safe-deletion research not.
- Q8 partially: MAST verified in full; the **Replit incident not retrieved**.
- Q9 mostly: **"research saturation" and analysis-paralysis evidence is genuinely thin**; only the
  stopping-condition modes and the expensive-failure pattern support it.
- Q10 mostly: **no verified quantitative human-intervention cost**; only first-hand review-load and
  consensus-compression figures.

**Evidence-quality warnings for downstream use.**
- `[E9]` costs use **Scale AI internal proxy pricing, not public list prices**, and GPT-5's hidden
  reasoning tokens are uncounted — so the **5.7× ratio is not a list-price ratio**.
- `[E8]` is **50 of 500 SWE-bench-Verified issues** and "in no way exhaustive".
- `[E3]`'s time horizon measures **task difficulty (human duration), not the agent's own runtime**;
  METR states aspects above 16 h are unreliable with the current suite, and that agent performance
  drops substantially when scored holistically rather than algorithmically.
- `[E10]` is **practitioner opinion** and must be cited as such.
- Everything under `[L1]`–`[L10]` is **n=1 project, n=1 run, one model family, one host**
  (`KI-35` explicitly limits external validity to "单模型单环境"). These are existence proofs and
  measurement warnings, **not** population estimates.
- The overnight run's own top-line result (**38/38 PASS**) is a **corpus-ceiling failure**
  (`KI-27`, `KI-28`), and its efficiency channel was **`UNMEASURABLE`** (`KI-23`). It must not be
  cited as evidence that any skill improves anything.
- One state change occurred between the parent's measurement and mine: the 0-byte `nul` file at the
  repo root, recorded as surviving ~11 days, is **now absent** (`[L9]`, measured 2026-09-24). The
  untracked-entry count also drifted **2170 → 2178** between the two measurements. Both are
  point-in-time values.
