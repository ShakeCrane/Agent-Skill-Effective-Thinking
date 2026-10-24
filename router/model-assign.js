// Model assignment — maps task intensity to concrete models for subagent dispatch.
// The router (task-router.js) already decides strategy (fast/structured/deep) and model_action
// (keep/upgrade/delegate) from a task profile; this module turns that decision into an assignment
// against a CONCRETE model catalog, with inspectable reasons and cost-share estimates.
//
// Design rules inherited from the router:
//   * escalation is a mismatch decision, not a difficulty decision — long/unfamiliar is never
//     enough to assign a strong model;
//   * one-shot irreversible judgments outrank parallel fan-out;
//   * cheapest tier that plausibly suffices is the default posture (在足够质量下使用最低合理成本).

'use strict';

const { route } = require('./task-router.js');
const { extract } = require('./extract.js');

function profileOf(unit) {
  if (unit && unit.profile && typeof unit.profile === 'object') return unit.profile;
  if (unit && typeof unit.task === 'string') return extract(unit.task);
  throw new Error('each unit needs either a `profile` object or a `task` string');
}

function normalizeCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.tiers) || catalog.tiers.length === 0) {
    throw new Error('catalog needs a non-empty `tiers` array');
  }
  const tiers = catalog.tiers.map((t, i) => ({
    id: String(t.id || `tier-${i}`),
    models: Array.isArray(t.models) && t.models.length ? t.models.map(String) : null,
    cost: Number.isFinite(Number(t.cost)) ? Number(t.cost) : null, // relative cost weight, optional
    rank: i, // array order = cheapest -> strongest (documented contract)
  }));
  const cheapest = tiers[0];
  const strongest = tiers[tiers.length - 1];
  const mid = tiers.length > 2 ? tiers[Math.floor((tiers.length - 1) / 2)] : strongest;
  const defaultTier = tiers.find((t) => t.id === catalog.default) || mid;
  return { tiers, cheapest, mid, strongest, defaultTier };
}

function pickModel(tier) {
  if (!tier.models) return null; // tier known, concrete model is the host's choice
  return tier.models[0];
}

/**
 * assignModels(units, catalog, opts?) — assign each unit a model tier by its intensity.
 *
 * @param {Array} units — [{ id?, profile | task }]
 * @param {Object} catalog — { tiers: [{ id, models: [name...], cost? }], default?: tierId }
 *   tiers are ordered cheapest -> strongest; `models` may be null when the host picks.
 * @param {Object} [opts] — passed through to route() (model_capabilities, thresholds, ...).
 * @returns {{ assignments, summary }} — assignments keep every reason the router produced;
 *   summary counts per tier and (when costs are given) the estimated cost share, so a caller
 *   can audit "how much of this batch landed on the expensive model".
 */
function assignModels(units, catalog, opts = {}) {
  if (!Array.isArray(units) || units.length === 0) throw new Error('units must be a non-empty array');
  const cat = normalizeCatalog(catalog);

  const assignments = units.map((unit, i) => {
    const profile = profileOf(unit);
    const r = route(profile, opts);
    let tier, rule;
    if (r.model_action === 'upgrade' || r.strategy === 'deep') {
      tier = cat.strongest;
      rule = r.model_action === 'upgrade' ? 'upgrade/mismatch -> strongest tier' : 'deep strategy -> strongest tier';
    } else if (r.strategy === 'fast' && r.model_action === 'keep') {
      tier = cat.cheapest;
      rule = 'fast + keep -> cheapest tier (could_deescalate=' + r.could_deescalate + ')';
    } else if (r.model_action === 'delegate') {
      tier = cat.mid;
      rule = 'delegate (parallel fan-out) -> mid tier per unit';
    } else {
      tier = cat.defaultTier;
      rule = 'structured/keep -> default tier';
    }
    return {
      id: unit.id !== undefined ? unit.id : i,
      tier: tier.id,
      model: pickModel(tier),
      strategy: r.strategy,
      model_action: r.model_action,
      could_deescalate: r.could_deescalate,
      reasons: [rule, ...r.reasons],
    };
  });

  const perTier = {};
  for (const a of assignments) perTier[a.tier] = (perTier[a.tier] || 0) + 1;
  const costById = new Map(cat.tiers.map((t) => [t.id, t.cost]));
  let costed = 0, totalCost = 0;
  for (const [tierId, n] of Object.entries(perTier)) {
    const c = costById.get(tierId);
    if (c != null) { costed += n * c; totalCost += n * c; }
  }
  const summary = { perTier, units: assignments.length };
  if (costed > 0) {
    summary.estCostShare = Object.fromEntries(
      Object.entries(perTier).map(([tierId, n]) => {
        const c = costById.get(tierId);
        const share = c == null ? null : +((n * c) / totalCost).toFixed(3);
        return [tierId, share];
      }),
    );
  }
  return { assignments, summary };
}

module.exports = { assignModels, normalizeCatalog };
