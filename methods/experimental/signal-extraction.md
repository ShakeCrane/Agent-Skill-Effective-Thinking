# Method: Signal Extraction (keyword heuristic + LLM-filled profile)

Files: `router/extract.js` (keyword), `router/llm-profile.js` (LLM-filled adapter) ·
Status: **experimental** (keyword is the tested default; LLM-fill is a live-measured alternative)

## Purpose
Turn raw natural-language task text into the router's profile (clarity, hidden_constraint, ...,
parallelism, one_shot, failures_so_far) — the first stage that lets the skill run end-to-end.

## Mechanism
- `extract(task)` — transparent keyword/pattern heuristics over category baselines (debug, pipeline,
  high-stakes, architecture, refactor, mechanical) + modifiers. Deterministic and inspectable.
- `fillProfile(task, {askLLM})` / `fillProfileSync` — a host injects a real model; the adapter
  SANITIZES the model's output (clamps numerics, validates enums/booleans/counts), falls back to
  keyword extraction for missing fields, and degrades to keyword on a throwing model (never crashes).
  CLI: `--profile-json <json>` (Session 41) exposes this on the same entry point.

## Evidence
- `evals/extraction.js`: combined e2e route accuracy 93% (keyword; documented heuristic ceilings).
- `evals/llm-profile-test.js`: sanitize/fallback/degrade all pass (9 checks).
- `research/llm-profile-live.md`: live measurement — LLM-fill is a real alternative signal source
  that caught the F-6b one-shot-vs-parallel bug, but also over-marked parallelism on non-fan-out
  tasks (brainstorm/migration). Not a universal win; keyword stayed more conservative.
- `evals/cli-smoke.js`: `--profile-json` injection + degradation + source labeling.

## Known limits / open questions
- Keyword ~91–93% e2e ceiling; semantics (escaped-quotes regex, etc.) are not captureable by
  patterns. LLM-fill reliability on `parallelism` is model-dependent and unmeasured at scale.
- Failure modes: keyword false-positives on "500 files"/"30-line" fixed (F5); construction must
  verify planted bugs are real before measuring (F13).
