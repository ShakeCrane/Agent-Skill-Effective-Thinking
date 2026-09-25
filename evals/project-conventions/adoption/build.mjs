// Adoption-path experiment: build the 4-condition × 5-task matrix.
//
//   node evals/project-conventions/adoption/build.mjs [--check]
//
// Conditions (identical task text, identical fixtures except for the treatment):
//   base      — skill bundle relocated out of .dsh/skills for the whole condition
//   installed — bundle present, prompt says nothing about it
//   agentsmd  — bundle present, the fixture repo carries a minimal AGENTS.md pointer
//   explicit  — bundle present, the prompt names the skill
//
// The canonical task text ends with a boundary sentence that forbids reading anything outside the
// fixture directory. Conditions `agentsmd` and `explicit` require exactly that, so the sentence is
// replaced by the same neutral wording in ALL FOUR conditions: the arms must differ in the adoption
// path only. The change is recorded in the write-up, not hidden.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, getCase, materialise } from '../task-eval/fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const RUNS = join(ROOT, '.scratch', 'adoption', 'runs');
const SKILL = join(ROOT, '.dsh', 'skills', 'project-conventions');

const TASKS = ['L3b-stale-comment', 'L3a-tidy-trap', 'L2b-structure-drift', 'H2-revert-not-reset', 'H4-strict-scope'];
const CONDITIONS = ['base', 'installed', 'agentsmd', 'explicit'];

const OLD_BOUNDARY = 'Work only inside your project directory. Do not read from or write to any other directory on this\nmachine.';
const NEW_BOUNDARY = 'Work only inside your project directory. A file outside it that you are pointed to may be read, but not modified.';

export const AGENTS_MD = `# Project conventions

This repository follows the \`project-conventions\` skill. Before you change anything here, read it and
follow it:

    ${join(SKILL, 'SKILL.md')}

Its \`references/\` files are part of it. Do not restate its rules here — the pointer is deliberate.
`;

/** Rewrite the task's boundary sentence the same way in every condition. */
export function adoptionTaskText(caseId) {
  const task = getCase(caseId).task;
  if (!task.includes(OLD_BOUNDARY)) throw new Error(`${caseId}: boundary sentence not found — fixtures changed`);
  return `${task.replace(OLD_BOUNDARY, NEW_BOUNDARY)}\n`;
}

export function build({ check = false } = {}) {
  if (existsSync(RUNS)) rmSync(RUNS, { recursive: true, force: true });
  mkdirSync(RUNS, { recursive: true });
  const rows = [];
  for (const caseId of TASKS) {
    for (const condition of CONDITIONS) {
      const dir = join(RUNS, `${caseId}__${condition}__r1`);
      materialise(caseId, dir);
      const task = adoptionTaskText(caseId);
      writeFileSync(join(dir, 'TASK.md'), task);
      if (condition === 'agentsmd') writeFileSync(join(dir, 'AGENTS.md'), AGENTS_MD);
      rows.push({ caseId, condition, dir, taskHash: createHash('sha256').update(task).digest('hex').slice(0, 12) });
    }
  }
  return rows;
}

if (process.argv[1] && process.argv[1].endsWith('build.mjs')) {
  const check = process.argv.includes('--check');
  const rows = build({ check });
  console.log(`${rows.length} fixtures under .scratch/adoption/runs (${TASKS.length} tasks × ${CONDITIONS.length} conditions)`);
  for (const caseId of TASKS) {
    const hashes = new Set(rows.filter((r) => r.caseId === caseId).map((r) => r.taskHash));
    console.log(`  ${caseId.padEnd(22)} TASK.md identical across conditions: ${hashes.size === 1}  (${[...hashes].join(', ')})`);
  }
  if (check) {
    console.log('\npristine check (must match the canonical pristine result for each case):');
    for (const r of rows) {
      const kase = getCase(r.caseId);
      const results = await kase.check(r.dir, kase);
      const failed = results.filter((x) => !x.ok).map((x) => x.id);
      console.log(`  ${r.caseId.padEnd(22)} ${r.condition.padEnd(9)} ${results.length - failed.length}/${results.length} pass  failing: ${failed.join(', ') || '(none)'}`);
    }
  }
  const agentsMdDirs = rows.filter((r) => r.condition === 'agentsmd').length;
  const taskOnly = readFileSync(join(rows[0].dir, 'TASK.md'), 'utf8');
  console.log(`\nAGENTS.md written for ${agentsMdDirs} fixtures; TASK.md boundary sentence replaced with:\n  "${NEW_BOUNDARY}"`);
  console.log(`sample TASK.md tail: ${JSON.stringify(taskOnly.slice(-180))}`);
}
