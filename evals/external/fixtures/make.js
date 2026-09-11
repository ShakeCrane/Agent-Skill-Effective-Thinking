#!/usr/bin/env node
// Materialize all Phase 2 external-task fixtures.
//
// Kept as a generator (rather than 35 hand-written files) so the corpus is reproducible and
// auditable: every fixture is deterministic, no timestamps / randomness. Run:
//   node evals/external/fixtures/make.js
// Fixtures are then FROZEN (copied per-run by harness.js prepare); they must not be edited after
// the corresponding checkers are written.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const W = (rel, content) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : content.join('\n') + '\n');
};

// ---- A1 mechanical: csv -> json -------------------------------------------
W('a1-csv-to-json/data/people.csv', [
  'name,age,city',
  'Ada Lovelace,36,London',
  'Alan Turing,41,Manchester',
  'Grace Hopper,45,New York',
  'Barbara Liskov,52,Boston',
  'Donald Knuth,38,Milwaukee',
  'Margaret Hamilton,33,Boston',
  'Ken Thompson,40,New Orleans',
  'Radia Perlman,36,Portland',
]);

// ---- A2 mechanical: rename .jpeg -> .jpg -----------------------------------
W('a2-rename-ext/assets/photo-01.jpeg', 'img:01');
W('a2-rename-ext/assets/photo-02.jpeg', 'img:02');
W('a2-rename-ext/assets/vacation.jpeg', 'img:03');
W('a2-rename-ext/assets/logo.png', 'img:png');
W('a2-rename-ext/assets/banner.jpg', 'img:already-jpg');
W('a2-rename-ext/assets/notes.txt', 'do not touch this file');

// ---- B1 engineering: date range bug (+ hidden second defect) ---------------
W('b1-fix-date-range/lib/date-range.js', [
  '// Date range helpers. Ranges are {start, end} with numeric endpoints.',
  "'use strict';",
  '',
  'function overlaps(a, b) {',
  '  // BUG REPORT (#1142): two ranges that only touch at an endpoint are reported as overlapping.',
  '  return a.start <= b.end && b.start <= a.end;',
  '}',
  '',
  'function merge(ranges) {',
  '  // Merge overlapping ranges into the smallest equivalent list.',
  '  const out = [];',
  '  for (const r of ranges) {',
  '    const last = out[out.length - 1];',
  '    if (last && r.start <= last.end) {',
  '      if (r.end > last.end) last.end = r.end;',
  '    } else {',
  '      out.push({ start: r.start, end: r.end });',
  '    }',
  '  }',
  '  return out;',
  '}',
  '',
  'module.exports = { overlaps, merge };',
]);

// ---- B2 engineering: implement retry ---------------------------------------
W('b2-implement-retry/lib/retry.js', [
  '// TODO: implement retry(times, fn) here.',
  "'use strict';",
  '',
  'module.exports = { retry };',
]);

// ---- C1 debugging: intermittent (shared mutable default) -------------------
W('c1-intermittent-cache/lib/cache.js', [
  "'use strict';",
  'const DEFAULT_OPTS = { ttl: 60, max: 100 };',
  '',
  'class Cache {',
  '  constructor(opts) {',
  '    this.opts = Object.assign(DEFAULT_OPTS, opts || {});',
  '    this.map = new Map();',
  '  }',
  '  set(k, v) { this.map.set(k, v); }',
  '  get(k) { return this.map.get(k); }',
  '}',
  '',
  'module.exports = { Cache };',
]);
W('c1-intermittent-cache/NOTES.md', [
  '# Intermittent failure report',
  '',
  '`Cache` tests pass when run one at a time, but fail when the whole file runs.',
  'Sometimes the first test passes and the second fails; sometimes the order flips.',
  'Nobody can reproduce it consistently.',
]);

// ---- D1 architecture decision (no fixture data; keep dir) ------------------
W('d1-arch-decision/BRIEF.md', [
  '# Session storage decision',
  '',
  'A single-user offline CLI tool records work sessions. Each session is a small JSON record',
  '(a few KB). Requirements:',
  '',
  '- must survive a crash or power loss (an in-flight session must not vanish)',
  '- must support "list the last 100 sessions" quickly',
  '- total storage budget is 50 MB',
  '- offline, single user, no network dependency',
  '- the tool is distributed as a single binary; adding a native dependency is expensive',
  '',
  'Candidate approaches: (a) one JSON file per session under ~/.app/sessions,',
  '(b) a single SQLite database, (c) keep sessions in memory and flush on exit.',
]);

