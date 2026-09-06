// Objective-principles conformance test: a higher-level audit that the router honors the
// objective's OWN stated rules over the whole eval corpus (train + held-out), independent of the
// exact per-item labels. Each principle maps to a behavioral guard; a violation is a real finding
// (difficulty misjudgment / overthinking / underthinking / over-upgrade / short delegation).
//
// Principles checked:
//   P1 don't rush ambiguous tasks        (clarity < .35  ->  NOT fast)
//   P2 don't overthink cheap tasks       (easy+cheap     ->  NOT deep)
//   P3 large context -> Deep
//   P4 repeated failure -> escalate/deepen   (ANY verification difficulty, per F-1 fix)
//   P5 high-risk & hard-to-verify -> Deep
//   P6 parallel independent units -> delegate, NOT upgrade  (tool-dependent OR not — the F-4 fix)
//   P7 one-shot + (high cost OR hard-to-verify) -> upgrade  (per F-6 fix; was entirely untested)
//
// Run: node evals/principles-test.js
'use strict';
const { route } = require('../router/task-router.js');
const { ITEMS: TRAIN } = require('./benchmark.js');
const { ITEMS: VAL } = require('./validation.js');

const ALL = TRAIN.concat(VAL);

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const violates = [];

// P1: don't rush ambiguous tasks
{
  const bad = ALL.filter((it) => (it.profile.clarity || 1) < 0.35 && route(it.profile, {}).strategy === 'fast');
  if (bad.length) violates.push(`P1:${bad.map((b) => b.id).join(',')}`);
  check('P1: ambiguous tasks are not rushed (fast)', bad.length === 0,
    bad.length ? 'rushed: ' + bad.map((b) => b.id).join(',') : 'none');
}

// P2: don't overthink trivially-cheap tasks
{
  const bad = ALL.filter((it) =>
    (it.profile.verification_difficulty || 1) <= 0.25 &&
    (it.profile.error_cost || 1) <= 0.2 &&
    (it.profile.reasoning_complexity || 1) <= 0.35 &&
    route(it.profile, {}).strategy === 'deep');
  if (bad.length) violates.push(`P2:${bad.map((b) => b.id).join(',')}`);
  check('P2: cheap/easy tasks are not over-thought (deep)', bad.length === 0,
    bad.length ? 'deep: ' + bad.map((b) => b.id).join(',') : 'none');
}

// P3: large context -> Deep
{
  const bad = ALL.filter((it) => it.profile.context_size === 'large' && route(it.profile, {}).strategy !== 'deep');
  if (bad.length) violates.push(`P3:${bad.map((b) => b.id).join(',')}`);
  check('P3: large-context tasks route Deep', bad.length === 0,
    bad.length ? 'not deep: ' + bad.map((b) => b.id).join(',') : 'none');
}

// P4: repeated failure -> escalate or deepen
{
  const bad = ALL.filter((it) => {
    const f = Number(it.profile.failures_so_far || 0);
    if (f < 3) return false;
    const r = route(it.profile, {});
    return r.model_action === 'keep' && r.strategy !== 'deep';
  });
  if (bad.length) violates.push(`P4:${bad.map((b) => b.id).join(',')}`);
  check('P4: repeated failure escalates or deepens (any verif)', bad.length === 0,
    bad.length ? 'not escalated/deepened: ' + bad.map((b) => b.id).join(',') : 'none');
}

// P5: high-risk & hard-to-verify -> Deep
{
  const bad = ALL.filter((it) =>
    (it.profile.verification_difficulty || 0) > 0.7 &&
    (it.profile.error_cost || 0) >= 0.7 &&
    route(it.profile, {}).strategy !== 'deep');
  if (bad.length) violates.push(`P5:${bad.map((b) => b.id).join(',')}`);
  check('P5: high-risk, hard-to-verify tasks route Deep', bad.length === 0,
    bad.length ? 'not deep: ' + bad.map((b) => b.id).join(',') : 'none');
}

// P6: parallel independent units -> delegate, NOT upgrade (findings F-4/F-5: no tool_dependency
// required, and delegation must not be silently disabled by capability edges or an upgrade victory).
// EXCEPTION (F-6b): a one-shot irreversible judgment overrides parallel-delegation — a single
// decision is never fan-out work, so upgrade is correct there (covered by P7).
{
  const bad = ALL.filter((it) => it.profile.parallelism && it.profile.one_shot !== true
    && route(it.profile, {}).model_action === 'upgrade');
  if (bad.length) violates.push(`P6:${bad.map((b) => b.id).join(',')}`);
  check('P6: parallel units delegate, not upgrade', bad.length === 0,
    bad.length ? 'upgraded: ' + bad.map((b) => b.id).join(',') : 'none');
  // every non-one-shot parallel item must end at delegate unless a caller-supplied capability
  // mismatch upgrades it
  const notDelegated = ALL.filter((it) => it.profile.parallelism && it.profile.one_shot !== true
    && route(it.profile, {}).model_action !== 'delegate');
  check('P6b: parallel independent work actually delegates (non-one-shot)', notDelegated.length === 0,
    notDelegated.length ? 'kept/upgraded: ' + notDelegated.map((b) => b.id).join(',') : 'none');
}

// P7: one-shot + (high cost OR hard-to-verify) & irreversible -> upgrade (F-6); ALSO outranks
// parallel-delegation (F-6b): a one-shot judgment is never fan-out work.
{
  const bad = ALL.filter((it) => {
    if (it.profile.one_shot !== true) return false;
    const highRisk = (it.profile.error_cost || 0) >= 0.7 || (it.profile.verification_difficulty || 0) > 0.7;
    if (!highRisk) return false;
    return route(it.profile, {}).model_action !== 'upgrade';
  });
  if (bad.length) violates.push(`P7:${bad.map((b) => b.id).join(',')}`);
  check('P7: one-shot high-stakes/hard-to-verify upgrades (incl. over parallel)', bad.length === 0,
    bad.length ? 'not upgraded: ' + bad.map((b) => b.id).join(',') : 'none');
}

console.log('');
console.log(failures === 0 ? 'PRINCIPLES TEST PASS: router honors the objective-derived principles over the eval corpus'
  : `PRINCIPLES TEST FAIL: ${violates.join(' | ')}`);
process.exit(failures === 0 ? 0 : 1);
