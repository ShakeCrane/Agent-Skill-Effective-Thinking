// Self-validation of the task-level harness.
//
// The harness makes two claims, and neither is worth anything untested:
//   1. each case FAILS on its pristine fixture — otherwise the task asks for nothing;
//   2. each case PASSES with its reference solution — otherwise the assertions cannot be satisfied,
//      and a "0% pass rate" would look like a finding instead of a broken instrument.
//
// Before the first real run, this script was the reason to trust the checker. It also guards against
// the failure mode the previous evaluation actually hit: a rubric that passes anything, or one that
// nothing can pass, both read as a clean result if nobody checks.
//
//   node evals/project-conventions/task-eval/validate.mjs

import { CASES, getCase, materialise } from './fixtures.mjs';
import { applyReference, REFERENCED } from './reference.mjs';
import { rmSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRATCH = resolve(HERE, '..', '..', '..', '.scratch', 'eval', 'harness-validation');

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function main() {
  check('every case has a reference solution', CASES.every((c) => REFERENCED.includes(c.id)),
    CASES.filter((c) => !REFERENCED.includes(c.id)).map((c) => c.id).join(', ') || `${REFERENCED.length} solutions`);

  // `heldOut` is the flag the analysis leans on when it says four cases were never used to tune a rule.
  // A claim nothing reads is not a record, so it is checked and printed here rather than trusted.
  const undeclared = CASES.filter((c) => typeof c.heldOut !== 'boolean').map((c) => c.id);
  const held = CASES.filter((c) => c.heldOut).map((c) => c.id);
  check('every case declares whether it is held out', undeclared.length === 0,
    undeclared.length ? `undeclared: ${undeclared.join(', ')}` : `${held.length}/${CASES.length} held out`);
  check('the held-out set is a non-empty proper subset of the cases', held.length > 0 && held.length < CASES.length,
    `held out: ${held.join(', ')}`);

  rmSync(SCRATCH, { recursive: true, force: true });
  mkdirSync(SCRATCH, { recursive: true });

  for (const c of CASES) {
    const pristine = join(SCRATCH, `${c.id}__pristine`);
    await materialise(c.id, pristine);
    const before = await getCase(c.id).check(pristine, c);
    const beforePassed = before.filter((r) => r.ok).length;
    // The failing ids are printed, not just counted: a case carried by a single assertion looks the
    // same as a case carried by all of them unless the load-bearing ones are named.
    const loadBearing = before.filter((r) => !r.ok).map((r) => r.id);
    check(`${c.id}: fails before any work`, loadBearing.length > 0,
      `${beforePassed}/${before.length} assertions already pass; load-bearing: ${loadBearing.join(', ') || '(none — the case demands nothing)'}`);

    const solved = join(SCRATCH, `${c.id}__reference`);
    await materialise(c.id, solved);
    applyReference(c.id, solved);
    const after = await getCase(c.id).check(solved, c);
    const stillFailing = after.filter((r) => !r.ok);
    check(`${c.id}: passes with the reference solution`, stillFailing.length === 0,
      stillFailing.length ? stillFailing.map((r) => `${r.id} (${r.detail})`).join('; ') : `${after.length}/${after.length} assertions`);
  }

  rmSync(SCRATCH, { recursive: true, force: true });

  console.log('');
  console.log(failures === 0
    ? `TASK-EVAL HARNESS PASS: ${CASES.length} cases fail pristine and pass with a reference solution`
    : `TASK-EVAL HARNESS FAIL: ${failures} problem(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`validate.mjs: ${e.stack ?? e.message}`);
  process.exit(2);
});
