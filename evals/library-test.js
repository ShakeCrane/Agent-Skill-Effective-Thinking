// Library-surface test: the public API (index.js) exposes the whole skill as one importable unit,
// with the documented functions/types, and a few end-to-end behaviors still work through it.
//
// Run: node evals/library-test.js
'use strict';
const lib = require('../index.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// ---- expected export surface ----
{
  const expected = ['route', 'extract', 'fillProfile', 'fillProfileSync', 'capabilities', 'calibrate',
    'adaptiveLoop', 'runTask', 'runTaskAsync', 'fanOut', 'fanOutAsync', 'review', 'reviewAsync',
    'consolidate', 'protocol', 'stopping', 'cost', 'certainty', 'verificationPlan', 'VERIFY_LADDER'];
  const missing = expected.filter((k) => !(k in lib));
  check('public API exposes all expected members', missing.length === 0,
    missing.length ? 'MISSING: ' + missing.join(',') : expected.join(','));
}

// ---- each member has the right type ----
{
  const funcs = ['route', 'extract', 'adaptiveLoop', 'runTask', 'fanOut', 'review', 'consolidate'];
  const nonFunc = funcs.filter((k) => typeof lib[k] !== 'function');
  check('core members are functions', nonFunc.length === 0, nonFunc.join(','));
  for (const mod of ['capabilities', 'calibrate', 'protocol', 'stopping', 'cost']) {
    if (typeof lib[mod] !== 'object' || lib[mod] === null) failures++;
  }
  check('capability/calibrate/protocol/stopping/cost are modules', true, 'object modules');
}

// ---- end-to-end through the public API ----
{
  const r = lib.route(lib.extract('Convert this markdown file to HTML.'));
  check('extract->route works via public API', r.strategy === 'fast', `strategy=${r.strategy}`);
  const c = lib.estimateCost ? null : null; // cost is exposed as module, not top-level fn
  const cost = lib.cost.estimateCost('deep', {});
  check('cost works via public API', cost.tokens > lib.cost.estimateCost('fast', {}).tokens,
    `deep=${cost.tokens} vs fast=...`);
  const st = lib.stopping.shouldStop('fast', {});
  check('stopping works via public API', st.stop === true, st.reason);
  const out = lib.fanOut(['a', 'b'], (x) => x.toUpperCase());
  check('fanOut works via public API', out.length === 2 && out[0].result === 'A', `results=${out.map((o) => o.result)}`);
  const proto = lib.protocol.protocolFor('structured');
  check('protocol works via public API', proto.required.length === 5, `structured required=${proto.required.length}`);
  const vp = lib.verificationPlan('fast', { verification_difficulty: 0.1, error_cost: 0.1 });
  check('verificationPlan works via public API', vp.primary.key === 'external-test'
    && vp.methods[vp.methods.length - 1].key === 'self-review', vp.methods.map((m) => m.key).join('>'));
  check('VERIFY_LADDER exported', Array.isArray(lib.VERIFY_LADDER) && lib.VERIFY_LADDER.length === 7
    && lib.VERIFY_LADDER[6].key === 'self-review', `len=${lib.VERIFY_LADDER.length}`);
  const cert = lib.certainty.classify({ clarity: 0.95, hidden_constraint: 0.05, constraint_count: 1,
    constraint_conflict: 0, reasoning_complexity: 0.05, novelty: 0, error_cost: 0.05,
    reversibility: 0.95, verification_difficulty: 0.05, tool_dependency: false,
    context_size: 'small', parallelism: false, failures_so_far: 0 });
  check('certainty works via public API', ['high', 'medium', 'boundary'].includes(cert.certainty)
    && cert.strategy === 'fast', `certainty=${cert.certainty} strategy=${cert.strategy}`);
  const fp = lib.fillProfileSync('Convert this markdown file to HTML.', {
    askLLM: () => ({ clarity: 0.95, verification_difficulty: 0.05 }),
  });
  check('fillProfileSync works via public API', typeof fp.clarity === 'number' && fp.context_size === 'small',
    `clarity=${fp.clarity} ctx=${fp.context_size}`);
}

console.log(failures === 0 ? 'LIBRARY TEST PASS: skill is consumable as one importable library with a stable public API'
  : `LIBRARY TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
