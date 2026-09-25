// Add ONE run directory without touching the runs that already exist (build.mjs wipes the tree).
//
//   node evals/project-conventions/adoption/add.mjs --case L3b-stale-comment --condition base --rep 1 [--canonical-task] [--agentsmd]
//
// --canonical-task restores the fixtures' own TASK.md verbatim (the `strict` condition, which replicates
// the round-2 trigger arm's text where reading anything outside the fixture was forbidden).
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { materialise } from '../task-eval/fixtures.mjs';
import { adoptionTaskText, AGENTS_MD } from './build.mjs';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};

const caseId = arg('--case');
const condition = arg('--condition');
const rep = arg('--rep', '1');
if (!caseId || !condition) {
  console.error('usage: add.mjs --case <id> --condition <name> [--rep N] [--canonical-task] [--agentsmd]');
  process.exit(2);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(resolve(HERE, '..', '..', '..'), '.scratch', 'adoption', 'runs');
const dir = join(RUNS, `${caseId}__${condition}__r${rep}`);
if (existsSync(dir)) {
  console.error(`refusing to overwrite existing run: ${dir}`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
materialise(caseId, dir);
if (!process.argv.includes('--canonical-task')) writeFileSync(join(dir, 'TASK.md'), adoptionTaskText(caseId));
if (process.argv.includes('--agentsmd')) writeFileSync(join(dir, 'AGENTS.md'), AGENTS_MD);
console.log(`materialised ${dir}\n  task: ${process.argv.includes('--canonical-task') ? 'canonical (boundary sentence forbids outside reads)' : 'adoption variant'}`);
