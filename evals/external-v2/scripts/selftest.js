#!/usr/bin/env node
// selftest.js — the construction gate for the v2 pilot corpus.
//
// For every pilot task it verifies:
//   * provenance: every primary criterion has a legal, non-vacuous source
//   * Gate A gold pass:   seed + gold      => checker PASS (all primary criteria)
//   * Gate B mutation kill: seed + mutation => checker FAIL, and the FAIL must come from the
//                           criterion the mutation was designed to trigger (no vacuous kills)
//   * seed sanity:        pristine seed    => checker FAIL (each seed ships a real bug)
//   * the checker itself never throws (checkerStatus must be "ok")
//
// Exit code is nonzero if any task fails any gate.
'use strict';
const fs = require('fs');
const path = require('path');
const {
  V2_ROOT, PILOT, listTaskIds, seedDir, evaluatorDir, readJSON, exists, copyDir, tmpdir, ALLOWED_SOURCE_TYPES,
} = require('./lib.js');
const { runCheck } = require('./check-run.js');

function loadApplier(taskId, kind, id) {
  const p = kind === 'gold'
    ? path.join(evaluatorDir(taskId), 'gold', 'index.js')
    : path.join(evaluatorDir(taskId), 'mutations', `${id}.js`);
  if (!exists(p)) throw new Error(`missing ${kind} applier: ${p}`);
  return require(p);
}

// A mutation may supply its transform inline (MUTATIONS[i].apply) or as a separate file
// (mutations/<id>.js). Inline keeps a task's evaluator to one mutations module.
function resolveMutation(taskId, mutation) {
  if (typeof mutation.apply === 'function') return mutation.apply;
  return loadApplier(taskId, 'mutation', mutation.id);
}

async function applyTransform(applier, ws) {
  const fn = typeof applier === 'function' ? applier : applier.apply;
  if (typeof fn !== 'function') throw new Error('applier exports neither a function nor apply()');
  await fn(ws);
}

function checkProvenance(taskId, criteriaDoc, checkerPrimaryIds) {
  const problems = [];
  const entries = Array.isArray(criteriaDoc.criteria) ? criteriaDoc.criteria : [];
  const byId = new Map(entries.map((c) => [c.id, c]));
  for (const id of checkerPrimaryIds) {
    const e = byId.get(id);
    if (!e) { problems.push(`criterion ${id} emitted by checker but missing from criteria.json`); continue; }
    if (e.primary !== true) problems.push(`criterion ${id} is primary in checker but not marked primary:true in criteria.json`);
    if (!ALLOWED_SOURCE_TYPES.has(e.sourceType)) problems.push(`criterion ${id} has illegal sourceType '${e.sourceType}'`);
    if (!e.source || !String(e.source).trim()) problems.push(`criterion ${id} has no source`);
    if (!e.sourceExcerpt || !String(e.sourceExcerpt).trim()) problems.push(`criterion ${id} has no sourceExcerpt`);
    if (!e.description || !String(e.description).trim()) problems.push(`criterion ${id} has no description`);
  }
  const primaryEntries = entries.filter((c) => c.primary === true);
  if (primaryEntries.length === 0) problems.push('criteria.json declares no primary criteria');
  for (const e of primaryEntries) {
    if (!checkerPrimaryIds.includes(e.id)) problems.push(`criteria.json primary ${e.id} is never emitted by the checker`);
  }
  return { problems, primaryCount: primaryEntries.length };
}

