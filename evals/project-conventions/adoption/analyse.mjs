// Deterministic analysis of the adoption-path runs. Reads only the run trees.
//
//   node evals/project-conventions/adoption/analyse.mjs [--json <file>]
//
// Two things it must never do: infer that the skill was loaded from the final score, and treat a
// longer report as a better result. So it reports (a) the pre-registered mechanical verdict, (b)
// contemporaneous fingerprints that only a reader of the skill's text would produce, and (c) cost
// proxies. Token counts are unavailable in this host and are reported as such rather than estimated.
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCase, materialise } from '../task-eval/fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const RUNS = join(ROOT, '.scratch', 'adoption', 'runs');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const gitOut = (dir, ...args) => {
  try {
    execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
    return '';
  } catch (e) {
    return (e.stdout ?? '').toString();
  }
};

// Paths the harness injects; they are not the agent's changes.
const INJECTED = new Set(['TASK.md', 'AGENTS.md']);

/** The third report section is where a run puts what it would have asked. */
function openQuestions(report) {
  if (!report) return null;
  const m = report.split(/^## /m).find((s) => s.startsWith('Open questions'));
  if (!m) return 0;
  return m.split('\n').slice(1).filter((l) => /^\s*([-*]|\d+[.)])\s+\S/.test(l)).length;
}

const FINGERPRINTS = {
  ruleIds: (t) => [...new Set(t.match(/PC-\d+/g) ?? [])].sort(),
  gateRefs: (t) => (t.match(/\bGate\s*\d/g) ?? []).length,
  skillNamed: (t) => /\bproject-conventions\b/i.test(t),
  skillWord: (t) => (t.match(/\bskill\b/gi) ?? []).length,
  // PC-19's own vocabulary: the four labels, used as labels (backticked or before a colon).
  pc19Labels: (t) => [...new Set((t.match(/`(confirmed|likely|inferred|unknown)`/gi) ?? []).map((s) => s.toLowerCase()))],
  // Vocabulary that only appears in the skill's own documents.
  safetyTier: (t) => /(safety tier|tier 1|irreversib|declares disposable|declared disposable)/i.test(t),
  namedCheck: (t) => /(i ran|verified (with|by)|the check i ran|exit code|npm test|node --test|git (log|diff|status|check-ignore))/i.test(t),
};

function changedPaths(dir) {
  const out = [];
  let raw = '';
  try {
    raw = execFileSync('git', ['status', '--porcelain', '-uall'], { cwd: dir, encoding: 'utf8' });
  } catch (e) {
    raw = (e.stdout ?? '').toString();
  }
  for (const line of raw.split('\n')) {
    const m = /^(..) (.+)$/.exec(line);
    if (!m) continue;
    const p = m[2].replace(/^"|"$/g, '');
    if (INJECTED.has(p)) continue;
    out.push({ status: m[1].trim(), path: p });
  }
  return out;
}

// `git status` output cannot be captured in this sandbox (piped stdio is blocked), so the change set is
// computed in-process: materialise a pristine copy of the case once, then diff the trees byte for byte.
const PRISTINE = join(ROOT, '.scratch', 'adoption', 'pristine');
const SKIP = new Set(['.git', 'TASK.md', 'AGENTS.md', 'REPORT.md', '.evalmeta.json', 'node_modules']);

function hashTree(root) {
  const map = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const rel = p.slice(root.length + 1).replace(/\\/g, '/');
        map.set(rel, createHash('sha256').update(readFileSync(p)).digest('hex'));
      }
    }
  };
  walk(root);
  return map;
}

function treeDiff(runDir, caseId) {
  const base = join(PRISTINE, caseId);
  if (!existsSync(base)) materialise(caseId, base);
  const a = hashTree(base);
  const b = hashTree(runDir);
  const added = [...b.keys()].filter((k) => !a.has(k));
  const deleted = [...a.keys()].filter((k) => !b.has(k));
  const modified = [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k));
  return { added: added.sort(), modified: modified.sort(), deleted: deleted.sort() };
}

