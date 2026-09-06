// Capability-based escalation model.
// Implements the objective's core escalation principle literally: escalate only when there is a
// real mismatch between the CURRENT MODEL's capability and the TASK's capability requirements
// ("当前模型能力与任务要求之间存在实际不匹配"), never for length/jargon/novelty alone.
//
// A task's requirements are derived from its profile (reasoning depth, context size, reliability
// for one-shot/unverifiable judgment). A model's capabilities are a small profile (reasoning,
// context, reliability). If a requirement exceeds the model's capability by more than a margin,
// the router escalates (upgrade).
//
// Design is small and inspectable, matching the project philosophy.

'use strict';

// Context size → numeric requirement (how much long-range consistency the task needs).
const CONTEXT_REQ = { small: 0.2, mid: 0.5, large: 0.9 };

// Tier → capability profile { reasoning, context, reliability } ∈ [0,1].
const TIER_CAPABILITIES = {
  strong: { reasoning: 0.9, context: 0.9, reliability: 0.9 },
  mid:    { reasoning: 0.6, context: 0.5, reliability: 0.6 },
  cheap:  { reasoning: 0.35, context: 0.3, reliability: 0.35 },
};

// How much capability headroom the model must have over the requirement to be "capable".
const CAPABILITY_MARGIN = 0.1;

function capabilitiesOf(tier) {
  return TIER_CAPABILITIES[tier] || null;
}

/**
 * taskRequirements(profile) -> { reasoning, context, reliability } ∈ [0,1]
 * Derive the task's capability requirements from its profile.
 * - reasoning: reasoning_complexity, boosted by novelty (novel work leans on reasoning),
 *   and by many/conflicting constraints (they interact).
 * - context: from context_size.
 * - reliability: high when the result is risky and/or hard to verify and/or a one-shot judgment —
 *   i.e. the model's output quality is load-bearing and cannot be cheaply corrected.
 */
function taskRequirements(p) {
  // NOTE: novelty deliberately does NOT contribute to the reasoning requirement. Echoing the
  // header claim: capability escalation must never fire "for novelty alone" (Finding F-7 removed a
  // novelty*0.15 term that let novelty tip a borderline reasoning requirement over the mismatch
  // margin). Novelty is handled at the STRATEGY level (deep for novel + non-trivial-verify), not
  // by inflating the model-capability requirement.
  const reasoning = Math.min(1,
    (p.reasoning_complexity || 0) +
    (p.constraint_conflict || 0) * 0.2 +
    Math.min(0.2, (p.constraint_count || 0) * 0.05)
  );
  const context = CONTEXT_REQ[p.context_size || 'small'] || CONTEXT_REQ.small;
  const reliability = Math.min(1, Math.max(
    p.error_cost || 0,
    (p.verification_difficulty || 0) * 0.8,
    p.one_shot === true ? 0.9 : 0
  ));
  return { reasoning, context, reliability };
}

/**
 * capabilityMismatch(profile, capabilities) -> { mismatch: bool, details: string[] }
 * True when the task requires more capability than the model has (by more than CAPABILITY_MARGIN).
 * Returns which axes fell short, for a transparent upgrade reason.
 */
function capabilityMismatch(profile, capabilities) {
  const req = taskRequirements(profile);
  const details = [];
  if (req.reasoning > capabilities.reasoning + CAPABILITY_MARGIN) {
    details.push(`reasoning need ${req.reasoning.toFixed(2)} > model ${capabilities.reasoning.toFixed(2)}`);
  }
  if (req.context > capabilities.context + CAPABILITY_MARGIN) {
    details.push(`context need ${req.context.toFixed(2)} > model ${capabilities.context.toFixed(2)}`);
  }
  if (req.reliability > capabilities.reliability + CAPABILITY_MARGIN) {
    details.push(`reliability need ${req.reliability.toFixed(2)} > model ${capabilities.reliability.toFixed(2)}`);
  }
  return { mismatch: details.length > 0, details };
}

module.exports = { taskRequirements, capabilitiesOf, capabilityMismatch, TIER_CAPABILITIES, CAPABILITY_MARGIN };
