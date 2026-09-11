# External Eval v2 — Pilot Suite

Behavioural evaluation of the Cognitive Skill against a **bare agent** and a **minimal cognitive
scaffold**, on tasks whose wrong answer looks plausible.

## Why v2 exists

v1 (see `../external/` and `../../reports/phase-2-external-eval.md`) produced a **ceiling-limited
NO CLEAR BENEFIT**: all three conditions passed the hard corpus, so task success lost its variance
and the incremental value of the full skill could not be measured.

v2 does **not** create difficulty by adding more explicit requirements. Each task is built so that a
*plausible* wrong decision remains available, while correct cognitive control — reading the
repository contract, choosing the right verification, respecting the source of truth, recovering
from a failed path, and stopping at the requested scope — makes success more likely.

## Layout

```text
evals/external-v2/
├── README.md              this file
├── protocol.json          pre-registered design: conditions, budgets, sensitivity gate, telemetry
├── conditions.json        frozen TASK.md templates + the fixed dispatcher instruction
├── pilot-manifest.json    the 12 tasks, families, mutations, criteria counts
├── run-order.json         frozen randomized order (12 tasks x 3 conditions = 36 runs)
├── scripts/
│   ├── lib.js             shared helpers (no-pipe child processes, hashing, walk)
│   ├── prepare-run.js     seed + TASK.md -> a fresh agent workspace
│   ├── check-run.js       run a task's deterministic checker, print JSON
│   ├── generate-order.js  build the frozen run order (seed 20260911)
│   └── selftest.js        the construction gate (gold / mutation / provenance)
└── pilot/
    └── v2-NN-<name>/
        ├── task.md        the common task text (identical in every condition)
        ├── seed/          the agent-visible mini repository (contains the real bug)
        └── evaluator/     criteria.json, checker.js, gold/, mutations/  — NEVER shipped to an agent
```

**Isolation rule:** an agent workspace is `seed/**` plus a generated `TASK.md`. The `evaluator/`
directory is never copied into a workspace (asserted by `prepare-run.js`).

## Conditions

The three conditions differ **only** by the instruction block inside the workspace `TASK.md`:

| condition | TASK.md contains |
|---|---|
| `controlA` | the task text only |
| `controlB` | the task text + a frozen three-line working-guidance block |
| `treatment` | the task text + the complete frozen `SKILL.md` |

The dispatcher message sent to the agent is byte-identical in all three conditions
(`conditions.json` → `dispatcher`). Condition-dependent wording is a framing confound and is
forbidden.

## Construction gates

```bash
node evals/external-v2/scripts/selftest.js
```

For every task this verifies:

1. **Gold pass** — `seed + gold` makes the checker PASS on all primary criteria.
2. **Mutation kill** — at least two *plausible* wrong fixes make the checker FAIL, and the failure
   comes from the criterion that mutation targets (no vacuous kills; a crash is not a kill).
3. **Pristine seed fails** — each seed ships a real bug.
4. **Provenance** — every primary criterion declares a legal `sourceType`, `source` and
   `sourceExcerpt`, and no criterion exists that an agent could not have known before running.
5. **No checker exceptions.**

## Preparing and checking a run

```bash
node evals/external-v2/scripts/prepare-run.js v2-01-redaction controlB /tmp/ws-v2-01-controlB
node evals/external-v2/scripts/check-run.js    v2-01-redaction /tmp/ws-v2-01-controlB
```

`prepare-run.js` prints the workspace path and the injected input size (`inputChars`). Injected text
is **not** counted as agent output artifact size.

## Status

> **Constructed. NOT yet frozen. Awaiting independent review before any real pilot execution.**

No agent run has been executed against this suite in this round. `protocol.json` records the
sensitivity gate and the unblinding order that apply *after* the 36 runs exist.
