// Repeatable benchmark for the Task Router.
// Each item: a natural-language task (for humans), a signal profile, and
// hand-labeled expected strategy + model_action.
//
// Coverage required (from the skill objective):
//   simple | seemingly-simple-with-hidden-constraint | multi-step | debug |
//   multi-constraint code change | architecture design | vague requirement |
//   high-risk | long-context | tool-verification | should-upgrade | should-NOT-upgrade
//
// Run: node evals/benchmark.js

'use strict';

const { route, DEFAULTS } = require('../router/task-router.js');

// ---- Items ----
// expected.strategy in {fast, structured, deep}
// expected.model_action in {keep, upgrade, delegate}
const ITEMS = [
  {
    id: 'simple-rename',
    task: 'Rename the local variable `foo` to `bar` in a 30-line function.',
    profile: {
      clarity: 0.9, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.1, novelty: 0.1, error_cost: 0.1, reversibility: 0.9,
      verification_difficulty: 0.1, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
  },

  {
    id: 'seemingly-simple-hidden-constraint',
    task: 'Sort this list of filenames alphabetically (but they must use natural collation for numbers, and be case-insensitive, and preserve a given icon ordering).',
    profile: {
      clarity: 0.8, hidden_constraint: 0.7, constraint_count: 3, constraint_conflict: 0.3,
      reasoning_complexity: 0.5, novelty: 0.4, error_cost: 0.3, reversibility: 0.7,
      verification_difficulty: 0.5, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
  },

  {
    id: 'multi-step-pipeline',
    task: 'Parse a CSV, filter rows, compute aggregates, and write a summary report.',
    profile: {
      clarity: 0.85, hidden_constraint: 0.2, constraint_count: 2, constraint_conflict: 0,
      reasoning_complexity: 0.4, novelty: 0.3, error_cost: 0.2, reversibility: 0.8,
      verification_difficulty: 0.3, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
  },

  {
    id: 'debug-flaky-test',
    task: 'Debug why a test is flaky (fails intermittently). Find the root cause.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.5, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.6, novelty: 0.5, error_cost: 0.4, reversibility: 0.8,
      verification_difficulty: 0.6, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
  },

  {
    id: 'multi-constraint-code-change',
    task: 'Refactor the auth module so it is thread-safe, backward compatible, and does not break the existing public API, while keeping tests green.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.5, constraint_count: 5, constraint_conflict: 0.6,
      reasoning_complexity: 0.7, novelty: 0.5, error_cost: 0.5, reversibility: 0.6,
      verification_difficulty: 0.5, tool_dependency: false, context_size: 'mid',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
  },

  {
    id: 'architecture-design',
    task: 'Design the high-level architecture for a distributed event-processing system.',
    profile: {
      clarity: 0.6, hidden_constraint: 0.6, constraint_count: 4, constraint_conflict: 0.6,
      reasoning_complexity: 0.8, novelty: 0.7, error_cost: 0.6, reversibility: 0.4,
      verification_difficulty: 0.8, tool_dependency: false, context_size: 'mid',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
  },

  {
    id: 'vague-requirement',
    task: 'Make the product "better" — user did not specify what better means.',
    profile: {
      clarity: 0.2, hidden_constraint: 0.8, constraint_count: 0, constraint_conflict: 0,
      reasoning_complexity: 0.6, novelty: 0.6, error_cost: 0.5, reversibility: 0.3,
      verification_difficulty: 0.7, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
  },

  {
    id: 'high-risk-financial',
    task: 'Approve or flag a high-value financial reconciliation discrepancy.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.5, constraint_count: 2, constraint_conflict: 0.2,
      reasoning_complexity: 0.6, novelty: 0.4, error_cost: 0.9, reversibility: 0.1,
      verification_difficulty: 0.6, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
  },

  {
    id: 'long-context-review',
    task: 'Review a 500-page codebase for a subtle security vulnerability.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.7, constraint_count: 2, constraint_conflict: 0.2,
      reasoning_complexity: 0.7, novelty: 0.5, error_cost: 0.6, reversibility: 0.3,
      verification_difficulty: 0.7, tool_dependency: false, context_size: 'large',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' },
  },

  {
    id: 'tool-verification',
    task: 'Confirm whether this third-party library supports feature X by reading its docs and running a small test.',
    profile: {
      clarity: 0.8, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0,
      reasoning_complexity: 0.4, novelty: 0.4, error_cost: 0.3, reversibility: 0.8,
      verification_difficulty: 0.4, tool_dependency: true, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'keep' },
  },

  {
    id: 'should-upgrade-after-failures',
    task: 'A hard causal bug that has already failed 4 fix attempts using the current weak model.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.6, constraint_count: 3, constraint_conflict: 0.4,
      reasoning_complexity: 0.8, novelty: 0.6, error_cost: 0.5, reversibility: 0.6,
      verification_difficulty: 0.7, tool_dependency: false, context_size: 'mid',
      parallelism: false, failures_so_far: 4,
    },
    expected: { strategy: 'deep', model_action: 'upgrade' },
  },

  {
    id: 'should-NOT-upgrade-mechanical',
    task: 'Move 200 files from folder A to folder B and update import paths (a known mechanical migration pattern).',
    profile: {
      clarity: 0.9, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.1, novelty: 0.1, error_cost: 0.2, reversibility: 0.9,
      verification_difficulty: 0.2, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'fast', model_action: 'keep' },
  },

  {
    id: 'delegate-parallel-research',
    task: 'Summarize what 10 different papers say, independently, before I combine them.',
    profile: {
      clarity: 0.8, hidden_constraint: 0.3, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.3, novelty: 0.4, error_cost: 0.2, reversibility: 0.9,
      verification_difficulty: 0.3, tool_dependency: true, context_size: 'small',
      parallelism: true, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'delegate' },
  },

  // ---- Session 28 additions: principle-coverage gaps the reviewer found (P7 one-shot, P8
  //      non-tool parallel, P5 at low-verif failures, F2 ambiguity) — these had NO benchmark item,
  //      so the rules were effectively untested. Each label is reasoned from the objective, not
  //      from the threshold values. ----
  {
    id: 'one-shot-hard-to-verify-moderate-cost',
    task: 'Pick the final architect-approved service name for the platform — a one-shot irreversible naming decision that no automated test can validate.',
    profile: {
      clarity: 0.6, hidden_constraint: 0.5, constraint_count: 2, constraint_conflict: 0.3,
      reasoning_complexity: 0.6, novelty: 0.5, error_cost: 0.4, reversibility: 0.1,
      verification_difficulty: 0.9, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0, one_shot: true,
    },
    expected: { strategy: 'deep', model_action: 'upgrade' }, // one-shot + hard-to-verify → upgrade (P7)
  },
  {
    id: 'one-shot-high-cost-mid-verif',
    task: 'Authorize one irreversible payment transfer decision, no way to undo, moderately hard to verify.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.4, constraint_count: 2, constraint_conflict: 0.2,
      reasoning_complexity: 0.5, novelty: 0.3, error_cost: 0.9, reversibility: 0.05,
      verification_difficulty: 0.6, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0, one_shot: true,
    },
    expected: { strategy: 'deep', model_action: 'upgrade' }, // one-shot + high error cost → upgrade (P7)
  },
  {
    id: 'parallel-refactor-no-tool',
    task: 'Refactor the storage layer: many independent per-module changes that can run in parallel, no external research needed.',
    profile: {
      clarity: 0.7, hidden_constraint: 0.4, constraint_count: 3, constraint_conflict: 0.3,
      reasoning_complexity: 0.5, novelty: 0.4, error_cost: 0.4, reversibility: 0.6,
      verification_difficulty: 0.4, tool_dependency: false, context_size: 'mid',
      parallelism: true, failures_so_far: 0,
    },
    expected: { strategy: 'structured', model_action: 'delegate' }, // P8: paralallel without tool-dependency still delegates
  },
  {
    id: 'repeated-failure-low-verif',
    task: 'A job that already failed 5 times even though the step claims to be trivially checkable; the loop must stop failing.',
    profile: {
      clarity: 0.6, hidden_constraint: 0.5, constraint_count: 2, constraint_conflict: 0.3,
      reasoning_complexity: 0.6, novelty: 0.4, error_cost: 0.4, reversibility: 0.6,
      verification_difficulty: 0.3, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 5,
    },
    expected: { strategy: 'deep', model_action: 'upgrade' }, // repeated failure is empirical → escalate even at low verif (P4/F-1)
  },
  {
    id: 'ambiguous-hard-to-verify',
    task: 'The user said "make it better" and there is no way to test what better means — a vague request that is also hard to verify.',
    profile: {
      clarity: 0.2, hidden_constraint: 0.6, constraint_count: 2, constraint_conflict: 0.3,
      reasoning_complexity: 0.6, novelty: 0.5, error_cost: 0.5, reversibility: 0.4,
      verification_difficulty: 0.7, tool_dependency: false, context_size: 'small',
      parallelism: false, failures_so_far: 0,
    },
    expected: { strategy: 'deep', model_action: 'keep' }, // ambiguity + non-trivial verification → deep (F2)
  },

  // Session 37 (F-6b): one-shot irreversible JUDGMENT must outrank parallel-delegation — a single
  // decision is never fan-out work, even when the surrounding work looks parallel. Regression guard
  // for the live-LLM-profile finding.
  {
    id: 'one-shot-parallel-judgment',
    task: 'The board must choose ONE final acquisition target now — a single irreversible decision (with several analysts feeding parallel background notes).',
    profile: {
      clarity: 0.5, hidden_constraint: 0.8, constraint_count: 3, constraint_conflict: 0.5,
      reasoning_complexity: 0.85, novelty: 0.7, error_cost: 0.95, reversibility: 0.05,
      verification_difficulty: 0.9, tool_dependency: true, context_size: 'large',
      parallelism: true, failures_so_far: 0, one_shot: true,
    },
    expected: { strategy: 'deep', model_action: 'upgrade' }, // one_shot wins over parallel → upgrade, never delegate (F-6b)
  },
];

// ---- Baseline: a naive "no-reasoning" router that always picks Structured/keep ----
// Represents an agent with no router: it never fast-tracks simple tasks, never escalates
// on failure, and never delegates. It handles everything with the same light plan.
function baseline(p) {
  return { strategy: 'structured', model_action: 'keep', reasons: ['baseline: no reasoning'] };
}

// ---- Metrics ----
function scoreItem(expected, got) {
  const strategyOK = got.strategy === expected.strategy;
  const modelOK = got.model_action === expected.model_action;
  return { strategyOK, modelOK };
}

function run(label, routeFn) {
  let sCorrect = 0, mCorrect = 0;
  const rows = [];
  for (const it of ITEMS) {
    const got = routeFn(it.profile, { mismatch: false });
    const { strategyOK, modelOK } = scoreItem(it.expected, got);
    if (strategyOK) sCorrect++;
    if (modelOK) mCorrect++;
    rows.push({
      id: it.id,
      exp: `${it.expected.strategy}/${it.expected.model_action}`,
      got: `${got.strategy}/${got.model_action}`,
      strategyOK, modelOK,
      reasons: got.reasons.join('; '),
    });
  }
  const n = ITEMS.length;
  return {
    label,
    n,
    strategyAccuracy: sCorrect / n,
    modelAccuracy: mCorrect / n,
    overallAccuracy: (sCorrect + mCorrect) / (2 * n),
    rows,
  };
}

function pretty(r) {
  const lines = [`== ${r.label} ==`];
  lines.push(`  strategy accuracy: ${(r.strategyAccuracy * 100).toFixed(1)}% (${r.rows.filter(x=>x.strategyOK).length}/${r.n})`);
  lines.push(`  model   accuracy: ${(r.modelAccuracy * 100).toFixed(1)}% (${r.rows.filter(x=>x.modelOK).length}/${r.n})`);
  lines.push(`  overall accuracy: ${(r.overallAccuracy * 100).toFixed(1)}%`);
  lines.push('  per-item:');
  for (const row of r.rows) {
    const s = row.strategyOK ? 'OK ' : 'XX ';
    const m = row.modelOK ? 'OK' : 'XX';
    lines.push(`    [${row.id}] exp=${row.exp} got=${row.got}  strategy:${s} model:${m}`);
    if (!row.strategyOK || !row.modelOK) {
      lines.push(`        reasons: ${row.reasons}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const router = run('TaskRouter (v2)', (p) => route(p, {}));
  const baselineR = run('Baseline (no-reasoning: always structured/keep)', (p) => baseline(p));
  console.log(pretty(router));
  console.log('');
  console.log(pretty(baselineR));

  // Improvement vs baseline
  const impS = ((router.strategyAccuracy - baselineR.strategyAccuracy) * 100).toFixed(1);
  const impM = ((router.modelAccuracy - baselineR.modelAccuracy) * 100).toFixed(1);
  console.log('');
  console.log(`Improvement vs baseline -> strategy: ${impS} pts, model: ${impM} pts`);
  return { router, baselineR, thresholds: DEFAULTS };
}

module.exports = { ITEMS, run, scoreItem, main };

if (require.main === module) {
  main();
}
