#!/usr/bin/env node
// Task Router CLI — end-to-end from a natural-language task to a decision.
// Usage:
//   node bin/router.js "Fix the off-by-one bug in the pagination loop"
//   echo "task text" | node bin/router.js --stdin
//   node bin/router.js --task "..." --tier strong
// Options:
//   --tier strong|cheap|auto   current model tier (default auto)
//   --stdin                    read task from stdin
//   --json                     machine-readable output
//   --profile-json <json>      inject a (possibly LLM-filled, partial) profile; missing fields
//                              fall back to keyword extraction (see router/llm-profile.js)
'use strict';
const { extract } = require('../router/extract.js');
const { sanitize } = require('../router/llm-profile.js');
const { route } = require('../router/task-router.js');
const { protocolFor } = require('../strategies/protocol.js');
const { shouldStop } = require('../strategies/stopping.js');
const { capabilitiesOf } = require('../router/capabilities.js');
const { estimateCost } = require('../strategies/cost.js');
const { classify } = require('../strategies/certainty.js');
const { verificationPlan } = require('../strategies/verify.js');

const STRATEGY_DESC = {
  fast: 'Execute directly: minimal planning, cheap verification. Do NOT manufacture analysis.',
  structured: 'Light plan first: Objective / Hard Constraints / Assumptions / Plan / Verification — keep it brief.',
  deep: 'Deliberate: decompose, explore alternatives, counterexamples, strongest objection, external evidence, adversarial checks, real verification.',
};
const ACTION_DESC = {
  keep: 'Keep the current model.',
  upgrade: 'Upgrade to a stronger model: concrete mismatch (capability / repeated failure / one-shot high-stakes no-oracle).',
  delegate: 'Delegate: independent units worth fanning out to subagents/parallel workers.',
};

function parseArgs(argv) {
  const opts = { tier: 'auto', capability: null, stdin: false, json: false, batch: false, task: null, profileJson: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stdin') opts.stdin = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--batch') opts.batch = true;
    else if (a === '--tier') opts.tier = argv[++i] || 'auto';
    else if (a === '--capability') opts.capability = argv[++i] || null;
    else if (a === '--task') opts.task = argv[++i] || null;
    else if (a === '--profile-json') opts.profileJson = argv[++i] || null;
    else opts.task = opts.task ? opts.task + ' ' + a : a;
  }
  return opts;
}

// Parse an injected profile JSON (may be partial / LLM-filled). Falls back to keyword extraction
// for any missing/invalid field (same sanitize used by router/llm-profile.js), so a partial fill
// is safe. Malformed JSON -> { ok:false } so the caller knows it degraded (never crashes).
function parseInjectedProfile(opts) {
  if (!opts.profileJson) return { ok: false, raw: {} };
  let raw = {};
  try {
    raw = JSON.parse(opts.profileJson);
  } catch (e) {
    return { ok: false, raw: {} };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, raw: {} };
  return { ok: true, raw };
}

function decide(task, opts) {
  const kw = extract(task);
  // In BATCH mode an injected profileJson is IGNORED — it is a per-single-task construct, and
  // applying one task's profile to every batch row would silently corrupt the others (Session 50
  // fix). planTasks strips it before calling decide.
  const injected = opts.notrackProfileJson ? { ok: false, raw: {} } : parseInjectedProfile(opts);
  const profile = injected.ok ? sanitize(injected.raw, kw) : kw;
  const caps = opts.capability ? capabilitiesOf(opts.capability) : null;
  const r = route(profile, { current_model_tier: opts.tier, model_capabilities: caps || undefined });
  const stopping = shouldStop(r.strategy, initialStopState(r.strategy));
  const source = (opts.notrackProfileJson || !injected.ok) ? 'keyword' : 'injected+keyword';
  return { task, profile, r, stopping, capability: opts.capability, source, profileJsonIgnored: !!opts.notrackProfileJson };
}

function planTasks(tasks, opts = {}) {
  // profileJson is single-task-only; drop it so no batch row inherits another task's profile.
  // (Keep a flag so decide reports source='keyword' and we can warn.)
  const batchOpts = Object.assign({}, opts, { profileJson: null, notrackProfileJson: true });
  return tasks
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => t.length > 0)
    .map((task) => ({ task, ...decide(task, batchOpts) }));
}

function initialStopState(strategy) {
  // Initial deliberation state for a fresh task.
  if (strategy === 'structured') return { planWritten: false, assumptionsExplicit: false };
  if (strategy === 'deep') return { evidenceSufficient: false, roundsSinceNewInfo: 0, attempts: 0 };
  return {};
}

