// Cost / effort estimator test: strategy cost ordering, context/tool adjustments, and the advisory
// budget check (must NEVER auto-downgrade quality/verification decisions).
//
// Run: node evals/cost-test.js
'use strict';
const { estimateCost, budgetCheck } = require('../strategies/cost.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// ---- ordering: deep > structured > fast on effort axes ----
{
  const f = estimateCost('fast', {}).tokens;
  const s = estimateCost('structured', {}).tokens;
  const d = estimateCost('deep', {}).tokens;
  check('effort ordering fast < structured < deep (tokens)', f < s && s < d, `${f} < ${s} < ${d}`);
  const fl = estimateCost('fast', {}).latency;
  const dl = estimateCost('deep', {}).latency;
  check('effort ordering holds on latency', fl < dl, `${fl} < ${dl}`);
}

// ---- context_size large raises tokens/latency ----
{
  const small = estimateCost('deep', { context_size: 'small' });
  const large = estimateCost('deep', { context_size: 'large' });
  check('large context raises cost', large.tokens > small.tokens && large.latency > small.latency,
    `${small.tokens}->${large.tokens}`);
}

// ---- tool_dependency raises toolCalls ----
{
  const noTool = estimateCost('structured', { tool_dependency: false });
  const withTool = estimateCost('structured', { tool_dependency: true });
  check('tool dependency raises toolCalls', withTool.toolCalls > noTool.toolCalls,
    `${noTool.toolCalls}->${withTool.toolCalls}`);
}

// ---- budget: fits when within, over when exceeded ----
{
  const deepCost = estimateCost('deep', {});
  const ok = budgetCheck({ strategy: 'deep', budget: { tokens: deepCost.tokens + 1, latency: 100 } });
  check('budget fits when within', ok.fits === true, ok.advice);
  const over = budgetCheck({ strategy: 'deep', budget: { tokens: 1 } });
  check('budget over when exceeded', over.fits === false && /tokens/.test(over.advice),
    over.fits ? 'fits' : 'over (as expected)');
}

// ---- advisory only: budget overflow must NOT auto-downgrade the strategy ----
{
  const over = budgetCheck({ strategy: 'deep', budget: { tokens: 1 } });
  const explicitlyAdvisory = /advisor|do NOT auto-downgrade|don'?t auto-downgrade|quality/i.test(over.advice);
  check('budget advice is advisory (never overrides quality)', explicitlyAdvisory,
    over.advice.slice(0, 80));
  // The function must not return a different strategy (it takes no strategy-override path by design).
  check('budgetCheck has no strategy besides the chosen one (no downgrade API)',
    typeof budgetCheck({ strategy: 'deep', budget: { tokens: 1 } }).strategy === 'undefined',
    'returns cost/budget/advice only');
}

// ---- a real cost-conscious decision: trivial task fast is orders cheaper than deep ----
{
  const f = estimateCost('fast', {});
  const d = estimateCost('deep', {});
  check('fast ≈ 1/10 of deep (order of magnitude)', d.tokens >= 9 * f.tokens,
    `fast=${f.tokens} deep=${d.tokens}`);
}

console.log(failures === 0 ? 'COST TEST PASS: effort estimates and advisory budget behavior correct (cost-aware + quality-safe)'
  : `COST TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
