// Skill identity for the DeepSeek Harness adapter.
//
// Single source for the model-facing catalog metadata. The canonical instruction BODY lives in the
// repository root `SKILL.md`; this module carries only the routing metadata DSH needs to advertise
// the skill before it is loaded, plus the invocation policy.
//
// Kept dependency-free and side-effect-free so both the Cordis plugin (`./index.mjs`) and the
// construction scripts (`scripts/check-dsh-skill-sync.js`) can read it.

/**
 * Stable kebab-case skill name. This is the identifier the model and user invoke, and the name
 * `ctx.skills` resolves against, so it must not change casually.
 */
export const SKILL_NAME = 'effective-thinking';

/**
 * Routing description shown in the catalog BEFORE the body is loaded. It states when the skill is
 * worth loading and when it is not, and deliberately makes no effectiveness claim: the project's
 * behavioural evaluations have not established a general benefit, so the contract must not promise
 * one (see reports/phase-2-v2-pilot.md).
 */
export const SKILL_DESCRIPTION =
  'Use for non-trivial tasks that benefit from task judgment, adaptive reasoning effort, ' +
  'verification planning, failure recovery, model/agent routing, or explicit stopping control. ' +
  'Avoid for trivial tasks that can be executed and verified directly.';

/** Optional extra routing guidance for discovery consumers. */
export const SKILL_WHEN_TO_USE =
  'Ambiguous or under-specified requests, high-stakes or hard-to-verify work, repeated-failure ' +
  'debugging, multi-constraint changes, and tasks where the right depth of reasoning or the right ' +
  'verification method is itself the decision.';

/** Invocation policy: reachable by the model and explicit user invocation. */
export const SKILL_INVOCATION = { modelInvocable: true, userInvocable: true };

/**
 * Catalog precedence rank. Lower ranks win duplicate skill names. 550 matches the third-party
 * packaged-provider convention (below `BUNDLED_SKILL_RANK` = 600 for in-box roots); this skill's
 * name is unique, so the rank only decides hypothetical conflicts.
 */
export const PACKAGED_SKILL_RANK = 550;

/** Origin bucket advertised in prompt-visible metadata. */
export const SKILL_SOURCE = 'custom';

/** Cordis plugin name for this adapter. */
export const PLUGIN_NAME = 'effective-thinking-dsh';