function renderHuman(d) {
  const proto = protocolFor(d.r.strategy);
  const lines = [];
  lines.push(`TASK:   ${d.task}`);
  lines.push(`STRATEGY:  ${d.r.strategy.toUpperCase()}`);
  const cert = classify(d.profile);
  lines.push(`CERTAINTY: ${cert.certainty.toUpperCase()} (margin ${cert.margin})`);
  lines.push(`  ${STRATEGY_DESC[d.r.strategy]}`);
  lines.push(`MODEL:   ${d.r.model_action.toUpperCase()}`);
  lines.push(`  ${ACTION_DESC[d.r.model_action]}`);
  if (d.r.could_deescalate) {
    lines.push(`DE-ESCALATE: could_deescalate=${d.r.could_deescalate} recommend_deescalate=${d.r.recommend_deescalate} (current model tier: ${d.optsTier})`);
  }
  lines.push('EXECUTION PROTOCOL:');
  if (proto.required.length) {
    lines.push('  REQUIRED before executing:');
    for (const s of proto.required) lines.push(`    - ${s.label}`);
  } else {
    lines.push('  REQUIRED: none (execute directly)');
  }
  if (proto.optional.length) {
    lines.push('  OPTIONAL as needed:');
    for (const s of proto.optional) lines.push(`    - ${s.label}`);
  }
  lines.push(`  NOTE: ${proto.notes}`);
  lines.push('WHEN TO STOP DELIBERATING:');
  lines.push(`  stop=${d.stopping.stop} — ${d.stopping.reason}`);
  lines.push('REASONS:');
  for (const reason of d.r.reasons) lines.push(`  - ${reason}`);
  lines.push('EXTRACTED PROFILE:');
  const p = d.profile;
  lines.push(`  clarity=${p.clarity} hidden=${p.hidden_constraint} constraints=${p.constraint_count} conflict=${p.constraint_conflict}`);
  lines.push(`  reasoning=${p.reasoning_complexity} novelty=${p.novelty} error_cost=${p.error_cost} reversibility=${p.reversibility}`);
  lines.push(`  verif_difficulty=${p.verification_difficulty} tool=${p.tool_dependency} context=${p.context_size} parallel=${p.parallelism} failures=${p.failures_so_far || 0} one_shot=${p.one_shot || false}`);
  const c = estimateCost(d.r.strategy, p);
  lines.push('ESTIMATED EFFORT (relative, advisory):');
  lines.push(`  tokens=${c.tokens} latency=${c.latency} toolCalls=${c.toolCalls} — cost does NOT override the strategy/quality decision`);
  const vp = verificationPlan(d.r.strategy, p);
  lines.push('VERIFICATION PLAN:');
  lines.push(`  primary: ${vp.primary.label}`);
  lines.push(`  ${vp.methods.map((m) => m.label).join(' → ')}`);
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  // Batch mode: read many tasks (one per non-empty line) from stdin and triage them at once.
  if (opts.batch) {
    if (opts.profileJson) {
      // profile-json is per-single-task; in batch it would corrupt every row, so we ignore it and
      // say so (Session 50 fix).
      console.error('NOTE: --profile-json is ignored in --batch mode (it applies to a single task).');
    }
    let text;
    try {
      text = require('fs').readFileSync(0, 'utf8');
    } catch (e) {
      text = '';
    }
    const rows = planTasks(text.split(/\r?\n/), opts);
    if (opts.json) {
      console.log(JSON.stringify(rows.map((r) => ({ task: r.task, strategy: r.r.strategy, model_action: r.r.model_action })), null, 2));
    } else {
      for (const r of rows) {
        const cert = classify(r.profile).certainty.toUpperCase();
        console.log(`[${r.r.strategy.toUpperCase()}|${r.r.model_action.toUpperCase()}|${cert}] ${r.task.slice(0, 90)}`);
      }
    }
    process.exit(rows.length ? 0 : 1);
  }

  let task = opts.task;
  if (!task && opts.stdin) {
    // read all stdin synchronously if piped
    try {
      task = require('fs').readFileSync(0, 'utf8').trim();
    } catch (e) {
      task = null;
    }
  }
  if (!task) {
    console.error('Usage: node bin/router.js "task text" | --stdin | --batch | --task "..." [--tier strong|cheap|auto] [--capability strong|mid|cheap] [--profile-json {...}] [--json]');
    process.exit(2);
  }
  const d = decide(task, opts);
  d.optsTier = opts.tier;
  console.log(opts.json ? JSON.stringify({ task, profile: d.profile, decision: d.r, tier: opts.tier, capability: opts.capability, source: d.source }, null, 2) : renderHuman(d));
}

module.exports = { decide, planTasks, renderHuman };

if (require.main === module) main();
