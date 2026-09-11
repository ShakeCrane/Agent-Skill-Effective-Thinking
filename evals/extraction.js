// End-to-end extraction fidelity harness.
// Runs the FULL pipeline from a raw task string -> profile (router/extract.js) -> route,
// and compares against the hand-labeled expected route AND the hand-labeled "gold" profile.
//
// This measures THREE things:
//   A) END-TO-END routing: does route(extract(task)) match the expected route?
//      (the config the skill actually makes.)
//   B) PROFILE fidelity: does the extracted profile approximate the hand-inspected gold profile?
//      (how trustworthy is signal extraction on its own.)
//   C) HIGH-STAKES regression block: a small set of adversarial raw-text cases where the task
//      SURFACE ("bug"/"debug"/"repair") used to shadow the real stakes, plus the negative control
//      that proves stakes alone still do not escalate.
//
// The router emits TWO orthogonal dimensions (strategy x model_action). Scoring only `strategy`
// would hide a whole class of regression — a task can route to the right strategy with the wrong
// model action (as `one-shot-high-cost-mid-verif` currently does). We therefore report strategy,
// model_action and the JOINT (both correct on the same item) accuracy, each against a conservative
// regression floor.
//
// Run: node evals/extraction.js

'use strict';
const { route } = require('../router/task-router.js');
const { extract } = require('../router/extract.js');
const { ITEMS: TRAIN } = require('./benchmark.js');
const { ITEMS: VAL } = require('./validation.js');

// ---- Signal fidelity (mean absolute error per signal, clamped to route-relevant set) ----
const SIGNALS = [
  'clarity', 'hidden_constraint', 'constraint_count', 'constraint_conflict',
  'reasoning_complexity', 'novelty', 'error_cost', 'reversibility',
  'verification_difficulty',
];

function profileMAE(gold, got) {
  let sum = 0;
  for (const s of SIGNALS) {
    const a = Number(gold[s]) || 0;
    const b = Number(got[s]) || 0;
    sum += Math.abs(a - b);
  }
  return sum / SIGNALS.length;
}

/**
 * HIGH-STAKES regression block.
 *
 * P2 bug being locked down: `baseCategory()` is first-match-wins with the debug/repair category
 * ahead of the high-stakes category, so "Fix this security bug before production launch." was
 * classified as an ORDINARY debug task (error_cost 0.45, reversibility 0.6) and routed
 * structured/keep — the stakes were silently shadowed by the task's surface wording.
 *
 * Fix under test: stakes are applied as an ORTHOGONAL MODIFIER (`highStakesAnchor + exposure`,
 * minus transient-retry framing), touching ONLY error_cost (>=0.85) and reversibility (<=0.25).
 * Deliberately asserted as NOT setting one_shot, NOT setting verification_difficulty to 0.8, and
 * NOT causing a model upgrade — escalation stays governed by the existing mismatch/one-shot/
 * repeated-failure rules, so high stakes mean "verify properly", not "use a bigger model".
 *
 * `profile` inside each item is the stored gold profile used by this harness; the P2 assertions
 * below re-derive the profile from the raw text, because the raw text is the actual input.
 */
const HIGH_STAKES = [
  {
    id: 'hs-security-bug-before-launch',
    task: 'Fix this security bug before production launch.',
    expected: { strategy: 'deep', model_action: 'keep' },
    minErrorCost: 0.7, maxReversibility: 0.3,
  },
  {
    id: 'hs-auth-failure-before-release',
    task: 'Debug this authentication failure before release.',
    expected: { strategy: 'deep', model_action: 'keep' },
    minErrorCost: 0.7, maxReversibility: 0.3,
  },
  {
    id: 'hs-payment-bug-financial-loss',
    task: 'Repair this payment bug; incorrect results could cause financial loss.',
    expected: { strategy: 'deep', model_action: 'keep' },
    minErrorCost: 0.7, maxReversibility: 0.3,
  },
];

