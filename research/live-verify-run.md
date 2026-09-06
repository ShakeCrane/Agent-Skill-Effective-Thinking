# Live Verify-Ladder Run — real-agent self-review vs executed-verification

Status: `experimental` (first live-LLM-executor run; n=2 subjects, one model family). Purpose:
exercise the verify planner's channels (external-test vs self-review) with REAL subagents as the
executors — the "no live-LLM-executor run" gap flagged through Session 29. Recorded honestly,
including the negative result. Updated: Session 30.

## Protocol

- Two subjects with PLANTED bugs, saved only to OS temp (not the repo):
  - S1 `discountedTotal`: `reduce(..., prices[0] || 0)` double-counts the first element (visible to
    careful reading).
  - S2 `max`: running maximum starts at `0` instead of `xs[0]/-Infinity` → wrong floor for
    all-negative lists (sneaky by reading; passes ordinary positive inputs).
- For each subject, two fresh no-seed subagents ran in parallel:
  - **self-review only**: forbidden from executing anything; pure mental re-read.
  - **independent runner**: allowed (encouraged) to actually run `node` tests against the file.
- Ground truth was established by the captain running the same tests directly.

## Results

| subject | channel | verdict | confidence | basis |
|---|---|---|---|---|
| S1 | self-review only | BUGGY | high | mental re-read (doubled first element) |
| S1 | independent runner | BUGGY | high | executed: 1260 vs expected 900 |
| S2 | self-review only | BUGGY | high | mental re-read (0 floor breaks negatives) |
| S2 | independent runner | BUGGY | high | executed: max([-5,-2])=0 ≠ -2, max([-1])=0 ≠ -1 |

Ground truth (executed): S1 → discounts wrong on every non-empty case; S2 → wrong on all-negative
lists. Both subjects genuinely buggy.

## Findings (honest, incl. the negative result)

1. **Both channels caught both bugs.** The often-claimed "self-review misses it, execution catches
   it" differential was NOT observed in this sample (n=2, one strong model). Self-review here was
   sufficient and correct. Claiming self-review "always fails" would be unsupported by this data.
2. **The ladder's rationale is subtler and still holds.** Self-review produces an *assertion* ("I
   re-read it and it looks wrong"); execution produces *reproducible evidence* (actual outputs vs a
   contract anyone can re-run). Both were right, but only the executed channel yields
   independently-checkable ground truth. Hence the verify planner's rule stands: **when an external
   check exists, run it first; self-review is the last-resort sanity pass, never primary** — not
   because it always fails, but because an assertion is weaker evidence than a run.
3. **Limits of this run:** n=2 subjects, single model family, hand-picked bugs. It does not measure
   the real-world miss rate of self-review (the literature: Huang et al. 2023 — self-correction
   without external feedback is unreliable). A design that DEMANDS self-review-only success would be
   unsupported; a design that PREFERS an available run is confirmed as at-least-as-safe.

## Why this is evidence, not a promotion

The verify planner stays `experimental`. This run proves the channels execute end-to-end on real
agents and that both converge on ground truth here — but it does NOT validate a performance *gap*
between self-review and execution, and does not reach the bar for `validated` (needs a larger,
varied sample and ideally a measured self-review failure rate). Negative-result honesty is part of
the method-status discipline.

## Files
- Subjects and agent transcripts are transient; this record is the durable artifact.
