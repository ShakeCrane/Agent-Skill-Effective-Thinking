// Failure-mode COVERAGE AUDIT.
// Operationalizes the objective's "重点观察" list (the failure modes a cognitive skill must not
// exhibit) as an auditable checklist wired to the actual eval sets. Two checks per mode:
//   A) EXERCISED — does the combined eval set contain at least one case designed to catch this
//      failure mode?
//   B) NO-REGRESSION — does the current router pass every such case (so it does not currently
//      exhibit the mode)?
//
// Run: node evals/coverage.js
'use strict';
const { route } = require('../router/task-router.js');
const { ITEMS: TRAIN } = require('./benchmark.js');
const { ITEMS: VAL } = require('./validation.js');

const ALL = TRAIN.concat(VAL);

// --- Id substring lists (case ids that target each failure mode) ---
const IDS = {
  overthinking: ['many-trivial-constraints', 'high-stakes-trivial-verify', 'novel-mechanical-boilerplate', 'simple-rename', 'md-to-html', 'mass-header-replace'],
  underthinking: ['architecture', 'vague', 'microservice', 'security-review', 'flaky-ci', 'investment', 'contract-clause'],
  premature_execution: ['regex-rewrite', 'simple-bugfix', 'seemingly-simple-hidden', 'multi-constraint'],
  unnecessary_upgrade: ['not-upgrade-mechanical', 'high-risk-financial', 'rename', 'taglines', 'trivial'],
  late_upgrade: ['should-upgrade-after-failures', 'investment', 'pipeline-failed-5x', 'contract-clause'],
  constraint_omission: ['seemingly-simple-hidden', 'regex-rewrite', 'multi-constraint'],
  unnecessary_delegate: ['parallel-mechanical', 'currency', 'not-upgrade-mechanical'],
  missed_delegate: ['delegate-parallel', 'parallel-paper'],
};

function hasAny(id, keys) { return keys.some((k) => id.includes(k)); }

const MODES = [
  {
    id: 'difficulty-misjudgment', desc: '难度误判: any strategy mismatch on the eval sets',
    match: () => true,
    isExhibited: (c, got) => got.strategy !== c.expected.strategy,
  },
  {
    id: 'overthinking', desc: '过度思考: trivial/cheap task forced to deep',
    match: (c) => hasAny(c.id, IDS.overthinking),
    isExhibited: (c, got) => got.strategy !== c.expected.strategy,
  },
  {
    id: 'underthinking', desc: '思考不足: hard task kept too shallow',
    match: (c) => hasAny(c.id, IDS.underthinking),
    isExhibited: (c, got) => got.strategy !== c.expected.strategy,
  },
  {
    id: 'premature-execution', desc: '过早执行: constrained/non-trivial task marked fast',
    match: (c) => hasAny(c.id, IDS.premature_execution),
    isExhibited: (c, got) => got.strategy === 'fast' && c.expected.strategy !== 'fast',
  },
  {
    id: 'unnecessary-upgrade', desc: '不必要升级: upgrade on a task that needs none',
    match: (c) => hasAny(c.id, IDS.unnecessary_upgrade),
    isExhibited: (c, got) => got.model_action === 'upgrade' && c.expected.model_action !== 'upgrade',
  },
  {
    id: 'late-upgrade', desc: '升级过晚: should upgrade but does not',
    match: (c) => hasAny(c.id, IDS.late_upgrade),
    isExhibited: (c, got) => got.model_action !== 'upgrade' && c.expected.model_action === 'upgrade',
  },
  {
    id: 'constraint-omission', desc: '约束遗漏: hidden-constraint task misread as simple',
    match: (c) => hasAny(c.id, IDS.constraint_omission),
    isExhibited: (c, got) => got.strategy !== c.expected.strategy,
  },
  {
    id: 'unnecessary-delegate', desc: '工具调用浪费/误派发: delegated when not parallel research',
    match: (c) => hasAny(c.id, IDS.unnecessary_delegate),
    isExhibited: (c, got) => got.model_action === 'delegate' && c.expected.model_action !== 'delegate',
  },
  {
    id: 'missed-delegate', desc: '漏派发: clear parallel research not delegated',
    match: (c) => hasAny(c.id, IDS.missed_delegate),
    isExhibited: (c, got) => got.model_action !== 'delegate' && c.expected.model_action === 'delegate',
  },
];

function main() {
  const lines = ['== FAILURE-MODE COVERAGE AUDIT =='];
  let allPass = true;
  for (const m of MODES) {
    const targets = ALL.filter(m.match);
    const exercised = targets.length > 0;
    const exhibited = targets.filter((c) => m.isExhibited(c, route(c.profile, {})));
    const noRegression = exhibited.length === 0;
    const ok = exercised && noRegression;
    if (!ok) allPass = false;
    const exhibitStr = exhibited.length ? ` EXHIBITED: ${exhibited.map((x) => x.id).join(',')}` : '';
    lines.push(`[${ok ? 'OK ' : 'FAIL'}] ${m.id}: exercised=${exercised} (${targets.length} case(s)) noRegression=${noRegression}${exhibitStr || ''}`);
    lines.push(`      ${m.desc}`);
  }
  lines.push(allPass ? 'COVERAGE PASS: all failure modes exercised and free of regressions' : 'COVERAGE FAIL: see above');
  console.log(lines.join('\n'));
  process.exit(allPass ? 0 : 1);
}

module.exports = { MODES, main };

if (require.main === module) main();