/**
 * NEGATIVE CONTROL for the rule "high stakes raise the need for VERIFICATION, not DELIBERATION".
 *
 * High error cost, but cheap to verify, reversible, and not a one-shot decision: the router must
 * NOT auto-upgrade the model and must NOT enter Deep merely because the stakes are high.
 *
 * The hand-built profile below deliberately carries the risk axes and NOTHING else that could
 * force Deep, so the assertion isolates the router rule from the keyword extractor.
 *
 * Observed, documented router contract (NOT a bug, and asserted so it stays deliberate): such a
 * task lands on `structured`, not `fast`. The Fast branch requires *low* error cost (errCost
 * <= E_LOW = 0.3) on purpose — "Fast" in this router means a low-cost mechanical deliverable, so a
 * high-stakes-but-cheap-to-verify task still gets a light plan and a verification step. The point of
 * the control is the ABSENCE of `deep` and of `upgrade`, which is what high stakes must not cause.
 */
const NEGATIVE_CONTROL = {
  id: 'nctl-high-cost-cheap-verify-reversible',
  expected: { strategy: 'structured', model_action: 'keep' },
  goldProfile: {
    clarity: 0.8, hidden_constraint: 0.3, constraint_count: 2, constraint_conflict: 0.1,
    reasoning_complexity: 0.3, novelty: 0.2, error_cost: 0.9, reversibility: 0.9,
    verification_difficulty: 0.1, tool_dependency: false, context_size: 'small',
    parallelism: false, one_shot: false, failures_so_far: 0,
  },
};

/**
 * Second negative control, on the EXTRACTOR side: an explicit high-cost statement whose risk comes
 * from ordinary correctness (not from the security/release/financial anchor). The P2 modifier must
 * NOT fire, so the profile keeps a cheap, reversible, verifiable shape. This proves the high-stakes
 * modifier is anchored to real stakes phrasing and is not a blanket "any costly task" switch.
 */
const NEGATIVE_CONTROL_RAW = {
  id: 'nctl-extractor-anchor-specificity',
  task: 'Fix the rounding typo in the pricing formatter; incorrect prices could cost us money, but a unit test verifies the fix and one command reverts it.',
  maxErrorCost: 0.45,
  maxReversibilityDrop: 0.6,
};

