// Package-integrity test: the npm package contract is sound.
// Guards against "script points to a missing file" and "test chain references a missing eval"
// drift — a real maintenance risk in a growing repo. Asserts:
//   1. package.json "main" points to an existing file.
//   2. every npm scripts.* "node <file>" target exists.
//   3. every `npm run <script>` referenced by another script resolves to a defined script.
//   4. every file named in the npm "test" chain exists.
//   5. publish metadata: files whitelist entries exist, and the RELEASE-FACING files are covered by
//      the whitelist (see below), plus prepack runs the reproducible release gate.
//
// Why (5) exists: `test:dsh` runs `evals/dsh-plugin-test.js`. That file was NOT in the `files`
// whitelist, so the script existed in the tarball while its target did not — a published package
// whose own npm scripts could not run. Checking "the file exists in the repo" is not enough; the
// release-facing target must also be reachable in the published artifact, so the contract is
// checked against the whitelist's coverage, not just the working tree.
//
// Run: node evals/package-meta-test.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// 1. main
check('package main points to an existing file', !!pkg.main && exists(pkg.main), `main=${pkg.main}`);

// 2. every script target `node <file>` exists
{
  const missing = [];
  for (const [k, v] of Object.entries(pkg.scripts || {})) {
    const m = /^node\s+([^\s&|]+)/.exec(v);
    if (m && !exists(m[1])) missing.push(`${k}->${m[1]}`);
  }
  check('every npm script node-target exists', missing.length === 0,
    missing.length ? 'MISSING: ' + missing.join(', ') : `${Object.keys(pkg.scripts).length} scripts`);
}

// 3. every `npm run <script>` reference resolves to a defined script (catches a renamed script
//    leaving a dangling reference in prepack / release:*).
{
  const dangling = [];
  const defined = new Set(Object.keys(pkg.scripts || {}));
  for (const [k, v] of Object.entries(pkg.scripts || {})) {
    for (const m of String(v).matchAll(/npm run ([\w:.-]+)/g)) {
      if (!defined.has(m[1])) dangling.push(`${k}->${m[1]}`);
    }
  }
  check('every npm run reference resolves to a defined script', dangling.length === 0,
    dangling.length ? 'DANGLING: ' + dangling.join(', ') : 'no dangling script references');
}

// 4. every file in the test chain exists
{
  const chain = (pkg.scripts && pkg.scripts.test) || '';
  const files = chain.split('&&').map((s) => s.trim()).filter((s) => s.startsWith('node '))
    .map((s) => s.replace(/^node\s+/, '').split(/\s+/)[0]);
  const missing = files.filter((f) => !exists(f));
  check('every test-chain file exists', missing.length === 0,
    missing.length ? 'MISSING: ' + missing.join(', ') : `${files.length} chain files`);
}

// 5a. publish metadata
{
  check('package is publishable (private:false)', pkg.private === false,
    `private=${pkg.private}`);
  check('license declared', typeof pkg.license === 'string' && pkg.license.length > 0,
    `license=${pkg.license}`);
  check('license file exists for the declared license',
    pkg.license !== 'MIT' || exists('LICENSE'), `license=${pkg.license}`);
  check('keywords declared', Array.isArray(pkg.keywords) && pkg.keywords.length > 0,
    `${(pkg.keywords || []).length} keywords`);
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  const missingFiles = files.filter((f) => !exists(f) && !exists(f.replace(/\/$/, '') + '/'));
  check('files whitelist entries all exist', files.length > 0 && missingFiles.length === 0,
    files.length ? `${files.length} entries, none missing` : 'no files field');
}

