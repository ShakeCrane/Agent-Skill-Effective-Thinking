// Scorer for the project-conventions behavioural decision suite.
//
// Used two ways:
//   - imported by suite-test.mjs, which proves the rubric discriminates
//   - as a CLI over a results file, to score real runs
//
//   node evals/project-conventions/score.mjs <results.jsonl>
//
// A results file is one JSON object per line:
//   { "case": "version-01", "condition": "baseline" | "skill", "response": "..." }
//
// Scoring is mechanical and deliberately crude: every `mustMatch` pattern must appear somewhere in
// the response (case-insensitive), and no `mustNotMatch` pattern may appear. It reads the decision
// and the reason, not the prose. The point is not to grade writing quality — it is to detect whether
// a specific rule fired, so that a claim like "the skill changed behaviour" can be checked instead of
// asserted.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SUITE = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));

/** Compile once; a bad pattern should be a load-time failure, not a silent non-match. */
const compiled = new Map(
  SUITE.cases.map((c) => [
    c.id,
    {
      def: c,
      must: c.mustMatch.map((p) => new RegExp(p, 'i')),
      mustNot: c.mustNotMatch.map((p) => new RegExp(p, 'i')),
    },
  ]),
);

/**
 * Negation cue that turns an otherwise forbidden phrase into a refusal.
 *
 * This exists because the first scoring pass was dominated by instrument error. A correct answer
 * routinely names the behaviour it is rejecting — "I would not delete it", "this is not a MAJOR",
 * "rather than assume the flag" — and a naive substring match scores every one of those as the
 * failure it is warning against. Measured on the first live run, that inflated the false-failure rate
 * enough to hide the real signal, which is exactly the kind of number the task forbids reporting.
 */
const NEGATION = /\b(?:not|never|no|none|cannot|can't|won't|wouldn't|shouldn't|don't|doesn't|isn't|aren't|rather than|instead of|without|avoid(?:s|ed)?|refus(?:e|es|ed)|reject(?:s|ed)?|decline[sd]?|leave|leaves|left|keep|keeps|kept|preserve[sd]?|report(?:s|ed)?|ask(?:s|ed)?|before)\b/i;

/**
 * True when `match` appears in `text` as an endorsement rather than inside a refusal.
 * Looks back to the start of the enclosing sentence (or 90 characters), which is the window in which
 * a negation governing this clause would sit.
 */
function isEndorsed(text, index) {
  const from = Math.max(0, index - 90);
  const window = text.slice(from, index);
  const boundary = Math.max(window.lastIndexOf('.'), window.lastIndexOf('\n'), window.lastIndexOf(';'));
  const clause = boundary === -1 ? window : window.slice(boundary + 1);
  return !NEGATION.test(clause);
}

/**
 * Score one response against one case.
 * Returns { pass, missing, violated } — `missing` are required patterns that did not fire,
 * `violated` are forbidden patterns endorsed rather than merely mentioned.
 */
export function scoreCase(caseId, response) {
  const entry = compiled.get(caseId);
  if (!entry) throw new Error(`unknown case id: ${caseId}`);
  const text = String(response ?? '');
  const missing = entry.def.mustMatch.filter((_, i) => !entry.must[i].test(text));
  const violated = entry.def.mustNotMatch.filter((pattern, i) => {
    const rx = new RegExp(pattern, 'gi');
    let m;
    while ((m = rx.exec(text)) !== null) {
      if (isEndorsed(text, m.index)) return true;
      if (m.index === rx.lastIndex) rx.lastIndex += 1; // zero-width guard
    }
    return false;
  });
  return { caseId, pass: missing.length === 0 && violated.length === 0, missing, violated };
}

/** Aggregate a list of scored rows. Returns per-condition totals. */
export function summarise(rows) {
  const byCondition = new Map();
  const byArea = new Map();
  for (const r of rows) {
    const cond = r.condition ?? 'unknown';
    const area = compiled.get(r.caseId)?.def.area ?? 0;
    byCondition.set(cond, byCondition.get(cond) ?? { pass: 0, total: 0 });
    const c = byCondition.get(cond);
    c.total += 1;
    if (r.pass) c.pass += 1;
    const key = `${cond}:${area}`;
    byArea.set(key, byArea.get(key) ?? { pass: 0, total: 0 });
    const a = byArea.get(key);
    a.total += 1;
    if (r.pass) a.pass += 1;
  }
  return { byCondition, byArea };
}

// ---------------------------------------------------------------------------- CLI
// Compare resolved paths rather than string-building a file URL: on Windows the URL form is
// `file:///D:/...` and a hand-built `file://D:/...` never matches, which silently turns the CLI into
// a no-op that exits 0 having printed nothing.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node evals/project-conventions/score.mjs <results.jsonl>');
    process.exit(2);
  }
  const rows = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
    .map((r) => ({ ...r, ...scoreCase(r.case, r.response) }));

  for (const r of rows) {
    const mark = r.pass ? 'PASS' : 'FAIL';
    const why = r.pass
      ? ''
      : [r.missing.length ? `missing: ${r.missing.join(' | ')}` : '', r.violated.length ? `violated: ${r.violated.join(' | ')}` : '']
          .filter(Boolean)
          .join(' ; ');
    console.log(`[${mark}] ${r.condition.padEnd(8)} ${r.case.padEnd(14)} ${why}`);
  }

  const { byCondition } = summarise(rows);
  console.log('');
  for (const [cond, s] of [...byCondition].sort()) {
    console.log(`${cond.padEnd(10)} ${s.pass}/${s.total} pass (${((s.pass / s.total) * 100).toFixed(0)}%)`);
  }
}
