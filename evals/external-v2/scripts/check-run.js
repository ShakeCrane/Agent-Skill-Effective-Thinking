#!/usr/bin/env node
// check-run.js <taskId> <workspacePath>
//
// Runs the task's deterministic checker against a workspace and prints the standard machine-readable
// JSON result. A checker exception is reported as checkerStatus:"error" with taskPass:false — an
// exception is NEVER interpreted as a task pass.
'use strict';
const path = require('path');
const { evaluatorDir, seedDir } = require('./lib.js');

function normalize(taskId, raw) {
  const criteria = Array.isArray(raw && raw.criteria) ? raw.criteria : [];
  const primary = criteria.filter((c) => c.primary !== false);
  const out = {
    taskId,
    checkerStatus: 'ok',
    taskPass: !!raw.taskPass && primary.every((c) => !!c.passed),
    primaryPassed: primary.filter((c) => !!c.passed).length,
    primaryTotal: primary.length,
    criteria: criteria.map((c) => ({
      id: c.id, passed: !!c.passed, primary: c.primary !== false, detail: c.detail === undefined ? '' : String(c.detail),
    })),
    secondary: (raw && raw.secondary) || {},
    notes: (raw && raw.notes) || [],
  };
  return out;
}

async function runCheck(taskId, ws) {
  let checker;
  try {
    checker = require(path.join(evaluatorDir(taskId), 'checker.js'));
  } catch (e) {
    return { taskId, checkerStatus: 'error', taskPass: false, primaryPassed: 0, primaryTotal: 0, criteria: [], secondary: {}, notes: [`checker load failed: ${e.message}`] };
  }
  try {
    const raw = await checker.check(ws, { seedDir: seedDir(taskId), taskId });
    return normalize(taskId, raw);
  } catch (e) {
    return { taskId, checkerStatus: 'error', taskPass: false, primaryPassed: 0, primaryTotal: 0, criteria: [], secondary: {}, notes: [`checker threw: ${e.message}`] };
  }
}

async function main() {
  const [taskId, ws] = process.argv.slice(2);
  if (!taskId || !ws) { console.error('usage: node scripts/check-run.js <taskId> <workspacePath>'); process.exit(2); }
  const res = await runCheck(taskId, ws);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.checkerStatus === 'ok' ? 0 : 1);
}

if (require.main === module) main();
module.exports = { runCheck, normalize };
