#!/usr/bin/env node
// Batch 1a runner — single-turn constraint-following runs on the FROZEN IFEval selection,
// 4 arms (same injection texts as batch 0, adapted to single-turn chat without the TASK.md
// wrapper) + a signal-calibration arm (model self-reports the router profile per prompt).
//
// Usage: node run-1a.mjs --model "reflection/beam:free" [--repeats 2] [--concurrency 4]
//   [--calibration-only | --arms-only]

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiClient, loadSecrets, detectReasoningReplay } from '../lib/api.mjs';
import { scoreRow } from './checkers.mjs';
import { FROZEN_SKILL, PLACEBO } from '../lib/v2tasks.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SEL = JSON.parse(readFileSync(join(HERE, 'ifeval-selected.json'), 'utf8'));
const PROFILE_CACHE = join(REPO, '.scratch', 'r5', 'model-profiles.json');

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const model = arg('model');
const repeats = Number(arg('repeats', '2'));
const concurrency = Number(arg('concurrency', '4'));
const calibrationOnly = process.argv.includes('--calibration-only');
const armsOnly = process.argv.includes('--arms-only');
if (!model) { console.error('--model required'); process.exit(2); }

const slug = model.replace(/[^a-zA-Z0-9._-]/g, '_');
const outDir = join(REPO, '.scratch', 'r5', 'runs', `batch1a-${slug}`);
mkdirSync(outDir, { recursive: true });
const resultsFile = join(outDir, 'results.jsonl');
const done = new Set();
if (existsSync(resultsFile)) {
  for (const line of readFileSync(resultsFile, 'utf8').trim().split('\n').filter(Boolean)) {
    try { done.add(JSON.parse(line).runid); } catch {}
  }
}
const { baseURL, apiKey } = loadSecrets();
const profiles = existsSync(PROFILE_CACHE) ? JSON.parse(readFileSync(PROFILE_CACHE, 'utf8')) : {};
let needsReasoningReplay = !!profiles[model]?.needsReasoningReplay;
if (profiles[model] === undefined) {
  const probe = await detectReasoningReplay(baseURL, apiKey, model);
  needsReasoningReplay = probe.needsReasoningReplay;
  profiles[model] = { needsReasoningReplay, probedAt: new Date().toISOString() };
  writeFileSync(PROFILE_CACHE, JSON.stringify(profiles, null, 2));
}

// Arm injection for single-turn chat (texts identical to batch 0 payloads).
function armUserText(prompt, arm) {
  if (arm === 'controlA') return prompt;
  if (arm === 'controlB') return `${prompt}\n\n# Working guidance\n\n先确认任务目标和约束，再执行；完成后用最直接可靠的方法验证结果。不要做与任务无关的改动。\n`;
  if (arm === 'controlC') return `${prompt}\n\n# Cognitive Skill\n\n${PLACEBO}`;
  if (arm === 'treatment') return `${prompt}\n\n# Cognitive Skill\n\n${FROZEN_SKILL}`;
  throw new Error(`unknown arm ${arm}`);
}

const jobs = [];
if (!calibrationOnly) {
  for (const p of SEL.picked) {
    for (const arm of ['controlA', 'controlB', 'controlC', 'treatment']) {
      for (let r = 1; r <= repeats; r++) {
        const runid = `k${p.key}__${arm}__r${r}`;
        if (!done.has(runid)) jobs.push({ kind: 'arm', runid, p, arm, r });
      }
    }
  }
}
if (!armsOnly) {
  for (const p of SEL.picked) {
    const runid = `k${p.key}__calibration`;
    if (!done.has(runid)) jobs.push({ kind: 'calibration', runid, p });
  }
}

const CAL_SYS = 'You estimate task properties. Reply with ONE JSON object only, no other text.';
const CAL_USER = (prompt) => `Task:\n"""\n${prompt}\n"""\n\nEstimate for this task: clarity, hidden_constraint, constraint_count, reasoning_complexity, error_cost, verification_difficulty.\nclarity, hidden_constraint, reasoning_complexity, error_cost and verification_difficulty are numbers between 0.0 and 1.0; constraint_count is an integer.\nReply with exactly one JSON object with those six keys.`;

function parseLooseJSON(text) {
  if (!text) return null;
  const s = text.replace(/```(?:json)?/gi, '');
  const i = s.indexOf('{');
  if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) { try { return JSON.parse(s.slice(i, k + 1)); } catch { return null; } } }
  }
  return null;
}

let idx = 0, settled = 0;
async function worker() {
  while (idx < jobs.length) {
    const job = jobs[idx++];
    const client = new ApiClient({ baseURL, apiKey, model, needsReasoningReplay, timeoutMs: 120000 });
    let rec;
    try {
      if (job.kind === 'arm') {
        const resp = await client.chat([{ role: 'user', content: armUserText(job.p.prompt, job.arm) }], { maxTokens: 4000 });
        const score = scoreRow(job.p, resp.content);
        rec = {
          runid: job.runid, kind: 'arm', key: job.p.key, level: job.p.level, arm: job.arm, repeat: job.r, model,
          promptPass: score.promptPass, perInstruction: score.perInstruction,
          contentLen: resp.content.length, usage: resp.usage, retries: client.stats.retries,
        };
      } else {
        const resp = await client.chat(
          [{ role: 'system', content: CAL_SYS }, { role: 'user', content: CAL_USER(job.p.prompt) }],
          { maxTokens: 1500 },
        );
        const est = parseLooseJSON(resp.content);
        rec = {
          runid: job.runid, kind: 'calibration', key: job.p.key, level: job.p.level, model,
          truth: { constraint_count: job.p.instruction_id_list.length },
          estimate: est, parseOK: !!est, contentLen: resp.content.length,
        };
      }
    } catch (err) {
      rec = { runid: job.runid, kind: job.kind, key: job.p.key, arm: job.arm || null, model, error: String(err.message).slice(0, 200) };
    }
    // Append-only journal (synchronous append serializes concurrent workers).
    const line = JSON.stringify(rec) + '\n';
    appendFileSync(resultsFile, line);
    settled++;
    console.log(`[${settled}/${jobs.length}] ${rec.runid} ${rec.kind === 'arm' ? `${rec.arm} pass=${rec.promptPass}` : `cal parseOK=${rec.parseOK}`}`);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
console.log(`\n[done] ${settled} settled -> ${resultsFile}`);
