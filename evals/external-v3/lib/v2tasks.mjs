// Round-5 v2-corpus adapter — reuses the frozen External Eval v2 tasks, seeds and checkers
// UNCHANGED (evals/external-v2 is read-only for this round) and adds the controlC arm:
// the v2 task text plus a LENGTH-MATCHED placebo injected under the same heading treatment uses,
// so treatment-vs-controlC isolates skill CONTENT from prompt LENGTH.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..'); // lib/ -> external-v3 -> evals -> repo root
export const V2_ROOT = join(REPO, 'evals', 'external-v2');
export const FROZEN_SKILL = readFileSync(join(V2_ROOT, 'frozen', 'SKILL.md'), 'utf8');
export const PLACEBO = readFileSync(join(HERE, '..', 'placebo.md'), 'utf8');
// Round-6 slim variants (see research/round6-slim-protocol.md; length-matched to each other).
export const SLIM_SKILL = readFileSync(join(HERE, '..', 'slim-skill.md'), 'utf8');
export const SLIM_PLACEBO = readFileSync(join(HERE, '..', 'slim-placebo.md'), 'utf8');

export function v2TaskIds() {
  return readdirSync(join(V2_ROOT, 'pilot')).filter((d) => d.startsWith('v2-')).sort();
}

export function taskCommonText(taskId) {
  return readFileSync(join(V2_ROOT, 'pilot', taskId, 'task.md'), 'utf8').trim();
}

// v2 templates verbatim; controlC mirrors the treatment template with the placebo payload.
export function buildTaskMd(taskId, arm) {
  const common = taskCommonText(taskId);
  if (arm === 'controlA') return `# Task\n\n${common}\n`;
  if (arm === 'controlB') {
    return `# Task\n\n${common}\n\n# Working guidance\n\n先确认任务目标和约束，再执行；完成后用最直接可靠的方法验证结果。不要做与任务无关的改动。\n`;
  }
  if (arm === 'controlC') return `# Task\n\n${common}\n\n# Cognitive Skill\n\n${PLACEBO}\n`;
  if (arm === 'slimControl') return `# Task\n\n${common}\n\n# Cognitive Skill\n\n${SLIM_PLACEBO}\n`;
  if (arm === 'slimTreatment') return `# Task\n\n${common}\n\n# Cognitive Skill\n\n${SLIM_SKILL}\n`;
  if (arm === 'treatment') return `# Task\n\n${common}\n\n# Cognitive Skill\n\n${FROZEN_SKILL}\n`;
  throw new Error(`unknown arm '${arm}'`);
}

export function prepareWorkspace(taskId, arm, wsRoot) {
  const seed = join(V2_ROOT, 'pilot', taskId, 'seed');
  if (!existsSync(seed)) throw new Error(`no seed for ${taskId}`);
  if (existsSync(wsRoot)) rmSync(wsRoot, { recursive: true, force: true });
  mkdirSync(wsRoot, { recursive: true });
  cpSync(seed, wsRoot, { recursive: true });
  writeFileSync(join(wsRoot, 'TASK.md'), buildTaskMd(taskId, arm), 'utf8');
  if (existsSync(join(wsRoot, 'evaluator'))) throw new Error('evaluator leaked into workspace');
  return wsRoot;
}

const cRequire = createRequire(import.meta.url);
export function runChecker(taskId, wsRoot) {
  const checkerPath = join(V2_ROOT, 'pilot', taskId, 'evaluator', 'checker.js');
  delete cRequire.cache[cRequire.resolve(checkerPath)];
  const { check } = cRequire(checkerPath);
  return check(wsRoot, { seedDir: join(V2_ROOT, 'pilot', taskId, 'seed') }); // -> { taskPass, criteria, ... }
}
