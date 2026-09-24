// Re-derives the behavioural comparison from the preserved run.
//
// Kept in the repository, not in scratch, because the run's result is a *negative* one — a ceiling —
// and a negative result nobody can re-derive is indistinguishable from a claim. This script joins the
// blind verdicts back onto the conditions and reports the comparison including inter-judge agreement
// and the ceiling.
//
//   node evals/project-conventions/behaviour-run/join.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const read = (f) =>
  readFileSync(join(DIR, f), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

const key = new Map(read('blind-key.jsonl').map((r) => [r.code, r]));
const j1 = new Map(read('judged-j1.jsonl').map((r) => [r.code, String(r.verdict).toUpperCase()]));
const j2 = new Map(read('judged-j2.jsonl').map((r) => [r.code, String(r.verdict).toUpperCase()]));

const codes = [...key.keys()];
const agree = codes.filter((c) => j1.get(c) === j2.get(c)).length;
console.log(`rows: ${codes.length}`);
console.log(`inter-judge agreement: ${agree}/${codes.length} (${((agree / codes.length) * 100).toFixed(1)}%)`);

const stats = {};
for (const c of codes) {
  const { condition, case: caseId } = key.get(c);
  // A row passes only when BOTH judges pass it; a disagreement counts against the condition, so the
  // comparison cannot be improved by picking the friendlier judge.
  const pass = j1.get(c) === 'PASS' && j2.get(c) === 'PASS';
  stats[condition] ??= { pass: 0, total: 0, disagree: 0 };
  const s = stats[condition];
  s.total += 1;
  if (pass) s.pass += 1;
  if (j1.get(c) !== j2.get(c)) s.disagree += 1;
}

console.log('');
for (const [cond, s] of Object.entries(stats)) {
  console.log(
    `${cond.padEnd(9)} ${s.pass}/${s.total} pass (${((s.pass / s.total) * 100).toFixed(1)}%)  judge disagreements: ${s.disagree}`,
  );
}
console.log('');
console.log(
  `difference (skill - baseline): ${(((stats.skill.pass / stats.skill.total) - (stats.baseline.pass / stats.baseline.total)) * 100).toFixed(1)} points`,
);
console.log('NOTE: that difference rests on 2 rows of a single case, and the two judges disagreed on both,');
console.log('      so it is within judge noise. The ceiling below is the real result.');

const allCases = [...new Set(codes.map((c) => key.get(c).case))].sort();
const solvedByAll = allCases.filter((id) =>
  codes.filter((c) => key.get(c).case === id).every((c) => j1.get(c) === 'PASS' && j2.get(c) === 'PASS'),
);
console.log(`cases solved by all 6 runs: ${solvedByAll.length}/${allCases.length}`);
const discriminating = allCases.filter((id) => !solvedByAll.includes(id));
console.log(`cases with any discriminating signal: ${discriminating.length}/${allCases.length}`);
if (discriminating.length) console.log(`  ${discriminating.join(', ')}`);
console.log('');
console.log('NOT VERIFIED: the case set is saturated, so no behavioural benefit is demonstrated.');
