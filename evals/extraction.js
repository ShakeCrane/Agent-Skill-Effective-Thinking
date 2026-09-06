// End-to-end extraction fidelity harness.
// Runs the FULL pipeline from a raw task string -> profile (router/extract.js) -> route,
// and compares against the hand-labeled expected route AND the hand-labeled "gold" profile.
//
// This measures TWO things:
//   A) END-TO-END routing: does route(extract(task)) match the expected strategy/model?
//      (the config the skill actually makes.)
//   B) PROFILE fidelity: does the extracted profile approximate the hand-inspected gold profile?
//      (how trustworthy is signal extraction on its own.)
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

function runSet(name, items) {
  let routeOK = 0, modelOK = 0, maeSum = 0;
  const misses = [];
  for (const it of items) {
    if (!it.task) continue; // only tasks with natural-language text count here
    const prof = extract(it.task);
    const got = route(prof, {});
    const rOK = got.strategy === it.expected.strategy;
    const mOK = got.model_action === it.expected.model_action;
    if (rOK) routeOK++;
    if (mOK) modelOK++;
    const mae = profileMAE(it.profile, prof);
    maeSum += mae;
    if (!rOK || !mOK) {
      misses.push({
        id: it.id,
        exp: `${it.expected.strategy}/${it.expected.model_action}`,
        got: `${got.strategy}/${got.model_action}`,
        mae: mae.toFixed(2),
        extractedProfile: { ...prof },
      });
    }
    console.log(
      `[${rOK && mOK ? 'OK ' : 'MISS'}] ${it.id}  exp=${it.expected.strategy}/${it.expected.model_action} ` +
      `e2e=${got.strategy}/${got.model_action}  sigMAE=${mae.toFixed(2)}`
    );
  }
  const n = items.filter((x) => x.task).length;
  console.log('');
  console.log(`${name}: e2e ROUTE ${routeOK}/${n} (${((routeOK/n)*100).toFixed(0)}%), MODEL ${modelOK}/${n} (${((modelOK/n)*100).toFixed(0)}%), mean|signal MAE=${(maeSum/n).toFixed(2)}`);
  if (misses.length) {
    console.log('miss details:');
    for (const m of misses) console.log(' ', m.id, 'exp=' + m.exp, 'got=' + m.got, 'sigMAE=' + m.mae);
  }
  return { routeOK, n };
}

function main() {
  const v = runSet('VALIDATION (held-out)', VAL);
  const t = runSet('TRAIN (benchmark)', TRAIN);
  const total = v.routeOK + t.routeOK;
  const totalN = v.n + t.n;
  console.log('');
  console.log(`COMBINED e2e route accuracy: ${total}/${totalN} (${((total/totalN)*100).toFixed(0)}%)`);
  // Extraction is expected to be imperfect; we do not fail the build on < 100%, but we do fail
  // on a hard floor so regressions are caught.
  const FLOOR = 0.7;
  const pass = (total / totalN) >= FLOOR;
  console.log(pass ? `EXTRACTION PASS (>= ${FLOOR * 100}% e2e route accuracy)` : `EXTRACTION BELOW FLOOR ${FLOOR * 100}%`);
  process.exit(pass ? 0 : 1);
}

module.exports = { runSet, main };

if (require.main === module) main();
