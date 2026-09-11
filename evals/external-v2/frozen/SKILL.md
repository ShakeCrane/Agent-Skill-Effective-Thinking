# Cognitive Agent Skill — Task Judgment & Adaptive Execution

A lightweight, evidence-driven skill that helps an agent decide **how** to work on a task
before it starts working. The goal is not to make the agent "think more" — it is to make
the agent **spend the right amount of effort on the right task**, and to **verify what matters**.

> Core principle: **简单任务快速完成，复杂任务才深入思考。**
> Think the right amount for the task at hand. Do not apply one rigid template to everything.

---

## What this skill gives you

On receiving a task, before executing at scale, decide:

1. What is the task actually asking for?
2. How hard / risky is it? (Is my first read trustworthy?)
3. Any hidden constraints or information gaps?
4. Execute now, or plan first? How deep should reasoning go?
5. Do I need tools, search, tests, or other agents?
6. Is my current model enough, or is there a real capability mismatch?
7. How am I going to verify the result?
8. When do I stop deliberating and start executing?

The skill separates two concerns:

- **Signal extraction** — reading the task and scoring a small set of honest signals.
- **Routing** — mapping those signals to an execution strategy.

Keep signal extraction cheap and honest. A compact, high-signal profile beats a giant
mechanical scoring table.

---

## Step 1 — Extract a minimal task profile

Do **not** dump a 20-item questionnaire on every task. For simple tasks, you can route in one
sentence. For anything non-trivial, fill in only the signals that matter:

| Signal | Meaning |
|---|---|
| `clarity` (0-1) | How unambiguous is the requirement? Low = vague/contradictory/ambiguous. |
| `hidden_constraint` (0-1) | Probability there is an unstated requirement or trap. |
| `constraint_count` (int) | Number of visible constraints. |
| `constraint_conflict` (0-1) | Do constraints pull against each other? |
| `reasoning_complexity` (0-1) | Depth of reasoning required (chain, trade-offs, causality). |
| `novelty` (0-1) | Is this a well-trodden pattern or something new for you? |
| `error_cost` (0-1) | Cost of getting it wrong (financial, safety, irreversible, reputation). |
| `reversibility` (0-1) | 1 = easily undone by an automated test / cheap redo; 0 = hard to undo. |
| `verification_difficulty` (0-1) | How hard is it to check correctness? Low = easy test. |
| `tool_dependency` (bool) | Does correct execution require tools / search / external data? |
| `context_size` (small/mid/large) | Rough working-set size (long context = more care). |
| `parallelism` (bool) | Are there independent subproblems to fan out? |
| `one_shot` (bool) | Is the OUTPUT a single irreversible decision (e.g. an investment call, final legal clause) rather than an iterable deliverable you can review/redo? True → upgrade on high cost OR hard-to-verify, and it OVERRIDES parallel-delegation. |
| `failures_so_far` (int) | How many attempts have already failed? |

**Be honest, not clever.** Getting these signals wrong is the #1 router failure. When unsure
about a signal that would change the route, prefer the more cautious reading *and* flag it.

**Signal sources:** the CLI routes from task text via a keyword extractor (`extract`), and an agent
may instead fill the profile FROM UNDERSTANDING using `fillProfile(task, {askLLM})` (or pass a
partial profile via `npm run route -- --task "..." --profile-json '{...}'`) — the LLM-fill path
sanitizes your output and falls back to keyword extraction for missing fields, so it is safe. (See
`router/llm-profile.js`.)

---

## Step 2 — Route to a strategy

Four strategies. The router is principled, not a giant table:

### Fast — direct execute
When: high clarity, low error cost, easy to verify, low reasoning complexity, low hidden-
constraint probability, reversible.

Behavior: minimal planning, just do it, one quick verify. Do **not** manufacture analysis to
look thoughtful.

### Structured — light plan + verify
When: moderate complexity, multiple steps, a few constraints, needs some planning or checking,
but not deep trade-off analysis.

Minimum before starting: **Objective · Hard Constraints · Assumptions · Plan · Verification.**
Keep it brief.

### Deep — heavy deliberation
When: high complexity, high risk, architecture/root-cause/method design, many interacting
constraints, hard to verify directly, vague requirements.

Use as needed: task decomposition, alternatives, counterexample search, strongest objection,
assumption checks, external evidence, independent review, adversarial tests, real verification.

