// Verification planner: turns a routing decision into a concrete VERIFICATION PLAN, following the
// objective's 反思原则 priority ladder:
//   1 actual run / automated test  2 compiler/runtime  3 primary/authoritative source
//   4 independent computation      5 multi-source       6 independent reviewer
//   7 self review (LAST — reflection is NOT evidence)
//
// The higher the verification_difficulty / error-cost / one-shot risk, the further up the ladder
// the plan must go — and self-review is never the primary, only ever a final sanity pass.
// Deliberately deterministic and small; does not actually run anything (that is the executor's job).

'use strict';

const LADDER = [
  { key: 'external-test', label: 'Actual run / automated test' },
  { key: 'compiler-runtime', label: 'Compiler / runtime check' },
  { key: 'authoritative-source', label: 'Primary / authoritative source' },
  { key: 'independent-computation', label: 'Independent computation' },
  { key: 'multi-source', label: 'Multi-source cross-check' },
  { key: 'independent-reviewer', label: 'Independent reviewer / adversarial test' },
  { key: 'self-review', label: 'Self-review (last — reflection is not evidence)' },
];

const BY_KEY = Object.fromEntries(LADDER.map((m) => [m.key, m]));

// depth needed as verification difficulty grows
function ladderDepth(v) {
  if (v <= 0.3) return 1;              // trivially verifiable -> automated test suffices
  if (v <= 0.5) return 3;              // moderate -> compiler + authoritative source
  if (v <= 0.7) return 5;              // hard -> independent computation + multi-source
  return 6;                            // very hard -> independent reviewer / adversarial
}

/**
 * verificationPlan(strategy, profile) -> { primary, methods: [{key,label}], note }
 * NOTE (V8): `strategy` is accepted for signature stability but is NOT read — the plan is driven
 * entirely by the profile's verification_difficulty / error_cost / one_shot (verification depth is
 * a property of the RESULT, not of the deliberation strategy). This independence is deliberate and
 * test-locked (verify-test).

 * Self-review is never primary; note↔primary are always consistent.
 */
function verificationPlan(strategy, profile = {}) {
  const v = clamp01(profile.verification_difficulty);
  const errCost = clamp01(profile.error_cost);
  const oneShot = profile.one_shot === true;

  let take = ladderDepth(v);

  // High-risk / one-shot judgment: verification cannot be cheap; escalate to independent review.
  if (errCost >= 0.7 || oneShot) take = Math.max(take, 6);

  const keysInOrder = LADDER.slice(0, take).map((m) => m.key);
  // self-review is only ever the LAST method and grades as a sanity pass, never the primary.
  // Ensure the final plans always end with 'self-review' (reflection-as-check, not as evidence).
  if (!keysInOrder.includes('self-review')) keysInOrder.push('self-review');

  const methods = keysInOrder.map((k) => BY_KEY[k]);
  const primary = methods[0];
  // NOTE↔PRIMARY consistency (Verifier finding V1): for one-shot/no-oracle the note must not
  // promise "lead with independent review" while `primary` is external-test. Phrase the note so it
  // always agrees with what `primary` actually says: run the test FIRST if one exists, and only for
  // one_shot/no-oracle tasks explicitly call out independent review as the escalation path.
  const note = oneShot
    ? 'One-shot / no oracle: if an automated check exists, run it first (that is the primary method); otherwise there is NO cheap check — escalate to independent review / adversarial test. Self-review only as a final sanity pass.'
    : v > 0.7
      ? 'Hard to verify: combine independent computation / cross-check / reviewer; do not rely on self-review alone.'
      : 'Cheaply verifiable: prefer an actual run / automated test over any amount of self-inspection.';
  return { primary, methods, note };
}

function clamp01(n) { const x = Number(n); return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0; }

module.exports = { verificationPlan, LADDER };
