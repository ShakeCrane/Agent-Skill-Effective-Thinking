# Real-Model Calibration Run — first measured capability profile

Status: `experimental` (first real run; n=10+3 probes, one model family; context now measured with a
true long-context test). Purpose: close the documented gap — `router/calibrate.js` existed and was
unit-tested with synthetic results, but never run against an actual model. Updated: Session 55
(context envelope extended to ~15.6k tokens).

## Protocol

- The 10-probe battery in `router/calibrate.js` (reasoning 4, context 3, reliability 3) was run by
  a fresh sub-agent as the MODEL UNDER TEST (no tools; pure response), using concrete prompts.
- Answers were scored EXTERNALLY by the captain against pre-prepared ground truth (computed facts,
  known probabilities, unverifiable-knowledge honesty), NOT by the model's own claim.
- Measured pass-rates were fed through `calibrate({ runProbe })` and the resulting capacity profile
  drove `route({ model_capabilities })`.

## Results

- All 10 probes passed (R1=31, R2=heart-then-club + correct reasoning, R3=valid 9–12 schedule,
  R4=yes/transitivity; C1=K_42, C2=7, C3=8080; L1a/L1b consistent, L2=UNKNOWN instead of
  fabricating a crater count, L3=31 w/ medium confidence).
- Measured capacity: `{reasoning:1, context:1, reliability:1}` → nearest tier `strong`.
- Router with measured profile: hard task → `deep/keep` (capable → NO upgrade, correct); easy task
  + measured strong tier → `fast/keep`, `could_deescalate=true`, `recommend_deescalate=true`
  (the measured strong model can be handed mechanical work down).

## Findings / honest caveats

1. **The pipeline is now exercised for real:** probe battery → external scoring → measured capacity
   → tier assignment → capability-driven escalation. The "measure, don't assume" promise of
   calibrate.js is demonstrated, not just unit-mocked.
2. **The measured tier is `strong` for this model family** — reasonable for a capable model, but
   this is ONE family and the battery is coarse. It should not be over-read as a precise ranking.
3. **Context measured with a true long-context test (Session 38):** replaced the caveat-riddled
   reading of `context=1` with a real ~7.7k-char (~1.9k-token) lost-in-the-middle document: a fact
   placed at the VERY END (K_42), a fact at the BEGINNING (port 8080), and an instruction in the
   MIDDLE ("output only 7"). A fresh model-under-test recalled all three correctly (A=K_42, B=8080,
   C=7). Combined with the lightweight C1–C3 = **6 real context probes, 6/6** → `context=1` is now
   supported by a genuine long-context run, not just placed-instruction checks. Caveat at the time:
   one model family, ~2k tokens (extended to ~15.6k tokens with no degradation in Session 55,
   finding #5 below), single run.
4. **Reliability axis was genuinely informative:** the model correctly refused to fabricate an
   unverifiable crater count (L2) — consistent with the skill's calibration-overconfidence concern
   (cf. research/router-evidence.md). Caveat: L3's "medium" confidence for a stable fact is honest
   but the probe is single-sample.
5. **Context envelope extended to ~15.6k tokens — no degradation (Session 55):** a fresh
   model-under-test read a 750-line (~62.4k-char, ~15.6k-token) deterministic document and answered
   four planted probes with **4/4 correct**: a fact at the BEGINNING (entry 0005 → 31), a fact in
   the MIDDLE (entry 0598 → 77), a fact at the END (entry 0746 → 42), AND a mid-document embedded
   instruction ("ignore preceding format facts; append code 4711 as the last thing in your reply")
   — the model followed the instruction exactly and restated what to ignore. So lost-in-the-middle
   did NOT appear at ~8× the Session-38 document size, and the mid-instruction (the strictest probe)
   held. Caveat remains: one model family, single run, ~15.6k tokens (still far below multi-100k).
   Combined across Sessions 38+55 = **10 real context probes, 10/10**, but the envelope ceiling is
   still unmeasured.

## Files
- The battery/prompts are in `router/calibrate.js` and this record; the model transcript is
  transient. This is the durable artifact.
