#!/usr/bin/env node
// Self-audit: ONE command that verifies and reports the health of the whole skill.
// Runs every check in the npm test chain, prints a concise PASS/FAIL ledger, and exits non-zero if
// anything failed. Purpose: "可验证 / 更高效" — an operator or agent sees the entire status in a
// single run instead of inspecting 22 reports.
//
// Usage: node bin/self-audit.js   (or `npm run audit`)
//
// NOTE: child output streams through via stdio:'inherit' (each check prints its own verdict), and
// pass/fail is judged by EXIT STATUS — capturing piped child stdout is blocked in a confined
// sandbox (EPERM), so we deliberately avoid it.

'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');
const CHECKS = (pkg.scripts.test || '')
  .split('&&')
  .map((s) => s.trim())
  .filter((s) => s.startsWith('node '))
  .map((s) => (s.match(/^node\s+([^\s]+)/) || [])[1])
  .filter(Boolean);

function runOne(file) {
  const label = path.basename(file);
  console.log(`\n----- ${label} -----`);
  let ok = true;
  try {
    execFileSync(process.execPath, [path.join(ROOT, file)], { stdio: 'inherit' });
  } catch (e) {
    ok = false;
  }
  return { label, ok };
}

// Allowed stdio for the harness: inherit + ignore work in the confined sandbox; pipes are blocked.
function run() {
  console.log('== COGNITIVE AGENT SKILL — SELF-AUDIT ==');
  const results = CHECKS.map(runOne);
  let passed = 0;
  for (const r of results) {
    if (r.ok) passed += 1;
    console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.label}`);
  }
  const total = results.length;
  const rate = total ? ((passed / total) * 100).toFixed(0) : 0;
  console.log('');
  console.log(`Checks: ${passed}/${total} passed (${rate}%).`);
  console.log('Exit: ' + (passed === total ? '0 — skill healthy' : 'FAIL (non-zero)'));
  process.exit(passed === total ? 0 : 1);
}

run();
