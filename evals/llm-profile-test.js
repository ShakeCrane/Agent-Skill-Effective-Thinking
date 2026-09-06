// LLM-profile adapter test: the agent-self signal-extraction path (objective's "LLM fills profile
// vs keyword baseline"). Verifies sanitization, keyword fallback for missing/invalid fields,
// count/enum/boolean integrity, degradation on a failing model, and end-to-end routing through an
// LLM-filled profile vs the keyword extractor.
//
// Run: node evals/llm-profile-test.js
'use strict';
const { fillProfile, fillProfileSync, sanitize } = require('../router/llm-profile.js');
const { route } = require('../router/task-router.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// 1. sanitize clamps numeric fields to [0,1] and keeps integers for counts.
{
  const s = sanitize(
    { clarity: 5, constraint_count: 3, failures_so_far: 4, error_cost: -2, context_size: 'large', one_shot: true, tool_dependency: 'true' },
    { clarity: 0.5, constraint_count: 0, failures_so_far: 0, error_cost: 0.1, context_size: 'small', one_shot: false, tool_dependency: false }
  );
  check('clamp high -> 1', s.clarity === 1, `clarity=${s.clarity}`);
  check('clamp negative -> 0', s.error_cost === 0, `error_cost=${s.error_cost}`);
  check('count kept as integer', s.constraint_count === 3 && s.failures_so_far === 4,
    `cc=${s.constraint_count} f=${s.failures_so_far}`);
  check('enum coerced', s.context_size === 'large', `ctx=${s.context_size}`);
  check('booleans coerced', s.one_shot === true && s.tool_dependency === true, `one=${s.one_shot} tool=${s.tool_dependency}`);
}

// 2. missing fields fall back to the keyword extractor (still a complete valid profile)
{
  const kw = { clarity: 0.4, constraint_count: 0, failures_so_far: 1, error_cost: 0.2, context_size: 'small' };
  const s = sanitize({ clarity: 0.9 }, kw);
  check('filled field kept, missing fields from keyword fallback',
    s.clarity === 0.9 && s.constraint_count === kw.constraint_count && s.context_size === 'small',
    `clarity=${s.clarity} cc=${s.constraint_count}`);
}

// 3. sync fillProfileSync end-to-end: a real model-ish askLLM returns a full profile; route() on it
//    behaves sensibly (LLM says "hard tricky debug" -> deep).
{
  const task = 'Explain why our E2E tests intermittently time out in CI but pass locally.';
  const p = fillProfileSync(task, { askLLM: (t) => ({
    clarity: 0.5, hidden_constraint: 0.8, constraint_count: 2, constraint_conflict: 0.4,
    reasoning_complexity: 0.85, novelty: 0.6, error_cost: 0.5, reversibility: 0.4,
    verification_difficulty: 0.85, tool_dependency: false, context_size: 'small',
    parallelism: false, failures_so_far: 1,
  }) });
  const r = route(p, {});
  check('LLM-filled profile routes deep for a hard debugging task', r.strategy === 'deep',
    `strategy=${r.strategy} reasons=${r.reasons.join('; ')}`);
}

// 4. async fillProfile handles a Promise-returning askLLM (real agent path)
;(async () => {
  const task = 'Convert this markdown file to HTML.';
  const p = await fillProfile(task, {
    askLLM: async () => ({ clarity: 0.95, verification_difficulty: 0.05, reasoning_complexity: 0.05 }),
  });
  const r = route(p, {});
  check('async LLM profile routes fast for a mechanical convert', r.strategy === 'fast',
    `strategy=${r.strategy}`);

  // 5. a THROWING askLLM degrades to the keyword path (no crash, still a valid profile)
  const p2 = await fillProfile('Rewrite this regex to also match quoted strings.', {
    askLLM: async () => { throw new Error('model unavailable'); },
  });
  check('throwing model degrades to keyword extraction (no crash)', typeof p2.clarity === 'number'
    && Number.isFinite(p2.verification_difficulty), `clarity=${p2.clarity}`);

  console.log(failures === 0 ? 'LLM-PROFILE TEST PASS: agent-self signal extraction works, sanitizes, and degrades safely'
    : `LLM-PROFILE TEST FAIL: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
