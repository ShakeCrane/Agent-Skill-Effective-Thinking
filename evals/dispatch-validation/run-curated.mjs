#!/usr/bin/env node
// Dispatch-validation A — does curation save tokens WITHOUT losing attention?
//
// Design: each frozen IFEval prompt (machine-checkable constraints) is embedded as the FIRST
// user message of a long noisy transcript (irrelevant narration + fake tool outputs). The model
// must then produce the constrained response. Three arms:
//   full   — the whole transcript goes upstream;
//   curated — curateConversation(transcript, budget) output (constraints kept, chatter dropped);
//   tail   — naive truncation: only the LAST k messages (may drop the early constraint!).
// Measures: constraint pass rate (deterministic checkers) + prompt tokens. Pre-registered
// expectations: curated ≈ full on pass rate with a large token reduction; tail < full when the
// constraint falls out of the window.
//
// Usage: node run-curated.mjs --model "reflection/beam:free" [--repeats 2] [--concurrency 4]

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiClient, loadSecrets, detectReasoningReplay } from '../external-v3/lib/api.mjs';
import { scoreRow } from '../external-v3/batch1a/checkers.mjs';
import { curateConversation } from '../../context/curate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..'); // evals/dispatch-validation -> evals -> repo root
const SEL = JSON.parse(readFileSync(join(REPO, 'evals', 'external-v3', 'batch1a', 'ifeval-selected.json'), 'utf8'));
const PROFILE_CACHE = join(REPO, '.scratch', 'r5', 'model-profiles.json');

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const model = arg('model');
const repeats = Number(arg('repeats', '2'));
const concurrency = Number(arg('concurrency', '4'));
const CURATE_BUDGET = 900; // tokens for the curated payload
const TAIL_K = 4; // naive truncation keeps the last 4 messages
const FILLER_TURNS = 6; // noise messages between the constraint and the final question
if (!model) { console.error('--model required'); process.exit(2); }

// Deterministic irrelevant filler (same sentence family as the placebo: warehouse docs).
const FILLER_SENTENCES = [
  'The loading plan for outbound trucks is posted ninety minutes before each scheduled departure.',
  'Cold-chain items record two temperatures at intake: the truck reading and the dock-side reading.',
  'The forklift charging schedule alternates night shifts; daytime charging is only for break-glass use.',
  'Serial-numbered goods are scanned twice: once at intake and once at final outbound staging.',
];
function fillerMessages(seed) {
  // ONE merged assistant message: consecutive assistant-role messages hang some providers
  // (observed on beam, 2026-10-25). No plan marker -> classified as chatter by
  // curateConversation, which is exactly what curation should drop.
  const parts = [];
  for (let i = 0; i < FILLER_TURNS; i++) {
    const s = FILLER_SENTENCES[(seed + i) % FILLER_SENTENCES.length];
    if (i % 2 === 0) parts.push(`Note ${i}: ${s} I will check the ledger next.`);
    else parts.push(`Ledger excerpt:\n${'row: qty ok; shelf ok; audit date ok\n'.repeat(10)}`);
  }
  return [{ role: 'assistant', content: parts.join('\n\n') }];
}

function buildTranscript(prompt, seed) {
  return [
    { role: 'user', content: prompt },
    ...fillerMessages(seed),
    { role: 'user', content: 'Now produce the response to the ORIGINAL writing task at the very top of this conversation, following ALL of its requirements. Reply with the response itself only.' },
  ];
}

// Naive baseline: character-level truncation of the serialized transcript (keeps the last
// TAIL_CHARS — typically cuts away the early constraint, which is the failure it exists to show).
const TAIL_CHARS = 1600;
function serialize(msgs) {
  return msgs.map((m) => `[${m.role}]\n${m.content}`).join('\n\n');
}

// Providers can hang on consecutive same-role messages (observed on beam, 2026-10-25); merge
// any that survive curation with a visible separator so no arm depends on provider tolerance.
function mergeConsecutive(msgs) {
  const out = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n\n---\n\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  return out;
}

