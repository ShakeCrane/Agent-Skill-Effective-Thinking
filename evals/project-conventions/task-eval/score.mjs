// Aggregates task-level run results.
//
//   node evals/project-conventions/task-eval/score.mjs <runsDir> [--out results.jsonl]
//
// A run directory is named `<caseId>__<condition>__<rep>`, which is also the record of which arm it
// belonged to — the condition is in the directory name, not in the agent's prompt, so it cannot leak
// into what the agent saw.
//
// Scoring reads the repository each run left behind. It never reads the agent's chat, and it never
// asks the agent how it did.

import { readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CASES, getCase } from './fixtures.mjs';

const HELD_OUT = new Set(CASES.filter((c) => c.heldOut).map((c) => c.id));

const runsDir = process.argv[2];
const outIdx = process.argv.indexOf('--out');
const outFile = outIdx === -1 ? null : process.argv[outIdx + 1];

if (!runsDir || !existsSync(runsDir)) {
  console.error('usage: score.mjs <runsDir> [--out results.jsonl]');
  process.exit(2);
}

const dirs = readdirSync(runsDir).filter((d) => {
  const abs = join(runsDir, d);
  return statSync(abs).isDirectory() && /__[a-z]+__r\d+$/.test(d);
});

// A run that was materialised but never executed is indistinguishable from a run that failed
// everything, and scoring it as a failure would manufacture a difference between arms. Every task
// requires a REPORT.md, so its absence is the readiness signal; anything unready is reported as
// PENDING and excluded from the comparison.
const pending = [];
const ready = dirs.filter((d) => {
  if (existsSync(join(runsDir, d, 'REPORT.md'))) return true;
  pending.push(d);
  return false;
});

const rows = [];
for (const d of ready.sort()) {
  const [, caseId, condition] = /^(.+)__([a-z]+)__r\d+$/.exec(d);
  let kase;
  try {
    kase = getCase(caseId);
  } catch {
    console.log(`[SKIP] ${d} — unknown case`);
    continue;
  }
  const dir = resolve(runsDir, d);
  const results = await kase.check(dir, kase);
  const passed = results.filter((r) => r.ok).length;
  rows.push({ run: d, case: caseId, tier: kase.tier, condition, passed, total: results.length, failed: results.filter((r) => !r.ok).map((r) => r.id) });
  console.log(
    `${passed === results.length ? 'PASS' : 'FAIL'}  ${condition.padEnd(8)} ${caseId.padEnd(22)} ${passed}/${results.length}` +
      (passed === results.length ? '' : `  failed: ${results.filter((r) => !r.ok).map((r) => r.id).join(', ')}`),
  );
}

// Per-condition and per-tier aggregation.
const summarise = (keyFn) => {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    const s = m.get(k) ?? { pass: 0, total: 0, assertions: 0, assertionTotal: 0 };
    s.total += 1;
    s.assertions += r.passed;
    s.assertionTotal += r.total;
    if (r.passed === r.total) s.pass += 1;
    m.set(k, s);
  }
  return m;
};

console.log('');
if (pending.length) {
  console.log(`PENDING (no REPORT.md — materialised but not executed): ${pending.length}`);
  for (const p of pending) console.log(`  ${p}`);
  console.log('');
}
for (const [k, s] of summarise((r) => r.condition)) {
  console.log(`condition ${k.padEnd(8)} runs solved ${s.pass}/${s.total}   assertions ${s.assertions}/${s.assertionTotal}`);
}
console.log('');
for (const [k, s] of summarise((r) => r.tier)) {
  console.log(`tier ${k.padEnd(4)} runs solved ${s.pass}/${s.total}   assertions ${s.assertions}/${s.assertionTotal}`);
}
if (rows.length && new Set(rows.map((r) => r.condition)).size > 1) {
  const conds = [...new Set(rows.map((r) => r.condition))].sort();
  console.log('');
  for (const tier of ['L1', 'L2', 'L3']) {
    const line = [];
    for (const cond of conds) {
      const s = summarise((r) => (r.tier === tier ? r.condition : null)).get(cond);
      if (s) line.push(`${cond} ${s.assertions}/${s.assertionTotal}`);
    }
    if (line.length) console.log(`tier ${tier}: ${line.join('   ')}`);
  }
  // Split by whether a case was ever available for rule tuning. A difference that lives only in the
  // tuning set is a different claim from one that also shows up in cases no rule was fitted to.
  console.log('');
  for (const [label, wanted] of [['held out ', true], ['tuning set', false]]) {
    const line = [];
    for (const cond of conds) {
      const s = summarise((r) => (HELD_OUT.has(r.case) === wanted ? r.condition : null)).get(cond);
      if (s) line.push(`${cond} ${s.assertions}/${s.assertionTotal} (${s.total} runs)`);
    }
    if (line.length) console.log(`${label}: ${line.join('   ')}`);
  }
}

if (outFile) {
  writeFileSync(outFile, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`\nwrote ${outFile} (${rows.length} rows)`);
}
