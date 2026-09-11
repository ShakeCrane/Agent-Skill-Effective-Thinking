#!/usr/bin/env node
// Checker self-test — proves every acceptance checker can BOTH fail and pass before any real run.
//
// Discipline (project failure F13): a detector that has never been shown to fire is a false pass.
// So for every corpus item we build two workspaces:
//   1. PRISTINE fixtures  -> checker MUST return pass=false (otherwise the checker is vacuous)
//   2. GOLD solution      -> checker MUST return pass=true  (otherwise the checker is mis-specified)
// Any item failing either direction is a harness defect and must be fixed before the corpus is used.
//
// Run: node evals/external/selftest.js

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CHECKERS, countTodos } = require('./checkers.js');
const { ITEMS } = require('./corpus.js');

const FIX = path.join(__dirname, 'fixtures');
const TMP = path.join(os.tmpdir(), 'cog-skill-selftest');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
const W = (base, rel, content) => {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

// ---- gold solutions ---------------------------------------------------------
const GOLD = {
  'a1-csv-to-json': (ws) => {
    const rows = fs.readFileSync(path.join(ws, 'data/people.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
      .map((l) => l.split(',')).map(([name, age, city]) => ({ name, age: Number(age), city }));
    W(ws, 'output.json', JSON.stringify(rows, null, 2));
  },
  'a2-rename-ext': (ws) => {
    for (const f of fs.readdirSync(path.join(ws, 'assets'))) {
      if (f.endsWith('.jpeg')) fs.renameSync(path.join(ws, 'assets', f), path.join(ws, 'assets', f.replace(/\.jpeg$/, '.jpg')));
    }
  },
  'b1-fix-date-range': (ws) => {
    W(ws, 'lib/date-range.js', [
      "'use strict';",
      'function overlaps(a, b) { return a.start < b.end && b.start < a.end; }',
      'function merge(ranges) {',
      '  const sorted = ranges.slice().sort((x, y) => x.start - y.start);',
      '  const out = [];',
      '  for (const r of sorted) {',
      '    const last = out[out.length - 1];',
      '    if (last && r.start <= last.end) { if (r.end > last.end) last.end = r.end; }',
      '    else out.push({ start: r.start, end: r.end });',
      '  }',
      '  return out;',
      '}',
      'module.exports = { overlaps, merge };',
    ].join('\n'));
  },
  'b2-implement-retry': (ws) => {
    W(ws, 'lib/retry.js', [
      "'use strict';",
      'function retry(times, fn) {',
      '  let lastErr;',
      '  function attempt(i) {',
      '    try {',
      '      const r = fn();',
      '      if (r && typeof r.then === "function") {',
      '        return r.catch((e) => (i + 1 < times ? attempt(i + 1) : Promise.reject(e)));',
      '      }',
      '      return r;',
      '    } catch (e) {',
      '      lastErr = e;',
      '      if (i + 1 < times) return attempt(i + 1);',
      '      throw e;',
      '    }',
      '  }',
      '  return attempt(0);',
      '}',
      'module.exports = { retry };',
    ].join('\n'));
  },
  'c1-intermittent-cache': (ws) => {
    const p = path.join(ws, 'lib/cache.js');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('Object.assign(DEFAULT_OPTS, opts || {})', 'Object.assign({}, DEFAULT_OPTS, opts || {})'));
  },
  'd1-arch-decision': (ws) => {
    W(ws, 'decision.md', [
      '# Decision: session storage',
      '',
      'Recommendation: approach (a) — one JSON file per session under ~/.app/sessions.',
      '',
      'Alternatives considered: (b) a single SQLite database, and (c) keep sessions in memory and',
      'flush on exit. SQLite is rejected: it adds a native dependency to a single-binary',
      'distribution, which the brief flags as expensive. In-memory is rejected: it cannot survive',
      'a crash or power loss, which is a hard requirement.',
      '',
      'Risk: many small files make "list the last 100 sessions" depend on directory scan order and',
      'filesystem timestamps; on a slow disk this can become noticeable.',
      '',
      'Rollback: keep the previous storage module behind the same interface; if listing regresses,',
      'revert to the SQLite approach (b), which was the runner-up and is fully specified above.',
      '',
      'Falsification: if measured directory scan time for 100 sessions exceeds 200 ms on a typical',
      'user disk, or if the 50 MB budget is exceeded, this choice would be wrong and we would',
      'switch to SQLite.',
      '',
      'Constraints addressed: 50 MB budget is ample for a few KB per session; crash survival is met',
      'because each session is written and fsynced as its own file.',
    ].join('\n'));
  },
  'e1-read-config': (ws) => {
    const y = fs.readFileSync(path.join(ws, 'deploy/settings.yaml'), 'utf8');
    const port = Number((y.match(/port:\s*(\d+)/) || [])[1]);
    const timeout = Number((y.match(/timeout_ms:\s*(\d+)/) || [])[1]);
    const p = path.join(ws, 'service-config.json');
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    cfg.port = port; cfg.timeout_ms = timeout;
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  },
  'e2-count-todos': (ws) => { W(ws, 'answer.txt', String(countTodos(path.join(ws, 'src')))); },
  'f1-billing-rates': (ws) => {
    const p = path.join(ws, 'billing/rates.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const k of Object.keys(j.rates)) j.rates[k] = Math.round(j.rates[k] * 1.05 * 100) / 100;
    fs.writeFileSync(p, JSON.stringify(j, null, 2));
  },
  'g1-long-context': (ws) => {
    const j = path.join(ws, 'config/worker.json');
    const cfg = JSON.parse(fs.readFileSync(j, 'utf8'));
    cfg.worker.retry_limit = 7;
    fs.writeFileSync(j, JSON.stringify(cfg, null, 2));
    const rep = (f, from, to) => {
      const p = path.join(ws, f);
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(from, to));
    };
    rep('config/worker.yaml', 'retry_limit: 4', 'retry_limit: 7');
    rep('src/worker.js', 'RETRY_LIMIT = 12', 'RETRY_LIMIT = 7');
    rep('scripts/run-worker.sh', 'RETRY_LIMIT=5', 'RETRY_LIMIT=7');
    rep('deploy/worker.ini', 'retry_limit = 6', 'retry_limit = 7');
    W(ws, 'changed.txt', ['config/worker.json', 'config/worker.yaml', 'src/worker.js', 'scripts/run-worker.sh', 'deploy/worker.ini'].join('\n'));
  },
  'h1-failure-recovery': (ws) => {
    const p = path.join(ws, 'lib/percent.js');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('Math.round((part / whole) * 100)', '(part / whole) * 100'));
  },
  'i1-parallel-logs': (ws) => {
    const lines = [];
    for (const f of fs.readdirSync(path.join(ws, 'logs')).sort()) {
      const n = fs.readFileSync(path.join(ws, 'logs', f), 'utf8').split(/\r?\n/).filter((l) => /\bERROR\b/.test(l)).length;
      lines.push(`- ${f}: ${n}`);
    }
    W(ws, 'summary.md', lines.join('\n'));
  },
  'j1-one-shot-decision': (ws) => {
    W(ws, 'decision.md', [
      '# Decision: NO-GO for this weekend',
      '',
      'Decision: NO-GO. Do not open the maintenance window this weekend.',
      '',
      'Reasons (from the brief):',
      '- The granted maintenance window is 4 hours, but the measured migration in staging took',
      '  6 hours 20 minutes. The plan does not fit the window.',
      '- The rollback procedure has never been executed or tested, so there is no demonstrated way',
      '  back if the migration fails midway.',
      '- The last verified backup restore was 11 months ago and was not timed, so recovery time is',
      '  unknown.',
      '- The only engineer who has performed this migration is on leave and unreachable.',
      '',
      'Main risk: a failed migration means roughly 8 hours of full payment outage, with no tested',
      'rollback and no verified restore to fall back on.',
      '',
      'What would change this decision: if the rollback procedure were executed and tested',
      'end-to-end, a restore were timed within the window, and the window were extended beyond the',
      'measured 6 hours 20 minutes, I would reconsider and could support GO.',
    ].join('\n'));
  },
  'n1-paginate': (ws) => {
    W(ws, 'lib/paginate.js', [
      "'use strict';",
      'function paginate(items, pageSize) {',
      '  if (!Array.isArray(items)) throw new TypeError("items must be an array");',
      '  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new TypeError("pageSize must be a positive integer");',
      '  const out = [];',
      '  for (let i = 0; i < items.length; i += pageSize) out.push(items.slice(i, i + pageSize));',
      '  return out;',
      '}',
      'module.exports = { paginate };',
    ].join('\n'));
  },
  'n2-format-truncate': (ws) => {
    W(ws, 'lib/format.js', [
      "'use strict';",
      'function formatMoney(n) {',
      '  const neg = Number(n) < 0;',
      '  const v = Math.abs(Number(n));',
      '  const t = Math.floor(v * 100) / 100;',
      '  return (neg && t !== 0 ? "-" : "") + t.toFixed(2);',
      '}',
      'module.exports = { formatMoney };',
    ].join('\n'));
  },
  'n3-version-compare': (ws) => {
    W(ws, 'lib/version.js', [
      "'use strict';",
      'function parse(v) { return String(v).split(/[.]/).map(Number); }',
      'function maxVersion(list) {',
      '  let best = list[0];',
      '  for (const v of list) {',
      '    const a = parse(v), b = parse(best);',
      '    for (let i = 0; i < Math.max(a.length, b.length); i++) {',
      '      const x = a[i] || 0, y = b[i] || 0;',
      '      if (x > y) { best = v; break; }',
      '      if (x < y) break;',
      '    }',
      '  }',
      '  return best;',
      '}',
      'module.exports = { maxVersion, parse };',
    ].join('\n'));
  },
  'n4-three-sources': (ws) => {
    const y = fs.readFileSync(path.join(ws, 'deploy/a.yaml'), 'utf8');
    const ini = fs.readFileSync(path.join(ws, 'deploy/b.ini'), 'utf8');
    const j = JSON.parse(fs.readFileSync(path.join(ws, 'deploy/c.json'), 'utf8'));
    W(ws, 'report.json', JSON.stringify({
      port: Number((y.match(/port:\s*(\d+)/) || [])[1]),
      worker_count: Number((ini.match(/worker_count\s*=\s*(\d+)/) || [])[1]),
      region: j.region,
    }, null, 2));
  },
  'n5-context-distractor': (ws) => {
    const setJson = (f, fn) => { const p = path.join(ws, f); const j = JSON.parse(fs.readFileSync(p, 'utf8')); fn(j); fs.writeFileSync(p, JSON.stringify(j, null, 2)); };
    setJson('conf/worker.json', (j) => { j.worker.retry_limit = 7; j.worker.backoff_multiplier = 3; });
    setJson('conf/pool.json', (j) => { j.pool.retry_limit = 7; j.pool.backoff_multiplier = 3; });
    const rep = (f, a, b) => { const p = path.join(ws, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(a, b)); };
    rep('conf/fetcher.yaml', 'retry_limit: 9', 'retry_limit: 7');
    rep('src/sync.js', 'RETRY_LIMIT = 4', 'RETRY_LIMIT = 7');
    rep('scripts/run.sh', 'BACKOFF_MULTIPLIER=8', 'BACKOFF_MULTIPLIER=3');
    rep('conf/legacy.ini', 'retry_limit = 11', 'retry_limit = 7');
    rep('conf/legacy.ini', 'backoff_multiplier = 2', 'backoff_multiplier = 3');
    W(ws, 'changed.txt', ['conf/worker.json', 'conf/pool.json', 'conf/fetcher.yaml', 'src/sync.js', 'scripts/run.sh', 'conf/legacy.ini'].join('\n'));
  },
  'n6-two-defects': (ws) => {
    W(ws, 'lib/stats.js', [
      "'use strict';",
      'function mean(arr) { if (!arr.length) return 0; let s = 0; for (const v of arr) s += v; return s / arr.length; }',
      'function median(arr) { const s = arr.slice().sort((a, b) => a - b); const m = s.length >> 1;',
      '  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }',
      'module.exports = { mean, median };',
    ].join('\n'));
  },
  'n7-no-extra-files': (ws) => {
    const p = path.join(ws, 'notes.txt');
    const lines = fs.readFileSync(p, 'utf8').replace(/\s+$/, '').split(/\r?\n/);
    fs.writeFileSync(p, lines.reverse().join('\n') + '\n');
  },
  'n8-refactor': (ws) => {
    W(ws, 'lib/strings.js', [
      "'use strict';",
      'function clean(s) { return s == null ? "" : String(s).trim(); }',
      'function slugify(s) { return clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }',
      'function truncate(s, n) { const t = clean(s); return t.length <= n ? t : t.slice(0, n) + "..."; }',
      'module.exports = { clean, slugify, truncate };',
    ].join('\n'));
  },
  'n9-compound-count': (ws) => {
    let n = 0;
    for (const f of fs.readdirSync(path.join(ws, 'src2'), { recursive: true })) {
      const fp = path.join(ws, 'src2', f);
      if (!fs.statSync(fp).isFile()) continue;
      const txt = fs.readFileSync(fp, 'utf8');
      for (const line of txt.split(/\r?\n/)) { const s = line.trim(); if (/^(\/\/|#|\*)/.test(s)) n += (s.match(/FIXME/g) || []).length; }
      n += (txt.match(/XXX/g) || []).length;
    }
    W(ws, 'count.txt', String(n));
  },
  'n10-parallel-rows': (ws) => {
    const lines = [];
    for (const f of fs.readdirSync(path.join(ws, 'data')).sort()) {
      const rows = fs.readFileSync(path.join(ws, 'data', f), 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
      lines.push(`- ${f}: ${Math.max(0, rows.length - 1)}`);
    }
    W(ws, 'counts.md', lines.join('\n'));
  },
  'n11-rate-trap': (ws) => {
    const p = path.join(ws, 'billing2/rates.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const k of Object.keys(j.rates)) j.rates[k] = Math.round(j.rates[k] * 1.05 * 100) / 100;
    fs.writeFileSync(p, JSON.stringify(j, null, 2));
  },
  'n12-unique-id': (ws) => {
    W(ws, 'lib/id.js', [
      "'use strict';",
      'let seq = 0;',
      'function makeId() { seq += 1; return "id-" + seq + "-" + Math.random().toString(36).slice(2, 8); }',
      'module.exports = { makeId };',
    ].join('\n'));
  },
};

async function main() {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
  let bad = 0;
  console.log('== checker self-test (pristine must FAIL, gold must PASS) ==\n');
  for (const item of ITEMS) {
    const id = item.task_id;
    const fn = CHECKERS[id];
    if (!fn) { console.log(`[NO CHECKER] ${id}`); bad++; continue; }

    const pristine = path.join(TMP, 'pristine__' + id);
    copyDir(path.join(FIX, id), pristine);
    let pRes;
    try { pRes = await fn(pristine); } catch (e) { pRes = { pass: true, criteria: [], err: e.message }; }

    const gold = path.join(TMP, 'gold__' + id);
    copyDir(path.join(FIX, id), gold);
    let gRes;
    try { GOLD[id](gold); gRes = await fn(gold); } catch (e) { gRes = { pass: false, criteria: [], err: e.message }; }

    const pristineOK = pRes.pass === false;
    const goldOK = gRes.pass === true;
    const line = pristineOK && goldOK ? 'OK  ' : 'BAD ';
    if (!pristineOK || !goldOK) bad++;
    console.log(`[${line}] ${id.padEnd(22)} pristine_pass=${pRes.pass} gold_pass=${gRes.pass} ` +
      `gold_criteria=${(gRes.criteria || []).filter((c) => c.pass).length}/${(gRes.criteria || []).length}` +
      (gRes.err ? ` ERR=${String(gRes.err).slice(0, 80)}` : ''));
    if (!goldOK) {
      for (const c of (gRes.criteria || []).filter((c) => !c.pass)) console.log(`         failed: ${c.id} ${c.detail}`);
    }
  }
  console.log('');
  console.log(bad === 0
    ? `SELFTEST PASS: all ${ITEMS.length} checkers are non-vacuous and satisfiable`
    : `SELFTEST FAIL: ${bad} item(s) mis-specified`);
  process.exit(bad === 0 ? 0 : 1);
}

if (require.main === module) main();
module.exports = { main };
