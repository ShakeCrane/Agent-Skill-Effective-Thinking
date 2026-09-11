#!/usr/bin/env node
// prepare-run.js <taskId> <condition> <destDir>
//
// Builds a FRESH agent workspace for one run: a copy of the task's seed/ plus a TASK.md whose only
// condition-dependent content is the instruction block. The evaluator directory (criteria, checker,
// gold, mutations) is NEVER copied into the workspace.
'use strict';
const fs = require('fs');
const path = require('path');
const { V2_ROOT, seedDir, taskDir, readJSON, read, copyDir, exists, FROZEN_SKILL } = require('./lib.js');

function commonTaskText(taskId) {
  const p = path.join(taskDir(taskId), 'task.md');
  if (!exists(p)) throw new Error(`missing common task text: ${p}`);
  return read(p).trim();
}

function buildTaskMd(taskId, condition, conditionsDoc) {
  const def = conditionsDoc.conditions[condition];
  if (!def) throw new Error(`unknown condition '${condition}'`);
  const common = commonTaskText(taskId);
  // Treatment ALWAYS injects the frozen snapshot — never the live repository SKILL.md.
  const skill = condition === 'treatment' ? read(FROZEN_SKILL) : '';
  return def.taskMdTemplate
    .replace('{COMMON_TASK_TEXT}', common)
    .replace('{SKILL_MD}', skill);
}

function prepare(taskId, condition, destDir) {
  const conditionsDoc = readJSON(path.join(V2_ROOT, 'conditions.json'));
  const src = seedDir(taskId);
  if (!exists(src)) throw new Error(`no seed for task ${taskId}`);
  if (exists(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
  copyDir(src, destDir);
  const taskMd = buildTaskMd(taskId, condition, conditionsDoc);
  fs.writeFileSync(path.join(destDir, 'TASK.md'), taskMd);
  // Guard: the evaluator must never leak into a run workspace.
  if (exists(path.join(destDir, 'evaluator'))) throw new Error('evaluator leaked into workspace');
  return { destDir, taskMd, inputChars: taskMd.length };
}

function main() {
  const [taskId, condition, destDir] = process.argv.slice(2);
  if (!taskId || !condition || !destDir) {
    console.error('usage: node scripts/prepare-run.js <taskId> <condition> <destDir>');
    process.exit(2);
  }
  const r = prepare(taskId, condition, destDir);
  console.log(JSON.stringify({ prepared: true, taskId, condition, workspace: r.destDir, inputChars: r.inputChars }));
}

if (require.main === module) main();
module.exports = { prepare, buildTaskMd, commonTaskText };
