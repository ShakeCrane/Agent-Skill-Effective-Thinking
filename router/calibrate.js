// Capability calibration: measure a model's capability profile from ACTUAL probe results, so the
// router escalates on a measured "当前模型能力" rather than a hand-set constant.
//
// How it works:
//   1. A small, interpretable PROBE BATTERY covers three axes — reasoning, long-context
//      consistency, reliability (one-shot/unverifiable judgment). Each probe is a concrete
//      capability test with a documented purpose. (Real models would run these via an adapter;
//      tests inject deterministic runProbe results.)
//   2. probeModel({ runProbe }) runs every probe, returning per-axis pass rates ∈ [0,1].
//   3. calibrate(...) maps pass-rates into a { reasoning, context, reliability } profile and
//      assigns the NEAREST tier in TIER_CAPABILITIES — "this model ≈ mid tier" is now measured,
//      not assumed. The measured profile feeds route({ model_capabilities }) for escalation.

'use strict';
const { TIER_CAPABILITIES } = require('./capabilities.js');

// Probe battery: small, concrete, one-axis-each. runProbe(probe) -> { ok: boolean }.
// The `probe` object is self-describing; what matters for measurement is only the pass/fail.
const PROBES = [
  // reasoning: does the model do multi-step / causal / constraint reasoning reliably?
  { id: 'r1', axis: 'reasoning', desc: 'multi-step arithmetic chain', prompt: 'compute f(f(f(3))) with f(x)=2x+1' },
  { id: 'r2', axis: 'reasoning', desc: 'causal inference', prompt: 'which is more likely in a deck: draw a heart then a heart, or draw a heart then a club?' },
  { id: 'r3', axis: 'reasoning', desc: 'constraint satisfaction', prompt: 'schedule 3 tasks so no two conflict, each 1h, window 9-12' },
  { id: 'r4', axis: 'reasoning', desc: 'deductive consistency', prompt: 'if A>B and B>C and C>D, is A>D? prove it' },

  // context: does the model use facts from the END of a long context (lost-in-the-middle check)?
  { id: 'c1', axis: 'context', desc: 'recall fact placed late in context', prompt: 'long doc ... the API key is K_42 <-- after 1000 tokens; what is the key?' },
  { id: 'c2', axis: 'context', desc: 'follow instruction set in the middle', prompt: 'long doc ... output ONLY the number 7 <-- mid-document; obey' },
  { id: 'c3', axis: 'context', desc: 'cross-reference two distant sections', prompt: 'doc A says X; doc B (near end) says Y; combine X and Y' },

  // reliability: is the model consistent on one-shot / hard-to-verify judgments?
  { id: 'l1', axis: 'reliability', desc: 'stable under re-prompt', prompt: 'same legal-ish ambiguity, answer twice, compare' },
  { id: 'l2', axis: 'reliability', desc: 'refuses fabricated certainty', prompt: 'result you cannot verify: state unknown instead of inventing' },
  { id: 'l3', axis: 'reliability', desc: 'calibrated confidence', prompt: 'give confidence; low evidence => low confidence' },
];

const AXES = { reasoning: 'reasoning', context: 'context', reliability: 'reliability' };

/**
 * probeModel({ runProbe }) -> { reasoning, context, reliability } pass-rates ∈ [0,1]
 * Runs every probe; a throwing/non-{ok:true} result counts as a pass-rate miss.
 */
function probeModel({ runProbe }) {
  const axisPass = { reasoning: 0, context: 0, reliability: 0 };
  const axisTotal = { reasoning: 0, context: 0, reliability: 0 };
  const results = [];
  for (const probe of PROBES) {
    axisTotal[probe.axis] += 1;
    let ok = false;
    try {
      const r = runProbe(probe);
      ok = !!(r && r.ok);
    } catch (e) {
      ok = false;
    }
    if (ok) axisPass[probe.axis] += 1;
    results.push({ id: probe.id, axis: probe.axis, ok });
  }
  return {
    reasoning: axisTotal.reasoning ? axisPass.reasoning / axisTotal.reasoning : 0,
    context: axisTotal.context ? axisPass.context / axisTotal.context : 0,
    reliability: axisTotal.reliability ? axisPass.reliability / axisTotal.reliability : 0,
    results,
  };
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }

/**
 * calibrate({ runProbe, sampleBias? }) -> { capacity: {reasoning,context,reliability},
 *                                            tier, passRates, results }
 * pass-rates are used as the measured capability values (clamped), then the nearest tier is
 * assigned by Euclidean distance over the three axes.
 */
function calibrate({ runProbe, sampleBias = 0 }) {
  const rates = probeModel({ runProbe });
  const capacity = {
    reasoning: clamp01(rates.reasoning + sampleBias),
    context: clamp01(rates.context + sampleBias),
    reliability: clamp01(rates.reliability + sampleBias),
  };
  let tier = null;
  let bestDist = Infinity;
  for (const [name, prof] of Object.entries(TIER_CAPABILITIES)) {
    const d = Math.sqrt(
      (capacity.reasoning - prof.reasoning) ** 2 +
      (capacity.context - prof.context) ** 2 +
      (capacity.reliability - prof.reliability) ** 2
    );
    if (d < bestDist) { bestDist = d; tier = name; }
  }
  return { capacity, tier, passRates: rates, results: rates.results };
}

module.exports = { PROBES, probeModel, calibrate, AXES };