function armMessages(transcript, arm) {
  if (arm === 'full') return mergeConsecutive(transcript);
  if (arm === 'curated') {
    const { messages } = curateConversation(transcript, CURATE_BUDGET);
    return mergeConsecutive(messages);
  }
  if (arm === 'tail') {
    const flat = serialize(transcript);
    return [{ role: 'user', content: flat.slice(-TAIL_CHARS) }];
  }
  throw new Error(`unknown arm ${arm}`);
}

const slug = model.replace(/[^a-zA-Z0-9._-]/g, '_');
const outDir = join(REPO, '.scratch', 'r5', 'runs', `curated-${slug}`);
mkdirSync(outDir, { recursive: true });
const resultsFile = join(outDir, 'results.jsonl');
const done = new Set();
if (existsSync(resultsFile)) for (const l of readFileSync(resultsFile, 'utf8').trim().split('\n').filter(Boolean)) { try { done.add(JSON.parse(l).runid); } catch {} }

const { baseURL, apiKey } = loadSecrets();
const profiles = existsSync(PROFILE_CACHE) ? JSON.parse(readFileSync(PROFILE_CACHE, 'utf8')) : {};
if (profiles[model] === undefined) {
  const probe = await detectReasoningReplay(baseURL, apiKey, model);
  profiles[model] = { needsReasoningReplay: probe.needsReasoningReplay, probedAt: new Date().toISOString() };
  import('node:fs').then((m) => m.writeFileSync(PROFILE_CACHE, JSON.stringify(profiles, null, 2)));
}
const needsReasoningReplay = !!profiles[model].needsReasoningReplay;

const jobs = [];
SEL.picked.forEach((p, i) => {
  for (const arm of ['full', 'curated', 'tail']) {
    for (let r = 1; r <= repeats; r++) {
      const runid = `k${p.key}__${arm}__r${r}`;
      if (!done.has(runid)) jobs.push({ runid, p, arm, r, i });
    }
  }
});
console.log(`[plan] ${model}: ${SEL.picked.length} prompts x 3 arms x ${repeats} = ${jobs.length} to do`);

let idx = 0, settled = 0;
async function worker() {
  while (idx < jobs.length) {
    const job = jobs[idx++];
    const client = new ApiClient({ baseURL, apiKey, model, needsReasoningReplay, timeoutMs: 60000 });
    let rec;
    try {
      const transcript = buildTranscript(job.p.prompt, job.i);
      const msgs = armMessages(transcript, job.arm);
      const resp = await client.chat(msgs, { maxTokens: 4000 });
      const score = scoreRow(job.p, resp.content);
      rec = {
        runid: job.runid, arm: job.arm, repeat: job.r, key: job.p.key, model,
        promptPass: score.promptPass,
        promptTokens: resp.usage.prompt_tokens || 0, completionTokens: resp.usage.completion_tokens || 0,
        sentMessages: msgs.length,
      };
    } catch (err) {
      rec = { runid: job.runid, arm: job.arm, repeat: job.r, key: job.p.key, model, error: String(err.message).slice(0, 200), promptPass: false };
    }
    appendFileSync(resultsFile, JSON.stringify(rec) + '\n');
    settled++;
    console.log(`[${settled}/${jobs.length}] ${rec.runid} ${rec.arm} pass=${rec.promptPass} ptok=${rec.promptTokens ?? '-'}`);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));

// Inline summary: per-arm pass rate + median prompt tokens + token saving.
const all = readFileSync(resultsFile, 'utf8').trim().split('\n').map(JSON.parse).filter((r) => !r.error);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
console.log('\n=== summary ===');
const stats = {};
for (const arm of ['full', 'curated', 'tail']) {
  const rs = all.filter((r) => r.arm === arm);
  stats[arm] = {
    pass: `${rs.filter((r) => r.promptPass).length}/${rs.length}`,
    medPromptTokens: med(rs.map((r) => r.promptTokens)),
  };
  console.log(`  ${arm.padEnd(8)} pass=${stats[arm].pass} medPromptTokens=${stats[arm].medPromptTokens}`);
}
if (stats.full.medPromptTokens && stats.curated.medPromptTokens) {
  console.log(`  token saving (curated vs full): ${((1 - stats.curated.medPromptTokens / stats.full.medPromptTokens) * 100).toFixed(1)}%`);
}
