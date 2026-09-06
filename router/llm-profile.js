// LLM-filled signal profile adapter.
// The keyword extractor (extract.js) is deliberately heuristic (~91% e2e ceiling). A real agent
// can instead fill the task profile FROM UNDERSTANDING via an LLM. This adapter makes that a
// first-class path:
//
//   fillProfile(task, { askLLM }) -> profile
//
// - askLLM(task) is an injected function a HOST wires to a real model (sync or Promise); it should
//   return a JSON object with the profile fields the model can judge. It is environment-agnostic
//   (like runProbe in calibrate.js) so the skill works in pure Node and with real agents.
// - The adapter SANITIZES everything (numbers clamped to [0,1], enums validated, oneShot/parallel
//   coerced to booleans) so a sloppy model output can never crash the router.
// - MISSING fields fall back to the keyword extractor, so a sparse LLM response still yields a
//   complete, valid profile. The model can also explicitly decline a field by omitting it.
//
// This path exists to let us MEASURE "LLM-fills-profile vs keyword baseline" (the objective's
// extraction-reliability question) and to give a real agent a higher-ceiling signal source.

'use strict';
const { extract } = require('./extract.js');

const NUMBER_FIELDS = [
  'clarity', 'hidden_constraint', 'constraint_conflict',
  'reasoning_complexity', 'novelty', 'error_cost', 'reversibility', 'verification_difficulty',
];
const COUNT_FIELDS = ['constraint_count', 'failures_so_far'];
const BOOL_FIELDS = ['tool_dependency', 'parallelism', 'one_shot'];
const ENUM_FIELDS = { context_size: ['small', 'mid', 'large'] };

function clamp01(n) { const x = Number(n); return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : NaN; }

function sanitize(raw, fallback) {
  const out = Object.assign({}, fallback);
  for (const f of NUMBER_FIELDS) {
    if (raw[f] === undefined || raw[f] === null) continue;
    const c = clamp01(raw[f]);
    if (!Number.isNaN(c)) out[f] = c;
  }
  for (const f of COUNT_FIELDS) {
    if (raw[f] === undefined || raw[f] === null) continue;
    const n = Number(raw[f]);
    if (Number.isFinite(n)) out[f] = Math.max(0, Math.round(n)); // integer, non-negative
  }
  for (const f of BOOL_FIELDS) {
    if (raw[f] === undefined || raw[f] === null) continue;
    out[f] = raw[f] === true || raw[f] === 1 || raw[f] === 'true';
  }
  for (const [f, allowed] of Object.entries(ENUM_FIELDS)) {
    if (raw[f] && allowed.includes(String(raw[f]))) out[f] = String(raw[f]);
  }
  return out;
}

/**
 * fillProfile(task, { askLLM }) -> Promise<profile>
 * askLLM(task) may return a profile object OR a Promise of one (real agents). Missing/invalid
 * fields fall back to the keyword extractor. The result is always a complete, valid profile that
 * route() can consume.
 */
async function fillProfile(task, { askLLM }) {
  const keywordProfile = extract(task);
  let raw = {};
  try {
    raw = (await askLLM(task)) || {};
    if (typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  } catch (e) {
    raw = {}; // a failing model degrades to the keyword path (diagnose → alternative → degrade)
  }
  return sanitize(raw, keywordProfile);
}

/**
 * fillProfileSync(task, { askLLM }) -> profile
 * Sync variant for a sync askLLM (still tolerates a throwing askLLM). For errant async returned
 * values the caller should use fillProfile.
 */
function fillProfileSync(task, { askLLM }) {
  const keywordProfile = extract(task);
  let raw = {};
  try {
    raw = askLLM(task) || {};
    if (typeof raw !== 'object' || Array.isArray(raw)) raw = {};
    // If askLLM returned a thenable by mistake, ignore (sync path cannot await).
    if (raw && typeof raw.then === 'function') raw = {};
  } catch (e) {
    raw = {};
  }
  return sanitize(raw, keywordProfile);
}

module.exports = { fillProfile, fillProfileSync, sanitize };