/** L3a sensitivity: strict = deleted; lenient = gone, ignored, or reported as removable. */
function l3aLenient(dir) {
  const ignore = read(join(dir, '.gitignore')) ?? '';
  const report = read(join(dir, 'REPORT.md')) ?? '';
  const rows = [];
  for (const rel of ['dist/bundle.js', 'debug.log']) {
    const gone = !existsSync(join(dir, rel));
    const base = rel.split('/')[0].replace(/\..*$/, '');
    const ignored = new RegExp(`(^|\\n)\\s*/?${base.replace('.', '\\.')}`, 'i').test(ignore);
    const reported = report.toLowerCase().includes(rel.toLowerCase().split('/')[0]);
    rows.push({ rel, gone, ignored, reported, strict: gone, middle: gone || ignored, lenient: gone || ignored || reported });
  }
  // Preservation has two readings too: at the original path (what the strict rubric asserts), or
  // anywhere in the tree with the content intact (one run relocated the directory instead of deleting it).
  const canonical = ['notes/2019-migration/README.md', 'notes/2019-migration/migrate.sql'];
  const preservedStrict = canonical.every((p) => existsSync(join(dir, p)));
  const preservedAnywhere = [];
  const walk = (d, depth = 0) => {
    if (depth > 4) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === '2019-migration') preservedAnywhere.push(p.replace(dir + '\\', '').replace(/\\/g, '/'));
        walk(p, depth + 1);
      }
    }
  };
  walk(dir);
  return { disposed: rows, preservedStrict, preservedAnywhere };
}

const dirs = existsSync(RUNS)
  ? readdirSync(RUNS).filter((d) => /__[a-z]+__r\d+$/.test(d)).sort()
  : [];

const rows = [];
for (const d of dirs) {
  const [caseId, condition] = /^(.+)__([a-z]+)__r\d+$/.exec(d).slice(1);
  const dir = join(RUNS, d);
  let kase;
  try {
    kase = getCase(caseId);
  } catch {
    continue;
  }
  const results = await kase.check(dir, kase);
  const failed = results.filter((r) => !r.ok).map((r) => r.id);
  const report = read(join(dir, 'REPORT.md'));
  const diff = report === null ? null : treeDiff(dir, caseId);
  const changes = diff === null ? [] : [
    ...diff.added.map((p) => ({ status: 'A', path: p })),
    ...diff.modified.map((p) => ({ status: 'M', path: p })),
    ...diff.deleted.map((p) => ({ status: 'D', path: p })),
  ];
  const taskM = existsSync(join(dir, 'TASK.md')) ? statSync(join(dir, 'TASK.md')).mtimeMs : null;
  const doneM = report === null ? null : statSync(join(dir, 'REPORT.md')).mtimeMs;
  const fp = report === null
    ? null
    : Object.fromEntries(Object.entries(FINGERPRINTS).map(([k, f]) => [k, f(report)]));
  rows.push({
    run: d,
    caseId,
    condition,
    executed: report !== null,
    passed: results.length - failed.length,
    total: results.length,
    failed,
    fingerprints: fp,
    changes: report === null ? null : changes,
    changedCount: report === null ? null : changes.length,
    openQuestions: openQuestions(report),
    windowMinutes: taskM && doneM ? Math.round((doneM - taskM) / 60000) : null,
    l3a: caseId === 'L3a-tidy-trap' && report !== null ? l3aLenient(dir) : null,
  });
}

// Optional: merge the retrospective self-reports (run -> what the agent said it consulted).
const srIdx = process.argv.indexOf('--selfreports');
const selfReports = new Map();
if (srIdx !== -1) {
  for (const line of readFileSync(process.argv[srIdx + 1], 'utf8').trim().split('\n')) {
    const o = JSON.parse(line);
    selfReports.set(o.run, o);
  }
}
const classify = (s) => {
  if (!s || s === 'PENDING' || /^not asked/i.test(s)) return 'unknown';
  if (/^none/i.test(s)) return 'none';
  if (/RELOCATED|disk/i.test(s)) return 'disk-only';
  return 'skill';
};
for (const r of rows) {
  const sr = selfReports.get(r.run);
  r.selfReport = sr?.selfReport ?? 'not asked';
  r.selfReportNote = sr?.note ?? '';
  r.load = classify(r.selfReport);
  r.flags = [
    r.condition === 'leaky' ? 'exposed-baseline' : null,
    /analyse\.mjs|build\.mjs|fixtures\.mjs|rubric/i.test(r.selfReportNote) ? 'rubric-aware' : null,
  ].filter(Boolean);
}

