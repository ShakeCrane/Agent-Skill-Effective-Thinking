// Adversarial probe: hunt for router failures / boundary fragility.
// Run: node evals/probe.js
'use strict';
const { route } = require('../router/task-router.js');

// Each probe: description + profile + a "sane" expected strategy.
// The comment on each describes why this is a hard / adversarial case.
const PROBES = [
  {
    id: 'many-constraints-but-trivial',
    note: '3 constraints but mechanical, easily verified, reversible, low risk. Overthinking risk: should be FAST.',
    profile: {
      clarity: 0.9, hidden_constraint: 0.1, constraint_count: 3, constraint_conflict: 0.1,
      reasoning_complexity: 0.2, novelty: 0.1, error_cost: 0.1, reversibility: 0.95,
      verification_difficulty: 0.1, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    sane: 'fast',
  },
  {
    id: 'high-stakes-trivial-verify',
    note: 'High error cost but trivially verifiable & reversible. v1 wrongly went DEEP (overthinking). v2 should NOT over-deliberate: high stakes need verification, not deep deliberation. Structured (light plan + explicit verify) is the defensible answer.',
    profile: {
      clarity: 0.9, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.2, novelty: 0.1, error_cost: 0.85, reversibility: 0.9,
      verification_difficulty: 0.1, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    sane: 'structured',
  },
  {
    id: 'parallel-mechanical-batch',
    note: '100 identical mechanical file transforms. Parallelism=true but NOT research; should NOT delegate to stronger/swarm. Just fast/structured.',
    profile: {
      clarity: 0.9, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.1, novelty: 0.1, error_cost: 0.1, reversibility: 0.95,
      verification_difficulty: 0.1, tool_dependency: false, context_size: 'small',
      parallelism: true, failures_so_far: 0,
    },
    sane: 'fast', // model_action should be keep (not delegate)
  },
  {
    id: 'medium-everything',
    note: 'All signals mid=0.5, few constraints. Should be structured (middle).',
    profile: {
      clarity: 0.6, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0.3,
      reasoning_complexity: 0.5, novelty: 0.4, error_cost: 0.4, reversibility: 0.5,
      verification_difficulty: 0.4, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    sane: 'structured',
  },
  {
    id: 'one-failure-mechanical',
    note: '1 failure but trivially verifiable mechanical task. Should NOT escalate (failures=1 < 3).',
    profile: {
      clarity: 0.85, hidden_constraint: 0.2, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.2, novelty: 0.2, error_cost: 0.2, reversibility: 0.9,
      verification_difficulty: 0.1, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 1,
    },
    sane: 'fast',
  },
  {
    id: 'complex-but-easy-verify',
    note: 'High reasoning complexity but a cheap, exact automated oracle exists. Deep anyway? (proto: yes -> deep)',
    profile: {
      clarity: 0.7, hidden_constraint: 0.3, constraint_count: 2, constraint_conflict: 0.2,
      reasoning_complexity: 0.8, novelty: 0.6, error_cost: 0.4, reversibility: 0.9,
      verification_difficulty: 0.2, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    sane: 'deep', // reasoning_complexity high wins even if verifiable
  },
];

let failures = 0;
for (const p of PROBES) {
  const r = route(p.profile, {});
  const mark = r.strategy === p.sane ? 'OK ' : 'MISMATCH ';
  const mm = r.model_action;
  if (r.strategy !== p.sane) failures++;
  console.log(`[${mark}] ${p.id}\n    note: ${p.note}\n    => ${r.strategy} / ${mm}   (sane ${p.sane})\n    reasons: ${r.reasons.join('; ')}\n`);
}
console.log(failures === 0 ? 'PROBE PASS: all adversarial cases route as expected' : `PROBE FAIL: ${failures} mismatches`);

// ---- De-escalation (downgrade) assertions — closes the "模型升级与降级逻辑" minimum deliverable.
const mechanical = {
  clarity: 0.9, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0,
  reasoning_complexity: 0.1, novelty: 0.1, error_cost: 0.1, reversibility: 0.95,
  verification_difficulty: 0.1, tool_dependency: false, context_size: 'small',
  parallelism: false, failures_so_far: 0,
};
const hardTask = {
  clarity: 0.5, hidden_constraint: 0.7, constraint_count: 4, constraint_conflict: 0.6,
  reasoning_complexity: 0.85, novelty: 0.6, error_cost: 0.7, reversibility: 0.3,
  verification_difficulty: 0.8, tool_dependency: false, context_size: 'large',
  parallelism: false, failures_so_far: 0,
};

const deescalateChecks = [
  {
    id: 'deescalate-mechanical-strong',
    note: 'mechanical fast task + STRONG current model → recommend handing DOWN to a cheap model.',
    got: route(mechanical, { current_model_tier: 'strong' }),
    expect: (r) => r.could_deescalate === true && r.recommend_deescalate === true,
  },
  {
    id: 'deescalate-mechanical-cheap',
    note: 'mechanical fast task + CHEAP current model → cannot downgrade (nothing to downgrade from).',
    got: route(mechanical, { current_model_tier: 'cheap' }),
    expect: (r) => r.could_deescalate === true && r.recommend_deescalate === false,
  },
  {
    id: 'no-deescalate-hard',
    note: 'deep task → must NOT be handed to a cheap model.',
    got: route(hardTask, { current_model_tier: 'strong' }),
    expect: (r) => r.could_deescalate === false && r.recommend_deescalate === false,
  },
  {
    id: 'deescalate-default-auto',
    note: 'default tier auto → no de-escalation recommendation (conservative).',
    got: route(mechanical, {}),
    expect: (r) => r.could_deescalate === true && r.recommend_deescalate === false,
  },
];

let dFail = 0;
for (const c of deescalateChecks) {
  const ok = c.expect(c.got);
  if (!ok) dFail++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] deescalate: ${c.id}\n    note: ${c.note}\n    => could_deescalate=${c.got.could_deescalate} recommend_deescalate=${c.got.recommend_deescalate}\n`);
}
console.log(dFail === 0 ? 'DEESCLATE PASS: upgrade/downgrade logic consistent' : `DEESCLATE FAIL: ${dFail}`);
process.exit((failures === 0 && dFail === 0) ? 0 : 1);
