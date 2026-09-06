// verify-test.js — Verification-planner test: the plan follows the objective's 反思原则 ladder
// (external test > compile > primary source > independent computation > multi-source > independent
// reviewer > self-review LAST), escalates with verification difficulty/risk, never elevates
// self-review, and (V1) keeps note↔primary consistent, and (V8) is strategy-independent by design.
//
// Run: node evals/verify-test.js
'use strict';
const { verificationPlan, LADDER } = require('../strategies/verify.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const keys = (p) => p.methods.map((m) => m.key).join('>');

// 0. THE LADDER IS VALIDATED AGAINST THE SPEC, NOT AGAINST ITSELF (V2: the old test derived the
//    ranks from LADDER and then compared methods to that same LADDER — a tautology that could never
//    fail. Now the expected order is spelled out independently: self-review must be LAST, and the
//    six evidence channels must precede it in the documented priority order).
const SPEC_ORDER = ['external-test', 'compiler-runtime', 'authoritative-source',
  'independent-computation', 'multi-source', 'independent-reviewer', 'self-review'];
{
  const specRank = Object.fromEntries(SPEC_ORDER.map((k, i) => [k, i]));
  for (const m of LADDER) if (!(m.key in specRank)) {
    check('LADDER contains only spec channels', false, `unknown key ${m.key}`);
  }
  const ladderKeys = LADDER.map((m) => m.key);
  const sorted = ladderKeys.slice().sort((a, b) => specRank[a] - specRank[b]);
  check('LADDER is a permutation of the spec order', ladderKeys.length === SPEC_ORDER.length
    && ladderKeys.every((k, i) => k === sorted[i]), ladderKeys.join('>'));
  const p = verificationPlan('deep', { verification_difficulty: 0.95, error_cost: 0.95 });
  const r = p.methods.map((m) => specRank[m.key]);
  check('methods follow the SPEC ladder (non-decreasing rank)', r.every((x, i) => i === 0 || x >= r[i - 1]), keys(p));
  check('methods are a subset of the spec channels, self-review last', p.methods.every((m) => m.key in specRank) && r[r.length - 1] === SPEC_ORDER.length - 1, keys(p));
}

// 1. easy task: external test primary, self-review LAST
{
  const p = verificationPlan('fast', { verification_difficulty: 0.1, error_cost: 0.1 });
  check('easy task: primary is an actual run/test', p.primary.key === 'external-test', p.primary.label);
  check('self-review is always LAST', p.methods[p.methods.length - 1].key === 'self-review', keys(p));
  check('self-review is NOT the primary', p.primary.key !== 'self-review', p.primary.key);
}

// 3. hard-to-verify escalates to independent review / adversarial, deeper than easy
{
  const p = verificationPlan('deep', { verification_difficulty: 0.95, error_cost: 0.5, one_shot: false });
  check('very hard-to-verify plan includes independent reviewer', p.methods.some((m) => m.key === 'independent-reviewer'), keys(p));
  const easy = verificationPlan('fast', { verification_difficulty: 0.1, error_cost: 0.1 });
  check('hard plan is deeper than an easy plan', p.methods.length > easy.methods.length, `len=${p.methods.length}`);
}

// 4. one-shot no-oracle -> independent review is forced, AND note agrees with primary (V1)
{
  const p = verificationPlan('deep', { verification_difficulty: 0.6, error_cost: 0.9, one_shot: true });
  check('one-shot high-stakes forces independent review', p.methods.some((m) => m.key === 'independent-reviewer'), keys(p));
  check('note agrees with primary for one-shot (no contradiction)', /primary method/.test(p.note) || !/lead with independent review/.test(p.note), p.note);
  check('primary is still the test step (nothing overrides the ladder)', p.primary.key === 'external-test', p.primary.key);
}

// 5. cheap-but-high-stakes still leads with external verification + independent review
{
  const p = verificationPlan('fast', { verification_difficulty: 0.2, error_cost: 0.85, one_shot: false });
  check('cheap-to-verify high-stakes still leads with a test', p.primary.key === 'external-test', `primary=${p.primary.key}`);
  check('...but adds independent review because stakes are high', p.methods.some((m) => m.key === 'independent-reviewer'), keys(p));
}

// 6. strategy is advisory and does NOT change the plan (V8: the param is accepted for signature
//    stability but the plan is profile-driven — locked so tests stop "disguising" it by changing
//    strategy AND profile together).
{
  const prof = { verification_difficulty: 0.5, error_cost: 0.3, one_shot: false };
  const f = verificationPlan('fast', prof);
  const d = verificationPlan('deep', prof);
  check('strategy does not change the plan (profile-driven)', JSON.stringify(f.methods) === JSON.stringify(d.methods), keys(f));
}

console.log(failures === 0 ? 'VERIFY TEST PASS: verification plans follow the objective priority ladder, self-review last'
  : `VERIFY TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
