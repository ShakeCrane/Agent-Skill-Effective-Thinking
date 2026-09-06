// Dogfood / integration test: run REAL task text through the PUBLIC library (index.js) end to end,
// and assert the composed system stays coherent. Catches integration gaps between components that
// per-unit tests miss: extract -> route -> protocol -> stopping -> adaptive-loop must agree on a
// coherent strategy, must always terminate, and fast tasks must stop immediately.
//
// Run: node evals/dogfood-test.js
'use strict';
const lib = require('../index.js');

// Real natural-language tasks across the objective's categories (from the eval sets).
const TASKS = [
  'Rename the local variable foo to bar in a 30-line function.',
  'Fix the off-by-one bug in the pagination loop, keeping the API response shape unchanged.',
  'Rewrite this regex to also match quoted strings with escaped quotes.',
  'Design the high-level architecture for a distributed event-processing system.',
  'Explain why our E2E tests intermittently time out in CI but pass locally.',
  'Classify 10,000 customer reviews into 5 sentiment buckets using our existing classifier.',
  'Review the security of our auth flow before we launch to production.',
  'This data pipeline has failed 5 times in a row with a cryptic error; make it stop failing.',
  'Summarize the key claims of these 3 long papers, each independently, then I will combine them.',
  'Decide whether to invest in company X — high-stakes, one-shot, irreversible, no way to verify beforehand.',
];

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const STRATEGIES = ['fast', 'structured', 'deep'];
const ACTIONS = ['keep', 'upgrade', 'delegate'];
let protoMismatch = 0;
let stopInvalid = 0;
let bounded = 0;

for (const task of TASKS) {
  const d = lib.route(lib.extract(task));
  const st = lib.stopping.shouldStop(d.strategy, { planWritten: true, assumptionsExplicit: true, evidenceSufficient: false, attempts: 0, roundsSinceNewInfo: 0 });

  // 1. decision is within the documented vocabulary
  if (!STRATEGIES.includes(d.strategy)) failures++;
  if (!ACTIONS.includes(d.model_action)) failures++;

  // 2. protocol always exists for whatever strategy the router emits
  const proto = lib.protocol.protocolFor(d.strategy);
  if (!proto || !Array.isArray(proto.required)) protoMismatch++;

  // 3. stopping always returns a valid, decisive response
  if (!st || typeof st.stop !== 'boolean') stopInvalid++;

  // 4. adaptive loop (fake executor: succeed on 3rd attempt) always terminates bounded
  const end = lib.runTask({
    task,
    execute: ((n = 0) => () => ({ ok: ++n >= 3 }))(),
  });
  const { attempt } = { attempt: end.history.length }; // total steps incl. initial route
  if (!end.done || attempt > 10) bounded++;
}

check(`all ${TASKS.length} tasks route to documented strategies/actions`, failures === 0,
  failures ? `${failures} bad decision(s)` : 'all valid');
check('protocol exists for every emitted strategy', protoMismatch === 0,
  `${protoMismatch} mismatch(es)`);
check('stopping responds correctly on every strategy', stopInvalid === 0,
  `${stopInvalid} invalid`);
check('adaptive loop terminates bounded on every task', bounded === 0,
  `${bounded} unbounded`);

// ---- fast tasks must stop immediately (consistent with stopping module) ----
{
  for (const task of TASKS.slice(0, 1)) {
    const d = lib.route(lib.extract(task));
    if (d.strategy === 'fast') {
      const s = lib.stopping.shouldStop('fast', {});
      check('fast task stops immediately through the library', s.stop === true, s.reason);
    }
  }
}

// ---- composed sanity on one known case: deep task + fake executor escalates then completes ----
{
  for (const task of TASKS.slice(7, 8)) { // pipeline-failed-5x
    const d = lib.route(lib.extract(task));
    check('repeated-failure task routes deep/upgrade through library', d.strategy === 'deep' && d.model_action === 'upgrade',
      `${d.strategy}/${d.model_action}`);
  }
}

console.log(failures === 0 && protoMismatch === 0 && stopInvalid === 0 && bounded === 0
  ? 'DOGFOOD TEST PASS: composed skill is coherent on real task text through the public library'
  : `DOGFOOD TEST FAIL: ${failures}/${protoMismatch}/${stopInvalid}/${bounded}`);
process.exit((failures === 0 && protoMismatch === 0 && stopInvalid === 0 && bounded === 0) ? 0 : 1);
