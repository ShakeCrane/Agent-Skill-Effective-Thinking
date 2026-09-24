// CLI for the task-level behavioural evaluation.
//
//   node evals/project-conventions/task-eval/run.mjs list
//   node evals/project-conventions/task-eval/run.mjs materialise <caseId> <outDir>
//   node evals/project-conventions/task-eval/run.mjs check <caseId> <dir> [--json]
//
// `materialise` builds a self-contained git repository for one case under the given directory, which
// is expected to live in the workspace's ignored scratch area. `check` inspects the state an agent
// left behind and prints one line per assertion.
//
// The runner deliberately does NOT dispatch agents: that is the captain's job, so that the agent
// prompts, the fixture, and the scoring stay separately reviewable — and so that whoever scores a run
// is not the same module that produced it.

import { existsSync } from 'node:fs';
import { CASES, getCase, materialise } from './fixtures.mjs';

const [cmd, a, b] = process.argv.slice(2);
const asJson = process.argv.includes('--json');

async function main() {
  if (cmd === 'list') {
    for (const c of CASES) console.log(`${c.tier}  ${c.id.padEnd(22)} ${c.title}`);
    console.log(`\n${CASES.length} case(s).`);
    return;
  }

  if (cmd === 'materialise') {
    if (!a || !b) throw new Error('usage: materialise <caseId> <outDir>');
    await materialise(a, b);
    console.log(`materialised ${a} -> ${b}`);
    return;
  }

  if (cmd === 'check') {
    if (!a || !b) throw new Error('usage: check <caseId> <dir>');
    if (!existsSync(b)) throw new Error(`no such directory: ${b}`);
    const c = getCase(a);
    const results = await c.check(b, c);
    const passed = results.filter((r) => r.ok).length;
    if (asJson) {
      console.log(JSON.stringify({ case: a, tier: c.tier, passed, total: results.length, results }));
    } else {
      for (const r of results) console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.id}${r.detail ? ` — ${r.detail}` : ''}`);
      console.log(`\n${a}: ${passed}/${results.length} assertions passed`);
    }
    process.exit(passed === results.length ? 0 : 1);
  }

  throw new Error(`unknown command: ${cmd ?? '(none)'}`);
}

main().catch((e) => {
  console.error(`run.mjs: ${e.message}`);
  process.exit(2);
});
