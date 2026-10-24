#!/usr/bin/env node
// Round-5 aggregation — computes the PRE-REGISTERED primary metric first, arm-blind by
// construction: per-task "disagreement pattern" (are the pass/fail outcomes identical across
// the anonymous conditions?) does not need to know which arm is which. Cost/Fisher/statistics
// that DO need identities come after, in the reveal step.
//
// Usage: node aggregate.mjs <runsDir> [--blind]

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const runsDir = process.argv[2];
const blind = process.argv.includes('--blind');
if (!runsDir || !existsSync(runsDir)) { console.error('usage: node aggregate.mjs <runsDir> [--blind]'); process.exit(2); }

// Collect result.json + transcript per run.
const runs = [];
for (const d of readdirSync(runsDir)) {
  const rp = join(runsDir, d, 'result.json');
  if (!existsSync(rp)) continue;
  const r = JSON.parse(readFileSync(rp, 'utf8'));
  let mentions = null;
  const tp = join(runsDir, d, 'transcript.json');
  if (existsSync(tp)) {
    const transcript = JSON.parse(readFileSync(tp, 'utf8'));
    const text = transcript.map((m) => m.content || '').join('\n');
    mentions = {
      fast: (text.match(/\bfast\b/gi) || []).length,
      structured: (text.match(/\bstructured\b/gi) || []).length,
      deep: (text.match(/\bdeep\b/gi) || []).length,
      verify: (text.match(/\bverif/gi) || []).length,
    };
  }
  runs.push({ ...r, mentions });
}
if (!runs.length) { console.error('no results found'); process.exit(1); }

// INTEGRITY GATE (F20 lesson): a scorer that silently throws records taskPass=false with no
// criteria — indistinguishable from genuine failure unless counted. Warn loudly, never pass silently.
const scorerFailures = runs.filter((r) => r.checkerError || (!r.criteria && r.kind !== 'calibration' && r.arm));
if (scorerFailures.length) {
  console.log(`\n!! INTEGRITY WARNING: ${scorerFailures.length}/${runs.length} runs have checkerError or empty criteria —`);
  console.log('!! the scorer may not have executed (see failure log F20). These are NOT confirmed task failures.');
  const byErr = {};
  for (const r of scorerFailures) { const k = `${r.task} :: ${String(r.checkerError || 'empty criteria').split('\n')[0].slice(0, 90)}`; byErr[k] = (byErr[k] || 0) + 1; }
  Object.entries(byErr).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([k, v]) => console.log(`!!   ${v}x ${k}`));
}

const arms = [...new Set(runs.map((r) => r.arm))].sort();
const tasks = [...new Set(runs.map((r) => r.task))].sort();
const models = [...new Set(runs.map((r) => r.model))];

// Sealed anonymization map (stable per runsDir): arm -> condition-X/Y/Z/W.
const mapPath = join(REPO, '.scratch', 'r5', `blind-map-${createHash('sha256').update(runsDir).digest('hex').slice(0, 8)}.json`);
let anon;
if (existsSync(mapPath)) anon = JSON.parse(readFileSync(mapPath, 'utf8'));
else {
  const letters = ['X', 'Y', 'Z', 'W'];
  anon = { arms: {}, created: new Date().toISOString(), runsDir };
  arms.forEach((a, i) => { anon.arms[a] = `condition-${letters[i]}`; });
  writeFileSync(mapPath, JSON.stringify(anon, null, 2));
}
const label = (arm) => (blind ? anon.arms[arm] : arm);

// ---- Primary metric (arm-blind): per-task disagreement across conditions ----
const perTask = tasks.map((task) => {
  const cells = arms.map((arm) => {
    const rs = runs.filter((r) => r.task === task && r.arm === arm);
    return {
      arm, label: label(arm),
      n: rs.length,
      pass: rs.filter((r) => r.taskPass).length,
      statuses: [...new Set(rs.map((r) => r.status.split(':')[0]))],
      tokens: rs.map((r) => (r.telemetry?.tokens?.prompt || 0) + (r.telemetry?.tokens?.completion || 0)),
      actions: rs.map((r) => (r.telemetry?.actions?.length || 0)),
      turns: rs.map((r) => (r.telemetry?.turns || 0)),
      f16: rs.reduce((s, r) => s + (r.telemetry?.f16_narration_turns || 0), 0),
      empty: rs.reduce((s, r) => s + (r.telemetry?.empty_turns || 0), 0),
    };
  });
  const passRates = cells.map((c) => (c.n ? c.pass / c.n : null));
  const allDefined = passRates.every((p) => p !== null);
  const disagreement = allDefined && new Set(passRates).size > 1;
  return { task, cells, disagreement };
});

const disagreeCount = perTask.filter((t) => t.disagreement).length;
const verdict = disagreeCount >= 4 ? 'INFORMATIVE' : disagreeCount >= 1 ? 'PARTIAL' : 'NO-DISCRIMINATION';

// ---- Cost per arm (identity-free medians computed here, but reported with labels) ----
function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
const perArm = arms.map((arm) => {
  const rs = runs.filter((r) => r.arm === arm);
  return {
    label: label(arm),
    runs: rs.length,
    passRate: +(rs.filter((r) => r.taskPass).length / rs.length).toFixed(3),
    medianTokens: median(rs.map((r) => (r.telemetry?.tokens?.prompt || 0) + (r.telemetry?.tokens?.completion || 0))),
    medianActions: median(rs.map((r) => (r.telemetry?.actions?.length || 0))),
    medianTurns: median(rs.map((r) => (r.telemetry?.turns || 0))),
    degenerate: rs.filter((r) => r.status?.startsWith('degenerate')).length,
    f16Total: rs.reduce((s, r) => s + (r.telemetry?.f16_narration_turns || 0), 0),
    emptyTotal: rs.reduce((s, r) => s + (r.telemetry?.empty_turns || 0), 0),
  };
});

const out = {
  runsDir, models, generatedAt: new Date().toISOString(), blind,
  primaryMetric: { disagreeCount, taskCount: tasks.length, verdict },
  perTask: perTask.map((t) => ({
    task: t.task, disagreement: t.disagreement,
    cells: t.cells.map((c) => `${c.label} ${c.pass}/${c.n}`),
  })),
  perArm,
};
const outFile = join(runsDir, `aggregate${blind ? '-blind' : ''}.json`);
writeFileSync(outFile, JSON.stringify(out, null, 2));

console.log(`models: ${models.join(', ')}`);
console.log(`runs: ${runs.length}`);
console.log(`\nPRIMARY METRIC (arm-blind): disagreement on ${disagreeCount}/${tasks.length} tasks -> ${verdict}`);
for (const t of out.perTask) console.log(`  ${t.disagreement ? '*' : ' '} ${t.task}: ${t.cells.join(' | ')}`);
console.log(`\nper-arm (labelled):`);
for (const a of perArm) {
  console.log(`  ${a.label}: pass=${a.passRate} medTokens=${a.medianTokens} medActions=${a.medianActions} medTurns=${a.medianTurns} degenerate=${a.degenerate} f16=${a.f16Total} empty=${a.emptyTotal}`);
}
console.log(`\nwrote ${outFile}`);