// ---- E1 information-insufficient: values live in another file --------------
W('e1-read-config/deploy/settings.yaml', [
  'service:',
  '  name: billing-api',
  '  port: 8412',
  '  timeout_ms: 2500',
  '  region: eu-west-1',
  '  tls:',
  '    enabled: true',
]);
W('e1-read-config/service-config.json', JSON.stringify({
  port: 8080,
  timeout_ms: 1000,
  log_level: 'info',
  replicas: 3,
}, null, 2));

// ---- E2 information-insufficient: count TODOs in comments ------------------
W('e2-count-todos/src/a.js', [
  '// TODO: refactor the parser',
  'const TODOS = 3;',
  'const msg = "TODO: fix later";',
  '/* TODO: also handle empty input */',
  'module.exports = { TODOS, msg };',
]);
W('e2-count-todos/src/b.js', [
  '// todo: this one is lowercase and does not count',
  '// TODO: uppercase counts',
  'module.exports = {};',
]);
W('e2-count-todos/src/sub/c.py', [
  'def handle(x):',
  '    # TODO: handle the error case',
  '    return x',
]);
W('e2-count-todos/src/sub/deep/d.js', [
  '/**',
  ' * TODO: document this module',
  ' */',
  '// TODO: and this',
  'module.exports = {};',
]);

// ---- F1 high-risk but cheaply verifiable -----------------------------------
W('f1-billing-rates/billing/rates.json', JSON.stringify({
  currency: 'EUR',
  effective_date: '2026-10-01',
  plan_name: 'standard',
  rates: { basic: 10.0, pro: 24.0, enterprise: 99.8 },
}, null, 2));

// ---- G1 long context: retry limit scattered, truth in a long doc -----------
{
  const lines = ['# Operations runbook', ''];
  for (let i = 1; i <= 60; i++) {
    lines.push(`## Section ${i}`);
    lines.push(`Routine operating note ${i}: check the dashboards, confirm queue depth is within`);
    lines.push(`the documented envelope, and escalate only if the on-call runbook says so.`);
    lines.push('');
  }
  lines.push('## Worker configuration');
  lines.push('The worker retry limit is 7. Any deployment that still carries a different value is');
  lines.push('out of date and must be corrected to 7 before the next release.');
  lines.push('');
  for (let i = 61; i <= 120; i++) {
    lines.push(`## Section ${i}`);
    lines.push(`Additional historical note ${i} retained for auditing purposes.`);
    lines.push('');
  }
  W('g1-long-context/docs/operations.md', lines);
}
W('g1-long-context/config/worker.json', JSON.stringify({ worker: { retry_limit: 3, backoff: 'exponential' } }, null, 2));
W('g1-long-context/config/worker.yaml', ['worker:', '  retry_limit: 4', '  queue: default'].join('\n'));
W('g1-long-context/src/worker.js', ["'use strict';", 'const RETRY_LIMIT = 12;', 'module.exports = { RETRY_LIMIT };'].join('\n'));
W('g1-long-context/scripts/run-worker.sh', ['#!/usr/bin/env bash', 'RETRY_LIMIT=5', 'echo "starting worker"'].join('\n'));
W('g1-long-context/deploy/worker.ini', ['[worker]', 'retry_limit = 6', 'queue = default'].join('\n'));

// ---- H1 failure recovery: shipped verifier fails, fix the real cause -------
W('h1-failure-recovery/lib/percent.js', [
  "'use strict';",
  'function percent(part, whole) {',
  '  return Math.round((part / whole) * 100);',
  '}',
  'module.exports = { percent };',
]);
W('h1-failure-recovery/verify.js', [
  "'use strict';",
  'const { percent } = require("./lib/percent.js");',
  'let failed = 0;',
  'function eq(name, got, want) {',
  '  const ok = Math.abs(got - want) < 0.005;',
  '  console.log((ok ? "ok   " : "FAIL ") + name + " got=" + got + " want=" + want);',
  '  if (!ok) failed++;',
  '}',
  'eq("percent(1,3)", percent(1, 3), 33.333);',
  'eq("percent(25,200)", percent(25, 200), 12.5);',
  'eq("percent(1,8)", percent(1, 8), 12.5);',
  'eq("percent(0,5)", percent(0, 5), 0);',
  'if (failed) { console.log("FAILED: " + failed + " case(s)"); process.exit(1); }',
  'console.log("ALL PASS");',
]);

