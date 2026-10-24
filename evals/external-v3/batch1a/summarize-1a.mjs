#!/usr/bin/env node
// Batch 1a summarizer — discrimination-band check, per-prompt arm disagreement, cost per arm,
// and the signal-calibration analysis: model self-report vs ground truth vs the repo's keyword
// extractor (router/extract.js) on the same prompts.
//
// Usage: node summarize-1a.mjs <resultsDir>   (e.g. .scratch/r5/runs/batch1a-reflection_beam_free)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const runsDir = process.argv[2];
if (!runsDir || !existsSync(join(runsDir, 'results.jsonl'))) { console.error('usage: node summarize-1a.mjs <resultsDir>'); process.exit(2); }

const rows = readFileSync(join(runsDir, 'results.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const arms = rows.filter((r) => r.kind === 'arm' && !r.error);
const cal = rows.filter((r) => r.kind === 'calibration' && !r.error);
const sel = JSON.parse(readFileSync(join(HERE, 'ifeval-selected.json'), 'utf8'));
const promptByKey = new Map(sel.picked.map((p) => [p.key, p]));

// ---- Pass rates per arm (overall + by level) ----
const ARMS = ['controlA', 'controlB', 'controlC', 'treatment'];
function rate(rs) { return rs.length ? `${rs.filter((r) => r.promptPass).length}/${rs.length}` : '-'; }
const perArm = ARMS.map((arm) => {
  const rs = arms.filter((r) => r.arm === arm);
  return {
    arm, overall: rate(rs),
    L1: rate(rs.filter((r) => r.level === 1)), L2: rate(rs.filter((r) => r.level === 2)), L3: rate(rs.filter((r) => r.level === 3)),
    medianPromptTokens: median(rs.map((r) => (r.usage?.prompt_tokens || 0) + (r.usage?.completion_tokens || 0))),
    medianCompletionTokens: median(rs.map((r) => r.usage?.completion_tokens || 0)),
  };
});

// ---- Per-prompt disagreement (arm-blind by construction) ----
const keys = [...new Set(arms.map((r) => r.key))];
const perPrompt = keys.map((key) => {
  const cells = ARMS.map((arm) => {
    const rs = arms.filter((r) => r.key === key && r.arm === arm);
    return rs.length ? rs.filter((r) => r.promptPass).length / rs.length : null;
  });
  const defined = cells.every((c) => c !== null);
  return { key, cells, disagreement: defined && new Set(cells).size > 1, level: promptByKey.get(key)?.level };
});
const disagreeCount = perPrompt.filter((p) => p.disagreement).length;

// ---- Calibration: self-report vs truth vs keyword extractor ----
const cRequire = createRequire(join(REPO, 'package.json'));
const { extract } = cRequire('./router/extract.js');
const calRows = cal.map((c) => {
  const est = c.estimate || {};
  const truth = c.truth.constraint_count;
  const kw = extract(promptByKey.get(c.key)?.prompt || '');
  const selfCount = Number.isFinite(Number(est.constraint_count)) ? Number(est.constraint_count) : null;
  return {
    key: c.key, truth,
    self: selfCount, selfDelta: selfCount === null ? null : selfCount - truth,
    hidden: Number(est.hidden_constraint), clarity: Number(est.clarity),
    kwCount: kw.constraint_count,
  };
});
const validCal = calRows.filter((r) => r.self !== null);
const maeSelf = validCal.length ? +(validCal.reduce((s, r) => s + Math.abs(r.selfDelta), 0) / validCal.length).toFixed(2) : null;
const maeKw = +(calRows.reduce((s, r) => s + Math.abs((r.kwCount || 0) - r.truth), 0) / calRows.length).toFixed(2);
// pass-vs-hidden_signal correlation (does self-reported hidden_constraint predict failure?)
const armA = arms.filter((r) => r.arm === 'controlA');
const joined = calRows.map((c) => {
  const a = armA.find((r) => r.key === c.key);
  return a ? { hidden: c.hidden, pass: a.promptPass } : null;
}).filter(Boolean);

function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

const out = {
  runsDir, generatedAt: new Date().toISOString(),
  armRuns: arms.length, calibrationRuns: cal.length, parseOK: cal.filter((c) => c.parseOK).length,
  perArm,
  disagreement: { prompts: disagreeCount, total: keys.length },
  calibration: {
    parseOKRate: `${cal.filter((c) => c.parseOK).length}/${cal.length}`,
    selfCountMAE: maeSelf, keywordExtractorMAE: maeKw,
    sample: calRows.slice(0, 8),
  },
  perPrompt: perPrompt.map((p) => ({ key: p.key, level: p.level, disagreement: p.disagreement, cells: p.cells.map((c) => (c === null ? '-' : c.toFixed(2))) })),
};
writeFileSync(join(runsDir, 'summary.json'), JSON.stringify(out, null, 2));
console.log(`arm runs: ${arms.length} | calibration parseOK: ${out.calibration.parseOKRate}`);
for (const a of perArm) console.log(`  ${a.arm}: overall=${a.overall} L1=${a.L1} L2=${a.L2} L3=${a.L3} medTok=${a.medianPromptTokens}`);
console.log(`disagreement: ${disagreeCount}/${keys.length} prompts`);
console.log(`calibration MAE: self=${maeSelf} keyword-extractor=${maeKw} (constraint_count vs truth)`);
console.log(`wrote ${join(runsDir, 'summary.json')}`);