/** Raw-text high-stakes assertions (the modifier must move the risk axes and nothing else). */
function runHighStakes() {
  console.log('HIGH-STAKES raw-text regression (P2)');
  let ok = 0;
  let checked = 0;

  for (const it of HIGH_STAKES) {
    const prof = extract(it.task);
    const got = route(prof, {});
    const routeOK = got.strategy === it.expected.strategy && got.model_action === it.expected.model_action;
    const costOK = Number(prof.error_cost) >= it.minErrorCost;
    const revOK = Number(prof.reversibility) <= it.maxReversibility;
    // The modifier must NOT smuggle in escalation:
    const noOneShot = prof.one_shot !== true;
    const noForcedDeepVerify = Number(prof.verification_difficulty) < 0.8;
    const noUpgrade = got.model_action !== 'upgrade';
    const pass = routeOK && costOK && revOK && noOneShot && noForcedDeepVerify && noUpgrade;
    checked += 1;
    if (pass) ok += 1;
    console.log(
      `[${pass ? 'OK ' : 'MISS'}] ${it.id}  exp=${it.expected.strategy}/${it.expected.model_action} ` +
      `e2e=${got.strategy}/${got.model_action}  error_cost=${prof.error_cost} reversibility=${prof.reversibility} ` +
      `verif=${prof.verification_difficulty} one_shot=${prof.one_shot === true}`
    );
    if (!costOK) console.log(`        error_cost ${prof.error_cost} < required ${it.minErrorCost}`);
    if (!revOK) console.log(`        reversibility ${prof.reversibility} > allowed ${it.maxReversibility}`);
    if (!noOneShot) console.log('        high stakes wrongly set one_shot=true');
    if (!noForcedDeepVerify) console.log('        high stakes wrongly forced verification_difficulty=0.8');
    if (!noUpgrade) console.log('        high stakes wrongly caused a model upgrade');
    if (!routeOK) console.log(`        route ${got.strategy}/${got.model_action} != ${it.expected.strategy}/${it.expected.model_action}`);
  }

  // Negative control 1 — router rule, isolated from the extractor.
  const ncRouter = route(NEGATIVE_CONTROL.goldProfile, {});
  const ncRouterOK = ncRouter.strategy === NEGATIVE_CONTROL.expected.strategy &&
    ncRouter.model_action === NEGATIVE_CONTROL.expected.model_action;
  checked += 1;
  if (ncRouterOK) ok += 1;
  console.log(
    `[${ncRouterOK ? 'OK ' : 'MISS'}] ${NEGATIVE_CONTROL.id} (router-only, hand profile)  ` +
    `error_cost=0.9 reversibility=0.9 verif=0.1 one_shot=false -> ${ncRouter.strategy}/${ncRouter.model_action} ` +
    `(exp ${NEGATIVE_CONTROL.expected.strategy}/${NEGATIVE_CONTROL.expected.model_action})`
  );
  if (ncRouter.strategy === 'deep') console.log('        high error cost alone wrongly forced Deep');
  if (ncRouter.model_action === 'upgrade') console.log('        high error cost alone wrongly forced an upgrade');

  // Negative control 2 — the extractor modifier stays anchor-specific.
  const ncRaw = extract(NEGATIVE_CONTROL_RAW.task);
  const ncRawOK = Number(ncRaw.error_cost) <= NEGATIVE_CONTROL_RAW.maxErrorCost &&
    Number(ncRaw.reversibility) >= NEGATIVE_CONTROL_RAW.maxReversibilityDrop &&
    ncRaw.one_shot !== true;
  checked += 1;
  if (ncRawOK) ok += 1;
  console.log(
    `[${ncRawOK ? 'OK ' : 'MISS'}] ${NEGATIVE_CONTROL_RAW.id}  ` +
    `error_cost=${ncRaw.error_cost} (<=${NEGATIVE_CONTROL_RAW.maxErrorCost}) reversibility=${ncRaw.reversibility} ` +
    `(>=${NEGATIVE_CONTROL_RAW.maxReversibilityDrop}) one_shot=${ncRaw.one_shot === true} -> ` +
    `${route(ncRaw, {}).strategy}/${route(ncRaw, {}).model_action}`
  );
  if (!ncRawOK) console.log('        the high-stakes modifier fired on text WITHOUT the high-stakes anchor');

  console.log('');
  console.log(`HIGH-STAKES: ${ok}/${checked} assertions OK`);
  return { ok, checked };
}

function runSet(name, items) {
  let routeOK = 0, modelOK = 0, jointOK = 0, maeSum = 0;
  const misses = [];
  for (const it of items) {
    if (!it.task) continue; // only tasks with natural-language text count here
    const prof = extract(it.task);
    const got = route(prof, {});
    const rOK = got.strategy === it.expected.strategy;
    const mOK = got.model_action === it.expected.model_action;
    const jOK = rOK && mOK;
    if (rOK) routeOK++;
    if (mOK) modelOK++;
    if (jOK) jointOK++;
    const mae = profileMAE(it.profile, prof);
    maeSum += mae;
    if (!jOK) {
      misses.push({
        id: it.id,
        exp: `${it.expected.strategy}/${it.expected.model_action}`,
        got: `${got.strategy}/${got.model_action}`,
        mae: mae.toFixed(2),
        extractedProfile: { ...prof },
      });
    }
    console.log(
      `[${jOK ? 'OK ' : 'MISS'}] ${it.id}  exp=${it.expected.strategy}/${it.expected.model_action} ` +
      `e2e=${got.strategy}/${got.model_action}  sigMAE=${mae.toFixed(2)}`
    );
  }
  const n = items.filter((x) => x.task).length;
  const pct = (k) => `${k}/${n} (${((k / n) * 100).toFixed(0)}%)`;
  console.log('');
  console.log(`${name}: e2e STRATEGY ${pct(routeOK)}, MODEL ${pct(modelOK)}, JOINT ${pct(jointOK)}, mean|signal MAE=${(maeSum / n).toFixed(2)}`);
  if (misses.length) {
    console.log('miss details:');
    for (const m of misses) console.log(' ', m.id, 'exp=' + m.exp, 'got=' + m.got, 'sigMAE=' + m.mae);
  }
  return { routeOK, modelOK, jointOK, n };
}

