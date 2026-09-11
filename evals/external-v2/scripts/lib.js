// Shared construction/evaluation helpers for the v2 pilot suite.
//
// IMPORTANT environment constraint (learned the hard way in v1): capturing a child process's stdout
// through a PIPE is forbidden in this sandbox (spawnSync/execFileSync with stdio:'pipe' -> EPERM).
// So every child process we launch uses stdio:'ignore' and writes its result to a TEMP FILE, which
// the parent then reads. stdio:'inherit' and 'ignore' work fine.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const V2_ROOT = path.join(HERE, '..');
const REPO_ROOT = path.join(V2_ROOT, '..', '..');
const PILOT = path.join(V2_ROOT, 'pilot');
const SKILL_MD = path.join(REPO_ROOT, 'SKILL.md');
// The ONLY Cognitive Skill text a Treatment run may receive. Frozen before the pilot; the live
// repository SKILL.md is deliberately NOT read at prepare time, so run 1 and run 36 inject the
// exact same bytes even if the working tree changes mid-pilot.
const FROZEN_SKILL = path.join(V2_ROOT, 'frozen', 'SKILL.md');
const FREEZE_MANIFEST = path.join(V2_ROOT, 'freeze-manifest.json');
const FREEZE_META = path.join(V2_ROOT, 'frozen', 'freeze-metadata.json');

const read = (p) => fs.readFileSync(p, 'utf8');
const readJSON = (p) => JSON.parse(read(p));
const exists = (p) => fs.existsSync(p);
const writeFile = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function walk(dir, base = dir, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

function tmpdir(prefix) {
  const d = path.join(os.tmpdir(), `v2-${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Run a JS snippet in a child Node process (optionally with a different TZ/cwd) and return
// { status, json, raw }. The child writes its JSON payload to a temp file; no pipes are used.
function runNodeJSON(code, opts = {}) {
  const outFile = path.join(os.tmpdir(), `v2-child-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const wrap =
    `const fs=require('fs');const _f=${JSON.stringify(outFile)};` +
    `const _emit=(o)=>fs.writeFileSync(_f, JSON.stringify(o));` +
    `try{${code}\n}catch(e){_emit({__error:String(e&&e.message||e)});}`;
  const env = Object.assign({}, process.env, opts.env || {});
  const r = spawnSync(process.execPath, ['-e', wrap], {
    cwd: opts.cwd || V2_ROOT, env, stdio: 'ignore', timeout: opts.timeout || 30000,
  });
  let raw = '';
  try { raw = fs.readFileSync(outFile, 'utf8'); } catch (e) { /* child wrote nothing */ }
  try { fs.unlinkSync(outFile); } catch (e) { /* best effort */ }
  let json = null;
  try { json = JSON.parse(raw); } catch (e) { /* not JSON */ }
  return { status: r.status, json, raw, error: r.error ? String(r.error.message) : null };
}

// Run an npm script in a child process without pipes. Returns the exit status only.
function runNpm(script, cwd) {
  const npmCli = process.env.npm_execpath;
  const r = npmCli
    ? spawnSync(process.execPath, [npmCli, 'run', script], { cwd, stdio: 'ignore', timeout: 60000 })
    : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], { cwd, stdio: 'ignore', timeout: 60000, shell: process.platform === 'win32' });
  return { status: r.status, error: r.error ? String(r.error.message) : null };
}

function taskDir(taskId) { return path.join(PILOT, taskId); }
function seedDir(taskId) { return path.join(PILOT, taskId, 'seed'); }
function evaluatorDir(taskId) { return path.join(PILOT, taskId, 'evaluator'); }

function listTaskIds() {
  if (!exists(PILOT)) return [];
  return fs.readdirSync(PILOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^v2-\d\d-/.test(e.name))
    .map((e) => e.name)
    .sort();
}

const ALLOWED_SOURCE_TYPES = new Set([
  'user_task', 'repository_contract', 'public_api_contract', 'existing_visible_test', 'schema_contract',
]);

// A directory's content hash: sorted relative paths + SHA-256 of each file, then hashed again.
// Deterministic across platforms (forward-slash separators, sorted keys).
function treeHash(dir) {
  const files = walk(dir).slice().sort();
  const h = crypto.createHash('sha256');
  for (const rel of files) {
    h.update(rel.split(path.sep).join('/'));
    h.update('\0');
    h.update(sha256(path.join(dir, rel)));
    h.update('\n');
  }
  return h.digest('hex');
}

module.exports = {
  HERE, V2_ROOT, REPO_ROOT, PILOT, SKILL_MD, FROZEN_SKILL, FREEZE_MANIFEST, FREEZE_META,
  read, readJSON, exists, writeFile, sha256, treeHash, copyDir, walk, tmpdir,
  runNodeJSON, runNpm, taskDir, seedDir, evaluatorDir, listTaskIds, ALLOWED_SOURCE_TYPES,
};
