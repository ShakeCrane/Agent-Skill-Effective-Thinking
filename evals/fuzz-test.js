// Input-robustness fuzz test: feed adversarial / malformed / extreme task strings through the
// WHOLE pipeline (extract -> route -> certainty -> verify -> cost -> CLI decide) and assert the
// skill never crashes and always returns the documented vocabulary. Catches crashes on input while
// the rest of the suite tests valid profiles.
//
// Run: node evals/fuzz-test.js
'use strict';
const { extract } = require('../router/extract.js');
const { route } = require('../router/task-router.js');
const { classify } = require('../strategies/certainty.js');
const { estimateCost } = require('../strategies/cost.js');
const { verificationPlan } = require('../strategies/verify.js');
const { decide } = require('../bin/router.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const STRATS = new Set(['fast', 'structured', 'deep']);
const ACTIONS = new Set(['keep', 'upgrade', 'delegate']);

// Adversarial / malformed / extreme inputs. Each must NOT crash and must yield valid vocabulary.
const INPUTS = [
  '', ' ', '\t\n\r', '\u0000\u0001 control chars',
  '😀 emoji only 🎉', '混合 中文 English ї ϟƺ',
  '{"json":"object"} braces', 'null undefined NaN', '!@#$%^&*()',
  'Rename foo to bar', 'a'.repeat(10000),
  '{"one_shot":true,"error_cost":95}', '1.2.3.4.5', 'https://example.com/a.b.c?q=1',
  'null\u0000byte', '\uD83D\uDE00 surrogate', '\uFFFD\uFFFD replacement chars',
  'make it stop failing, the pipeline has failed 5 times', 'CONVERT THIS TO JSON!!',
];

// 1. pipeline never crashes + valid vocabulary
{
  let crash = 0;
  for (const t of INPUTS) {
    try {
      const p = extract(t);
      const r = route(p, {});
      classify(p);
      estimateCost(r.strategy, p);
      verificationPlan(r.strategy, p);
      if (!STRATS.has(r.strategy) || !ACTIONS.has(r.model_action)) {
        console.log('   [bad vocab] ' + JSON.stringify(t.slice(0, 30)) + ' -> ' + r.strategy + '/' + r.model_action);
        crash++;
      }
    } catch (e) {
      console.log('   [crash] ' + JSON.stringify(t.slice(0, 30)) + ' : ' + e.message);
      crash++;
    }
  }
  check(`pipeline handles ${INPUTS.length} adversarial inputs without crash/vocab-violation`, crash === 0, `issues=${crash}`);
}

// 2. CLI decide (keyword path) never crashes on the same inputs
{
  let crash = 0;
  for (const t of INPUTS) {
    try {
      const { r } = decide(t, { tier: 'auto' });
      if (!STRATS.has(r.strategy) || !ACTIONS.has(r.model_action)) { crash++; console.log('   [bad vocab] CLI ' + JSON.stringify(t.slice(0, 20))); }
    } catch (e) { crash++; console.log('   [cli crash] ' + JSON.stringify(t.slice(0, 20)) + ' : ' + e.message); }
  }
  check('CLI decide (keyword) handles all adversarial inputs', crash === 0, `issues=${crash}`);
}

// 3. CLI decide with --profile-json (injected partial) never crashes, including degenerate JSON
{
  const injections = [null, '{bad', '[]', '{"clarity":2,"constraint_count":-1,"one_shot":"yes"}', '{"__proto__":{}}', '42', '"str"'];
  let crash = 0;
  for (const inj of injections) {
    for (const t of ['Rename foo to bar', 'Invest one-shot in company X', 'Design the auth architecture', '']) {
      try {
        const { r } = decide(t, { tier: 'auto', profileJson: inj });
        if (!STRATS.has(r.strategy) || !ACTIONS.has(r.model_action)) { crash++; console.log('   [bad vocab] inject=' + String(inj).slice(0, 24)); }
      } catch (e) { crash++; console.log('   [inject crash] ' + JSON.stringify(inj) + ' : ' + e.message); }
    }
  }
  check('CLI decide with degenerate --profile-json never crashes', crash === 0, `issues=${crash}`);
}

// 4. batch planTasks with blank/malformed lines never crashes
{
  const { planTasks } = require('../bin/router.js');
  let crash = 0, n = 0;
  try {
    const rows = planTasks(['', '   ', 'Rename foo', '', 'Invest one-shot: irreversible, no oracle, costly'], { tier: 'auto' });
    n = rows.length;
    if (rows.some((r) => !STRATS.has(r.r.strategy) || !ACTIONS.has(r.r.model_action))) crash++;
  } catch (e) { crash++; console.log('   [batch crash] ' + e.message); }
  check('batch planTasks handles blanks/malformed lines (skips blanks, valid rows)', crash === 0 && n >= 2, `rows=${n} issues=${crash}`);
}

console.log(failures === 0 ? 'FUZZ TEST PASS: whole pipeline is input-robust (no crash, valid vocabulary)'
  : `FUZZ TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
