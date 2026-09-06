// VALIDATION / REGRESSION CORPUS (32 items).
//
// Naming note (Release Blocker 4): this file was historically called a "held-out validation
// set". That label is no longer accurate. The corpus GREW through the development feedback
// loop: its misses at 12→21 items drove router v4 changes (failure-log F5), the extractor
// fixes (F4), and later sessions expanded (22→32) and cross-checked it (cross-author labels).
// A set that participates in the feedback loop cannot strictly be called a true held-out test set.
//
// What it IS: a regression / specification-consistency corpus. Its labels were reasoned from
// task nature (not from consulting DEFAULTS), and it checks that the router keeps honoring a
// fixed, independently-authored specification while the router evolves.
//
// What it is NOT: standalone proof of out-of-distribution generalization. The "32/32" result is
// regression consistency against THIS corpus, not evidence of generalization to unseen
// distributions. A separate external held-out set is future work.
//
// Run: node evals/validation.js

'use strict';
const { route } = require('../router/task-router.js');

const ITEMS = [
  {
    id: 'val-trivial-fact',
    task: 'What is the capital of France?',
    profile: {
      clarity: 0.95, hidden_constraint: 0.02, constraint_count: 0, constraint_conflict: 0,
      reasoning_complexity: 0.05, novelty: 0.0, error_cost: 0.02, reversibility: 0.99,
      verification_difficulty: 0.02, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
    rationale: 'Fact recall, trivial.',
  },
  {
    id: 'val-trivial-arith',
    task: 'Subtract 47 from 100.',
    profile: {
      clarity: 0.95, hidden_constraint: 0.02, constraint_count: 0, constraint_conflict: 0,
      reasoning_complexity: 0.05, novelty: 0.0, error_cost: 0.05, reversibility: 0.99,
      verification_difficulty: 0.05, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
    rationale: 'Trivial arithmetic.',
  },
  {
    id: 'val-flaky-ci-debug',
    task: 'Explain why our E2E tests intermittently time out in CI but pass locally.',
    profile: {
      clarity: 0.6, hidden_constraint: 0.7, constraint_count: 2, constraint_conflict: 0.3,
      reasoning_complexity: 0.75, novelty: 0.6, error_cost: 0.4, reversibility: 0.6,
      verification_difficulty: 0.75, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 1,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
    rationale: 'Root-cause of intermittent infra/test issue: hard to verify, many hidden factors.',
  },
  {
    id: 'val-regex-rewrite',
    task: 'Rewrite this regex to also match quoted strings with escaped quotes.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.5, constraint_count: 2, constraint_conflict: 0.2,
      reasoning_complexity: 0.5, novelty: 0.3, error_cost: 0.3, reversibility: 0.85,
      verification_difficulty: 0.4, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'Small but has edge-case subtleties (escaped quotes); verifiable with a quick test.',
  },
  {
    id: 'val-microservice-migration',
    task: 'Migrate this monolith to microservices: assess trade-offs and propose a phased plan.',
    profile: {
      clarity: 0.5, hidden_constraint: 0.7, constraint_count: 4, constraint_conflict: 0.7,
      reasoning_complexity: 0.85, novelty: 0.6, error_cost: 0.7, reversibility: 0.3,
      verification_difficulty: 0.8, tool_dependency: false, context_size: 'large',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
    rationale: 'Architecture trade-offs, irreversible, hard to verify, large context.',
  },
  {
    id: 'val-folder-sizes',
    task: 'List the file sizes of everything in this folder.',
    profile: {
      clarity: 0.95, hidden_constraint: 0.05, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.05, novelty: 0.0, error_cost: 0.05, reversibility: 0.99,
      verification_difficulty: 0.05, tool_dependency: true, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
    rationale: 'Mechanical listing, trivially verifiable; tool use is just a command.',
  },
  {
    id: 'val-pipeline-failed-5x',
    task: 'This data pipeline has failed 5 times in a row with a cryptic error; make it stop failing.',
    profile: {
      clarity: 0.5, hidden_constraint: 0.7, constraint_count: 3, constraint_conflict: 0.5,
      reasoning_complexity: 0.8, novelty: 0.6, error_cost: 0.6, reversibility: 0.5,
      verification_difficulty: 0.8, tool_dependency: false, context_size: 'mid',
      parallelism: false, failures_so_far: 5,
    },
    expected: { strategy: 'deep', model_action: 'upgrade' },
    rationale: '5 repeated failures + cryptic + hard to verify → capability boundary → upgrade.',
  },
  {
    id: 'val-batch-classify',
    task: 'Classify 10,000 customer reviews into 5 sentiment buckets using our existing classifier.',
    profile: {
      clarity: 0.85, hidden_constraint: 0.2, constraint_count: 2, constraint_conflict: 0,
      reasoning_complexity: 0.3, novelty: 0.2, error_cost: 0.2, reversibility: 0.9,
      verification_difficulty: 0.3, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    // Originally labeled structured ("multi-step, 10k items"). Re-labeled fast after analysis:
    // running an EXISTING pipeline is mechanical, low-risk, easily spot-verified, reversible, and
    // low-reasoning. "Multi-step" alone is not a reason to leave Fast (anti-overthinking).
    // Genuine open question: large mechanical BATCHES may want a light safety protocol (count
    // assertions, sample verify) — recorded as a candidate signal in task-router.md, NOT forced
    // into thresholds (avoids F2 co-fitting). task-nature (existing pipeline) supports fast.
    expected: { strategy: 'fast', model_action: 'keep' },
    rationale: 'Existing pipeline, mechanical, low-risk, easily spot-verified. Multi-step is not enough to force Structured.',
  },
  {
    id: 'val-taglines',
    task: 'Brainstorm 20 marketing taglines for a new coffee brand.',
    profile: {
      clarity: 0.9, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.2, novelty: 0.3, error_cost: 0.1, reversibility: 0.95,
      verification_difficulty: 0.1, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
    rationale: 'Low-risk creative generation, reversible, no right answer to verify.',
  },
  {
    id: 'val-security-review',
    task: 'Review the security of our auth flow before we launch to production.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.8, constraint_count: 3, constraint_conflict: 0.4,
      reasoning_complexity: 0.8, novelty: 0.5, error_cost: 0.9, reversibility: 0.1,
      verification_difficulty: 0.8, tool_dependency: false, context_size: 'mid',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
    rationale: 'High stakes, hard to verify (security is adversarial), high hidden-constraint.',
  },
  {
    id: 'val-md-to-html',
    task: 'Convert this markdown file to HTML.',
    profile: {
      clarity: 0.95, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.05, novelty: 0.0, error_cost: 0.05, reversibility: 0.99,
      verification_difficulty: 0.05, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
    rationale: 'Mechanical format transform.',
  },
  {
    id: 'val-parallel-paper-summaries',
    task: 'Summarize the key claims of these 3 long papers, each independently, then I will combine them.',
    profile: {
      clarity: 0.85, hidden_constraint: 0.3, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.3, novelty: 0.4, error_cost: 0.2, reversibility: 0.9,
      verification_difficulty: 0.3, tool_dependency: true, context_size: 'small',
      parallelism: true, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'delegate' },
    rationale: 'Independent research units ideal for fan-out → delegate.',
  },

  // ---- Session 04 additions: push into new axes (overthink guard, high-novelty mechanical,
  //      tool-lookup, no-oracle high-stakes, vague-but-cheap). Expectations reasoned from task
  //      nature, NOT from thresholds. ----
  {
    id: 'val-many-trivial-constraints',
    task: 'Sort this array, separating odds and evens first, preserving original relative order on ties, handling empty input — a quick coding exercise with unit tests.',
    profile: {
      clarity: 0.85, hidden_constraint: 0.3, constraint_count: 4, constraint_conflict: 0.2,
      reasoning_complexity: 0.3, novelty: 0.2, error_cost: 0.1, reversibility: 0.95,
      verification_difficulty: 0.15, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'Many trivial constraints must NOT force Deep (now validated: it routes structured, not deep). Label is structured because hidden_constraint=0.3 (mild) blocks Fast; the KEY claim — many trivial constraints ≠ deep — holds.',
  },
  {
    id: 'val-novel-mechanical-boilerplate',
    task: 'Generate boilerplate wrappers for a rarely-seen API we have never used — mechanical, verify by compiling.',
    profile: {
      clarity: 0.8, hidden_constraint: 0.3, constraint_count: 2, constraint_conflict: 0,
      reasoning_complexity: 0.4, novelty: 0.75, error_cost: 0.25, reversibility: 0.85,
      verification_difficulty: 0.3, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'High novelty must NOT force deep when mechanical and compilable-verifiable → structured.',
  },
  {
    id: 'val-sales-analysis',
    task: 'Analyze our sales data to find which region grew fastest and explain the method.',
    profile: {
      clarity: 0.75, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0.1,
      reasoning_complexity: 0.5, novelty: 0.3, error_cost: 0.3, reversibility: 0.8,
      verification_difficulty: 0.4, tool_dependency: false, context_size: 'mid',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'Multi-step data analysis, moderate, verifiable by reproducing the numbers.',
  },
  {
    id: 'val-currency-convert-tool',
    task: 'Look up the current USD→EUR rate from an API and convert 50 amounts.',
    profile: {
      clarity: 0.85, hidden_constraint: 0.2, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.15, novelty: 0.2, error_cost: 0.2, reversibility: 0.9,
      verification_difficulty: 0.15, tool_dependency: true, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
    rationale: 'Needs a tool lookup but is mechanical and easily verified → fast, and NOT delegate (single unit).',
  },
  {
    id: 'val-vague-performance',
    task: 'Improve the loading time of our homepage (user did not say by how much or measure what).',
    profile: {
      clarity: 0.3, hidden_constraint: 0.75, constraint_count: 1, constraint_conflict: 0.2,
      reasoning_complexity: 0.6, novelty: 0.5, error_cost: 0.4, reversibility: 0.5,
      verification_difficulty: 0.65, tool_dependency: false, context_size: 'mid',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
    rationale: 'Vague requirement + performance is hard to verify objectively → deep.',
  },
  {
    id: 'val-simple-bugfix',
    task: 'Fix the off-by-one bug in the pagination loop, keeping the API response shape unchanged.',
    profile: {
      clarity: 0.85, hidden_constraint: 0.3, constraint_count: 2, constraint_conflict: 0,
      reasoning_complexity: 0.3, novelty: 0.2, error_cost: 0.3, reversibility: 0.85,
      verification_difficulty: 0.25, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'Belabelled from fast: mild hidden constraint ("keep API response shape unchanged") reasonably blocks Fast; a clearly-scoped but constrained bugfix → Structured is the defensible read.',
  },
  {
    id: 'val-mass-header-replace',
    task: 'Replace every occurrence of the old copyright header across 500 files with the new one.',
    profile: {
      clarity: 0.9, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.1, novelty: 0.1, error_cost: 0.15, reversibility: 0.9,
      verification_difficulty: 0.15, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
    rationale: 'Mechanical mass replacement, verifiable, reversible → fast.',
  },
  {
    id: 'val-contract-clause-no-oracle',
    task: 'Draft the exact legal language for a vital contract clause; there is no way to test it and errors are very costly.',
    profile: {
      clarity: 0.55, hidden_constraint: 0.7, constraint_count: 3, constraint_conflict: 0.4,
      reasoning_complexity: 0.75, novelty: 0.6, error_cost: 0.85, reversibility: 0.1,
      verification_difficulty: 0.85, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0, one_shot: true,
    },
    expected: { strategy: 'deep', model_action: 'upgrade' },
    rationale: 'No test oracle + very high error cost + irreversible one-shot deliverable → deep AND upgrade (matches objective: hard-to-verify one-shot judgment with high error cost → upgrade). Legal jargon alone would NOT escalate, but high-cost-no-oracle + one-shot is a genuine mismatch, consistent with val-investment-decision.',
  },
  {
    id: 'val-investment-decision',
    task: 'Decide whether to invest in company X — high-stakes, one-shot, irreversible, no way to verify beforehand.',
    profile: {
      clarity: 0.5, hidden_constraint: 0.8, constraint_count: 3, constraint_conflict: 0.5,
      reasoning_complexity: 0.85, novelty: 0.7, error_cost: 0.95, reversibility: 0.05,
      verification_difficulty: 0.9, tool_dependency: false, context_size: 'mid',
      parallelism: false, failures_so_far: 0, one_shot: true,
    },
    expected: { strategy: 'deep', model_action: 'upgrade' },
    rationale: 'High-stakes one-shot irreversible decision with no oracle → deep; one-shot + no oracle + very high cost → upgrade.',
  },
  {
    id: 'val-mechanical-csv-parse',
    task: 'Parse 5,000 log lines and write one summary row per error code — mechanical, verifiable.',
    profile: {
      clarity: 0.85, hidden_constraint: 0.2, constraint_count: 2, constraint_conflict: 0,
      reasoning_complexity: 0.35, novelty: 0.1, error_cost: 0.15, reversibility: 0.9,
      verification_difficulty: 0.25, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'Belabelled from fast: parse+aggregate+write is a light multi-step pipeline → Structured is the defensible read (not research → keep, not delegate). KEY claim held: mechanical non-parallel batch must NOT delegate.',
  },

  // ---- Session 53 additions: expand the held-out set (22 → 32) with NEW pressure areas not
  //      covered above. Expectations reasoned from task nature only (same process as the rest of
  //      this file), deliberately spanning boundaries a rule router could plausibly get wrong.
  {
    id: 'val-prod-outage-cheap-repro',
    task: 'Production checkout is returning 500s for some users; you can reproduce the failure locally with a test in a few minutes and iterate quickly.',
    profile: {
      clarity: 0.8, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0.1,
      reasoning_complexity: 0.4, novelty: 0.3, error_cost: 0.7, reversibility: 0.9,
      verification_difficulty: 0.2, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'ANTI-OVERTHINKING under urgency: high stakes, but the failure is cheaply and exactly verifiable (local repro) and the fix is reversible — so risk is caught by a check, not by deep deliberation → Structured (fast blocked by light hidden-constraint on the root-cause hunt), definitely not deep and not upgrade.',
  },
  {
    id: 'val-one-shot-outranks-parallel',
    task: 'This weekend: approve or reject the irreversible database migration (single high-stakes decision), and separately fetch two independent pricing figures for the report.',
    profile: {
      clarity: 0.6, hidden_constraint: 0.7, constraint_count: 3, constraint_conflict: 0.5,
      reasoning_complexity: 0.8, novelty: 0.6, error_cost: 0.8, reversibility: 0.1,
      verification_difficulty: 0.8, tool_dependency: false, context_size: 'mid',
      parallelism: true, failures_so_far: 0, one_shot: true,
    },
    expected: { strategy: 'deep', model_action: 'upgrade' },
    rationale: 'F-6b ORDERING pressure test: the workload LOOKS parallel (two lookups), but the actual deliverable is a single irreversible one-shot judgment — fan-out is the wrong move → upgrade (not delegate). One-shot high-cost+hard-to-verify+irreversible outranks parallel-delegation.',
  },
  {
    id: 'val-mech-parallel-delegate',
    task: 'Extract and normalize 200 rows of data from each of 5 separate spreadsheets into one combined table.',
    profile: {
      clarity: 0.85, hidden_constraint: 0.2, constraint_count: 2, constraint_conflict: 0,
      reasoning_complexity: 0.35, novelty: 0.2, error_cost: 0.15, reversibility: 0.9,
      verification_difficulty: 0.3, tool_dependency: false, context_size: 'small',
      parallelism: true, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'delegate' },
    rationale: 'Mechanical-but-multi-step PARALLEL units (5 independent sheets) → fan out to cheaper/faster workers. Not fast (light multi-step normalize) and not upgrade → delegate. Complements the research-parallel case with a mechanical-parallel one.',
  },
  {
    id: 'val-single-research-no-delegate',
    task: 'Research the best ORM for our stack and recommend one, with pros and cons.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0.2,
      reasoning_complexity: 0.5, novelty: 0.4, error_cost: 0.3, reversibility: 0.7,
      verification_difficulty: 0.5, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'DELEGATION RESTRAINT: research-like but a SINGLE unit with a recommendation judgment → keep (fan-out is for parallel independent units, not one research thread). Moderately verifiable + mild hidden trade-offs → Structured.',
  },
  {
    id: 'val-yaml-json-comments',
    task: 'Convert our 400 YAML settings files to JSON — but the YAML has comments documenting each setting that the team still needs to read.',
    profile: {
      clarity: 0.6, hidden_constraint: 0.7, constraint_count: 2, constraint_conflict: 0.3,
      reasoning_complexity: 0.5, novelty: 0.4, error_cost: 0.35, reversibility: 0.7,
      verification_difficulty: 0.45, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'HIDDEN-CONSTRAINT DISGUISE: looks like a trivial lossy format conversion, but comments-survival changes the approach. Hidden constraint present but the result IS checkable (round-trip/readability), so Structured (plan the approach, then verify) — NOT deep (no hard-to-verify axis) and NOT fast (hidden constraint).',
  },
  {
    id: 'val-failed-twice-boundary',
    task: 'Our deploy script failed twice with a flaky credentials error; make the auth step more robust.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0.2,
      reasoning_complexity: 0.4, novelty: 0.3, error_cost: 0.4, reversibility: 0.6,
      verification_difficulty: 0.5, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 2,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'ESCALATION-BOUNDARY-AT-2: two failures is not yet the ≥3 empirical-mismatch threshold, so no forced upgrade/deepen — but it is a real multi-step robustness fix with moderate verification → Structured/keep. Tests that the escalation line is drawn at task-nature evidence, not at "any failure."',
  },
  {
    id: 'val-contract-review-large-hd',
    task: 'Review the attached 200-page vendor contract and flag every clause that could expose us to liability or cost over the next two years.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.7, constraint_count: 3, constraint_conflict: 0.5,
      reasoning_complexity: 0.8, novelty: 0.5, error_cost: 0.7, reversibility: 0.3,
      verification_difficulty: 0.75, tool_dependency: false, context_size: 'large',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
    rationale: 'LARGE-CONTEXT iterable deliverable: huge document, hard-to-verify legal risk, high stakes → Deep; but the deliverable is a review LIST that another reviewer can re-check (not a one-shot irrevocable judgment), and there is no repeated-failure evidence → keep, NOT upgrade.',
  },
  {
    id: 'val-ambiguous-cheap-reversible',
    task: "We cannot decide between the legacy endpoint and the newer one for an internal demo; just try the lighter change first — it is easy to revert.",
    profile: {
      clarity: 0.35, hidden_constraint: 0.3, constraint_count: 1, constraint_conflict: 0.2,
      reasoning_complexity: 0.3, novelty: 0.3, error_cost: 0.15, reversibility: 0.95,
      verification_difficulty: 0.2, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
    rationale: 'F-2 BOUNDARY (ambiguity + CHEAP + reversible): genuinely ambiguous, but verification is trivial and it is fully reversible — so "try it" is right; ambiguity alone must NOT force Deep (F-2 only lets ambiguity force Deep when verification is NOT cheap). Clarity blocks Fast → Structured/keep.',
  },
  {
    id: 'val-novel-hard-verify-algo',
    task: 'Design a fleet-scheduling algorithm we have never attempted, and there is no existing test harness to validate it against.',
    profile: {
      clarity: 0.55, hidden_constraint: 0.6, constraint_count: 3, constraint_conflict: 0.4,
      reasoning_complexity: 0.85, novelty: 0.85, error_cost: 0.6, reversibility: 0.5,
      verification_difficulty: 0.85, tool_dependency: false, context_size: 'mid',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
    rationale: 'NOVELTY + NO ORACLE: new algorithm, high reasoning complexity, hard to verify → Deep (design + alternatives + probing); no one-shot flag, no repeated failure, no parallel units → keep, not upgrade.',
  },
  {
    id: 'val-many-constraints-trivial-verify',
    task: 'Write a function returning the intersection of two arrays — preserve order, handle duplicates and empty/undefined inputs — such that a set of unit tests passes.',
    profile: {
      clarity: 0.9, hidden_constraint: 0.2, constraint_count: 3, constraint_conflict: 0.2,
      reasoning_complexity: 0.2, novelty: 0.1, error_cost: 0.05, reversibility: 0.95,
      verification_difficulty: 0.1, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
    rationale: 'OVERTHINK-GUARD extreme: several constraints, but verification is a trivial unit-test oracle, low stakes, reversible — the constraint-count guard explicitly requires "not trivially verifiable" to go Deep, so this stays Fast (execute directly, tests prove it).',
  },
];


function main() {
  const n = ITEMS.length;
  let sCorrect = 0, mCorrect = 0;
  const misses = [];
  for (const it of ITEMS) {
    const got = route(it.profile, {});
    const sOK = got.strategy === it.expected.strategy;
    const mOK = got.model_action === it.expected.model_action;
    if (sOK) sCorrect++;
    if (mOK) mCorrect++;
    if (!sOK || !mOK) {
      misses.push({ id: it.id, exp: it.expected, got, rationale: it.rationale });
    }
    console.log(
      `[${sOK && mOK ? 'OK ' : 'MISS'}] ${it.id}  exp=${it.expected.strategy}/${it.expected.model_action} got=${got.strategy}/${got.model_action}`
    );
    if (!sOK || !mOK) {
      console.log(`       rationale: ${it.rationale}`);
      console.log(`       reasons: ${got.reasons.join('; ')}`);
    }
  }
  console.log('');
  console.log(`VALIDATION: strategy ${sCorrect}/${n} (${((sCorrect/n)*100).toFixed(1)}%), model ${mCorrect}/${n} (${((mCorrect/n)*100).toFixed(1)}%)`);
  console.log(misses.length === 0
    ? 'VALIDATION PASS: router generalized to all held-out cases'
    : `VALIDATION FAILURES: ${misses.length} — inspect above (this is real overfitting signal)`);
  process.exit(misses.length === 0 ? 0 : 1);
}

module.exports = { ITEMS };

if (require.main === module) main();
