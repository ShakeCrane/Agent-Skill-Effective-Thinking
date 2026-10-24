# External Eval v3 — Round 5 (weak-model discrimination experiment)

Pre-registration: [`research/round5-benchmark-protocol.md`](../../research/round5-benchmark-protocol.md)
(decisions + amendments 10.1/10.2 are part of the frozen protocol).

## What runs here

- **Batch 0** — v2 frozen corpus × 4 arms × 3 repeats through a tool-loop agent harness
  (the subject model reads TASK.md itself via `read_file`; arm differences live ONLY in the
  workspace TASK.md, exactly as in v2; the dispatcher text is byte-identical to v2's).
- **Batch 1a** — IFEval frozen subset (40 prompts, stratified L1/L2/L3 by instruction count),
  single-turn, same 4 arm payloads + a signal-calibration arm.
- Arms: `controlA` (bare) · `controlB` (3-line guidance, v2 text) · `controlC` (length-matched
  placebo, `placebo.md`, 9230 chars = frozen SKILL.md) · `treatment` (frozen v2 SKILL.md snapshot).
- Subjects: provider free models (`reflection/beam:free`, `stealth/glyph-cluster:free`);
  fallback (only if free pool dies): `deepseek/deepseek-v4.1-flash`.

## Layout

```text
evals/external-v3/
├── conditions.md         (protocol-facing notes; see research/ doc instead)
├── placebo.md            length-matched placebo (generated; sha256 recorded in protocol)
├── make-placebo.mjs      deterministic placebo generator
├── lib/api.mjs           API client: reasoning-replay quirks, backoff, usage stats
├── lib/tools.mjs         workspace tools: list/read/write/run_tests
├── lib/agent.mjs         JSON-action agent loop: uniform EMPTY/INVALID nudges, F16 counters
├── lib/v2tasks.mjs       v2 corpus adapter (seeds/checkers reused unchanged; seedDir ctx)
├── run-batch.mjs         batch 0 runner (resume by result.json, concurrency pool)
├── aggregate.mjs         arm-blind primary metric (disagreement) + per-arm cost table
└── batch1a/              IFEval subset: checkers.mjs, select.mjs (frozen), run-1a.mjs
```

Run artifacts (workspaces, transcripts, telemetry, results) live under
`.scratch/r5/` (git-ignored). The API key lives in `.scratch/r5/secrets.json` (never committed).

## Telemetry (per run)

`turns, actions[], parse_fail_turns, empty_turns, f16_narration_turns, prose_action_turns,
max_consecutive_invalid, status, wall_ms, tokens{prompt,completion}, api_calls, api_retries`

- `empty_turns`: model replied with no content (reasoning-only). `f16_narration_turns`: those
  whose reasoning declares an action intent — the F16 signature, observed live on free subjects.
- Uniform environment responses (`EMPTY_NUDGE` / `INVALID_NUDGE`) are arm-independent.

## Commands

```bash
node evals/external-v3/run-batch.mjs --model "reflection/beam:free" \
  --arms controlA,controlB,controlC,treatment --repeats 3 \
  --out .scratch/r5/runs/batch0-beam --concurrency 4
node evals/external-v3/aggregate.mjs .scratch/r5/runs/batch0-beam --blind
node evals/external-v3/batch1a/run-1a.mjs --model "reflection/beam:free"
```

Nothing here enters `npm test` (frozen Phase 1 chain); v3 is verified by its own outputs.
`evals/external-v2/` is read-only for this round.