// 5b. RELEASE-FACING files must be covered by the npm `files` whitelist.
// These are the files the published package's own scripts and DSH bundle contract depend on. If one
// is missing from the whitelist, the tarball ships a script (or an export target) whose file does
// not exist inside the package.
{
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  /** Does an npm `files` whitelist entry cover `rel`? Mirrors npm: a bare name (no glob) covers the
   *  file itself and, if it is a directory, everything beneath it. */
  const covered = (rel) => files.some((patRaw) => {
    const pat = String(patRaw).replace(/^\.\//, '');
    if (pat === rel) return true;
    if (!/[*?[\]{}]/.test(pat)) return rel.startsWith(pat.replace(/\/$/, '') + '/');
    const rx = new RegExp('^' + pat.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
    return rx.test(rel);
  });

  // Derived from the manifest itself, so this cannot drift out of date by hand. Two seed sets:
  //   - `scripts`/`exports`/`main`/`dsh.bundle.patch`: the published package's own RUNNABLE
  //     contract (entry points + the scripts a consumer can actually invoke).
  //   - the `test` chain: checks that only make sense in a checkout and are deliberately NOT
  //     published, so it is intentionally excluded — `npm test` is a repository contract, not a
  //     contract of the shipped artifact.
  const SEED_SCRIPTS = ['dsh:check', 'test:dsh', 'dsh:sync'];
  const releaseFacing = new Set();
  const addTarget = (v) => {
    const m = /^node\s+([^\s&|]+)/.exec(String(v));
    if (m) releaseFacing.add(m[1].replace(/^\.\//, ''));
  };
  const seen = new Set();
  const walk = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const body = (pkg.scripts || {})[name];
    if (body === undefined) return;
    addTarget(body);
    for (const m of String(body).matchAll(/npm run ([\w:.-]+)/g)) walk(m[1]);
  };
  for (const s of SEED_SCRIPTS) walk(s);
  if (pkg.main) releaseFacing.add(pkg.main);
  for (const target of Object.values(pkg.exports || {})) {
    if (typeof target === 'string' && target.startsWith('./') && target !== './*') {
      releaseFacing.add(target.slice(2));
    }
  }
  // The DSH bundle contract declares a patch file by relative path too.
  const patch = pkg.dsh?.bundle?.patch;
  if (typeof patch === 'string') releaseFacing.add(patch.replace(/^\.\//, ''));

  const uncovered = [...releaseFacing]
    .filter((rel) => rel && !/[{}]/.test(rel) && rel !== 'package.json')
    .filter((rel) => exists(rel)) // a target that does not exist is reported by check (2)
    .filter((rel) => !covered(rel));
  check('every release-facing file is covered by the files whitelist', uncovered.length === 0,
    uncovered.length ? 'NOT PACKAGED: ' + uncovered.join(', ') : `${releaseFacing.size} release-facing targets covered`);

  // The specific drift this test was written for: test:dsh -> evals/dsh-plugin-test.js.
  check('the test:dsh script target is packaged',
    covered('evals/dsh-plugin-test.js'), 'evals/dsh-plugin-test.js in files whitelist');
  // …without publishing the rest of the eval corpus.
  check('the rest of evals/ is NOT published',
    !covered('evals/benchmark.js') && !covered('evals/validation.js'),
    'evals/ stays out of the tarball except the DSH contract test');
  // The DSH asset + loader the bundle contract needs.
  check('DSH bundle files are packaged',
    covered('dsh/index.mjs') && covered('dsh/skill-meta.mjs') && covered('dsh/cordis.patch.yml') &&
    covered('dsh/skill/effective-thinking.md'),
    'dsh/index.mjs, dsh/skill-meta.mjs, dsh/cordis.patch.yml, dsh/skill/effective-thinking.md');
  check('dsh:check dependencies are packaged',
    covered('scripts/check-dsh-skill-sync.js') && covered('scripts/sync-dsh-skill.js') && covered('SKILL.md'),
    'scripts/check-dsh-skill-sync.js, scripts/sync-dsh-skill.js, SKILL.md');
}

// 5c. the repack lifecycle: `prepack` must run the reproducible, host-free release gate, so a plain
// `npm pack` verifies the package in an environment with no DSH host installed.
{
  const prepack = pkg.scripts && pkg.scripts.prepack;
  check('prepack runs the reproducible release gate',
    prepack === 'npm run release:check', `prepack=${prepack}`);
  const releaseCheck = (pkg.scripts && pkg.scripts['release:check']) || '';
  check('release:check covers npm test, dsh:check and test:dsh',
    /(^|&&\s*)npm test\b/.test(releaseCheck) &&
    /dsh:check/.test(releaseCheck) && /test:dsh(?!:host)/.test(releaseCheck),
    `release:check=${releaseCheck}`);
  check('release:check does NOT require a real DSH host',
    !/test:dsh:host|--require-host|REQUIRE_DSH/.test(releaseCheck),
    `release:check=${releaseCheck}`);
  const releaseVerify = (pkg.scripts && pkg.scripts['release:verify']) || '';
  check('release:verify gates on the real host AND the release check',
    /test:dsh:host/.test(releaseVerify) && /release:check/.test(releaseVerify),
    `release:verify=${releaseVerify}`);
  check('no npm lifecycle script requires an external DSH host',
    !/test:dsh:host|--require-host|REQUIRE_DSH/.test(prepack || ''),
    `prepack=${prepack}`);
}

console.log(failures === 0 ? 'PACKAGE-META TEST PASS: package contract is sound (main, scripts, test chain, release-facing whitelist, publish metadata)'
  : `PACKAGE-META TEST FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
