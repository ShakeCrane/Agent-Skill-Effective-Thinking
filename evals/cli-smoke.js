// CLI smoke regression: asserts the END-TO-END text -> decision path (bin/router.js decide()).
// This covers exactly what the profile-based evals do not: the raw-task-text layer through
// extract -> route. Uses task texts from the eval sets whose expected outcome is unambiguous.
//
// Run: node evals/cli-smoke.js
'use strict';
const { decide } = require('../bin/router.js');

const CASES = [
  {
    task: 'Rename the local variable foo to bar in a 30-line function.',
    expect: { strategy: 'fast', model_action: 'keep' },
  },
  {
    task: 'Design the high-level architecture for a distributed event-processing system.',
    expect: { strategy: 'deep', model_action: 'keep' },
  },
  {
    task: 'This data pipeline has failed 5 times in a row with a cryptic error; make it stop failing.',
    expect: { strategy: 'deep', model_action: 'upgrade' },
  },
  {
    task: 'Convert this markdown file to HTML.',
    expect: { strategy: 'fast', model_action: 'keep' },
  },
  {
    task: 'Migrate this monolith to microservices: assess trade-offs and propose a phased plan.',
    expect: { strategy: 'deep', model_action: 'keep' },
  },
  {
    task: 'Summarize the key claims of these 3 long papers, each independently, then I will combine them.',
    expect: { strategy: 'structured', model_action: 'delegate' },
  },
  {
    task: 'Brainstorm 20 marketing taglines for a new coffee brand.',
    expect: { strategy: 'fast', model_action: 'keep' },
  },
];

let failures = 0;
for (const c of CASES) {
  const { r } = decide(c.task, { tier: 'auto' });
  const ok = r.strategy === c.expect.strategy && r.model_action === c.expect.model_action;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${c.task.slice(0, 60)}...\n    => ${r.strategy}/${r.model_action}  (expect ${c.expect.strategy}/${c.expect.model_action})`);
}
console.log(failures === 0 ? 'CLI SMOKE PASS: end-to-end text->decision path stable' : `CLI SMOKE FAIL: ${failures}`);

// ---- --profile-json injection (LLM-filled / partial profile through the same entry point) ----
{
  // one_shot + parallel -> must UPGRADE, not delegate (F-6b), via injected profile
  const a = decide('The board must choose ONE final acquisition target now', {
    tier: 'auto',
    profileJson: JSON.stringify({ one_shot: true, error_cost: 0.95, verification_difficulty: 0.9, reversibility: 0.05, parallelism: true }),
  });
  const okA = a.r.model_action === 'upgrade' && a.source === 'injected+keyword';
  if (!okA) failures++;
  console.log(`[${okA ? 'OK ' : 'FAIL'}] --profile-json injects one-shot+parallel -> ${a.r.model_action} (source=${a.source})`);

  // malformed JSON degrades to keyword extraction (no crash, honest source label)
  const b = decide('Migrate this monolith to microservices', { tier: 'auto', profileJson: '{bad json' });
  const okB = b.source === 'keyword' && b.r.strategy === 'deep' && b.r.model_action === 'keep';
  if (!okB) failures++;
  console.log(`[${okB ? 'OK ' : 'FAIL'}] malformed --profile-json degrades to keyword -> ${b.r.strategy}/${b.r.model_action} (source=${b.source})`);
}

console.log(failures === 0 ? 'CLI SMOKE PASS (incl. --profile-json): end-to-end text->decision path stable' : `CLI SMOKE FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
