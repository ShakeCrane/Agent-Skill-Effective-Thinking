#!/usr/bin/env node
// Phase 2 deterministic acceptance checkers — FROZEN before any run.
//
// Every checker: check(workspace) -> { pass, criteria:[{id,name,pass,detail}], notes?, tamper? }
//
// Rules that keep this honest:
//  - Expected values are always recomputed from the PRISTINE fixture directory, never from the run
//    workspace (so an agent cannot "pass" by editing its own inputs).
//  - Tamper signals (a protected file was modified) are reported explicitly and force pass=false.
//  - Checkers return per-criterion results, so "requirement omission" is measurable, not just a
//    single win/lose bit.
//  - Nothing here may be edited after Main Evaluation run #1 except to fix a genuine harness bug.

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const FIX = path.join(HERE, 'fixtures');

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const sha = (p) => require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const C = (id, name, pass, detail) => ({ id, name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });

// Run a Node snippet in a CHILD process and capture its stdout WITHOUT piped stdio, because some
// sandboxes forbid capturing a child's stdout through a pipe (spawnSync returns EPERM). The child's
// process.stdout.write is redirected to a temp file, the child runs with stdio:'ignore', and we
// read the file back. This preserves the checker's SEMANTICS (exit status + printed output) while
// changing only the IPC mechanism. Harness-compatibility fix M6; no criteria or task change.
function captureNode(script, opts = {}) {
  const outFile = path.join(os.tmpdir(), `cog-check-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const wrap =
    `const fs=require('fs');` +
    `const _f=${JSON.stringify(outFile)};` +
    `const _w=function(s){fs.appendFileSync(_f, typeof s==='string'?s:Buffer.isBuffer(s)?s.toString():String(s)); return true;};` +
    `process.stdout.write=_w; process.stderr.write=_w;` +
    script;
  const r = spawnSync(process.execPath, ['-e', wrap], Object.assign({ stdio: 'ignore' }, opts || {}));
  let stdout = '';
  try { stdout = fs.readFileSync(outFile, 'utf8'); } catch (e) { /* child produced no output */ }
  try { fs.unlinkSync(outFile); } catch (e) { /* best effort */ }
  return { status: r.status, stdout, error: r.error };
}

function walk(dir, base = dir, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(p);
  }
  return out;
}
const rel = (p, base) => path.relative(base, p).split(path.sep).join('/');

// ---------------------------------------------------------------- A1 csv->json
function a1(ws) {
  const c = [];
  const out = path.join(ws, 'output.json');
  if (!exists(out)) return { pass: false, criteria: [C('a1.exists', 'output.json exists', false, 'missing')] };
  let arr;
  try { arr = JSON.parse(read(out)); } catch (e) { return { pass: false, criteria: [C('a1.json', 'valid JSON', false, e.message)] }; }
  const rows = read(path.join(FIX, 'a1-csv-to-json/data/people.csv')).trim().split(/\r?\n/).slice(1)
    .map((l) => l.split(',')).map(([name, age, city]) => ({ name, age: Number(age), city }));
  c.push(C('a1.count', 'exactly 8 objects', arr.length === 8, `got ${arr.length}`));
  const keysOK = Array.isArray(arr) && arr.every((o) => o && Object.keys(o).sort().join(',') === 'age,city,name');
  c.push(C('a1.keys', 'every object has exactly name, age, city', keysOK, ''));
  const typesOK = Array.isArray(arr) && arr.every((o) => typeof o.age === 'number' && typeof o.name === 'string' && typeof o.city === 'string');
  c.push(C('a1.types', 'age is a number, others strings', typesOK, ''));
  let mismatch = 0;
  for (let i = 0; i < rows.length && i < arr.length; i++) {
    if (arr[i].name !== rows[i].name || arr[i].age !== rows[i].age || arr[i].city !== rows[i].city) mismatch++;
  }
  c.push(C('a1.values', 'all values match the CSV rows', mismatch === 0, `${mismatch} row(s) differ`));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- A2 rename ext
function a2(ws) {
  const dir = path.join(ws, 'assets');
  const files = exists(dir) ? fs.readdirSync(dir).sort() : [];
  const c = [];
  c.push(C('a2.nojpeg', 'no .jpeg files remain', files.every((f) => !f.endsWith('.jpeg')), files.filter((f) => f.endsWith('.jpeg')).join(',')));
  const want = { 'photo-01.jpg': 'img:01', 'photo-02.jpg': 'img:02', 'vacation.jpg': 'img:03', 'logo.png': 'img:png', 'banner.jpg': 'img:already-jpg', 'notes.txt': 'do not touch this file' };
  const missing = Object.keys(want).filter((f) => !files.includes(f));
  c.push(C('a2.present', 'all expected files present', missing.length === 0, 'missing: ' + missing.join(',')));
  const bad = Object.keys(want).filter((f) => exists(path.join(dir, f)) && read(path.join(dir, f)).trim() !== want[f]);
  c.push(C('a2.content', 'contents preserved / untouched files unchanged', bad.length === 0, 'changed: ' + bad.join(',')));
  c.push(C('a2.noextra', 'no unexpected files created', files.filter((f) => !(f in want)).length === 0, files.filter((f) => !(f in want)).join(',')));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- B1 date range
function b1(ws) {
  const c = [];
  const mod = path.join(ws, 'lib/date-range.js');
  if (!exists(mod)) return { pass: false, criteria: [C('b1.exists', 'lib/date-range.js exists', false, 'missing')] };
  let m;
  try { m = require(mod); } catch (e) { return { pass: false, criteria: [C('b1.load', 'module loads', false, e.message)] }; }
  c.push(C('b1.exports', 'exports overlaps and merge', typeof m.overlaps === 'function' && typeof m.merge === 'function', Object.keys(m).join(',')));
  const t = (name, got, want) => c.push(C(name, name, got === want, `got ${got} want ${want}`));
  t('b1.touch', m.overlaps({ start: 0, end: 10 }, { start: 10, end: 20 }), false);
  t('b1.overlap', m.overlaps({ start: 0, end: 10 }, { start: 5, end: 15 }), true);
  t('b1.disjoint', m.overlaps({ start: 0, end: 5 }, { start: 10, end: 15 }), false);
  // hidden second defect: merge must sort before merging
  const unsorted = m.merge([{ start: 10, end: 20 }, { start: 0, end: 5 }, { start: 4, end: 12 }]);
  const uOK = Array.isArray(unsorted) && unsorted.length === 1 && unsorted[0].start === 0 && unsorted[0].end === 20;
  c.push(C('b1.merge_unsorted', 'merge handles UNSORTED input', uOK, JSON.stringify(unsorted)));
  const sep = m.merge([{ start: 0, end: 5 }, { start: 10, end: 15 }]);
  const sOK = Array.isArray(sep) && sep.length === 2 && sep[0].start === 0 && sep[1].start === 10;
  c.push(C('b1.merge_separate', 'merge keeps disjoint ranges separate', sOK, JSON.stringify(sep)));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- B2 retry
async function b2(ws) {
  const c = [];
  const mod = path.join(ws, 'lib/retry.js');
  if (!exists(mod)) return { pass: false, criteria: [C('b2.exists', 'lib/retry.js exists', false, 'missing')] };
  let retry;
  try { retry = require(mod).retry; } catch (e) { return { pass: false, criteria: [C('b2.load', 'module loads', false, e.message)] }; }
  if (typeof retry !== 'function') return { pass: false, criteria: [C('b2.fn', 'retry is a function', false, typeof retry)] };

  // Style-agnostic: an implementation may be sync-returning or async-returning; both are correct
  // readings of "if fn returns a promise, await it". We measure SEMANTICS, not code style.
  const call = async (times, fn) => {
    try { return { ok: true, value: await retry(times, fn) }; }
    catch (e) { return { ok: false, error: e }; }
  };

  let n = 0;
  const r1 = await call(3, () => { n++; return 'v'; });
  c.push(C('b2.first_try', 'success on first attempt returns the value', r1.ok && r1.value === 'v', r1.ok ? String(r1.value) : 'threw:' + r1.error.message));
  c.push(C('b2.call_once', 'called exactly once when first succeeds', n === 1, `calls=${n}`));

  n = 0;
  const r2 = await call(3, () => { n++; if (n < 2) throw new Error('e1'); return 'ok'; });
  c.push(C('b2.retry_then_ok', 'returns value after a failed attempt', r2.ok && r2.value === 'ok' && n === 2, `got=${r2.ok ? r2.value : 'threw'} calls=${n}`));

  n = 0;
  const r3 = await call(3, () => { n++; throw new Error('e' + n); });
  c.push(C('b2.last_error', 'surfaces the LAST error when all attempts fail', !r3.ok && r3.error.message === 'e3', r3.ok ? 'no error' : r3.error.message));
  c.push(C('b2.bounded', 'never called more than `times`', n === 3, `calls=${n}`));

  n = 0;
  const r4 = await call(2, async () => { n++; if (n < 2) throw new Error('ae1'); return 'async-ok'; });
  c.push(C('b2.async_ok', 'async fn awaited and resolved value returned', r4.ok && r4.value === 'async-ok', r4.ok ? String(r4.value) : 'rejected:' + r4.error.message));

  n = 0;
  const r5 = await call(2, async () => { n++; throw new Error('ae' + n); });
  c.push(C('b2.async_last', 'async all-fail surfaces last error', !r5.ok && r5.error.message === 'ae2', r5.ok ? 'no reject' : r5.error.message));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- C1 intermittent cache
function c1(ws) {
  const c = [];
  const script = (order) => `
    const { Cache } = require(${JSON.stringify(path.join(ws, 'lib/cache.js'))});
    ${order === 1
      ? 'const a = new Cache({ ttl: 1 }); const b = new Cache();'
      : 'const b = new Cache(); const a = new Cache({ ttl: 1 });'}
    console.log(JSON.stringify({ first: a.opts.ttl, second: b.opts.ttl, max: b.opts.max }));
  `;
  for (const order of [1, 2]) {
    let out;
    try { out = JSON.parse(captureNode(script(order), { cwd: ws }).stdout); }
    catch (e) { c.push(C('c1.order' + order, `order ${order} runs`, false, String(e.message).slice(0, 120))); continue; }
    c.push(C('c1.order' + order, `no shared-state leak (order ${order})`, out.second === 60 && out.first === 1, JSON.stringify(out)));
  }
  let basic;
  try {
    basic = JSON.parse(captureNode(`
      const { Cache } = require(${JSON.stringify(path.join(ws, 'lib/cache.js'))});
      const k = new Cache(); k.set('x', 42);
      console.log(JSON.stringify({ got: k.get('x'), ttl: k.opts.ttl, max: k.opts.max }));
    `, { cwd: ws }).stdout);
  } catch (e) { basic = { got: 'error' }; }
  c.push(C('c1.api', 'set/get still work', basic.got === 42, JSON.stringify(basic)));
  c.push(C('c1.defaults', 'defaults remain ttl=60 max=100', basic.ttl === 60 && basic.max === 100, JSON.stringify(basic)));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- D1 architecture decision
function d1(ws) {
  const p = path.join(ws, 'decision.md');
  if (!exists(p)) return { pass: false, criteria: [C('d1.exists', 'decision.md exists', false, 'missing')] };
  const t = read(p).toLowerCase();
  const c = [];
  const approaches = [
    ['json-file', /json file|one file per|\.app\/sessions|approach a|option a|\(a\)/],
    ['sqlite', /sqlite|\(b\)|option b|approach b/],
    ['in-memory', /in memory|in-memory|memory only|\(c\)|option c|approach c/],
  ];
  const named = approaches.filter(([, re]) => re.test(t)).map(([n]) => n);
  const rec = /i recommend|recommendation|we should|i would choose|choose |chosen|selected|decision:/.test(t);
  c.push(C('d1.recommendation', 'states one definite recommendation', rec && named.length >= 1, `markers=${rec} named=${named.join('|')}`));
  c.push(C('d1.alternatives', 'discusses at least two alternatives', named.length >= 2, named.join('|')));
  const rej = /reject|rule[d]? out|discard|not chosen|ruled out|instead of/.test(t);
  c.push(C('d1.rejects', 'gives a reason for rejecting an alternative', rej, ''));
  c.push(C('d1.risk', 'names at least one risk', /risk/.test(t), ''));
  c.push(C('d1.rollback', 'gives a rollback or fallback', /rollback|roll back|fallback|fall back|revert/.test(t), ''));
  c.push(C('d1.falsification', 'states a concrete falsification criterion', /falsif|would prove|would be wrong|would change|if .{0,60}then .{0,40}(wrong|reconsider|switch|change)/.test(t), ''));
  c.push(C('d1.constraints', 'addresses the 50MB and crash-survival constraints', /50\s*mb|50mb/.test(t) && /crash|power loss|power-loss/.test(t), ''));
  return { pass: c.every((x) => x.pass), criteria: c, notes: 'subjective item — also routed to blinded reviewer; the CHOICE itself is not scored' };
}

// ---------------------------------------------------------------- E1 read config
function e1(ws) {
  const c = [];
  const yaml = path.join(ws, 'deploy/settings.yaml');
  const cfgPath = path.join(ws, 'service-config.json');
  if (!exists(cfgPath)) return { pass: false, criteria: [C('e1.exists', 'service-config.json exists', false, 'missing')] };
  const y = read(path.join(FIX, 'e1-read-config/deploy/settings.yaml'));
  const wantPort = Number((y.match(/port:\s*(\d+)/) || [])[1]);
  const wantTimeout = Number((y.match(/timeout_ms:\s*(\d+)/) || [])[1]);
  let cfg;
  try { cfg = JSON.parse(read(cfgPath)); } catch (e) { return { pass: false, criteria: [C('e1.json', 'valid JSON', false, e.message)] }; }
  c.push(C('e1.port', 'port matches settings.yaml', cfg.port === wantPort, `got ${cfg.port} want ${wantPort}`));
  c.push(C('e1.timeout', 'timeout_ms matches settings.yaml', cfg.timeout_ms === wantTimeout, `got ${cfg.timeout_ms} want ${wantTimeout}`));
  c.push(C('e1.preserved', 'log_level and replicas unchanged', cfg.log_level === 'info' && cfg.replicas === 3, JSON.stringify(cfg)));
  c.push(C('e1.keys', 'exactly the original four keys', Object.keys(cfg).sort().join(',') === 'log_level,port,replicas,timeout_ms', Object.keys(cfg).join(',')));
  const tamper = exists(yaml) && sha(yaml) !== sha(path.join(FIX, 'e1-read-config/deploy/settings.yaml'));
  c.push(C('e1.yaml_untouched', 'deploy/settings.yaml unmodified', !tamper, ''));
  return { pass: c.every((x) => x.pass), criteria: c, tamper: tamper ? 'settings.yaml modified' : null };
}

// ---------------------------------------------------------------- E2 count todos
function countTodos(root) {
  let n = 0;
  for (const f of walk(root)) {
    for (const line of read(f).split(/\r?\n/)) {
      const s = line.trim();
      if (/^(\/\/|#|\*|\/\*)/.test(s)) n += (s.match(/TODO/g) || []).length;
    }
  }
  return n;
}
function e2(ws) {
  const c = [];
  const want = countTodos(path.join(FIX, 'e2-count-todos/src'));
  const p = path.join(ws, 'answer.txt');
  if (!exists(p)) return { pass: false, criteria: [C('e2.exists', 'answer.txt exists', false, 'missing')] };
  const got = read(p).trim();
  c.push(C('e2.integer', 'answer.txt is a single integer', /^\d+$/.test(got), got));
  c.push(C('e2.count', 'count is correct', Number(got) === want, `got ${got} want ${want}`));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- F1 billing rates
function f1(ws) {
  const c = [];
  const p = path.join(ws, 'billing/rates.json');
  if (!exists(p)) return { pass: false, criteria: [C('f1.exists', 'billing/rates.json exists', false, 'missing')] };
  const src = JSON.parse(read(path.join(FIX, 'f1-billing-rates/billing/rates.json')));
  let got;
  try { got = JSON.parse(read(p)); } catch (e) { return { pass: false, criteria: [C('f1.json', 'valid JSON', false, e.message)] }; }
  const bad = [];
  for (const k of Object.keys(src.rates)) {
    const want = Math.round(src.rates[k] * 1.05 * 100) / 100;
    if (!(k in (got.rates || {})) || Math.abs(got.rates[k] - want) > 0.005) bad.push(`${k}: got ${got.rates && got.rates[k]} want ${want}`);
  }
  c.push(C('f1.rates', 'every rate = old * 1.05 (2dp)', bad.length === 0, bad.join('; ')));
  c.push(C('f1.keys', 'rates keeps exactly the original keys', Object.keys(got.rates || {}).sort().join(',') === Object.keys(src.rates).sort().join(','), Object.keys(got.rates || {}).join(',')));
  c.push(C('f1.fields', 'currency/effective_date/plan_name unchanged',
    got.currency === src.currency && got.effective_date === src.effective_date && got.plan_name === src.plan_name,
    JSON.stringify({ currency: got.currency, effective_date: got.effective_date, plan_name: got.plan_name })));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- G1 long context
function g1(ws) {
  const c = [];
  const targets = [
    ['config/worker.json', (txt) => JSON.parse(txt).worker.retry_limit === 7, true],
    ['config/worker.yaml', (txt) => /retry_limit:\s*7\b/.test(txt), false],
    ['src/worker.js', (txt) => /RETRY_LIMIT\s*=\s*7\b/.test(txt), false],
    ['scripts/run-worker.sh', (txt) => /RETRY_LIMIT=7\b/.test(txt), false],
    ['deploy/worker.ini', (txt) => /retry_limit\s*=\s*7\b/.test(txt), false],
  ];
  for (const [f, test, isJson] of targets) {
    const p = path.join(ws, f);
    if (!exists(p)) { c.push(C('g1.' + f, `${f} retry limit is 7`, false, 'missing')); continue; }
    let ok = false, detail = '';
    try { ok = test(read(p)); } catch (e) { detail = (isJson ? 'invalid JSON: ' : 'parse error: ') + e.message; }
    c.push(C('g1.' + f, `${f} retry limit is 7`, ok, detail));
  }
  const changedPath = path.join(ws, 'changed.txt');
  let listed = '';
  if (exists(changedPath)) listed = read(changedPath);
  const miss = targets.map(([f]) => f).filter((f) => !listed.includes(path.basename(f)));
  c.push(C('g1.changed_all', 'changed.txt lists all five files', miss.length === 0, 'missing from list: ' + miss.join(',')));
  const docPath = path.join(ws, 'docs/operations.md');
  const tamper = exists(docPath) && sha(docPath) !== sha(path.join(FIX, 'g1-long-context/docs/operations.md'));
  c.push(C('g1.doc_untouched', 'docs/operations.md unmodified', !tamper, ''));
  return { pass: c.every((x) => x.pass), criteria: c, tamper: tamper ? 'operations.md modified' : null };
}

// ---------------------------------------------------------------- H1 failure recovery
function h1(ws) {
  const c = [];
  const vPath = path.join(ws, 'verify.js');
  if (!exists(vPath)) return { pass: false, criteria: [C('h1.exists', 'verify.js exists', false, 'missing')], tamper: 'verify.js deleted' };
  const tamper = sha(vPath) !== sha(path.join(FIX, 'h1-failure-recovery/verify.js'));
  c.push(C('h1.untouched', 'verify.js is byte-for-byte unmodified', !tamper, tamper ? 'hash differs from fixture' : ''));
  let exit = 1, out = '';
  const rr = captureNode(`require(${JSON.stringify(vPath)});`, { cwd: ws });
  exit = rr.status === 0 ? 0 : (rr.status === null ? 1 : rr.status);
  out = rr.stdout || (rr.error ? String(rr.error.message) : '');
  c.push(C('h1.passes', '`node verify.js` exits 0', exit === 0, `exit=${exit} ${out.replace(/\n/g, ' ')}`));
  const pct = path.join(ws, 'lib/percent.js');
  const fixed = exists(pct) && sha(pct) !== sha(path.join(FIX, 'h1-failure-recovery/lib/percent.js'));
  c.push(C('h1.fixed_source', 'the fix is in lib/percent.js', fixed, ''));
  return { pass: c.every((x) => x.pass) && !tamper, criteria: c, tamper: tamper ? 'verify.js modified' : null };
}

// ---------------------------------------------------------------- I1 parallel logs
function i1(ws) {
  const c = [];
  const logDir = path.join(FIX, 'i1-parallel-logs/logs');
  const want = {};
  for (const f of fs.readdirSync(logDir)) {
    want[f] = read(path.join(logDir, f)).split(/\r?\n/).filter((l) => /\bERROR\b/.test(l)).length;
  }
  const p = path.join(ws, 'summary.md');
  if (!exists(p)) return { pass: false, criteria: [C('i1.exists', 'summary.md exists', false, 'missing')] };
  const txt = read(p);
  const got = {};
  const lines = txt.split(/\r?\n/).map((l) => l.match(/^-\s*(\S+):\s*(\d+)\s*$/)).filter(Boolean);
  for (const m of lines) got[m[1]] = Number(m[2]);
  c.push(C('i1.lines', `one line per log file (${Object.keys(want).length})`, Object.keys(got).length === Object.keys(want).length, `got ${Object.keys(got).length}`));
  const wrong = Object.keys(want).filter((f) => got[f] !== want[f]);
  c.push(C('i1.counts', 'every count is correct', wrong.length === 0, wrong.map((f) => `${f}: got ${got[f]} want ${want[f]}`).join('; ')));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- J1 one-shot decision
function j1(ws) {
  const c = [];
  const p = path.join(ws, 'decision.md');
  if (!exists(p)) return { pass: false, criteria: [C('j1.exists', 'decision.md exists', false, 'missing')] };
  const raw = read(p);
  const t = raw.toLowerCase();
  const noGo = /\bno[\s-]?go\b/.test(t);
  const goAlone = !noGo && /\bgo\b/.test(t.replace(/\bno[\s-]?go\b/gi, ''));
  const decision = noGo ? 'NO-GO' : goAlone ? 'GO' : 'NONE';
  c.push(C('j1.decision', 'exactly one definite decision', decision !== 'NONE', decision));
  c.push(C('j1.no_dither', 'does not say "it depends" or hedge as the final answer', !/it depends|can.t decide|both are reasonable as a final/.test(t), ''));
  const facts = ['4 hours', '6 hours 20', 'never been executed', '11 months', 'on leave', '8 hours'];
  const cited = facts.filter((f) => t.includes(f.toLowerCase()));
  c.push(C('j1.facts', 'cites at least two concrete facts from the brief', cited.length >= 2, cited.join('|')));
  c.push(C('j1.risk', 'states the main risk driving the decision', /risk|outage|data loss|rollback/.test(t), ''));
  // SECONDARY, not gating: the j1 task text asks for "decision and the reasons", it never asks for a
  // flip condition. Scoring it as a hard requirement would measure the skill's own stylistic rubric
  // rather than task success. Kept as a separate process-completeness signal.
  c.push(Object.assign(C('j1.change_condition', 'states a condition that would change the decision (secondary)', /would change|would reconsider|if .{0,80}(tested|verified|window|available|proven)|until .{0,60}(tested|verified)/.test(t), ''), { secondary: true }));
  c.push(C('j1.no_delegation', 'does not delegate the decision away', !/delegate|hand (it|this) (off )?to|committee|team should decide|ask the board/.test(t), ''));
  return { pass: c.every((x) => x.pass), criteria: c, notes: `extracted decision=${decision} (pre-registered defensible answer: NO-GO)` };
}

// ---------------------------------------------------------------- N1 paginate
function n1(ws) {
  const c = [];
  let paginate;
  try { paginate = require(path.join(ws, 'lib/paginate.js')).paginate; }
  catch (e) { return { pass: false, criteria: [C('n1.load', 'module loads', false, e.message)] }; }
  if (typeof paginate !== 'function') return { pass: false, criteria: [C('n1.fn', 'paginate is a function', false, typeof paginate)] };
  const eq = (id, name, got, want) => c.push(C(id, name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
  eq('n1.pages', 'splits into pages preserving order', paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  eq('n1.empty', 'empty input returns [] (not [[]])', paginate([], 3), []);
  const throws = (id, name, fnArg, pageArg) => {
    let ok = false;
    try { paginate(fnArg, pageArg); } catch (e) { ok = e instanceof TypeError; }
    c.push(C(id, name, ok, ''));
  };
  throws('n1.zero', 'pageSize 0 throws TypeError', [1, 2], 0);
  throws('n1.negative', 'negative pageSize throws TypeError', [1, 2], -1);
  throws('n1.fractional', 'non-integer pageSize throws TypeError', [1, 2], 1.5);
  throws('n1.notarray', 'non-array items throws TypeError', 'abc', 2);
  const src = [1, 2, 3, 4, 5];
  const copy = src.slice();
  paginate(src, 2);
  c.push(C('n1.nomutate', 'input array not mutated', JSON.stringify(src) === JSON.stringify(copy), JSON.stringify(src)));
  eq('n1.single', 'fewer items than pageSize yields one page', paginate([1, 2, 3], 5), [[1, 2, 3]]);
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- N2 truncate (not round)
function n2(ws) {
  const c = [];
  let formatMoney;
  try { formatMoney = require(path.join(ws, 'lib/format.js')).formatMoney; }
  catch (e) { return { pass: false, criteria: [C('n2.load', 'module loads', false, e.message)] }; }
  if (typeof formatMoney !== 'function') return { pass: false, criteria: [C('n2.fn', 'formatMoney is a function', false, typeof formatMoney)] };
  const cases = [[1.239, '1.23'], [1.2, '1.20'], [2, '2.00'], [-1.239, '-1.23'], [0.005, '0.00'], [1.999, '1.99'], [0, '0.00']];
  for (const [inp, want] of cases) {
    let got;
    try { got = formatMoney(inp); } catch (e) { got = 'threw:' + e.message; }
    c.push(C(`n2.${inp}`, `formatMoney(${inp}) === "${want}" (truncate, not round)`, got === want, String(got)));
  }
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- N3 version compare
function n3(ws) {
  const c = [];
  let maxVersion;
  try { maxVersion = require(path.join(ws, 'lib/version.js')).maxVersion; }
  catch (e) { return { pass: false, criteria: [C('n3.load', 'module loads', false, e.message)] }; }
  const cases = [
    ['n3.ten_vs_nine', ['1.2.9', '1.2.10', '1.2.3'], '1.2.10'],
    ['n3.major_minor', ['1.10.0', '1.9.0'], '1.10.0'],
    ['n3.major', ['2.0', '1.99.99'], '2.0'],
    ['n3.single', ['3.1.4'], '3.1.4'],
  ];
  for (const [id, inp, want] of cases) {
    let got;
    try { got = maxVersion(inp); } catch (e) { got = 'threw:' + e.message; }
    c.push(C(id, `maxVersion(${JSON.stringify(inp)}) === ${want}`, got === want, String(got)));
  }
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- N4 three sources
function n4(ws) {
  const c = [];
  const p = path.join(ws, 'report.json');
  if (!exists(p)) return { pass: false, criteria: [C('n4.exists', 'report.json exists', false, 'missing')] };
  let r;
  try { r = JSON.parse(read(p)); } catch (e) { return { pass: false, criteria: [C('n4.json', 'valid JSON', false, e.message)] }; }
  c.push(C('n4.port', 'port from a.yaml', r.port === 9231, String(r.port)));
  c.push(C('n4.workers', 'worker_count from b.ini', r.worker_count === 6, String(r.worker_count)));
  c.push(C('n4.region', 'region from c.json', r.region === 'ap-southeast-2', String(r.region)));
  c.push(C('n4.keys', 'exactly the three requested keys', Object.keys(r).sort().join(',') === 'port,region,worker_count', Object.keys(r).join(',')));
  // decoy: values copied from the outdated draft must not appear
  const txt = read(p);
  c.push(C('n4.no_decoy', 'does not use the outdated draft values', !/8080|us-east-1/.test(txt) && r.worker_count !== 2, ''));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- N5 context distractor
function n5(ws) {
  const c = [];
  const checks = [
    ['conf/worker.json', (t) => JSON.parse(t).worker.retry_limit === 7 && JSON.parse(t).worker.backoff_multiplier === 3],
    ['conf/pool.json', (t) => JSON.parse(t).pool.retry_limit === 7 && JSON.parse(t).pool.backoff_multiplier === 3],
    ['conf/fetcher.yaml', (t) => /retry_limit:\s*7\b/.test(t) && /backoff_multiplier:\s*3\b/.test(t)],
    ['src/sync.js', (t) => /RETRY_LIMIT\s*=\s*7\b/.test(t) && /BACKOFF_MULTIPLIER\s*=\s*3\b/.test(t)],
    ['scripts/run.sh', (t) => /RETRY_LIMIT=7\b/.test(t) && /BACKOFF_MULTIPLIER=3\b/.test(t)],
    ['conf/legacy.ini', (t) => /retry_limit\s*=\s*7\b/.test(t) && /backoff_multiplier\s*=\s*3\b/.test(t)],
  ];
  for (const [f, test] of checks) {
    const p = path.join(ws, f);
    let ok = false, detail = 'missing';
    if (exists(p)) { try { ok = test(read(p)); detail = ''; } catch (e) { detail = e.message; } }
    c.push(C('n5.' + f, `${f}: retry 7 AND backoff 3`, ok, detail));
  }
  const cp = path.join(ws, 'changed.txt');
  const listed = exists(cp) ? read(cp) : '';
  const miss = checks.map(([f]) => f).filter((f) => !listed.includes(path.basename(f)));
  c.push(C('n5.changed', 'changed.txt lists all six files', miss.length === 0, 'missing: ' + miss.join(',')));
  const dp = path.join(ws, 'docs/operations.md');
  const tamper = exists(dp) && sha(dp) !== sha(path.join(FIX, 'n5-context-distractor/docs/operations.md'));
  c.push(C('n5.doc', 'docs/operations.md unmodified', !tamper, ''));
  return { pass: c.every((x) => x.pass), criteria: c, tamper: tamper ? 'operations.md modified' : null };
}

// ---------------------------------------------------------------- N6 two defects
function n6(ws) {
  const c = [];
  const vp = path.join(ws, 'verify.js');
  if (!exists(vp)) return { pass: false, criteria: [C('n6.exists', 'verify.js exists', false, 'missing')], tamper: 'verify.js deleted' };
  const tamper = sha(vp) !== sha(path.join(FIX, 'n6-two-defects/verify.js'));
  c.push(C('n6.untouched', 'verify.js unmodified', !tamper, ''));
  let exit = 1, out = '';
  const rr = captureNode(`require(${JSON.stringify(vp)});`, { cwd: ws });
  exit = rr.status === 0 ? 0 : (rr.status === null ? 1 : rr.status);
  out = rr.stdout || (rr.error ? String(rr.error.message) : '');
  c.push(C('n6.passes', '`node verify.js` exits 0', exit === 0, `exit=${exit} ${out.replace(/\n/g, ' ')}`));
  const sp = path.join(ws, 'lib/stats.js');
  const fixed = exists(sp) && sha(sp) !== sha(path.join(FIX, 'n6-two-defects/lib/stats.js'));
  c.push(C('n6.fixed_source', 'fix is in lib/stats.js', fixed, ''));
  return { pass: c.every((x) => x.pass) && !tamper, criteria: c, tamper: tamper ? 'verify.js modified' : null };
}

// ---------------------------------------------------------------- N7 no extra files
function n7(ws) {
  const c = [];
  const p = path.join(ws, 'notes.txt');
  if (!exists(p)) return { pass: false, criteria: [C('n7.exists', 'notes.txt exists', false, 'missing')] };
  const want = ['epsilon', 'delta', 'gamma', 'beta', 'alpha'].join('\n');
  const got = read(p).replace(/\s+$/, '');
  c.push(C('n7.reversed', 'lines reversed in place', got === want, JSON.stringify(got.slice(0, 60))));
  const extra = fs.readdirSync(ws).filter((f) => f !== 'notes.txt' && f !== 'TASK.md');
  c.push(C('n7.no_extra', 'no additional files created', extra.length === 0, extra.join(',')));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- N8 refactor
function n8(ws) {
  const c = [];
  let m;
  try { m = require(path.join(ws, 'lib/strings.js')); }
  catch (e) { return { pass: false, criteria: [C('n8.load', 'module loads', false, e.message)] }; }
  // An implementation that throws must score as FAILED, not crash the checker (a crashing checker
  // would otherwise be scored as a pass by the self-test — see n8 self-test finding).
  const call = (fn, ...args) => { try { return fn(...args); } catch (e) { return `<<threw: ${e.message}>>`; } };
  const t = (id, name, got, want) => c.push(C(id, name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
  t('n8.slug1', 'slugify basic still correct', call(m.slugify, '  Hello World!  '), 'hello-world');
  t('n8.slug2', 'slugify separators still correct', call(m.slugify, 'A/B'), 'a-b');
  t('n8.trunc1', 'truncate with ellipsis still correct', call(m.truncate, 'hello', 3), 'hel...');
  t('n8.trunc2', 'truncate no-op still correct', call(m.truncate, 'hi', 5), 'hi');
  t('n8.null1', 'slugify(null) returns "" (new requirement)', call(m.slugify, null), '');
  t('n8.null2', 'truncate(null, n) returns "" (new requirement)', call(m.truncate, null, 3), '');
  c.push(C('n8.clean', 'helper `clean` is exported', typeof m.clean === 'function', Object.keys(m).join(',')));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- N9 compound count
function compoundCount(root) {
  let n = 0;
  for (const f of walk(root)) {
    const txt = read(f);
    for (const line of txt.split(/\r?\n/)) {
      const s = line.trim();
      if (/^(\/\/|#|\*)/.test(s)) n += (s.match(/FIXME/g) || []).length;
    }
    n += (txt.match(/XXX/g) || []).length;
  }
  return n;
}
function n9(ws) {
  const c = [];
  const want = compoundCount(path.join(FIX, 'n9-compound-count/src2'));
  const p = path.join(ws, 'count.txt');
  if (!exists(p)) return { pass: false, criteria: [C('n9.exists', 'count.txt exists', false, 'missing')] };
  const got = read(p).trim();
  c.push(C('n9.integer', 'count.txt is a single integer', /^\d+$/.test(got), got));
  c.push(C('n9.count', 'compound count correct (FIXME in comments + XXX anywhere)', Number(got) === want, `got ${got} want ${want}`));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- N10 parallel rows
function n10(ws) {
  const c = [];
  const dir = path.join(FIX, 'n10-parallel-rows/data');
  const want = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.csv')) continue;
    const lines = read(path.join(dir, f)).split(/\r?\n/).filter((l) => l.trim() !== '');
    want[f] = Math.max(0, lines.length - 1);
  }
  const p = path.join(ws, 'counts.md');
  if (!exists(p)) return { pass: false, criteria: [C('n10.exists', 'counts.md exists', false, 'missing')] };
  const got = {};
  for (const m of read(p).split(/\r?\n/).map((l) => l.match(/^-\s*(\S+):\s*(\d+)\s*$/)).filter(Boolean)) got[m[1]] = Number(m[2]);
  c.push(C('n10.all_files', `one line per csv file (${Object.keys(want).length})`, Object.keys(got).length === Object.keys(want).length, Object.keys(got).join(',')));
  const wrong = Object.keys(want).filter((f) => got[f] !== want[f]);
  c.push(C('n10.counts', 'every row count correct (empty/header-only = 0)', wrong.length === 0, wrong.map((f) => `${f}: got ${got[f]} want ${want[f]}`).join('; ')));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- N11 rate trap
function n11(ws) {
  const c = [];
  const p = path.join(ws, 'billing2/rates.json');
  if (!exists(p)) return { pass: false, criteria: [C('n11.exists', 'billing2/rates.json exists', false, 'missing')] };
  const src = JSON.parse(read(path.join(FIX, 'n11-rate-trap/billing2/rates.json')));
  let got;
  try { got = JSON.parse(read(p)); } catch (e) { return { pass: false, criteria: [C('n11.json', 'valid JSON', false, e.message)] }; }
  const bad = [];
  for (const k of Object.keys(src.rates)) {
    const want = Math.round(src.rates[k] * 1.05 * 100) / 100;
    if (Math.abs((got.rates || {})[k] - want) > 0.005) bad.push(`${k}: got ${(got.rates || {})[k]} want ${want}`);
  }
  c.push(C('n11.rates', 'rates object increased by 5% (2dp)', bad.length === 0, bad.join('; ')));
  c.push(C('n11.legacy', 'legacy_rate NOT changed (decoy)', got.legacy_rate === src.legacy_rate, `${got.legacy_rate} vs ${src.legacy_rate}`));
  c.push(C('n11.note', 'rate_note NOT changed (decoy)', got.rate_note === src.rate_note, ''));
  c.push(C('n11.discount', 'discount_rate_percent NOT changed (decoy)', got.discount_rate_percent === src.discount_rate_percent, `${got.discount_rate_percent} vs ${src.discount_rate_percent}`));
  c.push(C('n11.currency', 'currency unchanged', got.currency === src.currency, ''));
  return { pass: c.every((x) => x.pass), criteria: c };
}

// ---------------------------------------------------------------- N12 unique ids
function n12(ws) {
  const c = [];
  const p = path.join(ws, 'lib/id.js');
  if (!exists(p)) return { pass: false, criteria: [C('n12.exists', 'lib/id.js exists', false, 'missing')] };
  let out;
  try {
    out = JSON.parse(captureNode(`
      const { makeId } = require(${JSON.stringify(p)});
      const seen = new Set(); let dup = 0; let sample = '';
      for (let i = 0; i < 10000; i++) { const id = makeId(); if (!sample) sample = String(id); if (seen.has(id)) dup++; seen.add(id); }
      console.log(JSON.stringify({ dup, unique: seen.size, sample }));
    `, { cwd: ws }).stdout);
  } catch (e) { return { pass: false, criteria: [C('n12.run', 'module runs', false, String(e.message).slice(0, 120))] }; }
  c.push(C('n12.unique', '10000 generated ids are all unique', out.dup === 0 && out.unique === 10000, JSON.stringify(out)));
  c.push(C('n12.shape', 'id is still a non-empty string', typeof out.sample === 'string' && out.sample.length > 0, String(out.sample)));
  return { pass: c.every((x) => x.pass), criteria: c };
}

const CHECKERS = {
  'a1-csv-to-json': a1,
  'a2-rename-ext': a2,
  'b1-fix-date-range': b1,
  'b2-implement-retry': b2,
  'c1-intermittent-cache': c1,
  'd1-arch-decision': d1,
  'e1-read-config': e1,
  'e2-count-todos': e2,
  'f1-billing-rates': f1,
  'g1-long-context': g1,
  'h1-failure-recovery': h1,
  'i1-parallel-logs': i1,
  'j1-one-shot-decision': j1,
  'n1-paginate': n1,
  'n2-format-truncate': n2,
  'n3-version-compare': n3,
  'n4-three-sources': n4,
  'n5-context-distractor': n5,
  'n6-two-defects': n6,
  'n7-no-extra-files': n7,
  'n8-refactor': n8,
  'n9-compound-count': n9,
  'n10-parallel-rows': n10,
  'n11-rate-trap': n11,
  'n12-unique-id': n12,
};

module.exports = { CHECKERS, countTodos };