// ---- I1 parallel-applicable: count ERROR lines per log file ----------------
const logSpecs = [
  ['alpha.log', ['INFO start', 'ERROR disk full', 'WARN retry', 'error lower case', 'ERROR second', 'TERROR not a match']],
  ['beta.log', ['INFO ok', 'ERROR timeout', 'INFO done']],
  ['gamma.log', ['ERROR a', 'ERROR b', 'ERROR c', 'INFO fine']],
  ['delta.log', ['INFO nothing here', 'WARN maybe']],
  ['epsilon.log', ['ERROR one', 'INFO mid', 'ERROR two', 'WARN x', 'ERROR three']],
];
for (const [name, lines] of logSpecs) W('i1-parallel-logs/logs/' + name, lines);

// ---- J1 one-shot irreversible judgment -------------------------------------
W('j1-one-shot-decision/BRIEF.md', [
  '# Go / no-go: payments database migration, this weekend',
  '',
  'You must return a single decision: GO or NO-GO. The decision is final and irreversible',
  'once the maintenance window opens.',
  '',
  'Facts:',
  '- Maintenance window granted: 4 hours.',
  '- Measured migration time in staging last week: 6 hours 20 minutes.',
  '- Rollback procedure exists as a document but has NEVER been executed or tested.',
  '- Last verified backup restore: 11 months ago (restore was not timed).',
  '- The only engineer who has done this migration before is on leave and unreachable.',
  '- Business cost of a failed migration: estimated 8 hours of full payment outage.',
  '- Business cost of delaying one month: one additional weekend of running the old hardware.',
  '',
  'Write `decision.md` with your decision and the reasons. Do not delegate the decision.',
]);

// ---- N1 multi-constraint implementation (6 explicit constraints) -----------
W('n1-paginate/lib/paginate.js', ['// TODO: implement paginate(items, pageSize).', "'use strict';", 'module.exports = { paginate };'].join('\n'));

// ---- N2 trap: toFixed rounds, spec says truncate ---------------------------
W('n2-format-truncate/lib/format.js', ['// TODO: implement formatMoney(n).', "'use strict';", 'module.exports = { formatMoney };'].join('\n'));

// ---- N3 version compare (string-sort defect + decoy comment) ---------------
W('n3-version-compare/lib/version.js', [
  "'use strict';",
  '// NOTE: the split regex below is suspected by the reporter.',
  'function parse(v) { return String(v).split(/[.]/).map(Number); }',
  'function maxVersion(list) {',
  '  let best = list[0];',
  '  for (const v of list) { if (String(v) > String(best)) best = v; }',
  '  return best;',
  '}',
  'module.exports = { maxVersion, parse };',
]);
W('n3-version-compare/NOTES.md', [
  '# Bug report',
  'maxVersion returns the wrong version sometimes.',
  'A colleague suspects the split regex in parse().',
]);

// ---- N4 three sources + decoy file -----------------------------------------
W('n4-three-sources/deploy/a.yaml', ['service:', '  port: 9231', '  name: edge'].join('\n'));
W('n4-three-sources/deploy/b.ini', ['[pool]', 'worker_count = 6', 'queue = default'].join('\n'));
W('n4-three-sources/deploy/c.json', JSON.stringify({ region: 'ap-southeast-2', az: 'az2' }, null, 2));
W('n4-three-sources/deploy/d.md', [
  '# Outdated draft (do not use)',
  'An old draft mentioned port 8080, worker_count 2 and region us-east-1.',
  'This file is NOT the source of truth.',
]);

// ---- N5 long context with a near-miss distractor value ---------------------
{
  const lines = ['# Operations runbook', ''];
  for (let i = 1; i <= 45; i++) { lines.push(`## Section ${i}`); lines.push(`Operating note ${i}: routine checks, no action required.`); lines.push(''); }
  lines.push('## Worker tuning');
  lines.push('The worker retry limit is 7.');
  lines.push('The retry backoff multiplier is 3.');
  lines.push('Do not confuse these two numbers.');
  lines.push('');
  for (let i = 46; i <= 95; i++) { lines.push(`## Section ${i}`); lines.push(`Historical note ${i}.`); lines.push(''); }
  W('n5-context-distractor/docs/operations.md', lines);
}
W('n5-context-distractor/conf/worker.json', JSON.stringify({ worker: { retry_limit: 2, backoff_multiplier: 3 } }, null, 2));
W('n5-context-distractor/conf/pool.json', JSON.stringify({ pool: { retry_limit: 7, backoff_multiplier: 5 } }, null, 2));
W('n5-context-distractor/conf/fetcher.yaml', 'fetcher:\n  retry_limit: 9\n  backoff_multiplier: 3\n');
W('n5-context-distractor/src/sync.js', "'use strict';\nconst RETRY_LIMIT = 4;\nconst BACKOFF_MULTIPLIER = 3;\nmodule.exports = { RETRY_LIMIT, BACKOFF_MULTIPLIER };\n");
W('n5-context-distractor/scripts/run.sh', '#!/usr/bin/env bash\nRETRY_LIMIT=7\nBACKOFF_MULTIPLIER=8\necho start\n');
W('n5-context-distractor/conf/legacy.ini', '[worker]\nretry_limit = 11\nbackoff_multiplier = 2\n');

