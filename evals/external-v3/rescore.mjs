#!/usr/bin/env node
// Rescore — re-runs the v2 checkers over EXISTING workspaces (absolute paths) after the
// relative-path scoring bug (F20) and rewrites result.json in place. Episodes are NOT re-run:
// telemetry/transcript stay untouched; only taskPass/criteria/checkerError are recomputed.
// Also rebuilds manifest.jsonl from the corrected results.
//
// Usage: node rescore.mjs <runsDir> [<runsDir2> ...]

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runChecker } from './lib/v2tasks.mjs';

const dirs = process.argv.slice(2);
if (!dirs.length) { console.error('usage: node rescore.mjs <runsDir> [...]'); process.exit(2); }

for (const runsDir of dirs.map((d) => resolve(d))) {
  if (!existsSync(runsDir)) { console.error(`skip (missing): ${runsDir}`); continue; }
  const manifest = [];
  let changed = 0, unchanged = 0;
  for (const d of readdirSync(runsDir)) {
    const rp = join(runsDir, d, 'result.json');
    const ws = join(runsDir, d, 'ws');
    if (!existsSync(rp) || !existsSync(ws)) continue;
    const r = JSON.parse(readFileSync(rp, 'utf8'));
    let taskPass = false, criteria = [], checkerError = null;
    try {
      const verdict = await runChecker(r.task, ws);
      taskPass = !!verdict.taskPass;
      criteria = (verdict.criteria || []).map((c) => ({ id: c.id, passed: c.passed }));
    } catch (err) {
      checkerError = String(err.message).slice(0, 300);
    }
    const before = `${r.taskPass}|${(r.criteria || []).length}|${(r.criteria || []).filter((c) => c.passed).length}`;
    const after = `${taskPass}|${criteria.length}|${criteria.filter((c) => c.passed).length}`;
    r.taskPass = taskPass; r.criteria = criteria; r.checkerError = checkerError;
    r.rescoredAt = new Date().toISOString();
    if (before !== after) { changed++; } else { unchanged++; }
    writeFileSync(rp, JSON.stringify(r, null, 2));
    manifest.push({ runid: r.runid, task: r.task, arm: r.arm, repeat: r.repeat, status: r.status, taskPass });
  }
  const mf = join(runsDir, 'manifest.jsonl');
  if (manifest.length) writeFileSync(mf, manifest.map((m) => JSON.stringify(m)).join('\n') + '\n');
  const pass = manifest.filter((m) => m.taskPass).length;
  console.log(`${runsDir}: ${manifest.length} runs rescored, ${changed} changed, pass ${pass}/${manifest.length}`);
}