async function main() {
  const taskIds = listTaskIds();
  const expected = 12;
  let goldPass = 0, goldTotal = 0, mutKilled = 0, mutTotal = 0, checkerErrors = 0;
  const allProblems = [];
  const perTask = [];

  for (const taskId of taskIds) {
    const t = { taskId, gold: false, mutations: [], pristineFails: false, problems: [] };
    goldTotal += 1;

    // ---------- provenance ----------
    let criteriaDoc;
    try {
      criteriaDoc = readJSON(path.join(evaluatorDir(taskId), 'criteria.json'));
    } catch (e) {
      t.problems.push(`cannot read criteria.json: ${e.message}`);
      allProblems.push(`${taskId}: ${t.problems[t.problems.length - 1]}`);
      perTask.push(t); continue;
    }

    // ---------- gold ----------
    const goldWs = tmpdir(`${taskId}-gold`);
    try {
      copyDir(seedDir(taskId), goldWs);
      await applyTransform(loadApplier(taskId, 'gold'), goldWs);
      const goldRes = await runCheck(taskId, goldWs);
      if (goldRes.checkerStatus !== 'ok') { checkerErrors += 1; t.problems.push('checkerStatus=error on gold'); }
      const prov = checkProvenance(taskId, criteriaDoc, goldRes.criteria.filter((c) => c.primary).map((c) => c.id));
      prov.problems.forEach((p) => t.problems.push(p));
      if (goldRes.taskPass && goldRes.primaryPassed === goldRes.primaryTotal) {
        goldPass += 1; t.gold = true;
      } else {
        t.problems.push(`GOLD did not pass (${goldRes.primaryPassed}/${goldRes.primaryTotal}); failing=${JSON.stringify(goldRes.criteria.filter((c) => !c.passed).map((c) => c.id))}`);
      }
      t.primaryTotal = goldRes.primaryTotal;
    } catch (e) {
      t.problems.push(`gold stage threw: ${e.message}`);
    } finally { fs.rmSync(goldWs, { recursive: true, force: true }); }

    // ---------- pristine seed must fail ----------
    const priWs = tmpdir(`${taskId}-pristine`);
    try {
      copyDir(seedDir(taskId), priWs);
      const priRes = await runCheck(taskId, priWs);
      if (priRes.checkerStatus !== 'ok') { checkerErrors += 1; t.problems.push('checkerStatus=error on pristine'); }
      if (!priRes.taskPass) t.pristineFails = true;
      else t.problems.push('PRISTINE seed unexpectedly PASSES (no real bug in the seed)');
    } catch (e) {
      t.problems.push(`pristine stage threw: ${e.message}`);
    } finally { fs.rmSync(priWs, { recursive: true, force: true }); }

    // ---------- mutations ----------
    let mutations = [];
    try {
      mutations = require(path.join(evaluatorDir(taskId), 'mutations', 'index.js')).MUTATIONS || [];
    } catch (e) {
      t.problems.push(`cannot load mutations/index.js: ${e.message}`);
    }
    if (mutations.length < 2) t.problems.push(`needs >=2 mutations, found ${mutations.length}`);
    for (const m of mutations) {
      mutTotal += 1;
      const mWs = tmpdir(`${taskId}-${m.id}`);
      const rec = { id: m.id, expectedKilledBy: m.expectedKilledBy || [], failed: [], killed: false };
      try {
        copyDir(seedDir(taskId), mWs);
        await applyTransform(resolveMutation(taskId, m), mWs);
        const res = await runCheck(taskId, mWs);
        if (res.checkerStatus !== 'ok') { checkerErrors += 1; rec.problem = 'checkerStatus=error'; }
        rec.failed = res.criteria.filter((c) => c.primary && !c.passed).map((c) => c.id);
        const expectedIds = rec.expectedKilledBy || [];
        const missing = expectedIds.filter((id) => !rec.failed.includes(id));
        if (!res.taskPass && rec.failed.length > 0 && missing.length === 0) { rec.killed = true; mutKilled += 1; }
        else if (res.taskPass) rec.problem = 'mutation NOT killed (checker passed)';
        else if (rec.failed.length === 0) rec.problem = 'mutation failed only outside primary criteria (vacuous kill)';
        else rec.problem = `expected criteria not the ones that failed; missing=${JSON.stringify(missing)}`;
      } catch (e) {
        rec.problem = `mutation stage threw: ${e.message}`;
      } finally { fs.rmSync(mWs, { recursive: true, force: true }); }
      t.mutations.push(rec);
      if (rec.problem) t.problems.push(`mutation ${m.id}: ${rec.problem}`);
    }

    t.problems.forEach((p) => allProblems.push(`${taskId}: ${p}`));
    perTask.push(t);
  }

  // ---------- report ----------
  console.log('V2 PILOT SELFTEST');
  console.log('');
  for (const t of perTask) {
    const marks = [
      `gold=${t.gold ? 'PASS' : 'FAIL'}`,
      `pristine=${t.pristineFails ? 'fails(ok)' : 'PASSES(bad)'}`,
      `mutations=${t.mutations.filter((m) => m.killed).length}/${t.mutations.length}`,
    ];
    console.log(`${t.problems.length === 0 ? '[OK  ]' : '[FAIL]'} ${t.taskId.padEnd(30)} ${marks.join('  ')}`);
    if (t.problems.length) t.problems.forEach((p) => console.log(`         - ${p}`));
  }
  console.log('');
  console.log(`${goldPass}/${goldTotal} gold pass`);
  console.log(`${mutKilled}/${mutTotal} mutations killed`);
  console.log(`${allProblems.filter((p) => /provenance|criterion|sourceType|sourceExcerpt/.test(p)).length === 0 ? 'all primary criteria provenance-valid' : 'PROVENANCE PROBLEMS'}`);
  console.log(`${checkerErrors} checker errors`);
  console.log('');

  const ok = taskIds.length === expected && goldPass === goldTotal && mutKilled === mutTotal && allProblems.length === 0 && checkerErrors === 0;
  if (ok) {
    console.log('V2 PILOT CONSTRUCTION PASS');
    process.exit(0);
  }
  if (taskIds.length !== expected) console.log(`TASK COUNT PROBLEM: expected ${expected}, found ${taskIds.length}`);
  allProblems.forEach((p) => console.log(`PROBLEM: ${p}`));
  console.log('V2 PILOT CONSTRUCTION FAIL');
  process.exit(1);
}

if (require.main === module) main().catch((e) => { console.error('selftest crashed:', e); process.exit(1); });
