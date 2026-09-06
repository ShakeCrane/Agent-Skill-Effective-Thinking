// Execution-strategy protocols.
// Turns a router decision (fast | structured | deep) into a concrete execution protocol the
// agent follows — a machine-checkable encoding of the objective's per-strategy definitions.
// - fast     : minimal planning, direct execute, cheap verify. NO heavy structure.
// - structured: a light plan — must include Objective / Hard Constraints / Assumptions / Plan /
//               Verification (and keep it brief).
// - deep     : full deliberation — decomposition, alternatives, counterexample search, strongest
//               objection, assumption checks, external evidence, independent review, adversarial
//               tests, real verification (use as needed, not all mechanically).
//
// The protocol is deliberate: which steps are REQUIRED vs OPTIONAL is declared per strategy so a
// test can assert each strategy's intensity, and Fast does not silently inflate.

'use strict';

// Canonical step keys (shared vocabulary).
const STEPS = {
  objective:      { key: 'objective',      label: 'Objective' },
  hardConstraints:{ key: 'hardConstraints', label: 'Hard Constraints' },
  assumptions:    { key: 'assumptions',    label: 'Assumptions' },
  plan:           { key: 'plan',           label: 'Plan' },
  verification:   { key: 'verification',   label: 'Verification' },
  decompose:      { key: 'decompose',      label: 'Task decomposition' },
  alternatives:   { key: 'alternatives',   label: 'Alternative approaches' },
  counterexamples:{ key: 'counterexamples', label: 'Counterexample search' },
  strongestObjection: { key: 'strongestObjection', label: 'Strongest objection' },
  assumptionChecks:   { key: 'assumptionChecks',   label: 'Assumption checks' },
  externalEvidence:   { key: 'externalEvidence',   label: 'External evidence' },
  independentReview:  { key: 'independentReview',  label: 'Independent review (subagent/reviewer)' },
  adversarialTests:   { key: 'adversarialTests',   label: 'Adversarial tests' },
  execBudget:         { key: 'execBudget',         label: 'Execution budget / stop-when-done' },
};

// Protocol per strategy: { required: [stepKey...], optional: [stepKey...], notes }
// REQUIRED = must appear in the agent's working protocol. OPTIONAL = use as needed.
// Fast has NO required heavy steps (objective: avoid meaningless analysis).
const PROTOCOLS = {
  fast: {
    required: [],
    optional: ['verification', 'execBudget'],
    notes: 'Minimal planning; execute directly; one cheap verification. Do NOT manufacture analysis.',
  },
  structured: {
    required: ['objective', 'hardConstraints', 'assumptions', 'plan', 'verification'],
    optional: [],
    notes: 'Light plan before executing — keep it brief.',
  },
  deep: {
    required: ['objective', 'hardConstraints', 'plan', 'verification'],
    optional: ['assumptions', 'decompose', 'alternatives', 'counterexamples', 'strongestObjection',
      'assumptionChecks', 'externalEvidence', 'independentReview', 'adversarialTests', 'execBudget'],
    notes: 'Deliberate as needed: decompose, alternatives, counterexamples, strongest objection, ' +
           'assumption checks, external evidence, independent review, adversarial tests, real verification.',
  },
};

/**
 * protocolFor(strategy) -> { strategy, required: [labels], optional: [labels], notes }
 * Returns the concrete execution protocol for a router strategy.
 */
function protocolFor(strategy) {
  const p = PROTOCOLS[strategy] || PROTOCOLS.structured;
  return {
    strategy,
    required: p.required.map((k) => ({ key: k, label: STEPS[k].label })),
    optional: p.optional.map((k) => ({ key: k, label: STEPS[k].label })),
    notes: p.notes,
  };
}

/**
 * protocolPlan(strategy) -> { objective, hardConstraints, assumptions, plan, verification } skeleton
 * For structured (and deep) strategies, returns the minimum planning block fields the agent must
 * fill before executing. Fast returns { directExecute: true }.
 */
function protocolPlan(strategy) {
  if (strategy === 'fast') return { directExecute: true };
  return {
    objective: '',
    hardConstraints: [],
    assumptions: [],
    plan: [],
    verification: '',
  };
}

module.exports = { STEPS, PROTOCOLS, protocolFor, protocolPlan };
