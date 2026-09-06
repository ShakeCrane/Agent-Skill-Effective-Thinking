# Self-Review Reliability Study — measured, honest (incl. the negative result)

Status: `experimental` (n=14 across two rounds, one model family, hand-picked bug classes).
Purpose: test the objective's "反思不是证据 / 能验证就验证" premise at the model level — does
self-review reliably catch planted bugs, or does it confidently miss them? Recorded honestly
because the result PARTIALLY REFUTES the naive framing. Updated: Session 32.

## Motivation

The skill's verify ladder demotes self-review to LAST, never-primary, justified by "reflection is
not evidence" and the literature (Huang et al. 2023: LLM self-correction without external feedback
is unreliable). That is a *safety-first* design. But it implies an empirical claim: self-review
cannot be trusted to catch errors. We measured that claim directly.

## Protocol

- 6 distinct subtle planted-bug classes:
  S1 `chunk` (slice `i+size+1` → overlapping/oversized chunks)
  S2 `sortedNumbers` (Array#sort default → lexicographic, not numeric)
  S3 `getPath` (`(o && o[k]) || dflt` → destroys present-but-falsy values)
  S4 `titleCase` (`s[0].toUpperCase()` → throws on empty string)
  S5 `mean` (`reduce(..., 1)` → wrong initializer shifts every mean)
  S6 `dedupe` (`arr.length=0; arr.push(...out)` → mutates caller's input)
- Ground truth: captain executed each subject directly; all 6 confirmed BUGGY.
- Round A (anchored): 6 fresh no-seed agents, each given the function, the full contract, AND the
  exact exposing examples + an explicit "hand-trace these" instruction. Self-review only (no tools).
- Round B (unanchored): 6 fresh agents, same functions, but only a one-line spec + ONE neutral
  example (no exposing edge, no hint). Self-review only. This is the stricter test of free
  self-review.

## Results

| subject | ground truth | Round A (anchored) | Round B (unanchored) |
|---|---|---|---|
| S1 chunk   | BUGGY | BUGGY/high ✓ | BUGGY/high ✓ |
| S2 sort    | BUGGY | BUGGY/high ✓ | BUGGY/high ✓ |
| S3 getPath | BUGGY | BUGGY/high ✓ | BUGGY/high ✓ |
| S4 titleCase | BUGGY | BUGGY/high ✓ | BUGGY/high ✓ |
| S5 mean    | BUGGY | BUGGY/high ✓ | BUGGY/high ✓ |
| S6 dedupe  | BUGGY | BUGGY/high ✓ | BUGGY/high ✓ |

Including Session 31's 2 subjects: **14/14 self-review catches**, all at high confidence, with
correct reasoning (each agent stepped through the exact failing case by hand).

## Honest interpretation (do not overclaim)

1. **The naive claim — "self-review is unreliable / reflection is not evidence" — was NOT
   reproduced on this sample.** A strong model, explicitly told to hand-trace and verify, caught
   every planted bug even with minimal prompting (Round B). If we claimed "self-review always
   misses," this study would refute us.

2. **Why the ladder's design is still correct — but for a sharper reason.** The point is not that
   self-review *always fails*; it is that self-review *provides no guarantee*. It can succeed here
   and still fail in production on: longer/real code, hidden assumptions, distracting context, or
   when the agent is NOT prompted to hand-trace (the common "I re-checked it, looks fine" path).
   The literature documents real self-correction failure modes; a single clean n=14 does not erase
   that, it bounds it. So "when a cheap external check exists, run it FIRST" remains the right
   rule: it converts an uncertain assertion into reproducible evidence with near-certainty.

3. **Limits of this study:** n=14, one (strong) model family, hand-picked well-known bug
   anti-patterns, small functions in isolation, and every prompt carried an explicit verification
   instruction. It does NOT generalize to: long multi-file code, subtle domain-logic errors, or a
   model not asked to verify carefully. It measures an upper bound on self-review competence, not a
   production miss rate.

4. **Actionable:** the verify planner stays `experimental`. The honest basis for "prefer a real
   test" is *evidence quality and worst-case safety (guarantee)*, not "self-review always fails."
   SKILL.md / verify wording should avoid overclaiming self-review failure and instead state:
   "self-review can catch errors, but it offers no guarantee; a run is reproducible evidence."

## Files
- Subjects and transcripts are transient (agent outputs); this record is the durable artifact.
