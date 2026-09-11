#!/usr/bin/env node
// Phase 2 external behavioral evaluation harness.
//
// This script does NOT dispatch model runs (that is done by the main agent, one fresh-context
// subagent per run). It does everything that must be mechanical and tamper-evident:
//
//   prepare <taskId> <runId>   create an isolated workspace seeded with the task fixtures
//                              (outside the repo, so agent artifacts never pollute the project)
//   check   <taskId> <runId>   run the FROZEN deterministic checker + measure artifacts
//   record  <runId> ...        append one metrics row to results.jsonl (append-only)
//   order   [--seed N]         generate the randomized/interleaved run order ONCE
//   seal    <runId> <cond>     write the sealed condition map (never shown to reviewers)
//   report                     aggregate results by condition and category
//
// Design notes that matter for evidence quality:
//  - Workspaces live in OS temp, never in the repo (repo convergence + no cross-run contamination).
//  - Checkers are separate modules committed BEFORE any run; `check` never edits them.
//  - `check` also measures file churn / bytes / tamper signals, so "deleted the test" style
//    cheating is detectable rather than merely hoped-against.

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..');
const FIXTURES = path.join(HERE, 'fixtures');
const RUNS_ROOT = path.join(os.tmpdir(), 'cog-skill-eval');
const RESULTS = path.join(HERE, 'results.jsonl');
const ORDER_FILE = path.join(HERE, 'run-order.json');
const SEAL_FILE = path.join(HERE, 'condition-seal.json');

function wsPath(runId) { return path.join(RUNS_ROOT, runId); }

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

function prepare(taskId, runId) {
  const src = path.join(FIXTURES, taskId);
  if (!fs.existsSync(src)) throw new Error(`no fixtures for task ${taskId}`);
  const ws = wsPath(runId);
  if (fs.existsSync(ws)) fs.rmSync(ws, { recursive: true, force: true });
  copyDir(src, ws);
  const baseline = walk(ws).sort();
  fs.writeFileSync(path.join(RUNS_ROOT, runId + '.baseline.json'),
    JSON.stringify({ taskId, runId, baseline }, null, 2));
  console.log(ws);
  return ws;
}

// Artifact measurement: what the run actually produced (size/churn), plus tamper evidence.
// The run prompt (TASK.md) is injected into the workspace for dispatch symmetry, but it is not an
// artifact the agent produced — and for the treatment condition it literally contains SKILL.md.
// Counting it would inflate the verbosity/cost metric by ~7 KB for treatment only. Excluded.
const INJECTED = new Set(['TASK.md']);

function measure(taskId, runId) {
  const ws = wsPath(runId);
  if (!fs.existsSync(ws)) return { files: 0, bytes: 0, created: [], deleted: [] };
  const baselinePath = path.join(RUNS_ROOT, runId + '.baseline.json');
  const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')).baseline : [];
  const now = walk(ws).sort().filter((f) => !INJECTED.has(f));
  let bytes = 0;
  for (const f of now) {
    try { bytes += fs.statSync(path.join(ws, f)).size; } catch (e) { /* ignore */ }
  }
  return {
    files: now.length,
    bytes,
    created: now.filter((f) => !baseline.includes(f)),
    deleted: baseline.filter((f) => !now.includes(f)),
  };
}

async function check(taskId, runId) {
  const { CHECKERS } = require('./checkers.js');
  const fn = CHECKERS[taskId];
  if (!fn) throw new Error(`no checker for task ${taskId}`);
  const ws = wsPath(runId);
  // A checker that throws is a FAILURE OF THE RUN, not a harness crash: record it as evidence.
  let res;
  try {
    res = await fn(ws);
  } catch (e) {
    res = { pass: false, criteria: [{ id: 'harness.error', name: 'checker ran without error', pass: false, detail: String(e.message).slice(0, 200) }] };
  }
  const m = measure(taskId, runId);
  const out = {
    taskId, runId,
    pass: !!res.pass,
    criteria: res.criteria || [],
    notes: res.notes || null,
    tamper: res.tamper || null,
    artifacts: m,
  };
  console.log(JSON.stringify(out, null, 2));
  return out;
}

