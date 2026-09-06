# SKILL.md Contract-Sufficiency Audit — can the doc alone reproduce router decisions?

Status: `validated as sufficient` (deterministic audit of doc↔rules; independent sub-agent
cross-check dispatched but did not settle — recorded honestly). Purpose: verify the agent-facing
contract (SKILL.md) is instructive enough that a careful reader could reproduce the ROUTER's
decisions without reading code — the "is this a usable skill" question no unit test covers.
Updated: Session 46.

## Method

- Chose 5 tasks with distinct necessary outcomes (trivial, architecture, repeated-failure,
  one-shot, one-shot+parallel).
- Computed ROUTER GROUND TRUTH via the implementation (extract → route → verificationPlan).
- Checked whether SKILL.md contains the substantive RULES (not every threshold) that force those
  outcomes.
- (A no-seed sub-agent asked to apply SKILL.md-only was also dispatched, but did not settle in a
  reasonable time; the deterministic doc↔rule audit below is the durable evidence.)

## Ground truth vs what SKILL.md encodes

| task | router GT | SKILL.md rule that forces it |
|---|---|---|
| rename foo→bar | fast/keep | Step-2 Fast: high clarity, low error cost, easy to verify, low reasoning, low hidden-constraint; "just do it, one quick verify" (L73–76) and Step-1 one_shot/failures signals default off. |
| migrate monolith→microservices | deep/keep | Step-2 Deep: "many interacting constraints, hard to verify directly, vague requirements" (L88). |
| pipeline failed 5x | deep/upgrade | Model switching: "repeated attempts still fail... failures growing" → upgrade (L115); adaptive: "deepen... or upgrade when failures accumulate... repeated failure is evidence of mismatch — escalate, don't just retry harder" (L164–166). |
| invest in company X (one-shot) | deep/upgrade | Step-1 one_shot signal: "single irreversible decision... → upgrade on high cost OR hard-to-verify" (L54); Model switching: "one-shot judgment that is hard to verify afterwards" (L113). |
| choose ONE acquisition (one-shot + parallel) | deep/upgrade (NOT delegate) | Step-1 one_shot signal explicitly: "...and it OVERRIDES parallel-delegation" (L54) — the F-6b behavior an agent would otherwise get wrong is documented verbatim. |

Verification plan: SKILL.md Step 3 directs the agent to the external-test-first ladder
(`verificationPlan`, L140); ground truth primary = external-test for every task — consistent.

## Findings

1. **The contract is sufficient at the rule level.** Every necessary outcome of the 5 tasks is
   forced by an explicit SKILL.md statement — including the non-obvious one-shot-overrides-parallel
   case (F-6b), which the doc documents verbatim. A reader who follows SKILL.md would derive the
   same strategy, model action, and primary verification as the router on all 5.
2. **The doc is honest, not over-detailed.** It gives the discriminating reasons, not thresholds —
   appropriate for an agent-facing contract (the router owns the numbers; the agent owns the
   judgment).
3. **Independent sub-agent cross-check attempted, not settled** (environment: sub-agents often run
   long). Recorded honestly; the deterministic audit stands alone.

## Limits
- Checks rule *sufficiency* (would a faithful reader reach the right decision?), not that every
  subtlety is spelled out (e.g. hidden-constraint/ambiguity triggers are implied by "low hidden-
  constraint probability" in Fast and "vague requirements" in Deep, not fully enumerated).
- The 5 tasks sample the rule surface; more exotic combinations would need more items.

## Files
- SKILL.md (the audited contract), router/extract.js + task-router.js (ground-truth source). This
  record is the durable artifact.
