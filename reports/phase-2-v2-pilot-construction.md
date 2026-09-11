# External Eval v2 Pilot Construction Report

## Objective

Phase 2 v1 asked whether loading the Cognitive Skill makes an agent perform better on real tasks and
answered **NO CLEAR BENEFIT — ceiling-limited**: the corpus could not measure the skill's incremental
value because every condition solved (almost) everything.

v2 exists to fix the measurement, not the skill. It builds tasks in which a **plausible wrong
decision stays available** while correct cognitive control — reading the repository's own contract,
choosing the right verification, respecting the source of truth, recovering from a failed path, and
stopping at the requested scope — is what makes success likely.

This round constructs the corpus and its evidence gates. It does **not** run the pilot.

## v1 Limitation

- Main (12 hard tasks x 3 conditions): controlA / controlB / treatment all **12/12 task pass,
  55/55 criteria**, paired win=0 loss=0 tie=12.
- Pilot (13 original tasks): 85% / 92% / 92%; the only discriminating criterion
  (`d1.constraints`) was caught by *both* treatment and the three-line controlB reminder.
- Conclusion at the time: the full skill showed no measurable advantage over a minimal scaffold, but
  the corpus saturated, so the null result was bounded by sensitivity rather than established.

## Pilot Corpus (12 tasks, 12 families)

| # | task | family | seeded defect / requested change | visible test |
|---|---|---|---|---|
| V2-01 | `v2-01-redaction` | verification | redaction only handles the top level, two lowercase keys, and mutates its input | passes (top-level only) |
| V2-02 | `v2-02-date-only` | root-cause | `new Date(value)` + local getters → date depends on machine timezone | passes |
| V2-03 | `v2-03-config-precedence` | constraint/precedence | wrong source order and truthiness-based merge (`0` / `false` lost) | passes |
| V2-04 | `v2-04-idempotent-migration` | state/idempotency | migration appends unconditionally and mutates the caller's config | passes (single run) |
| V2-05 | `v2-05-atomic-cache` | failure-atomicity | writes the target directly; no temp, no atomic replace | passes (happy path) |
| V2-06 | `v2-06-concurrency` | concurrency | read → await → write race loses updates under `Promise.all` | passes (sequential) |
| V2-07 | `v2-07-generated-source` | source-of-truth | `priority` must be added through the generator's source of truth | **fails** (encodes the request) |
| V2-08 | `v2-08-format-compat` | compatibility/context-discovery | optional `note` must not change the default v1 line shape | **fails** (encodes the request) |
| V2-09 | `v2-09-offline-build` | failure-recovery | online build cannot run here; the offline path is the way, and `dist/` is generated | passes |
| V2-10 | `v2-10-scope-control` | stopping/scope | `slugify(null)` crashes; four unrelated TODOs are decoys | passes |
| V2-11 | `v2-11-easy-constant` | easy negative control | default port 3000 → 3001 | passes |
| V2-12 | `v2-12-boundary-fix` | cheap-verification negative control | `isWithin` boundaries are exclusive | **fails** (encodes the request) |

Nine seeds hide the defect behind a passing visible test (the naive patch looks sufficient); three
expose it through a failing visible test that states the requested behaviour.

Each seed is 4–6 files, Node >= 18, CommonJS, no third-party dependency, no network.

## Checker Evidence

`node evals/external-v2/scripts/selftest.js` → **V2 PILOT CONSTRUCTION PASS**

```text
12/12 gold pass
24/24 mutations killed
all primary criteria provenance-valid
0 checker errors
```

- **Gate A (gold).** Every task's `gold/` transform makes its checker PASS on *all* primary
  criteria.
- **Gate B (mutation kill).** 24 mutations (2 per task), each a plausible partial fix or wrong
  source of truth. The selftest records `expectedKilledBy`, the criteria that actually failed, and
  requires the expected set to be a subset of the actual set — a mutation that fails for an
  unrelated reason (or by crashing) is **not** counted as a kill. One expectation was corrected
  during construction precisely because of this rule (V2-02 `m2-utc-no-validation` does not break
  round-tripping of *valid* dates, only calendar validation).
- **Gate C (provenance).** 65 primary criteria, all carrying a legal `sourceType` + `source` +
  `sourceExcerpt`: `repository_contract` 44, `user_task` 15, `existing_visible_test` 6. No
  `reviewer_preference` / `skill_preference` / `hidden_expectation` style criteria exist.
- **Seed sanity.** Every pristine seed FAILS its checker, so each carries a real, detectable defect.
- Several checkers do more than compare outputs: V2-07 deletes and *regenerates* the artifact
  through the repository's own generator; V2-09 deletes `dist/`, rebuilds through the offline path
  and then mutates the source to prove the banner is derived, not hard-coded; V2-05 injects a
  `replace` failure; V2-06 runs 100+50 concurrent increments and a two-key burst; V2-02 runs the
  candidate in child processes under three `TZ` values.

## Anti-bias Review

Every task was checked against the five construction questions, all answered YES:

| question | answer |
|---|---|
| Would a competent engineer consider this a realistic task? | yes (bug reports, feature requests, contract compliance) |
| Is every primary criterion supported by the task text or the repository? | yes (65/65 provenance-valid) |
| Can controlB (a three-line reminder) plausibly solve it? | yes — the fix is small in every task; nothing requires the skill's structure |
| Does the task test correctness rather than use of a named method? | yes — no criterion mentions a skill method, premortem, deep deliberation or reviewers |
| Would the task still be valid if treatment lost? | yes — success is defined by the repository contract, not by the hypothesis |

No condition-specific criterion, wording or fixture exists. Conditions differ **only** by the
`TASK.md` instruction block; the dispatcher message is byte-identical (see `conditions.json`).

## Known Limitations

- All 12 mini-repositories are small Node projects. Difficulty comes from reasoning, not from repo
  size or context length; **long-context behaviour is not covered by this suite**.
- The pilot has **not been run**; every claim here is about construction evidence, not behaviour.
- No agent was executed while designing any checker — no future treatment output was consulted.
- Criteria within a task are not independent (a single wrong root cause can fail several), so the
  primary unit of analysis remains task pass with criterion detail as support.
- The host cannot strictly enforce a tool/action budget; `protocol.json` therefore pre-registers
  budgets as targets and forbids faking a hard budget that cannot be measured.
- `elapsedMs`-style wall-clock telemetry remains host-latency dominated unless the host marks start
  immediately before dispatch.

## Freeze Status

> **Construction complete. Awaiting independent reviewer approval before pilot execution.**

The 36-run pilot is defined and ordered (`run-order.json`, seed `20260911`) but deliberately **not
executed**. `protocol.json` pre-registers the resource budget, the sensitivity gate
(`>=9/12 tasks all-condition-pass` or `<4/12 tasks showing any condition disagreement` ⇒
`PILOT SENSITIVITY FAIL — CEILING-LIMITED`, no Main), the unblinding order, the telemetry schema and
the F16/F17 observation rules.
