# Task Dispatch — the right model for each unit, the right payload for every call

Two decisions decide most of the cost and much of the quality before work goes upstream
(to a subagent or another model call): which model executes it, and what exactly you send.

---

## 1. Assign models by task intensity

Judge each unit first — the same signals the router uses (clarity, reasoning complexity,
error cost, reversibility, verification difficulty, one-shot, failures so far):

- **fast + keep** (clear, low-risk, cheaply verified) → the **cheapest tier** that plausibly
  suffices. Do not spend a strong model on mechanical work.
- **structured** (several steps/constraints) → your **default tier**.
- **deep, or a concrete mismatch** (one-shot irreversible call, repeated failures, hard-to-verify
  high stakes) → the **strongest tier**.
- **parallel independent units** → fan out at **mid tier per unit**; but a one-shot irreversible
  judgment is never fanned out — it outranks parallelism.

Escalation is a *mismatch* decision, not a difficulty decision: a task being long, jargon-heavy,
or unfamiliar is never a reason to assign a strong model.

Library (deterministic, reasons included):

```js
const { assignModels } = require('cognitive-agent-skill');
assignModels(units, catalog); // units: [{ profile }] or [{ task }]; catalog: { tiers: cheapest→strongest }
```

Audit the summary: how many units landed on the expensive tier, and why (each assignment carries
its reasons). If most of a batch is on the strong tier, your intensity judgments — not the tasks —
are probably wrong.

## 2. Curate what you send upstream

Every token you send competes for attention with the tokens that matter. Before dispatch:

- **Constraints stay in full, always.** Never compress or drop a user or hard constraint; if the
  budget cannot hold them, say so — do not silently truncate.
- **The latest plan stays in full**; older plans collapse to one line each.
- **Verbose tool outputs** compress to head + tail with an elision marker.
- **Narration drops first** — "I will now…" text earns nothing upstream.
- Every drop and compression is **auditable**: the report lists what was kept, compressed,
  dropped. Curation is never silent.

Library:

```js
const { curate, curateConversation } = require('cognitive-agent-skill');
curate(blocks, budgetTokens);            // blocks: [{ kind, text }] — constraint|error|plan|outcome|tool-output|chatter
curateConversation(messages, budget);    // plain chat transcript, roles preserved
```

## Why this discipline

Measured, not assumed: a large fixed injection raised an agent's episode failure rate from 7.6%
to 23.7% with zero quality gain (round-5, p<0.001) — size itself is a cost. The same experiment
showed models sense *risk direction* well but count *magnitude* poorly, so let code count and
curate, and let judgment route.

**Do not over-claim:** assignment and curation are engineering controls with mechanical tests and
measured cost effects; their end-to-end behavioural benefit is not yet established. Prefer them
because they are cheap, auditable, and never make things worse — not because they are proven to
make things better.
