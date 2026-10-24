// Mechanical tests for router/model-assign.js — intensity -> tier mapping, reasons, cost share.
// Deterministic, no network, no LLM. Run: node evals/dispatch-assign-test.js
'use strict';
const assert = require('assert');
const { assignModels, normalizeCatalog } = require('../router/model-assign.js');

let failures = 0;
const check = (name, cond, detail) => {
  if (!cond) failures++;
  console.log(`[${cond ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const CATALOG = {
  tiers: [
    { id: 'free', models: ['beam:free'], cost: 0 },
    { id: 'mid', models: ['glm-5.3-flash'], cost: 1 },
    { id: 'strong', models: ['deepseek-v4.1-flash'], cost: 4 },
  ],
  default: 'mid',
};

// 1. fast mechanical -> cheapest tier
{
  const { assignments, summary } = assignModels(
    [{ id: 'a', profile: { clarity: 0.95, reasoning_complexity: 0.1, error_cost: 0.05, reversibility: 0.95, verification_difficulty: 0.1, hidden_constraint: 0.05 } }],
    CATALOG,
  );
  check('fast mechanical -> free tier', assignments[0].tier === 'free', assignments[0].tier);
  check('fast assignment names a concrete model', assignments[0].model === 'beam:free', String(assignments[0].model));
  check('reasons include the rule', /cheapest tier/.test(assignments[0].reasons[0]), assignments[0].reasons[0]);
  check('summary counts one free unit', summary.perTier.free === 1, JSON.stringify(summary.perTier));
}

// 2. one-shot high-stakes -> upgrade -> strongest tier (one-shot outranks everything)
{
  const { assignments } = assignModels(
    [{ id: 'b', profile: { one_shot: true, reversibility: 0.1, error_cost: 0.9, clarity: 0.9, reasoning_complexity: 0.8, parallelism: true } }],
    CATALOG,
  );
  check('one-shot high-stakes -> strong tier', assignments[0].tier === 'strong', assignments[0].tier);
  check('model_action is upgrade', assignments[0].model_action === 'upgrade', assignments[0].model_action);
  check('reason mentions upgrade rule', /upgrade\/mismatch/.test(assignments[0].reasons[0]), assignments[0].reasons[0]);
}

// 3. deep architecture task (no one-shot) -> deep strategy -> strongest tier
{
  const { assignments } = assignModels(
    [{ id: 'c', profile: { clarity: 0.35, verification_difficulty: 0.8, reasoning_complexity: 0.85, error_cost: 0.6, reversibility: 0.4 } }],
    CATALOG,
  );
  check('deep architecture -> strong tier', assignments[0].tier === 'strong', assignments[0].tier);
  check('strategy is deep', assignments[0].strategy === 'deep', assignments[0].strategy);
}

// 4. parallel research batch (not one-shot, not trivial) -> delegate -> mid tier
{
  const { assignments } = assignModels(
    [{ id: 'd', profile: { parallelism: true, clarity: 0.8, reasoning_complexity: 0.45, verification_difficulty: 0.4, error_cost: 0.3, reversibility: 0.6, hidden_constraint: 0.2 } }],
    CATALOG,
  );
  check('parallel fan-out -> mid tier', assignments[0].tier === 'mid', assignments[0].tier);
  check('model_action is delegate', assignments[0].model_action === 'delegate', assignments[0].model_action);
}

// 5. structured middle task -> default tier; cost share computed
{
  const { assignments, summary } = assignModels(
    [
      { id: 'e', profile: { clarity: 0.75, reasoning_complexity: 0.4, verification_difficulty: 0.4, error_cost: 0.3, reversibility: 0.7 } },
      { id: 'f', profile: { clarity: 0.7, reasoning_complexity: 0.35, verification_difficulty: 0.35, error_cost: 0.25, reversibility: 0.75 } },
    ],
    CATALOG,
  );
  check('structured -> default tier', assignments.every((a) => a.tier === 'mid'), assignments.map((a) => a.tier).join(','));
  check('cost share present with costs', summary.estCostShare && summary.estCostShare.mid === 1, JSON.stringify(summary.estCostShare));
}

// 6. task-string units go through the keyword extractor
{
  const { assignments } = assignModels([{ task: 'Rename the local variable foo to bar in a 30-line function.' }], CATALOG);
  check('task string -> extracted profile -> free tier', assignments[0].tier === 'free', assignments[0].tier);
}

// 7. mixed batch summary counts per tier
{
  const { summary } = assignModels(
    [
      { profile: { clarity: 0.95, reasoning_complexity: 0.1, verification_difficulty: 0.1, error_cost: 0.05, reversibility: 0.95 } },
      { profile: { clarity: 0.3, reasoning_complexity: 0.85, verification_difficulty: 0.8, error_cost: 0.7 } },
      { profile: { clarity: 0.7, reasoning_complexity: 0.4, verification_difficulty: 0.4 } },
      { profile: { clarity: 0.9, reasoning_complexity: 0.2, verification_difficulty: 0.2, error_cost: 0.1, reversibility: 0.9 } },
    ],
    CATALOG,
  );
  check('mixed batch: 2 free / 1-2 others', (summary.perTier.free || 0) === 2 && summary.units === 4, JSON.stringify(summary.perTier));
}

// 8. catalog contract errors
{
  let threw = null;
  try { normalizeCatalog({}); } catch (e) { threw = e; }
  check('empty catalog rejected', !!threw, threw && threw.message);
  let threw2 = null;
  try { assignModels([], CATALOG); } catch (e) { threw2 = e; }
  check('empty units rejected', !!threw2, threw2 && threw2.message);
  const cat = normalizeCatalog({ tiers: [{ id: 'only', models: ['x'] }] });
  check('single-tier catalog: default = that tier', cat.defaultTier.id === 'only', cat.defaultTier.id);
}

// 9. tiers without concrete models keep tier assignment, model null (host decides)
{
  const { assignments } = assignModels(
    [{ profile: { clarity: 0.95, reasoning_complexity: 0.1, verification_difficulty: 0.1, error_cost: 0.05, reversibility: 0.95 } }],
    { tiers: [{ id: 'cheap' }, { id: 'strong' }] },
  );
  check('model-less tier -> null model, tier kept', assignments[0].tier === 'cheap' && assignments[0].model === null, JSON.stringify(assignments[0]));
}

console.log(failures === 0 ? '\nDISPATCH-ASSIGN TEST PASS' : `\nDISPATCH-ASSIGN TEST FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