### Escalate / Delegate — model or executor change
This is **not** the default for "long / jargon-heavy / unfamiliar" tasks. Use it **only** when
there is a concrete mismatch: current-model capability vs. task requirement, or a clearly
parallelizable batch that a swarm can do faster/cheaper.

Mechanism: when you delegate or fan out, use the multi-agent orchestration helpers
(`multi-agent/orchestrate.js`): `fanOutAsync` (or `fanOutSync`) independent units to workers, get
**independent reviewers** to vote on claims (`reviewAsync`/`reviewSync`), and `consolidate` results
— keep good results, surface failures, and treat reviewer disagreement as something the main agent
must resolve. One failing unit must not discard the others. Use the async variants when the workers
are real subagents/agents; the adaptive loop's `runTaskAsync` feeds execution outcomes back into the
router (escalating on repeated failure) in an async host.

---

## Model switching — escalate and de-escalate

Default posture: **在足够质量下使用最低合理成本** (lowest reasonable cost at sufficient quality).

**Seriously consider upgrading** when:
- Important architecture / one-shot judgment that is hard to verify afterwards;
- High error cost;
- Repeated attempts still fail to build a correct task model (failures growing);
- Long-range context consistency is critical;
- Complex causal reasoning or many interacting constraints;
- You hit a clear capability boundary.

**Usually do NOT upgrade** when:
- Batch mechanical work, definite code edits, format conversion, file organization, simple
  extraction, running an existing pipeline;
- Low-risk work where an automated test catches mistakes cheaply.

> Escalation is a *mismatch* decision, not a *difficulty* decision. Length, jargon, and
> unfamiliarity alone are not reasons to upgrade.

Also support **de-escalation**: if a task is well-understood, mechanical, and verifiable (a Fast
task that needed no upgrade), it can be handed to a cheaper/faster model — **but only recommend
this when the current model is a strong one** (there is something to downgrade from; a cheap model
is already the cost floor). Treat upgrade and downgrade as two directions of one current-model-vs-
requirement decision, not as a one-way "bigger is better" ladder.

---

## Step 3 — Verify, then stop

Stop deliberating and start executing as soon as you have enough to act. Verification is the
anchor: prefer real tests / runs / compilers over "I re-checked and it looks fine." Use the
supplied verification planner (`strategies/verify.js` `verificationPlan(strategy, profile)`) to
turn the routing decision into a concrete, priority-ordered plan — external test > compiler >
authoritative source > independent computation > multi-source > independent reviewer, with
**self-review always last** (reflection is not evidence). Distinguish:

- CONFIRMED (tested / primary source)
- STRONGLY SUPPORTED
- PLAUSIBLE
- SPECULATIVE
- UNKNOWN

**When to stop deliberating (concrete rules, not vibes):**
- **Fast** tasks: stop immediately — no more planning, just do it.
- **Structured** tasks: stop once the light plan (Objective / Hard Constraints / Assumptions /
  Plan / Verification) is written and assumptions are explicit — then execute with a light verify.
- **Deep** tasks: keep deliberating **only while it generates new information**. Stop when (a)
  evidence is sufficient to decide, or (b) the last rounds produced no new information (you are
  re-reading, not learning), or (c) a bounded number of attempts is exhausted — then decide from
  current evidence and act (parallelizing independent parts if useful).

Rule of thumb: **deliberation that changes no decision is wasted deliberation.** If you can test
it, test it. Reflection is not evidence.

**Adaptive execution after a failed attempt:** don't blindly retry the same way. Feed the failure
back: re-judge the task (difficulty / verification / escalation), deepen the strategy or upgrade
the model when failures accumulate, and keep retrying only up to a hard attempt budget. Repeated
failure is evidence the current approach/model is mismatched — escalate, don't just retry harder.

---

## Guardrails

- **先理解，再执行。** Non-trivial tasks: build a minimal task model before large execution.
- Do not mechanically print the whole model to the user. It is internal machinery first.
- **Do not block easily.** Diagnose → try alternative → degrade → keep evidence → finish everything finishable.
- **Don't abuse elevation.** Prefer user-space / temp / minimal approaches.
- **Converge.** Exploration may branch; the final deliverable must be minimal and clean.
- When in doubt about a route-changing signal, prefer caution and **flag the uncertainty**.
