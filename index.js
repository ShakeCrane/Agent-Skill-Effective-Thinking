// Cognitive Agent Skill — public library API.
// One importable entry point for other agents/systems:
//
//   const { route, extract, ... } = require('./');
//
// Exposes the complete pipeline as stable functions: signal extraction -> routing -> capability
// model/calibration -> execution protocol -> stopping conditions -> certainty -> verification plan
// (external-test-first ladder, self-review last) -> adaptive loop -> multi-agent orchestration ->
// cost. (CLI remains `npm run route`.)
'use strict';

module.exports = {
  // routing
  route: require('./router/task-router.js').route,
  extract: require('./router/extract.js').extract,
  // LLM-filled profile adapter (objective's agent-self signal-extraction reliability path)
  fillProfile: require('./router/llm-profile.js').fillProfile,
  fillProfileSync: require('./router/llm-profile.js').fillProfileSync,
  // capability + calibration (measured model capability)
  capabilities: require('./router/capabilities.js'),
  calibrate: require('./router/calibrate.js'),
  // adaptive execution loop (failure feedback -> re-route)
  adaptiveLoop: require('./router/adaptive-loop.js').adaptiveLoop,
  runTask: require('./router/adaptive-loop.js').run,
  runTaskAsync: require('./router/adaptive-loop.js').runAsync,
  // multi-agent orchestration (fan-out / independent review / consolidate)
  fanOut: require('./multi-agent/orchestrate.js').fanOutSync,
  fanOutAsync: require('./multi-agent/orchestrate.js').fanOutAsync,
  review: require('./multi-agent/orchestrate.js').reviewSync,
  reviewAsync: require('./multi-agent/orchestrate.js').reviewAsync,
  consolidate: require('./multi-agent/orchestrate.js').consolidate,
  // execution protocol + stopping conditions + cost
  protocol: require('./strategies/protocol.js'),
  stopping: require('./strategies/stopping.js'),
  cost: require('./strategies/cost.js'),
  certainty: require('./strategies/certainty.js'),
  // verification planner (reflection-is-not-evidence ladder; self-review last)
  verificationPlan: require('./strategies/verify.js').verificationPlan,
  VERIFY_LADDER: require('./strategies/verify.js').LADDER,
};
