#!/usr/bin/env node
// Round-5 batch runner — executes the (task × arm × repeat) run matrix with a worker pool,
// checkpointing every completed run to disk (resume = skip runs whose result.json exists).
// Per-run outputs under <out>/<runid>/: ws/ (workspace), transcript.json, telemetry.json,
// result.json. A manifest.jsonl (one line per settled run) drives aggregation.
//
// Usage:
//   node run-batch.mjs --model "reflection/beam:free" --arms controlA,controlB,controlC,treatment \
//     --repeats 3 --out ../../../.scratch/r5/runs/batch0 [--concurrency 4] [--tasks v2-01-redaction,...]

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiClient, loadSecrets, sha256, detectReasoningReplay } from './lib/api.mjs';
import { runEpisode } from './lib/agent.mjs';
import { prepareWorkspace, runChecker, v2TaskIds, FROZEN_SKILL, PLACEBO } from './lib/v2tasks.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PROFILE_CACHE = join(REPO, '.scratch', 'r5', 'model-profiles.json');

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const model = arg('model');
const arms = arg('arms', 'controlA,controlB,controlC,treatment').split(',');
const repeats = Number(arg('repeats', '3'));
// Absolute always: v2 checkers require() workspace files, and require() resolves relative
// specifiers against the CALLING MODULE, not cwd — a relative out dir silently breaks every
// require-based checker (found the hard way, 2026-10-24; see failure log F20).
const outRoot = resolve(arg('out', join(REPO, '.scratch', 'r5', 'runs', 'batch0')));
const concurrency = Number(arg('concurrency', '4'));
const onlyTasks = arg('tasks', '').split(',').filter(Boolean);
if (!model) { console.error('--model is required'); process.exit(2); }

const modelSlug = model.replace(/[^a-zA-Z0-9._-]/g, '_');
const { baseURL, apiKey } = loadSecrets();
mkdirSync(outRoot, { recursive: true });

// One-time per-model quirk detection, cached on disk.
function loadProfiles() { try { return JSON.parse(readFileSync(PROFILE_CACHE, 'utf8')); } catch { return {}; } }
let needsReasoningReplay;
{
  const profiles = loadProfiles();
  if (profiles[model]?.settled) needsReasoningReplay = !!profiles[model].needsReasoningReplay;
}
if (needsReasoningReplay === undefined) {
  const probe = await detectReasoningReplay(baseURL, apiKey, model);
  needsReasoningReplay = probe.needsReasoningReplay;
  const profiles = loadProfiles();
  profiles[model] = { needsReasoningReplay, probedAt: new Date().toISOString() };
  writeFileSync(PROFILE_CACHE, JSON.stringify(profiles, null, 2));
  console.log(`[quirk] ${model}: needsReasoningReplay=${needsReasoningReplay}`);
}

const tasks = onlyTasks.length ? onlyTasks : v2TaskIds();
const runList = [];
for (const task of tasks) {
  for (const arm of arms) {
    for (let r = 1; r <= repeats; r++) {
      const runid = `${task}__${arm}__r${r}__${modelSlug}`;
      const dir = join(outRoot, runid);
      if (existsSync(join(dir, 'result.json'))) continue; // resume
      runList.push({ task, arm, repeat: r, runid, dir });
    }
  }
}
console.log(`[plan] model=${model} tasks=${tasks.length} arms=${arms.join('+')} repeats=${repeats} -> ${runList.length} runs to do`);

async function doRun(job) {
  mkdirSync(job.dir, { recursive: true });
  const ws = join(job.dir, 'ws');
  try {
    prepareWorkspace(job.task, job.arm, ws);
  } catch (err) {
    const rec = { runid: job.runid, task: job.task, arm: job.arm, repeat: job.repeat, model, status: 'prepare_error', error: err.message, taskPass: false };
    writeFileSync(join(job.dir, 'result.json'), JSON.stringify(rec, null, 2));
    appendFileSync(join(outRoot, 'manifest.jsonl'), JSON.stringify(rec) + '\n');
    return rec;
  }
  // Fresh client per episode so telemetry counts only this run's calls.
  const client = new ApiClient({ baseURL, apiKey, model, needsReasoningReplay });
  const { telemetry, transcript } = await runEpisode({ client, wsRoot: ws });

  let taskPass = false, criteria = [], checkerError = null;
  // Always score the workspace: a partial state left by a degenerate/turn-capped run is still
  // the agent's real final state (checkers throw on missing files -> recorded as taskPass=false).
  try {
    const verdict = await runChecker(job.task, ws);
    taskPass = !!verdict.taskPass;
    criteria = (verdict.criteria || []).map((c) => ({ id: c.id, passed: c.passed }));
  } catch (err) {
    checkerError = err.message;
  }
  const rec = {
    runid: job.runid, task: job.task, arm: job.arm, repeat: job.repeat, model,
    status: telemetry.status, taskPass, checkerError,
    criteria, telemetry: { ...telemetry, tokens: client.stats.tokens, api_calls: client.stats.calls, api_retries: client.stats.retries },
    armPayloadSha: sha256(job.arm === 'treatment' ? FROZEN_SKILL : job.arm === 'controlC' ? PLACEBO : ''),
  };
  writeFileSync(join(job.dir, 'result.json'), JSON.stringify(rec, null, 2));
  writeFileSync(join(job.dir, 'telemetry.json'), JSON.stringify(telemetry, null, 2));
  writeFileSync(join(job.dir, 'transcript.json'), JSON.stringify(transcript.map((m) => ({ role: m.role, content: (m.content || '').slice(0, 4000) })), null, 2));
  appendFileSync(join(outRoot, 'manifest.jsonl'), JSON.stringify({ runid: rec.runid, task: rec.task, arm: rec.arm, repeat: rec.repeat, status: rec.status, taskPass: rec.taskPass }) + '\n');
  return rec;
}

let done = 0, idx = 0;
const results = [];
async function worker() {
  while (idx < runList.length) {
    const job = runList[idx++];
    let rec;
    try { rec = await doRun(job); }
    catch (err) {
      rec = { runid: job.runid, task: job.task, arm: job.arm, repeat: job.repeat, model, status: `runner_error: ${String(err.message).slice(0, 200)}`, taskPass: false };
      try {
        writeFileSync(join(job.dir, 'result.json'), JSON.stringify(rec, null, 2));
        appendFileSync(join(outRoot, 'manifest.jsonl'), JSON.stringify({ runid: rec.runid, task: rec.task, arm: rec.arm, repeat: rec.repeat, status: rec.status, taskPass: false }) + '\n');
      } catch { /* disk issue — surface below */ }
    }
    done++;
    results.push(rec);
    console.log(`[${done}/${runList.length}] ${rec.runid} -> ${rec.status} pass=${rec.taskPass} turns=${rec.telemetry?.turns ?? '-'}`);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, runList.length) }, worker));

const pass = results.filter((r) => r.taskPass).length;
console.log(`\n[summary] settled=${results.length} pass=${pass} fail=${results.length - pass}`);
