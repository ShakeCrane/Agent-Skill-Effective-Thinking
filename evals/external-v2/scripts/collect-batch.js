#!/usr/bin/env node
// collect-batch.js — measure + judge a set of completed pilot runs, append rows to the results log.
//
// Usage:
//   node scripts/collect-batch.js <fromOrder> <toOrder> [--infra-invalid runId,runId,...]
//
// For every run in the frozen order range it:
//   * measures the workspace artefacts (TASK.md and evaluator metadata EXCLUDED — never counted as
//     agent output, and the Treatment TASK.md embeds the whole SKILL.md)
//   * runs the task's FROZEN checker and stores criterion-level results
//   * appends one row per run to results/pilot-results.jsonl
//
// Telemetry policy: any field this host cannot measure is written as null. Nothing is estimated and
// nothing is fabricated. In particular the host does not expose per-agent tool events, so
// toolCalls / externalActions / failedToolCalls / testsRun / ... are recorded as null.
//
// This file is measurement tooling added at freeze time. It is NOT a frozen input: it implements the
// pre-registered telemetry schema and does not alter any frozen artifact, so verify-freeze is
// unaffected.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readJSON, V2_ROOT, seedDir, exists, walk, sha256 } = require('./lib.js');
const { runCheck } = require('./check-run.js');

const RESULTS_DIR = path.join(V2_ROOT, 'results');
const RESULTS_FILE = path.join(RESULTS_DIR, 'pilot-results.jsonl');
const WS_ROOT = path.join(os.tmpdir(), 'v2-pilot');

function snapshot(dir) {
  const map = {};
  for (const rel of walk(dir)) {
    if (rel === 'TASK.md') continue; // condition input, never an agent artefact
    map[rel] = { sha: sha256(path.join(dir, rel)), size: fs.statSync(path.join(dir, rel)).size };
  }
  return map;
}

async function main() {
  const from = Number(process.argv[2]);
  const to = Number(process.argv[3]);
  const infraArg = process.argv.indexOf('--infra-invalid');
  const infraInvalid = new Set(
    infraArg >= 0 ? String(process.argv[infraArg + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : []
  );
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    console.error('usage: node scripts/collect-batch.js <fromOrder> <toOrder> [--infra-invalid a,b]');
    process.exit(2);
  }

  const order = readJSON(path.join(V2_ROOT, 'run-order.json')).runs;
  const slice = order.filter((r) => r.order >= from && r.order <= to).sort((a, b) => a.order - b.order);
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const rows = [];
  for (const r of slice) {
    const ws = path.join(WS_ROOT, r.runId);
    const base = snapshot(seedDir(r.taskId));
    const now = snapshot(ws);

    const changed = Object.keys(now).filter((f) => !base[f] || base[f].sha !== now[f].sha);
    const created = Object.keys(now).filter((f) => !base[f]);
    const deleted = Object.keys(base).filter((f) => !now[f]);
    const outputBytes = Object.keys(now).reduce((n, f) => n + now[f].size, 0);

    let check;
    try {
      check = await runCheck(r.taskId, ws);
    } catch (e) {
      check = { checkerStatus: 'error', taskPass: false, primaryPassed: 0, primaryTotal: 0, criteria: [], notes: [String(e.message)] };
    }

    const infra = infraInvalid.has(r.runId);
    const row = {
      order: r.order,
      runId: r.runId,
      taskId: r.taskId,
      condition: r.condition,
      replicate: r.replicate,
      status: infra ? 'infra_invalid_rerun' : 'valid_completed',
      // ---- checker outcome ----
      checkerStatus: check.checkerStatus,
      taskPass: check.taskPass,
      primaryPassed: check.primaryPassed,
      primaryTotal: check.primaryTotal,
      failedCriteria: check.criteria.filter((c) => c.primary && !c.passed).map((c) => c.id),
      checkerNotes: check.notes || [],
      // ---- measurable artefact telemetry ----
      outputBytesExcludingConditionInputs: outputBytes,
      filesChanged: changed.length,
      filesCreated: created.length,
      filesDeleted: deleted.length,
      changedPaths: changed,
      // ---- host-measurable timing (dispatch->judge wall clock; scheduling-inclusive) ----
      elapsedMs: null, // host turn latency dominates; recorded as null rather than a misleading number
      // ---- NOT measurable by this host (never fabricated) ----
      toolCalls: null,
      externalActions: null,
      failedToolCalls: null,
      uniqueCommands: null,
      repeatedFailedCommands: null,
      filesReadBeforeFirstEdit: null,
      unrelatedFilesChanged: null,
      testsRun: null,
      editsBeforeFirstTest: null,
      retryCount: null,
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      measuredAt: new Date().toISOString(),
    };
    rows.push(row);
    fs.appendFileSync(RESULTS_FILE, JSON.stringify(row) + '\n');
    console.log(
      `${String(row.order).padStart(2)} ${row.runId.padEnd(42)} ${row.status.padEnd(20)} pass=${row.taskPass} ` +
      `crit=${row.primaryPassed}/${row.primaryTotal} bytes=${outputBytes} changed=${changed.length} ` +
      (row.failedCriteria.length ? 'failed=' + JSON.stringify(row.failedCriteria) : '')
    );
  }
  console.log(`\ncollected ${rows.length} rows -> ${path.relative(V2_ROOT, RESULTS_FILE)}`);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