// ---------------------------------------------------------------------------
// Regression floors.
//
// These are NOT targets and NOT claims of generalization: the corpus is small (51 items), hand
// labeled, and the extractor is a keyword heuristic, so 100% is neither expected nor required. The
// floors exist to stop a real degradation from shipping silently, so they are set just BELOW the
// measured baseline (strategy 44/51, model 48/51, joint 42/51 at the time of writing) with a small
// margin — high enough to catch a class of regressions, not so high that an honest single-item
// trade-off blocks the build. Deliberately NOT lowered to make a red build green: if a change drops
// below a floor, the change is the problem, not the floor.
// ---------------------------------------------------------------------------
const FLOOR_STRATEGY = 0.80; // baseline 44/51 = 86%
const FLOOR_MODEL = 0.88;    // baseline 48/51 = 94%
const FLOOR_JOINT = 0.76;    // baseline 42/51 = 82%

function main() {
  const hs = runHighStakes();
  const v = runSet('VALIDATION (held-out)', VAL);
  const t = runSet('TRAIN (benchmark)', TRAIN);
  const acc = (k) => (v[k] + t[k]) / (v.n + t.n);
  const strategy = acc('routeOK');
  const model = acc('modelOK');
  const joint = acc('jointOK');
  const r3 = (x) => (x * 100).toFixed(0) + '%';
  console.log('');
  console.log(`COMBINED e2e STRATEGY accuracy: ${v.routeOK + t.routeOK}/${v.n + t.n} (${r3(strategy)})`);
  console.log(`COMBINED e2e MODEL accuracy:    ${v.modelOK + t.modelOK}/${v.n + t.n} (${r3(model)})`);
  console.log(`COMBINED e2e JOINT accuracy:    ${v.jointOK + t.jointOK}/${v.n + t.n} (${r3(joint)})  [strategy AND model_action]`);

  const breaches = [];
  if (strategy < FLOOR_STRATEGY) breaches.push(`strategy ${r3(strategy)} < floor ${r3(FLOOR_STRATEGY)}`);
  if (model < FLOOR_MODEL) breaches.push(`model_action ${r3(model)} < floor ${r3(FLOOR_MODEL)}`);
  if (joint < FLOOR_JOINT) breaches.push(`joint ${r3(joint)} < floor ${r3(FLOOR_JOINT)}`);
  if (hs.ok !== hs.checked) breaches.push(`high-stakes regression block ${hs.ok}/${hs.checked}`);
  // A high-stakes regression is a correctness bug, not a metric wobble: fail the build on it.
  if (breaches.length) {
    console.log('');
    for (const b of breaches) console.log('REGRESSION: ' + b);
    console.log(`EXTRACTION FAIL (floors: strategy>=${r3(FLOOR_STRATEGY)}, model>=${r3(FLOOR_MODEL)}, joint>=${r3(FLOOR_JOINT)})`);
    process.exit(1);
  }
  console.log('');
  console.log(`EXTRACTION PASS (strategy>=${r3(FLOOR_STRATEGY)}, model>=${r3(FLOOR_MODEL)}, joint>=${r3(FLOOR_JOINT)}; high-stakes ${hs.ok}/${hs.checked})`);
  process.exit(0);
}

module.exports = { runSet, runHighStakes, main, HIGH_STAKES, NEGATIVE_CONTROL, NEGATIVE_CONTROL_RAW };

if (require.main === module) main();
