// Protocol test: asserts each strategy's execution protocol matches the objective's definitions.
// This guards protocol intensity — Structured must include the 5 required plan fields, Deep must
// offer the deliberation tools, Fast must NOT require heavy analysis (anti-overthinking at the
// execution-protocol level).
//
// Run: node evals/protocol-test.js
'use strict';
const { protocolFor, protocolPlan, PROTOCOLS } = require('../strategies/protocol.js');

const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

// --- Structured: must require the 5 minimum-plan fields ---
let p = protocolFor('structured');
ok(JSON.stringify(p.required.map((x) => x.key)) === JSON.stringify(['objective', 'hardConstraints', 'assumptions', 'plan', 'verification']),
  'structured must require Objective/Hard Constraints/Assumptions/Plan/Verification');
// structured plan skeleton must expose all 5 fields
let plan = protocolPlan('structured');
ok('objective' in plan && 'hardConstraints' in plan && 'assumptions' in plan && 'plan' in plan && 'verification' in plan,
  'structured plan skeleton must expose the 5 fields');

// --- Fast: must NOT require heavy analysis, and plan is directExecute ---
p = protocolFor('fast');
ok(p.required.length === 0, 'fast must require no heavy structure (anti-overthinking)');
ok(Array.isArray(p.optional) && p.optional.length > 0, 'fast may still mention lightweight optional verification');
plan = protocolPlan('fast');
ok(plan.directExecute === true, 'fast plan must be directExecute');

// --- Deep: must include the core required block AND offer deliberation tools ---
p = protocolFor('deep');
const requiredKeys = p.required.map((x) => x.key);
ok(requiredKeys.includes('objective') && requiredKeys.includes('hardConstraints') && requiredKeys.includes('plan') && requiredKeys.includes('verification'),
  'deep must require the core plan block');
const optionalKeys = p.optional.map((x) => x.key);
for (const k of ['decompose', 'alternatives', 'counterexamples', 'strongestObjection', 'assumptionChecks', 'externalEvidence', 'independentReview', 'adversarialTests']) {
  ok(optionalKeys.includes(k), `deep must offer deliberation tool '${k}'`);
}

// --- Intensity ordering: deep must be strictly heavier than structured, structured than fast ---
// Weight = total protocol breadth (required + optional): Deep offers the full deliberation
// toolkit (13 surface) vs Structured's fixed light plan (5) vs Fast (2 lean).
function weight(s) {
  return PROTOCOLS[s].required.length + PROTOCOLS[s].optional.length;
}
ok(weight('deep') > weight('structured'), 'deep protocol must be heavier than structured');
ok(weight('structured') > weight('fast'), 'structured protocol must be heavier than fast');

console.log('PROTOCOL TEST PASS: strategy execution protocols match the objective definitions, with correct intensity ordering.');
process.exit(0);
