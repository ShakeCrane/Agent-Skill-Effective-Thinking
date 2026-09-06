// End-user (consumer) validation of the SHIPPED package — run AFTER `npm pack`, not in the repo
// workspace suite. It requires the tarball AFTER extraction as an installed dependency and
// exercises the whole public API from the installed tree (internal requires resolve from the
// package, not the repo). This closes the gap between "npm test passes in the repo" and "the
// published artifact actually works for an end user" (e.g. a missing `files` whitelist entry would
// break an internal require only here, not in the repo).
//
// Usage (one command): npm run consume
//   -> runs `node bin/consume-pack.js` which npm-packs to a temp dir, extracts, then runs this
//      test with CONSUMER_PKG_DIR pointed at the installed package.
//
// Run directly (after a manual pack+extract): CONSUMER_PKG_DIR=<dir-with-package.json> node evals/consumer-test.js
'use strict';
const PKG_DIR = process.env.CONSUMER_PKG_DIR;

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

if (!PKG_DIR) {
  console.log('CONSUMER: CONSUMER_PKG_DIR not set — run "npm run consume" (packs + extracts first).');
  process.exit(1);
}

require(PKG_DIR); // resolves package.json main; a missing transitive file throws here
const lib = require(PKG_DIR);

// 1. full public surface is present on the installed package
const expected = ['route', 'extract', 'fillProfile', 'fillProfileSync', 'capabilities', 'calibrate',
  'adaptiveLoop', 'runTask', 'runTaskAsync', 'fanOut', 'fanOutAsync', 'review', 'reviewAsync',
  'consolidate', 'protocol', 'stopping', 'cost', 'certainty', 'verificationPlan', 'VERIFY_LADDER'];
check('installed package exposes the full public API', expected.every((k) => k in lib), `missing=${expected.filter((k) => !(k in lib)).join(',')}`);

// 2. core routing behavior works from the installed tree
{
  const r = lib.route(lib.extract('Rename the local variable foo to bar in a 30-line function.'));
  check('installed route: trivial rename -> fast/keep', r.strategy === 'fast' && r.model_action === 'keep', `${r.strategy}/${r.model_action}`);
  const d = lib.route(lib.extract('This data pipeline has failed 5 times in a row with a cryptic error; make it stop failing.'));
  check('installed route: repeated-failure -> deep/upgrade', d.strategy === 'deep' && d.model_action === 'upgrade', `${d.strategy}/${d.model_action}`);
}

// 3. verify plan + certainty from the installed tree
{
  const vp = lib.verificationPlan('deep', { verification_difficulty: 0.9, error_cost: 0.9 });
  check('installed verify plan: self-review last, not primary', vp.primary.key === 'external-test' && vp.methods[vp.methods.length - 1].key === 'self-review', vp.methods.map((m) => m.key).join('>'));
  const c = lib.certainty.classify({ clarity: 0.95, hidden_constraint: 0.05, constraint_count: 1, constraint_conflict: 0, reasoning_complexity: 0.05, novelty: 0, error_cost: 0.05, reversibility: 0.95, verification_difficulty: 0.05, tool_dependency: false, context_size: 'small', parallelism: false, failures_so_far: 0 });
  check('installed certainty works', c.strategy === 'fast' && c.certainty === 'high', `${c.strategy}/${c.certainty}`);
}

(async () => {
  // 4. async orchestration + adaptive loop from the installed tree
  const out = await lib.fanOutAsync(['a', 'b'], async (x) => x.toUpperCase());
  check('installed fanOutAsync works', out.length === 2 && out.every((r) => r.ok) && out[1].result === 'B', JSON.stringify(out.map((o) => o.result)));
  const rev = await lib.reviewAsync([{ id: 'c' }], [async () => ({ agree: true }), async () => ({ agree: false })]);
  check('installed reviewAsync surfaces dispute', rev[0].verdict === 'disputed', rev[0].verdict);
  const final = await lib.runTaskAsync({ task: 'Convert this markdown file to HTML.', maxSteps: 4, execute: async () => ({ ok: true }) });
  check('installed runTaskAsync completes', final.done === true && final.success === true, `attempts=${final.attempts}`);

  console.log(failures === 0
    ? 'CONSUMER PACKAGE TEST PASS: the shipped tarball loads and works for an end user'
    : `CONSUMER PACKAGE TEST FAIL: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
