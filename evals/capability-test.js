// Capability-based escalation test: escalation must fire only on a REAL task-vs-model capability
// mismatch ("当前模型能力与任务要求之间存在实际不匹配"), never on length/jargon/novelty alone.
//
// Run: node evals/capability-test.js
'use strict';
const { route } = require('../router/task-router.js');
const { taskRequirements, capabilitiesOf, capabilityMismatch } = require('../router/capabilities.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// ---- task requirements derive correctly ----
{
  const req = taskRequirements({ reasoning_complexity: 0.8, novelty: 0.7, constraint_conflict: 0.6, constraint_count: 5, context_size: 'large', error_cost: 0.9, verification_difficulty: 0.85, one_shot: true });
  check('high-stress task requires high capability', req.reasoning > 0.8 && req.context >= 0.9 && req.reliability >= 0.9,
    `r=${req.reasoning.toFixed(2)} c=${req.context} rel=${req.reliability.toFixed(2)}`);
  const easy = taskRequirements({ reasoning_complexity: 0.1, context_size: 'small', error_cost: 0.1, verification_difficulty: 0.1 });
  check('trivial task requires low capability', easy.reasoning < 0.3 && easy.context <= 0.3 && easy.reliability < 0.3,
    `r=${easy.reasoning.toFixed(2)} c=${easy.context} rel=${easy.reliability.toFixed(2)}`);
}

// ---- tier profiles exist ----
{
  check('tiers strong/mid/cheap defined', !!capabilitiesOf('strong') && !!capabilitiesOf('mid') && !!capabilitiesOf('cheap'));
  check('strong > cheap on all axes',
    capabilitiesOf('strong').reasoning > capabilitiesOf('cheap').reasoning &&
    capabilitiesOf('strong').context > capabilitiesOf('cheap').context &&
    capabilitiesOf('strong').reliability > capabilitiesOf('cheap').reliability);
}

// ---- escalation fires on real capability mismatch (zero failures) ----
{
  // Hard causal/architecture task on a WEAK model: reasoning requirement (0.8+) >> cheap reasoning (0.35) → upgrade.
  const hard = { clarity: 0.6, hidden_constraint: 0.6, constraint_count: 4, constraint_conflict: 0.6, reasoning_complexity: 0.8, novelty: 0.6, error_cost: 0.5, reversibility: 0.4, verification_difficulty: 0.75, tool_dependency: false, context_size: 'large', parallelism: false, failures_so_far: 0 };
  const r = route(hard, { model_capabilities: capabilitiesOf('cheap') });
  check('hard task + cheap model -> upgrade (real mismatch, 0 failures)', r.model_action === 'upgrade',
    `model=${r.model_action} reason=${r.reasons.find((x) => /capability mismatch/.test(x)) || 'none'}`);
}

// ---- NO escalation on a weak model for an EASY task ----
{
  const easy = { clarity: 0.9, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0, reasoning_complexity: 0.1, novelty: 0.1, error_cost: 0.1, reversibility: 0.9, verification_difficulty: 0.1, tool_dependency: false, context_size: 'small', parallelism: false, failures_so_far: 0 };
  const r = route(easy, { model_capabilities: capabilitiesOf('cheap') });
  check('easy task + weak model -> NO upgrade (no mismatch)', r.model_action === 'keep', `model=${r.model_action}`);
}

// ---- NO escalation on a hard task for a STRONG model ----
{
  const hard = { clarity: 0.6, hidden_constraint: 0.6, constraint_count: 4, constraint_conflict: 0.6, reasoning_complexity: 0.8, novelty: 0.6, error_cost: 0.5, reversibility: 0.4, verification_difficulty: 0.75, tool_dependency: false, context_size: 'large', parallelism: false, failures_so_far: 0 };
  const r = route(hard, { model_capabilities: capabilitiesOf('strong') });
  check('hard task + strong model -> NO upgrade (capable)', r.model_action === 'keep', `model=${r.model_action}`);
}

// ---- no /mid tiers saturate ----
{
  const hard = { clarity: 0.6, hidden_constraint: 0.6, constraint_count: 4, constraint_conflict: 0.6, reasoning_complexity: 0.85, novelty: 0.7, error_cost: 0.6, reversibility: 0.3, verification_difficulty: 0.85, tool_dependency: false, context_size: 'large', parallelism: false, failures_so_far: 0 };
  const mid = route(hard, { model_capabilities: capabilitiesOf('mid') });
  check('hard task + mid model -> upgrade (reliability/context shortfall)', mid.model_action === 'upgrade',
    `model=${mid.model_action} reason=${mid.reasons.find((x) => /capability mismatch/.test(x)) || 'none'}`);
  const cm = capabilityMismatch(hard, capabilitiesOf('mid'));
  check('mismatch names the failing axes', cm.mismatch && cm.details.length >= 1,
    `details=${cm.details.join('; ')}`);
}

console.log(failures === 0 ? 'CAPABILITY TEST PASS: escalation is capability-mismatch-driven, not difficulty-driven'
  : `CAPABILITY TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
