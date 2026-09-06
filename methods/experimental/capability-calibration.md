# Method: Capability Model & Calibration (measured, not assumed)

Files: `router/capabilities.js` (model), `router/calibrate.js` (probe battery) ·
Status: **experimental** (mechanism unit-tested; one real-model run + two true long-context runs)

## Purpose
Answer "is the CURRENT model capable of this task?" from a measured capability profile, so
escalation fires only on a real current-model-vs-requirement mismatch (objective: 当前模型能力与
任务要求之间存在实际不匹配), never on length/jargon/novelty.

## Mechanism
- `taskRequirements(profile)` → {reasoning, context, reliability} (novelty deliberately excluded —
  F7/R-7); `capabilityMismatch(profile, capabilities)` signals a real margin breach.
- TIER_CAPABILITIES {strong/mid/cheap}; CAPABILITY_MARGIN headroom.
- `probeModel({runProbe})` runs a 10-probe battery (reasoning 4 / context 3 / reliability 3);
  `calibrate(...)` maps real pass-rates → capacity → nearest tier.
- `route({model_capabilities})` escalates on the measured mismatch.

## Evidence
- `evals/capability-test.js`, `evals/calibrate-test.js`: requirement derivation, tier ordering,
  mismatch-naming, escalation on measured (synthetic) profiles.
- `research/real-model-calibration.md`: first REAL run — all 10 probes passed → capacity {1,1,1},
  tier strong; hard task → deep/keep (no upgrade), easy → fast/keep + recommend_deescalate.
  Session 38 added a TRUE ~1.9k-token lost-in-the-middle test (beginning/middle/end facts), 6/6
  context probes → `context=1` backed by a real long-context run; **Session 55 extended the envelope
  to a ~15.6k-token document with 4/4 probes (no degradation) — 10 real context probes, 10/10.**

## Known limits / open questions
- One model family, coarse battery, ~15.6k-token context (still not multi-100k). Multi-model
  comparison and extreme-length context are deferred. Calibration remains `experimental`, not
  `validated`.
- **`tier strong` is a narrow probe result, not long-horizon behavioral capability:** passing the
  10-probe battery (and 10/10 context probes) does not establish that tool-calling, stopping,
  self-control, or long multi-step agent runs are equally reliable. Those remain externally
  unmeasured.