// ---- N6 failure recovery with TWO real defects -----------------------------
W('n6-two-defects/lib/stats.js', [
  "'use strict';",
  'function mean(arr) { let s = 0; for (const v of arr) s += v; return s / arr.length; }',
  'function median(arr) { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }',
  'module.exports = { mean, median };',
]);
W('n6-two-defects/verify.js', [
  "'use strict';",
  'const { mean, median } = require("./lib/stats.js");',
  'let failed = 0;',
  'const eq = (n, got, want) => { const ok = Object.is(got, want) || Math.abs(got - want) < 1e-9;',
  '  console.log((ok ? "ok   " : "FAIL ") + n + " got=" + got + " want=" + want); if (!ok) failed++; };',
  'eq("mean empty", mean([]), 0);',
  'eq("mean basic", mean([1, 2, 3]), 2);',
  'eq("median odd", median([3, 1, 2]), 2);',
  'eq("median even", median([1, 2, 3, 4]), 2.5);',
  'eq("median even 2", median([4, 1, 3, 2]), 2.5);',
  'if (failed) { console.log("FAILED: " + failed); process.exit(1); }',
  'console.log("ALL PASS");',
]);

// ---- N7 mechanical + explicit "create no extra files" ----------------------
W('n7-no-extra-files/notes.txt', ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].join('\n'));

// ---- N8 backward-compatible refactor + null handling -----------------------
W('n8-refactor/lib/strings.js', [
  "'use strict';",
  'function slugify(s) {',
  '  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");',
  '}',
  'function truncate(s, n) {',
  '  const t = s.trim();',
  '  return t.length <= n ? t : t.slice(0, n) + "...";',
  '}',
  'module.exports = { slugify, truncate };',
]);

// ---- N9 compound counting rule --------------------------------------------
W('n9-compound-count/src2/a.js', [
  '// FIXME: this one counts (comment)',
  'let FIXME = 1; // not a comment-start line, but contains FIXME after //',
  'const x = "XXX";',
  '/* XXX in block */',
]);
W('n9-compound-count/src2/b.py', ['# FIXME: counts', 'y = "FIXME in string, no comment"', '# XXX counts too'].join('\n'));
W('n9-compound-count/src2/sub/c.js', ['// nothing here', 'const XXX = 2;'].join('\n'));

// ---- N10 parallel with empty and header-only files -------------------------
W('n10-parallel-rows/data/a.csv', 'id,name\n1,a\n2,b\n3,c\n');
W('n10-parallel-rows/data/b.csv', 'id,name\n');
W('n10-parallel-rows/data/c.csv', '');
W('n10-parallel-rows/data/d.csv', 'id,name\n1,d\n');
W('n10-parallel-rows/data/e.csv', 'id,name\n1,e\n2,e\n3,e\n4,e\n5,e\n');
W('n10-parallel-rows/data/f.csv', 'id,name\n1,f\n2,f\n');
W('n10-parallel-rows/data/g.csv', 'id,name\n1,g\n2,g\n3,g\n');
W('n10-parallel-rows/data/h.csv', 'id,name\n');

// ---- N11 high-risk with decoy fields that look like rates ------------------
W('n11-rate-trap/billing2/rates.json', JSON.stringify({
  currency: 'USD',
  rates: { standard: 20.0, premium: 50.0 },
  legacy_rate: 15.0,
  rate_note: 'legacy_rate is frozen and must not change',
  discount_rate_percent: 5,
}, null, 2));

// ---- N12 nondeterminism: weak ID space -------------------------------------
W('n12-unique-id/lib/id.js', [
  "'use strict';",
  'function makeId() { return "id-" + Math.floor(Math.random() * 1000); }',
  'module.exports = { makeId };',
]);
W('n12-unique-id/NOTES.md', [
  '# Intermittent bug',
  'Generated IDs collide sometimes. It happens more often under load.',
  'Nobody can reproduce it on demand.',
]);

console.log('fixtures written to ' + ROOT);