function record(argv) {
  const get = (k, d) => {
    const i = argv.indexOf('--' + k);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d;
  };
  const row = {
    ts: new Date().toISOString(),
    runId: get('run'),
    taskId: get('task'),
    condition: get('condition'),
    startedAt: get('startedAt', null),
    endedAt: get('endedAt', null),
    elapsedMs: get('elapsedMs', null) === null ? null : Number(get('elapsedMs')),
    status: get('status', 'completed'),
    path: get('path', null),
  };
  fs.appendFileSync(RESULTS, JSON.stringify(row) + '\n');
  console.log('recorded', row.runId, row.condition);
}

// Deterministic seeded shuffle (mulberry32) so the run order is reproducible and generated once,
// conditions interleaved per task (no systematic "control always first").
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function order(argv) {
  const seedIdx = argv.indexOf('--seed');
  const seed = seedIdx >= 0 ? Number(argv[seedIdx + 1]) : 20260909;
  const { ITEMS } = require('./corpus.js');
  const CONDITIONS = ['controlA', 'controlB', 'treatment'];
  const tasks = ITEMS.map((t) => t.task_id);
  const rand = rng(seed);
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }
  const runs = [];
  tasks.forEach((taskId, i) => {
    // rotate the condition order per task so no condition is always first
    const rot = i % CONDITIONS.length;
    const conds = CONDITIONS.slice(rot).concat(CONDITIONS.slice(0, rot));
    const shuffled = conds.slice();
    for (let k = shuffled.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]];
    }
    shuffled.forEach((condition, c) => {
      runs.push({ seq: runs.length + 1, taskId, condition, runId: `${taskId}__${condition}` });
    });
  });
  fs.writeFileSync(ORDER_FILE, JSON.stringify({ seed, generatedAt: new Date().toISOString(), runs }, null, 2));
  console.log(`run-order.json written: ${runs.length} runs (seed ${seed})`);
  console.log(runs.slice(0, 6).map((r) => `${r.seq}. ${r.runId}`).join('\n'));
}

function seal(runId, condition) {
  const map = fs.existsSync(SEAL_FILE) ? JSON.parse(fs.readFileSync(SEAL_FILE, 'utf8')) : {};
  map[runId] = condition;
  fs.writeFileSync(SEAL_FILE, JSON.stringify(map, null, 2));
  console.log('sealed', runId, '->', condition);
}

