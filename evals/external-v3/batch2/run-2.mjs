#!/usr/bin/env node
// Batch 2 (math reasoning domain) — GSM8K subset, 4 arms, single-turn, exact numeric grading.
// Deterministic selection: rows at fixed stride (no prompt peeking, no difficulty labels).
//
// Usage: node run-2.mjs --model "reflection/beam:free" [--repeats 2] [--concurrency 4]

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiClient, loadSecrets, detectReasoningReplay } from '../lib/api.mjs';
import { FROZEN_SKILL, PLACEBO } from '../lib/v2tasks.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SRC = join(REPO, '.scratch', 'r5', 'data', 'gsm8k-test.jsonl');
const N = 40, STRIDE = 33; // deterministic: rows[0], rows[33], ... rows[1287]

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const model = arg('model');
const repeats = Number(arg('repeats', '2'));
const concurrency = Number(arg('concurrency', '4'));
if (!model) { console.error('--model required'); process.exit(2); }

const rows = readFileSync(SRC, 'utf8').trim().split('\n').map(JSON.parse);
const picked = Array.from({ length: N }, (_, i) => rows[i * STRIDE]).filter(Boolean);
const goldNum = (a) => {
  const m = a.match(/####\s*(-?[\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};
const lastNum = (s) => {
  const m = (s || '').match(/(-?\$?\d[\d,]*(?:\.\d+)?)/g);
  return m ? Number(m[m.length - 1].replace(/[$,]/g, '')) : null;
};

function armUserText(q, arm) {
  const SUFFIX = '\n\nEnd your reply with a line of the form "Final answer: <number>".';
  if (arm === 'controlA') return q + SUFFIX;
  if (arm === 'controlB') return `${q}${SUFFIX}\n\n# Working guidance\n\n先确认任务目标和约束，再执行；完成后用最直接可靠的方法验证结果。不要做与任务无关的改动。\n`;
  if (arm === 'controlC') return `${q}${SUFFIX}\n\n# Cognitive Skill\n\n${PLACEBO}`;
  if (arm === 'treatment') return `${q}${SUFFIX}\n\n# Cognitive Skill\n\n${FROZEN_SKILL}`;
  throw new Error(`unknown arm ${arm}`);
}

const slug = model.replace(/[^a-zA-Z0-9._-]/g, '_');
const outDir = join(REPO, '.scratch', 'r5', 'runs', `batch2-${slug}`);
mkdirSync(outDir, { recursive: true });
const resultsFile = join(outDir, 'results.jsonl');
const done = new Set();
if (existsSync(resultsFile)) for (const l of readFileSync(resultsFile, 'utf8').trim().split('\n').filter(Boolean)) { try { done.add(JSON.parse(l).runid); } catch {} }

const { baseURL, apiKey } = loadSecrets();
const PROFILE_CACHE = join(REPO, '.scratch', 'r5', 'model-profiles.json');
const profiles = existsSync(PROFILE_CACHE) ? JSON.parse(readFileSync(PROFILE_CACHE, 'utf8')) : {};
if (profiles[model] === undefined) {
  const probe = await detectReasoningReplay(baseURL, apiKey, model);
  profiles[model] = { needsReasoningReplay: probe.needsReasoningReplay, probedAt: new Date().toISOString() };
  writeFileSync(PROFILE_CACHE, JSON.stringify(profiles, null, 2));
}
const needsReasoningReplay = !!profiles[model].needsReasoningReplay;

const jobs = [];
picked.forEach((p, i) => {
  for (const arm of ['controlA', 'controlB', 'controlC', 'treatment']) {
    for (let r = 1; r <= repeats; r++) {
      const runid = `g${i}__${arm}__r${r}`;
      if (!done.has(runid)) jobs.push({ runid, p, i, arm, r });
    }
  }
});
console.log(`[plan] ${model}: ${picked.length} prompts x 4 arms x ${repeats} = ${jobs.length} to do`);

let idx = 0, settled = 0;
async function worker() {
  while (idx < jobs.length) {
    const job = jobs[idx++];
    const client = new ApiClient({ baseURL, apiKey, model, needsReasoningReplay, timeoutMs: 120000 });
    let rec;
    try {
      const gold = goldNum(job.p.answer);
      const resp = await client.chat([{ role: 'user', content: armUserText(job.p.question, job.arm) }], { maxTokens: 2500 });
      const got = lastNum(resp.content);
      rec = {
        runid: job.runid, item: job.i, arm: job.arm, repeat: job.r, model,
        gold, got, correct: gold !== null && got !== null && Math.abs(got - gold) < 1e-6,
        contentLen: resp.content.length, usage: resp.usage, retries: client.stats.retries,
      };
    } catch (err) {
      rec = { runid: job.runid, item: job.i, arm: job.arm, repeat: job.r, model, error: String(err.message).slice(0, 200), correct: false };
    }
    appendFileSync(resultsFile, JSON.stringify(rec) + '\n');
    settled++;
    console.log(`[${settled}/${jobs.length}] ${rec.runid} ${rec.arm} correct=${rec.correct}`);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));

// Inline mini-summary.
const all = readFileSync(resultsFile, 'utf8').trim().split('\n').map(JSON.parse).filter((r) => !r.error);
const ARMS = ['controlA', 'controlB', 'controlC', 'treatment'];
console.log('\n=== summary ===');
for (const arm of ARMS) {
  const rs = all.filter((r) => r.arm === arm);
  console.log(`  ${arm}: ${rs.filter((r) => r.correct).length}/${rs.length}`);
}
const items = [...new Set(all.map((r) => r.item))];
let dis = 0;
for (const it of items) {
  const rates = ARMS.map((a) => { const rs = all.filter((r) => r.item === it && r.arm === a); return rs.length ? rs.filter((r) => r.correct).length / rs.length : null; });
  if (rates.every((x) => x !== null) && new Set(rates).size > 1) dis++;
}
console.log(`disagreement: ${dis}/${items.length}`);
