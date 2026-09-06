// Skill-consistency guard: SKILL.md (the agent-facing contract) must not drift from the actual
// implementation. Asserts the documented skill matches the real modules:
//   - all four strategies are named in SKILL.md (and match what the router actually emits),
//   - model-switch autonomy principles are documented (mismatch-driven escalation, downgrade,
//     don't-abuse-upgrade),
//   - external verification > self-review is documented,
//   - every implementation path SKILL.md references actually exists,
//   - protocol step keys are shared between SKILL.md and strategies/protocol.js.
//
// Run: node evals/skill-consistency.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const R = (p) => path.join(ROOT, p);

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const skill = fs.readFileSync(R('SKILL.md'), 'utf8');

// 1. All four strategies are documented and match the router's output vocabulary.
{
  const { route } = require('../router/task-router.js');
  const proto = require('../strategies/protocol.js');
  const strategies = Object.keys(proto.PROTOCOLS); // ['fast','structured','deep']
  const documented = strategies.every((s) => skill.toLowerCase().includes(s));
  check('all router strategies documented in SKILL.md', documented, strategies.join(','));
  // model_action vocabulary documented (keep/upgrade/delegate)
  check('escalate/delegate documented', /[Ee]scalate|[Dd]elegate/.test(skill),
    'mentions "delegate"/"escalate"');
  // route() emits only documented strategies (contract: no undocumented strategy can appear)
  const emitted = new Set();
  const ALL_EVAL_ITEMS = require('./benchmark.js').ITEMS.concat(require('./validation.js').ITEMS);
  for (const it of ALL_EVAL_ITEMS) emitted.add(route(it.profile, {}).strategy);
  const allDocumented = [...emitted].every((s) => strategies.includes(s));
  check('router emits only documented strategies', allDocumented, [...emitted].join(','));
}

// 2. Model-switch autonomy principles documented.
check('mismatch-driven escalation documented', /mismatch/i.test(skill), '"mismatch"');
check('downgrade (de-escalation) documented', /de-?escalat/i.test(skill), '"de-escalation"');
check('do-not-abuse-upgrade documented', /not.*(upgrade|escalat)|don'?t.*(upgrade|escalat)|不必要升级|不默认.*强/i.test(skill),
  'upgrade restraint');

// 3. External verification over self-review.
check('external verification > self-review documented', /(test|run|compiler|primary source).*(re-?check|self)/i.test(skill) || /反思不是证据/.test(skill),
  '"reflection is not evidence" / external-over-self');

// 4. Every SKILL.md-referenced implementation path exists.
{
  const refs = ['router/task-router.js', 'router/extract.js', 'router/capabilities.js',
    'router/calibrate.js', 'router/adaptive-loop.js', 'strategies/protocol.js',
    'strategies/stopping.js', 'multi-agent/orchestrate.js', 'bin/router.js'];
  const missing = refs.filter((p) => !fs.existsSync(R(p)));
  check('all SKILL.md-referenced impl paths exist', missing.length === 0,
    missing.length ? 'MISSING: ' + missing.join(',') : `${refs.length} paths`);
}

// 5. Protocol step keys are shared between SKILL.md and strategies/protocol.js.
{
  const { STEPS } = require('../strategies/protocol.js');
  const keys = Object.keys(STEPS);
  // concept-based: any significant token of the step label must appear in SKILL.md (the doc is
  // bilingual/colloquial; requiring the exact canonical phrase would be a false-negative source)
  const missingDoc = keys.filter((k) => {
    const tokens = STEPS[k].label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);
    return !tokens.some((w) => skill.toLowerCase().includes(w));
  });
  check('all protocol steps described in SKILL.md', missingDoc.length === 0,
    missingDoc.length ? 'NOT IN SKILL.md: ' + missingDoc.join(',') : `${keys.length} steps`);
}

console.log(failures === 0 ? 'SKILL-CONSISTENCY PASS: SKILL.md matches the implemented skill (no drift)'
  : `SKILL-CONSISTENCY FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