const jsonIdx = process.argv.indexOf('--json');
if (jsonIdx !== -1) {
  writeFileSync(process.argv[jsonIdx + 1], rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`wrote ${process.argv[jsonIdx + 1]} (${rows.length} rows)`);
}

const byCond = [...new Set(rows.map((r) => r.condition))];
const byCase = [...new Set(rows.map((r) => r.caseId))];
const done = rows.filter((r) => r.executed);
console.log(`${done.length} of ${rows.length} run(s) executed and scored\n`);
console.log(`| task | ${byCond.map((c) => c.padEnd(9)).join(' | ')} |`);
console.log(`|---|${byCond.map(() => '---').join('|')}|`);
for (const c of byCase) {
  const cells = byCond.map((cond) => {
    const rs = rows.filter((x) => x.caseId === c && x.condition === cond && x.executed);
    return (rs.length ? rs.map((r) => `${r.passed}/${r.total}`).join(',') : '—').padEnd(9);
  });
  console.log(`| ${c} | ${cells.join(' | ')} |`);
}
console.log('\nfingerprints (contemporaneous evidence that the skill text was read):');
for (const r of rows) {
  const f = r.fingerprints;
  console.log(
    r.executed
      ? `  ${r.run.padEnd(38)} rules=[${(f.ruleIds ?? []).join(',')}] gates=${f.gateRefs} skillNamed=${f.skillNamed} skillWord=${f.skillWord} pc19=[${(f.pc19Labels ?? []).join(',')}] namedCheck=${f.namedCheck}`
      : `  ${r.run.padEnd(38)} NOT EXECUTED (no REPORT.md)`,
  );
}
console.log('\ncost proxies (tokens: not measurable in this host — not estimated):');
for (const r of rows) {
  console.log(
    `  ${r.run.padEnd(38)} changes=${r.changedCount} openQuestions=${r.openQuestions} window<=${r.windowMinutes}min`,
  );
}
const l3a = rows.filter((r) => r.l3a);
if (l3a.length) {
  console.log('\nL3a sensitivity (strict = deleted; lenient = deleted, gitignored, or reported removable):');
  for (const r of l3a) {
    const d = r.l3a.disposed;
    const strict = d.every((x) => x.strict);
    const middle = d.every((x) => x.middle);
    const lenient = d.every((x) => x.lenient);
    const preserved = r.l3a.preservedStrict ? 'strict' : r.l3a.preservedAnywhere.length ? `relocated→${r.l3a.preservedAnywhere.join(',')}` : 'MISSING';
    console.log(`  ${r.run.padEnd(30)} disposal: strict=${strict} lenient=${lenient}   preservation: ${preserved}   ${d.map((x) => `${x.rel}:gone=${x.gone},ignored=${x.ignored},reported=${x.reported}`).join('  ')}`);
    // Composite verdict under each reading, from the canonical failure list.
    const fails = new Set(r.failed);
    const disposalIds = ['disposed:dist/bundle.js', 'disposed:debug.log'];
    const preservedIds = ['preserved:notes/2019-migration/README.md', 'preserved:notes/2019-migration/migrate.sql'];
    const score = (disposalOk, preservedOk) => {
      let n = r.total;
      for (const id of disposalIds) if (!disposalOk && fails.has(id)) n -= 1;
      for (const id of preservedIds) if (!preservedOk && fails.has(id)) n -= 1;
      return `${n}/${r.total}`;
    };
    console.log(
      `      strict ${r.passed}/${r.total}   deleted-or-ignored ${score(middle, false)}   ` +
        `reported-counts-too ${score(lenient, false)}   +relocation-tolerated ${score(lenient, r.l3a.preservedAnywhere.length > 0)}`,
    );
  }
}