function report() {
  if (!fs.existsSync(RESULTS)) { console.log('no results yet'); return; }
  const rows = fs.readFileSync(RESULTS, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const { ITEMS } = require('./corpus.js');
  const catOf = Object.fromEntries(ITEMS.map((t) => [t.task_id, t.category]));
  const byCond = {};
  for (const r of rows) {
    const c = r.condition || 'unknown';
    byCond[c] = byCond[c] || { n: 0, pass: 0, completed: 0 };
    byCond[c].n += 1;
    if (r.status === 'completed') byCond[c].completed += 1;
    if (r.pass) byCond[c].pass += 1;
  }
  console.log('== by condition ==');
  for (const [c, v] of Object.entries(byCond)) {
    console.log(`  ${c.padEnd(10)} runs=${v.n} completed=${v.completed} pass=${v.pass}` + (v.n ? ` (${((v.pass / v.n) * 100).toFixed(0)}%)` : ''));
  }
  const byCat = {};
  for (const r of rows) {
    const k = (catOf[r.taskId] || '?') + ' | ' + (r.condition || '?');
    byCat[k] = byCat[k] || { n: 0, pass: 0 };
    byCat[k].n += 1;
    if (r.pass) byCat[k].pass += 1;
  }
  console.log('\n== by category x condition ==');
  for (const k of Object.keys(byCat).sort()) {
    console.log(`  ${k.padEnd(24)} ${byCat[k].pass}/${byCat[k].n}`);
  }
}

// batch <fromSeq> <toSeq>: prepare + write prompt + mark start for a slice of the frozen run
// order, and print one line per run (runId | condition | workspace). Dispatch order stays frozen.
async function batch(from, to) {
  const { runs } = JSON.parse(fs.readFileSync(ORDER_FILE, 'utf8'));
  const { execFileSync } = require('child_process');
  // prepare() WIPES the workspace, so never re-prepare a run that already has a recorded result —
  // that would destroy completed artifacts while their metrics stay in the log.
  const done = new Set();
  if (fs.existsSync(RESULTS)) {
    for (const line of fs.readFileSync(RESULTS, 'utf8').trim().split('\n').filter(Boolean)) {
      try { done.add(JSON.parse(line).runId); } catch (e) { /* ignore malformed */ }
    }
  }
  for (const r of runs.filter((x) => x.seq >= from && x.seq <= to)) {
    if (done.has(r.runId)) { console.log(`# skip (already judged): ${r.runId}`); continue; }
    const ws = prepare(r.taskId, r.runId);
    // prompts.js writes TASK.md; we don't need its stdout (we already hold `ws`). stdio:'ignore'
    // avoids the sandbox EPERM on piped child stdout (same harness-env fix class as M6).
    execFileSync(process.execPath, [path.join(HERE, 'prompts.js'), 'write', r.taskId, r.runId, r.condition, ws], { stdio: 'ignore' });
    fs.writeFileSync(path.join(RUNS_ROOT, r.runId + '.start'), String(Date.now()));
    console.log(`${r.runId}|${r.condition}|${ws}`);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'prepare') prepare(rest[0], rest[1]);
  else if (cmd === 'check') await check(rest[0], rest[1]);
  else if (cmd === 'judge') await judge(rest[0], rest[1], rest.slice(2));
  else if (cmd === 'batch') await batch(Number(rest[0]), Number(rest[1]));
  else if (cmd === 'start') { fs.mkdirSync(RUNS_ROOT, { recursive: true }); fs.writeFileSync(path.join(RUNS_ROOT, rest[0] + '.start'), String(Date.now())); console.log('start ' + rest[0]); }
  else if (cmd === 'record') record(rest);
  else if (cmd === 'order') order(rest);
  else if (cmd === 'seal') seal(rest[0], rest[1]);
  else if (cmd === 'report') report();
  else {
    console.log('usage: harness.js prepare|check|record|order|seal|report ...');
    process.exit(1);
  }
}

// judge: run the checker AND append the full result row in one step (so a checked run cannot be
// silently forgotten). This is the command used after every real run.
async function judge(taskId, runId, argv) {
  const get = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
  const res = await check(taskId, runId);
  const crit = res.criteria || [];
  // Only GATING criteria decide pass/fail. Criteria flagged `secondary` are recorded as separate
  // process signals (see checkers.js j1) so an unstated stylistic expectation cannot decide a task.
  const gating = crit.filter((c) => !c.secondary);
  // Wall-clock proxy: dispatch marks a start timestamp before the run, judge closes it here.
  // (True token cost is NOT measurable in this environment and is recorded as unknown, not guessed.)
  let elapsed = get('elapsedMs', null) === null ? null : Number(get('elapsedMs'));
  if (elapsed === null) {
    const sp = path.join(RUNS_ROOT, runId + '.start');
    if (fs.existsSync(sp)) elapsed = Date.now() - Number(fs.readFileSync(sp, 'utf8'));
  }
  const row = {
    ts: new Date().toISOString(),
    runId, taskId,
    condition: get('condition', 'unknown'),
    status: get('status', 'completed'),
    pass: gating.every((c) => c.pass) && !res.tamper,
    criteriaTotal: gating.length,
    criteriaPassed: gating.filter((c) => c.pass).length,
    failedCriteria: gating.filter((c) => !c.pass).map((c) => c.id),
    secondaryPassed: crit.filter((c) => c.secondary && c.pass).length,
    secondaryTotal: crit.filter((c) => c.secondary).length,
    tamper: res.tamper || null,
    files: res.artifacts.files,
    bytes: res.artifacts.bytes,
    created: res.artifacts.created.length,
    deleted: res.artifacts.deleted.length,
    elapsedMs: elapsed,
    notes: res.notes || null,
  };
  fs.appendFileSync(RESULTS, JSON.stringify(row) + '\n');
  console.log('\n--- judged ---');
  console.log(JSON.stringify(row, null, 2));
  return row;
}

if (require.main === module) main().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
module.exports = { prepare, check, judge, measure, record, report, wsPath };
