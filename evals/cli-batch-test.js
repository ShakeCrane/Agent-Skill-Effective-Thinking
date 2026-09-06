// Batch-mode test: the CLI's batch triage (planTasks) correctly handles many tasks at once.
// In-process (requires bin/router.js directly, calling planTasks) — deliberately avoids the spawn/
// piped-stdout sandbox limitation.
//
// Run: node evals/cli-batch-test.js
'use strict';
const { planTasks } = require('../bin/router.js');

const TASKS = [
  'Rename the local variable foo to bar in a 30-line function.',
  'Fix the off-by-one bug in the pagination loop, keeping the API response shape unchanged.',
  'Design the high-level architecture for a distributed event-processing system.',
  'This data pipeline has failed 5 times in a row with a cryptic error; make it stop failing.',
  '', // blank line must be skipped
  '  ', // whitespace-only line must be skipped
];

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const rows = planTasks(TASKS, { tier: 'auto' });

check('planTasks skips blank/whitespace lines', rows.length === 4, `rows=${rows.length}`);
check('every row is a full decision', rows.every((r) => r.r && r.r.strategy && r.r.model_action), 'all rows have r.strategy/model_action');
check('every strategy is in the documented set',
  rows.every((r) => ['fast', 'structured', 'deep'].includes(r.r.strategy)),
  rows.map((r) => r.r.strategy).join(','));
check('trivial task routes fast', rows[0].r.strategy === 'fast', rows[0].r.strategy);
check('repeated-failure task escalates', rows[3].r.strategy === 'deep' && rows[3].r.model_action === 'upgrade',
  `${rows[3].r.strategy}/${rows[3].r.model_action}`);

// ---- Session 50 regression: a --profile-json is per-SINGLE-task; in batch it must NOT leak into
//      other rows (a rename must stay fast even if an architecture task's profile is injected).
{
  const contaminated = planTasks(
    ['Rename the local variable foo to bar in a 30-line function.',
     'Design the high-level architecture for a distributed event-processing system.'],
    { tier: 'auto', profileJson: JSON.stringify({ reasoning_complexity: 0.95, verification_difficulty: 0.9 }) }
  );
  const ok = contaminated[0].r.strategy === 'fast' && contaminated[0].source === 'keyword'
    && contaminated[0].profileJsonIgnored === true
    && contaminated[1].r.strategy === 'deep';
  check('batch ignores --profile-json (no cross-row contamination)', ok,
    `row0=${contaminated[0].r.strategy}/${contaminated[0].source} row1=${contaminated[1].r.strategy}`);
}

console.log(failures === 0 ? 'CLI BATCH TEST PASS: batch triage handles many tasks at once correctly'
  : `CLI BATCH TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
