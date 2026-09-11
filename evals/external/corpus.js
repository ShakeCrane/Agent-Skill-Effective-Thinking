// Phase 2 external behavioral evaluation corpus — FROZEN at Main Evaluation start.
//
// These tasks are deliberately NOT rewrites of the Phase 1 routing benchmark (19/32 items). They are
// real agent-shaped work with an objective verifiable deliverable. Each item pairs with
//   fixtures/<task_id>/   (inputs, copied per run by harness.js prepare)
//   checkers.js           (deterministic acceptance check, authored before any run)
//
// Freeze rule: after the first Main Evaluation run, neither task_text, acceptance_criteria, nor the
// checker for an item may be changed to improve results. Newly discovered skill defects are recorded
// as Failures, not patched and re-run.

'use strict';

const ITEMS = [
  {
    task_id: 'a1-csv-to-json',
    category: 'A-mechanical-simple',
    task_text:
      'Convert data/people.csv into output.json: a JSON array with one object per data row (skip the header), with keys name (string), age (number), city (string). Write only output.json.',
    acceptance_criteria: [
      'output.json exists and is valid JSON',
      'array has exactly 8 objects',
      'every object has exactly the keys name, age, city',
      'age is a number (not a string)',
      'all values match the source rows exactly',
    ],
    verification_method: 'deterministic: parse CSV + parse JSON + deep compare',
    difficulty_notes: 'trivial; included specifically to detect overthinking on simple work',
    risk_notes: 'low error cost, fully reversible',
  },
  {
    task_id: 'a2-rename-ext',
    category: 'A-mechanical-simple',
    task_text:
      'In assets/, rename every file whose name ends in .jpeg so that it ends in .jpg instead. Do not change any file contents, and do not touch files that are not .jpeg.',
    acceptance_criteria: [
      'no .jpeg files remain in assets/',
      'the three renamed files exist with .jpg names',
      'file contents are byte-identical to the originals',
      'logo.png, banner.jpg and notes.txt are unchanged and still present',
    ],
    verification_method: 'deterministic: directory listing + content hash comparison',
    difficulty_notes: 'trivial file operation',
    risk_notes: 'low',
  },
  {
    task_id: 'b1-fix-date-range',
    category: 'B-mid-engineering',
    task_text:
      'There is a bug report in lib/date-range.js: two ranges that only touch at an endpoint are reported as overlapping. Fix the code. Keep the same exports and signatures. Make sure the module is actually correct, not just that the reported line changed.',
    acceptance_criteria: [
      'overlaps({0,10},{10,20}) is false (touching is not overlapping)',
      'overlaps({0,10},{5,15}) is true',
      'overlaps({0,5},{10,15}) is false',
      'merge() handles UNSORTED input correctly (hidden second defect)',
      'merge() merges overlapping ranges and preserves non-overlapping ones',
      'exports and function signatures unchanged',
    ],
    verification_method: 'deterministic: require the module, run fixed cases including unsorted merge',
    difficulty_notes:
      'reported defect is easy; the unsorted-merge defect is only found by actually testing — discriminates verification behavior',
    risk_notes: 'medium; wrong fix silently corrupts scheduling logic',
  },
  {
    task_id: 'b2-implement-retry',
    category: 'B-mid-engineering',
    task_text:
      'Implement retry(times, fn) in lib/retry.js. It must: call fn up to `times` total attempts; return the first successful result; if every attempt throws, throw the error from the LAST attempt; never call fn more than `times` times; and if fn returns a promise, await it (the function may be used with async work). Replace the TODO placeholder.',
    acceptance_criteria: [
      'success on first attempt calls fn exactly once and returns its value',
      'failure then success returns the successful value',
      'all attempts failing throws the last error',
      'fn is never called more than `times` times',
      'async fn is awaited and its resolved value returned',
      'async failure across all attempts rejects with the last error',
    ],
    verification_method: 'deterministic: in-process sync + async cases with call counters',
    difficulty_notes: 'moderate; the async+last-error combination is where naive implementations fail',
    risk_notes: 'medium',
  },
  {
    task_id: 'c1-intermittent-cache',
    category: 'C-high-uncertainty-debugging',
    task_text:
      'Read NOTES.md. The Cache tests fail intermittently depending on the order they run in. Find the real root cause in lib/cache.js and fix it. The fix must be minimal and must not change the public API.',
    acceptance_criteria: [
      'constructing a Cache with custom opts does not affect a later Cache created without opts',
      'the same holds when the constructions are swapped in order',
      'Cache still exposes set/get and returns what was stored',
      'default ttl remains 60 and default max remains 100',
    ],
    verification_method: 'deterministic: construct in both orders, assert no shared-state leakage',
    difficulty_notes:
      'high uncertainty: symptom is order-dependent and not reproducible by reading alone; requires forming and testing a hypothesis',
    risk_notes: 'medium-high; a wrong "fix" (e.g. adding sleeps) hides the defect',
  },
  {
    task_id: 'd1-arch-decision',
    category: 'D-architecture-decision',
    task_text:
      'Read BRIEF.md and write decision.md: choose one of the three session-storage approaches. Give a definite recommendation, say what you rejected and why, name the main risk, say how you would roll back, and state one concrete observation that would prove the choice wrong.',
    acceptance_criteria: [
      'states one definite recommendation (names a, b or c)',
      'discusses at least two alternatives',
      'gives a reason for rejecting at least one alternative',
      'names at least one risk of the chosen approach',
      'gives a rollback or fallback path',
      'states a concrete falsification criterion',
      'addresses the 50 MB / crash-survival constraints from the brief',
    ],
    verification_method: 'rule-based required-elements check + blinded reviewer rubric (subjective item)',
    difficulty_notes: 'no single right answer; scored on decision completeness, not on the choice itself',
    risk_notes: 'subjective — must be blind-reviewed; the choice itself is NOT scored',
  },
  {
    task_id: 'e1-read-config',
    category: 'E-information-insufficient',
    task_text:
      'Update service-config.json so that port and timeout_ms match the values already configured for this service in deploy/settings.yaml. Change only those two fields; every other field must keep its current value.',
    acceptance_criteria: [
      'port equals the value in deploy/settings.yaml',
      'timeout_ms equals the value in deploy/settings.yaml',
      'log_level and replicas unchanged',
      'file is still valid JSON with exactly the original four keys',
      'deploy/settings.yaml was not modified',
    ],
    verification_method: 'deterministic: parse both files, compare; values cannot be guessed',
    difficulty_notes: 'impossible without reading the fixture — tests whether the agent gathers info first',
    risk_notes: 'medium; guessing plausible values (8080/1000) is the failure mode',
  },
  {
    task_id: 'e2-count-todos',
    category: 'E-information-insufficient',
    task_text:
      'Count every occurrence of the exact uppercase token TODO that appears in a comment in src/ (all files, all subdirectories). A comment is a line whose first non-space characters are //, #, * or /*. Occurrences in strings, identifiers or lowercase "todo" do not count. Write only the number to answer.txt.',
    acceptance_criteria: [
      'answer.txt exists and contains a single integer',
      'the integer equals the true count computed by the same rule',
    ],
    verification_method: 'deterministic: recompute the count with the stated rule over src/',
    difficulty_notes: 'requires actually traversing files; decoys punish pattern-matching without reading',
    risk_notes: 'low',
  },
  {
    task_id: 'f1-billing-rates',
    category: 'F-high-risk-cheaply-verifiable',
    task_text:
      'PRODUCTION BILLING DATA — errors here are expensive and customer-visible. In billing/rates.json, increase every value inside "rates" by exactly 5%, rounded to 2 decimals. Every other field (currency, effective_date, plan_name) must stay byte-identical, and the rates object must keep exactly its current keys.',
    acceptance_criteria: [
      'every rate equals old * 1.05 rounded to 2 decimals (tolerance 0.005)',
      'currency, effective_date and plan_name are unchanged',
      'rates has exactly the original three keys',
      'file remains valid JSON',
    ],
    verification_method: 'deterministic: exact numeric comparison',
    difficulty_notes:
      'framed as high-stakes but trivially verifiable — tests whether high perceived risk triggers useless deliberation or refusal',
    risk_notes: 'framed high; actual risk low because verification is cheap',
  },
  {
    task_id: 'g1-long-context',
    category: 'G-long-context',
    task_text:
      'The worker retry limit is configured in several places and they disagree. Make every one of them consistent with the value documented in docs/operations.md, and write the list of files you changed (one path per line) to changed.txt. Do not edit docs/operations.md.',
    acceptance_criteria: [
      'all five configuration files now carry the retry limit 7',
      'each changed file is still syntactically valid for its format',
      'changed.txt lists all five files',
      'docs/operations.md is unmodified',
    ],
    verification_method: 'deterministic: parse each file, check value; check changed.txt coverage',
    difficulty_notes: 'the truth is buried mid-document; tests information retention across a long file',
    risk_notes: 'medium; missing one file is the expected failure mode',
  },
  {
    task_id: 'h1-failure-recovery',
    category: 'H-failure-recovery',
    task_text:
      'Run `node verify.js` in this workspace. It currently fails. Make it pass by fixing the real cause in lib/percent.js. Do not modify or delete verify.js.',
    acceptance_criteria: [
      '`node verify.js` exits 0',
      'verify.js is byte-for-byte unmodified (no test tampering)',
      'the fix is in lib/percent.js, not in the checker',
    ],
    verification_method: 'deterministic: run the verifier + hash-compare verify.js against the fixture',
    difficulty_notes:
      'requires actually executing the failing check and diagnosing from the real failure output',
    risk_notes: 'medium; the tempting wrong move is editing the test',
  },
  {
    task_id: 'i1-parallel-logs',
    category: 'I-parallel-applicable',
    task_text:
      'For each file in logs/, count the lines that contain the standalone uppercase word ERROR (lowercase "error" and words like TERROR do not count). Write one line per file to summary.md, in the form: - <filename>: <count>',
    acceptance_criteria: [
      'summary.md exists',
      'exactly one line per log file (5 files)',
      'every filename is present and spelled correctly',
      'every count matches the true count computed with the stated rule',
    ],
    verification_method: 'deterministic: recompute counts per file, parse summary.md',
    difficulty_notes: 'mechanically parallelizable; counts are decoy-protected',
    risk_notes: 'low',
  },
  {
    task_id: 'j1-one-shot-decision',
    category: 'J-one-shot-irreversible',
    task_text:
      'Read BRIEF.md. You must return ONE final, irreversible go / no-go decision for the weekend payments database migration. Do not delegate the decision, do not hand it to a committee, and do not return "it depends". Write decision.md containing your decision and the reasons.',
    acceptance_criteria: [
      'states exactly one definite decision (GO or NO-GO), not both and not "it depends"',
      'cites at least two concrete facts from the brief',
      'states the main risk that drives the decision',
      'states a condition under which the decision would change',
      'does not delegate the decision to someone else',
    ],
    verification_method:
      'rule-based: decision extraction + fact citation + delegation check. The brief is written so the defensible decision is NO-GO (window 4h < measured 6h20m, rollback untested, backup restore unverified for 11 months, expert unavailable).',
    difficulty_notes: 'one-shot, irreversible, no oracle — tests whether the skill causes over-delegation or dithering',
    risk_notes: 'judgment-based criterion: pre-registered before runs, frozen thereafter',
  },
  {
    task_id: 'n1-paginate',
    category: 'B-mid-engineering',
    task_text:
      'Implement paginate(items, pageSize) in lib/paginate.js. Requirements: (1) return an array of arrays (pages), preserving item order; (2) the last page may contain fewer than pageSize items; (3) if items is empty, return [] — not [[]]; (4) if pageSize is not a positive integer, throw a TypeError; (5) if items is not an array, throw a TypeError; (6) the input array must not be mutated.',
    acceptance_criteria: [
      'splits into pages preserving order',
      'empty input returns [] not [[]]',
      'pageSize 0 throws TypeError',
      'negative pageSize throws TypeError',
      'non-integer pageSize throws TypeError',
      'non-array items throws TypeError',
      'input array not mutated',
      'fewer items than pageSize yields one page',
    ],
    verification_method: 'deterministic: 8 in-process cases, one per constraint',
    difficulty_notes:
      'six independent constraints on a small function — built so that omitting any single one is measurable',
    risk_notes: 'medium; silent constraint omission is the expected failure mode',
  },
  {
    task_id: 'n2-format-truncate',
    category: 'B-mid-engineering',
    task_text:
      'Implement formatMoney(n) in lib/format.js: return the number as a string with EXACTLY two decimal places, TRUNCATING the remainder — never rounding. Examples: formatMoney(1.239) must be "1.23", formatMoney(2) must be "2.00", formatMoney(-1.239) must be "-1.23". Note: toFixed() rounds, so using it alone is wrong.',
    acceptance_criteria: [
      'formatMoney(1.239) === "1.23" (not 1.24)',
      'formatMoney(1.2) === "1.20"',
      'formatMoney(2) === "2.00"',
      'formatMoney(-1.239) === "-1.23"',
      'formatMoney(0.005) === "0.00"',
      'formatMoney(1.999) === "1.99"',
      'formatMoney(0) === "0.00"',
    ],
    verification_method: 'deterministic: exact string comparison per case',
    difficulty_notes: 'a named trap; the obvious one-liner (toFixed) fails it',
    risk_notes: 'medium',
  },
  {
    task_id: 'n3-version-compare',
    category: 'C-high-uncertainty-debugging',
    task_text:
      'Read NOTES.md. maxVersion returns the wrong version for some inputs. A colleague blames the split regex in parse(), but you should find the real cause. Fix lib/version.js so maxVersion returns the highest semantic version. Do not change the exported signature.',
    acceptance_criteria: [
      'maxVersion(["1.2.9","1.2.10","1.2.3"]) === "1.2.10"',
      'maxVersion(["1.10.0","1.9.0"]) === "1.10.0"',
      'maxVersion(["2.0","1.99.99"]) === "2.0"',
      'maxVersion(["3.1.4"]) === "3.1.4"',
    ],
    verification_method: 'deterministic: version ordering cases with a multi-digit trap',
    difficulty_notes: 'the real cause is lexicographic string comparison; a decoy blames the regex',
    risk_notes: 'medium-high; fixing the decoy leaves the bug',
  },
  {
    task_id: 'n4-three-sources',
    category: 'E-information-insufficient',
    task_text:
      'Write report.json containing exactly three keys: port (from deploy/a.yaml), worker_count (from deploy/b.ini), region (from deploy/c.json). Ignore every other file in deploy/ — one of them is an outdated draft that is not the source of truth.',
    acceptance_criteria: [
      'port matches a.yaml',
      'worker_count matches b.ini',
      'region matches c.json',
      'exactly the three requested keys',
      'does not use the outdated draft values',
    ],
    verification_method: 'deterministic: parse all sources + decoy-value check',
    difficulty_notes: 'requires reading three differently-formatted files and resisting a plausible decoy',
    risk_notes: 'medium; the decoy is the failure mode',
  },
  {
    task_id: 'n5-context-distractor',
    category: 'G-long-context',
    task_text:
      'Two worker settings are configured inconsistently across this project. Make every retry limit equal the value documented in docs/operations.md, AND every backoff multiplier equal its documented value — they are different numbers, do not confuse them. Write the list of files you changed to changed.txt. Do not edit docs/operations.md.',
    acceptance_criteria: [
      'all six config files have retry limit 7',
      'all six config files have backoff multiplier 3',
      'changed.txt lists all six files',
      'docs/operations.md unmodified',
    ],
    verification_method: 'deterministic: per-file parse of both values + changed.txt coverage',
    difficulty_notes: 'a near-miss distractor (7 vs 3) punishes shallow reading of a long document',
    risk_notes: 'medium; confusing the two numbers is the failure mode',
  },
  {
    task_id: 'n6-two-defects',
    category: 'H-failure-recovery',
    task_text:
      'Run `node verify.js` in this workspace. It fails. Make it pass by fixing the real causes in lib/stats.js — there is more than one. Do not modify or delete verify.js.',
    acceptance_criteria: [
      '`node verify.js` exits 0',
      'verify.js unmodified',
      'the fix is in lib/stats.js',
    ],
    verification_method: 'deterministic: run verifier + hash compare + fix-location check',
    difficulty_notes: 'two independent defects; fixing only the first still fails the verifier',
    risk_notes: 'medium; partial fix is the expected failure mode',
  },
  {
    task_id: 'n7-no-extra-files',
    category: 'A-mechanical-simple',
    task_text:
      'Reverse the order of the lines in notes.txt, in place. Do not create any additional file in this directory.',
    acceptance_criteria: [
      'notes.txt lines reversed',
      'no additional file created',
    ],
    verification_method: 'deterministic: content compare + directory listing',
    difficulty_notes: 'trivial work with an explicit anti-overthinking constraint — measures whether extra planning artifacts appear',
    risk_notes: 'low',
  },
  {
    task_id: 'n8-refactor',
    category: 'B-mid-engineering',
    task_text:
      'In lib/strings.js, extract the shared character-cleaning logic used by slugify and truncate into a helper function called clean(s), and use it in both. While you are there, make both functions tolerate null/undefined input by returning "" (they currently throw). The exported behaviour for valid input must not change, and clean must also be exported.',
    acceptance_criteria: [
      'slugify basic behaviour unchanged',
      'slugify separator handling unchanged',
      'truncate ellipsis behaviour unchanged',
      'truncate no-op behaviour unchanged',
      'slugify(null) returns ""',
      'truncate(null, n) returns ""',
      'clean is exported',
    ],
    verification_method: 'deterministic: behavioural equivalence cases + new null cases',
    difficulty_notes: 'refactor + additive requirement; behaviour preservation is where it breaks',
    risk_notes: 'medium',
  },
  {
    task_id: 'n9-compound-count',
    category: 'E-information-insufficient',
    task_text:
      'In src2/ (all files, all depths), count: (a) every occurrence of FIXME that appears in a comment line — a line whose first non-space characters are //, # or * — plus (b) every occurrence of XXX anywhere in the file, comment or code. Add the two numbers together and write only the total to count.txt.',
    acceptance_criteria: [
      'count.txt is a single integer',
      'the total matches the compound rule',
    ],
    verification_method: 'deterministic: recompute both halves with the stated rule',
    difficulty_notes: 'a two-part rule with decoys for each half; partial application gives a wrong total',
    risk_notes: 'medium',
  },
  {
    task_id: 'n10-parallel-rows',
    category: 'I-parallel-applicable',
    task_text:
      'For every .csv file in data/, count its data rows (excluding the header line; an empty file or a header-only file has 0). Write one line per file to counts.md in the form: - <filename>: <count>. Include the files that have zero rows.',
    acceptance_criteria: [
      'one line per csv file (8)',
      'every count correct, including empty and header-only files',
    ],
    verification_method: 'deterministic: recompute row counts, parse counts.md',
    difficulty_notes: 'mechanically parallel; the edge cases (empty, header-only) are the discriminators',
    risk_notes: 'low-medium; dropping zero-row files is the expected failure mode',
  },
  {
    task_id: 'n11-rate-trap',
    category: 'F-high-risk-cheaply-verifiable',
    task_text:
      'PRODUCTION BILLING — errors are customer-visible and expensive. In billing2/rates.json, increase every value inside the "rates" object by exactly 5%, rounded to 2 decimals. Do NOT change legacy_rate, rate_note or discount_rate_percent: despite their names they are not part of the rates object. Leave currency untouched.',
    acceptance_criteria: [
      'rates values increased by 5% (2dp)',
      'legacy_rate unchanged',
      'rate_note unchanged',
      'discount_rate_percent unchanged',
      'currency unchanged',
    ],
    verification_method: 'deterministic: numeric compare + decoy-field preservation',
    difficulty_notes: 'high-stakes framing plus three decoy fields that look like rates',
    risk_notes: 'framed high; actual risk low because verification is cheap',
  },
  {
    task_id: 'n12-unique-id',
    category: 'C-high-uncertainty-debugging',
    task_text:
      'Read NOTES.md. Generated IDs collide intermittently, more often under load. Find the real cause in lib/id.js and fix it so IDs are unique within a process. Do not change the exported signature, and keep IDs as non-empty strings.',
    acceptance_criteria: [
      '10000 generated ids are all unique',
      'id is still a non-empty string',
    ],
    verification_method: 'deterministic: generate 10000 ids in-process, count collisions',
    difficulty_notes: 'the defect is a too-small random space; only measurable by actually generating many ids',
    risk_notes: 'medium-high; "add a retry" style fixes would not pass',
  },
];

module.exports = { ITEMS };
