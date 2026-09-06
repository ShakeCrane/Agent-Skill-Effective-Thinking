#!/usr/bin/env node
// Publish-readiness gate: build the real tarball, extract it to a temp "installed" package, then
// run evals/consumer-test.js against it. This proves the SHIPPED artifact loads and works for an
// end user (internal requires resolve from the installed tree, not the repo).
//
// Usage: npm run consume   (or: node bin/consume-pack.js)
// Exit 0 = artifact is consumer-usable.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');

// On Windows npm is a .cmd shim that spawnSync cannot exec directly; run the npm CLI's own JS
// (process.env.npm_execpath) under node instead — the same mechanism `npm run X` uses.
const npmCli = process.env.npm_execpath || 'npm';
function runNpm(args, cwd) {
  if (process.platform === 'win32' && /\.(cmd|ps1)$/i.test(npmCli)) {
    execFileSync('cmd.exe', ['/c', npmCli].concat(args), { cwd, stdio: 'inherit' });
  } else {
    execFileSync(process.execPath, [npmCli].concat(args), { cwd, stdio: 'inherit' });
  }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-consume-'));
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-consume-cache-'));
try {
  // 1. npm pack to the temp dir (prepack runs `npm test`, so this also re-verifies the suite).
  //    Use a temp --cache so it never touches the (sandbox-blocked) global npm-cache.
  console.log('== pack ==');
  runNpm(['pack', '--cache', cacheDir, '--pack-destination', dir], ROOT);
  const tgz = fs.readdirSync(dir).find((f) => f.endsWith('.tgz'));
  if (!tgz) throw new Error('no tarball produced');

  // 2. extract into <dir>/installed/<package>
  const installDir = path.join(dir, 'installed');
  fs.mkdirSync(installDir, { recursive: true });
  execFileSync('tar', ['-xzf', path.join(dir, tgz), '-C', installDir], { stdio: 'inherit' });

  // 3. run the consumer test against the installed package
  console.log('\n== consume (require the installed package, exercise the full public API) ==');
  execFileSync(process.execPath, [path.join(ROOT, 'evals/consumer-test.js')], {
    stdio: 'inherit',
    env: Object.assign({}, process.env, { CONSUMER_PKG_DIR: path.join(installDir, 'package') }),
  });
  console.log('\nCONSUME PASS: shipped tarball is end-user usable.');
} finally {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* best-effort cleanup */ }
  try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch (e) { /* best-effort cleanup */ }
}
