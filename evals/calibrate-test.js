// Capability-calibration test: a model's capability profile is MEASURED from probe results, then
// drives escalation. Works with deterministic mocked probes (env-agnostic; real models plug in
// via runProbe).
//
// Run: node evals/calibrate-test.js
'use strict';
const { calibrate, PROBES } = require('../router/calibrate.js');
const { route } = require('../router/task-router.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// ---- a model that passes ~everything measures HIGH -> strong tier ----
{
  const c = calibrate({ runProbe: () => ({ ok: true }) });
  check('top model measures high on all axes',
    c.capacity.reasoning >= 0.9 && c.capacity.context >= 0.9 && c.capacity.reliability >= 0.9,
    `r=${c.capacity.reasoning.toFixed(2)} ctx=${c.capacity.context.toFixed(2)} rel=${c.capacity.reliability.toFixed(2)}`);
  check('top model assigned strong (or nearest-strong) tier', c.tier === 'strong' || c.tier === 'mid',
    `tier=${c.tier}`);
}

// ---- a model that fails almost everything measures LOW -> cheap tier ----
{
  const c = calibrate({ runProbe: () => ({ ok: false }) });
  check('weak model measures low on all axes',
    c.capacity.reasoning <= 0.15 && c.capacity.context <= 0.15 && c.capacity.reliability <= 0.15,
    `r=${c.capacity.reasoning.toFixed(2)} ctx=${c.capacity.context.toFixed(2)} rel=${c.capacity.reliability.toFixed(2)}`);
  check('weak model assigned cheap tier', c.tier === 'cheap',
    `tier=${c.tier}`);
}

// ---- measured low capacity drives escalation; measured high capacity does not ----
{
  const hard = { clarity: 0.6, hidden_constraint: 0.6, constraint_count: 4, constraint_conflict: 0.6, reasoning_complexity: 0.8, novelty: 0.6, error_cost: 0.5, reversibility: 0.4, verification_difficulty: 0.75, tool_dependency: false, context_size: 'large', parallelism: false, failures_so_far: 0 };

  const weakMeasured = calibrate({ runProbe: () => ({ ok: false }) });
  const upgrade = route(hard, { model_capabilities: weakMeasured.capacity });
  check('measured-weak model -> upgrade on hard task', upgrade.model_action === 'upgrade',
    `model=${upgrade.model_action} tier=${weakMeasured.tier}`);

  const strongMeasured = calibrate({ runProbe: () => ({ ok: true }) });
  const keep = route(hard, { model_capabilities: strongMeasured.capacity });
  check('measured-strong model -> keep on hard task', keep.model_action !== 'upgrade',
    `model=${keep.model_action} tier=${strongMeasured.tier}`);
}

// ---- probe results are recorded (auditability) ----
{
  const c = calibrate({ runProbe: (p) => ({ ok: p.id.startsWith('r') }) }); // passes only reasoning
  check('per-probe results recorded', c.results.length === PROBES.length && c.results.some((r) => r.ok),
    `results=${c.results.length} passed=${c.results.filter((r) => r.ok).length}`);
  check('axis rates reflect only-reasoning passing',
    c.capacity.reasoning > 0.9 && c.capacity.context === 0 && c.capacity.reliability === 0,
    `r=${c.capacity.reasoning.toFixed(2)} ctx=${c.capacity.context} rel=${c.capacity.reliability}`);
}

console.log(failures === 0 ? 'CALIBRATE TEST PASS: model capability is measured from probes and drives escalation'
  : `CALIBRATE TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
