// Integrity and discrimination test for the behavioural decision suite.
//
// A rubric that passes everything measures nothing. This script exists so that the suite cannot
// quietly become vacuous: every case must carry a good example that passes and a bad example that
// fails, and the two must be genuinely different decisions rather than a rewording. That is the same
// discipline the repository already applies to planted bugs — prove the instrument detects the thing
// before trusting any measurement it produces.
//
// Also validates the suite against the skill's own rule set, so a case cannot cite a rule that does
// not exist, and all twelve required behaviour areas must be covered.
//
//   node evals/project-conventions/suite-test.mjs
//
// Exit 0 = the suite is well-formed and its rubrics discriminate.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUITE, scoreCase } from './score.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const RULES_MD = join(REPO, '.dsh', 'skills', 'project-conventions', 'references', 'rules.md');

const REQUIRED_AREAS = 12;

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const ids = SUITE.cases.map((c) => c.id);

// ---------------------------------------------------------------- shape

check('case ids are unique', new Set(ids).size === ids.length, `${ids.length} case(s)`);
check('every case declares an area', SUITE.cases.every((c) => Number.isInteger(c.area)));
check('every case declares a prompt', SUITE.cases.every((c) => (c.prompt ?? '').length > 40));
check('every case declares a rationale', SUITE.cases.every((c) => (c.rationale ?? '').length > 20));
check('every case has at least one required pattern', SUITE.cases.every((c) => c.mustMatch?.length > 0));
check('every case has at least one forbidden pattern', SUITE.cases.every((c) => c.mustNotMatch?.length > 0));

// ---------------------------------------------------------------- patterns are real

const badPatterns = [];
for (const c of SUITE.cases) {
  for (const p of [...c.mustMatch, ...c.mustNotMatch]) {
    if (typeof p !== 'string' || p.trim() === '') badPatterns.push(`${c.id}: empty pattern`);
    if (p === '.*' || p === '^' || p === '$') badPatterns.push(`${c.id}: vacuous pattern ${JSON.stringify(p)}`);
    try {
      new RegExp(p, 'i');
    } catch (e) {
      badPatterns.push(`${c.id}: invalid regex ${JSON.stringify(p)} (${e.message})`);
    }
  }
}
check('every pattern is a real, non-vacuous regex', badPatterns.length === 0, badPatterns.join('; ') || 'ok');

// ---------------------------------------------------------------- discrimination

// The core check. A case whose good example fails is mis-specified; a case whose bad example passes is
// measuring nothing and is rejected outright.
//
// An adversarial review broke the original pair of checks with three mutations, each of which left the
// suite green: badExample = "no"; badExample = an unrelated sentence; and a rubric whose mustMatch was
// the single token "\bthe\b". All three failed the rubric by *missing a required token*, which proves
// nothing about whether the rubric detects the failure mode.
//
// The obvious repair — require badExample to satisfy every mustMatch so only a mustNotMatch hit can
// fail it — was tried and is unsatisfiable here: on decision-forcing cases the required token IS the
// correct decision ("1.5.0", "delete"), so no wrong answer can contain it. The invariant that is both
// achievable and meaningful is: **the bad example must commit the forbidden act**. It must violate at
// least one mustNotMatch pattern, and it must be a substantive answer rather than a degenerate string.
// That is what makes the failure attributable to the forbidden decision, and it is what the mutations
// above cannot survive.
const notDiscriminating = [];
const goodFails = [];
const badUnfocused = [];
function badExampleProblem(c) {
  const badText = c.badExample ?? '';
  const words = badText.trim().split(/\s+/).filter(Boolean).length;
  if (!(c.mustNotMatch ?? []).some((p) => new RegExp(p, 'i').test(badText))) return 'commits no forbidden act';
  if (words < 6) return `bad example is ${words} words`;
  return null;
}
for (const c of SUITE.cases) {
  const good = scoreCase(c.id, c.goodExample ?? '');
  const bad = scoreCase(c.id, c.badExample ?? '');
  if (!good.pass) {
    goodFails.push(`${c.id} (${[...good.missing.map((m) => `missing ${m}`), ...good.violated.map((v) => `violated ${v}`)].join(', ')})`);
  }
  const problem = badExampleProblem(c);
  if (problem) badUnfocused.push(`${c.id} (${problem})`);
  if (bad.pass) notDiscriminating.push(c.id);
}
check('every good example passes its own rubric', goodFails.length === 0, goodFails.join('; ') || 'ok');
check('every bad example commits a forbidden act, at substance', badUnfocused.length === 0,
  badUnfocused.join('; ') || `${SUITE.cases.length} bad examples demonstrate their case's failure mode`);
check('every bad example fails its rubric (no vacuous case)', notDiscriminating.length === 0,
  notDiscriminating.join(', ') || `${SUITE.cases.length} rubrics discriminate`);

// The three mutations an adversarial review used to break the previous version of the checks above.
// They are kept as permanent controls: a guard nobody has tried to defeat is a guard nobody knows
// works, and this suite's whole job is to not be the thing that quietly passes.
{
  const base = SUITE.cases[0];
  const mutations = [
    { name: 'badExample replaced by a degenerate word', c: { ...base, badExample: 'no' } },
    { name: 'badExample replaced by an unrelated sentence', c: { ...base, badExample: 'The weather was pleasant and the meeting ran long this afternoon.' } },
    { name: 'rubric reduced to a token that matches anything', c: { ...base, mustMatch: ['\\bthe\\b'], mustNotMatch: ['zzqq-never-appears'], badExample: 'nope' } },
  ];
  const undetected = mutations.filter((m) => badExampleProblem(m.c) === null);
  check('the strengthened check rejects the three mutations that broke it before', undetected.length === 0,
    undetected.length ? undetected.map((m) => m.name).join('; ') : `${mutations.length} mutations rejected`);
}

console.log('[NOTE] residual limit, stated rather than hidden: this proves the bad example commits the');
console.log('       forbidden act, not that it is the most likely wrong answer. A rubric can still be');
console.log('       vacuous with respect to a wrong answer nobody wrote down.');

// A good and a bad example that score identically mean the case is testing wording, not a decision.
const identical = SUITE.cases.filter((c) => (c.goodExample ?? '') === (c.badExample ?? '')).map((c) => c.id);
check('no case reuses one string as both examples', identical.length === 0, identical.join(', ') || 'ok');

// The negation guard needs its own control. Without this, a scorer that simply ignores every
// forbidden phrase would pass the discrimination check above just as happily.
const negationControls = SUITE.cases
  .filter((c) => c.mustNotMatch?.length)
  .map((c) => {
    const phrase = c.badExample;
    // Wrap the bad example in an explicit refusal and require the scorer to stop calling it a failure.
    const refused = `I would not do that. ${phrase.replace(/^([A-Z])/, (s) => s.toLowerCase())} — but I am refusing it.`;
    return { id: c.id, refused: scoreCase(c.id, refused) };
  });
const guardFailures = [];
for (const c of SUITE.cases) {
  for (const p of c.mustNotMatch ?? []) {
    const plain = new RegExp(p, 'i');
    const sample = `${p.replace(/[.*+?^${}()|[\]\\]/g, '')}`;
    if (!plain.test(sample)) continue; // pattern is not self-matching; nothing to probe
    const wrapped = scoreCase(c.id, `I would not ${sample} here.`);
    if (!wrapped.pass && wrapped.violated.length) guardFailures.push(`${c.id}: "${sample}"`);
  }
}
check('a negated forbidden phrase is not scored as a violation', guardFailures.length === 0,
  guardFailures.slice(0, 4).join('; ') || `${negationControls.length} cases carry the guard`);

// ---------------------------------------------------------------- rule references exist

const ruleIds = new Set([...readFileSync(RULES_MD, 'utf8').matchAll(/^### (PC-\d+)/gm)].map((m) => m[1]));
// Rules are declared per area rather than per case: a case tests an area, and the area names the
// rules it is meant to exercise. Deriving the citation set from the area table keeps the two in step.
const areaRules = new Map((SUITE.areas ?? []).map((a) => [a.id, a.rules ?? []]));
const cited = new Set();
for (const c of SUITE.cases) for (const r of areaRules.get(c.area) ?? []) if (/^PC-\d+$/.test(r)) cited.add(r);
const unknownRules = [...cited].filter((r) => !ruleIds.has(r));
check('every cited rule exists in the rule set', unknownRules.length === 0,
  unknownRules.join(', ') || `${cited.size} distinct rule(s) cited`);
check('the suite exercises most of the rule set', cited.size >= Math.ceil(ruleIds.size * 0.6),
  `${cited.size}/${ruleIds.size} rules exercised`);
const unexercised = [...ruleIds].filter((r) => !cited.has(r));
console.log(`[NOTE] rules not exercised by any case: ${unexercised.join(', ') || 'none'}`);

// ---------------------------------------------------------------- area coverage

const coveredAreas = new Set(SUITE.cases.map((c) => c.area));
const missingAreas = [];
for (let i = 1; i <= REQUIRED_AREAS; i += 1) if (!coveredAreas.has(i)) missingAreas.push(i);
check(`all ${REQUIRED_AREAS} required behaviour areas are covered`, missingAreas.length === 0,
  missingAreas.length ? `missing area(s): ${missingAreas.join(', ')}` : `${coveredAreas.size} areas, ${SUITE.cases.length} cases`);

const declaredAreas = new Set((SUITE.areas ?? []).map((a) => a.id));
const undeclared = [...coveredAreas].filter((a) => !declaredAreas.has(a));
check('every case area is declared in the area table', undeclared.length === 0, undeclared.join(', ') || 'ok');

// Areas with a single case cannot show a direction; record it rather than hide it.
const perArea = new Map();
for (const c of SUITE.cases) perArea.set(c.area, (perArea.get(c.area) ?? 0) + 1);
const thin = [...perArea].filter(([, n]) => n < 2).map(([a]) => a);
console.log(`[NOTE] areas with a single case (no within-area contrast): ${thin.join(', ') || 'none'}`);
console.log(`[NOTE] counterexamples present: ${SUITE.cases.filter((c) => c.mustNotMatch.length > 0).length}/${SUITE.cases.length} cases carry a forbidden decision`);

console.log('');
console.log(failures === 0
  ? `SUITE TEST PASS: ${SUITE.cases.length} cases across ${coveredAreas.size} areas, every rubric discriminates`
  : `SUITE TEST FAIL: ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
