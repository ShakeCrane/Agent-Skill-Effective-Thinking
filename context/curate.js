// Context curation — dynamically regulate what is sent upstream so the model pays tokens only
// for material that earns attention. Mechanizes the project's context-management rules:
//
//   * user/hard constraints are NEVER dropped (a tiny budget that cannot hold them is reported
//     as over-budget, not silently truncated);
//   * the LATEST plan is always kept in full — 完整保留最新计划；
//   * older plans compress to one line, verbose tool outputs compress to head+tail,
//     superseded chatter drops first;
//   * every drop/compression is listed in an audit report — curation is never silent.
//
// Deterministic and dependency-free; token estimates are chars/4 (documented approximation).

'use strict';

const KINDS = ['constraint', 'error', 'plan', 'outcome', 'tool-output', 'chatter'];
const PRIORITY = { constraint: 100, error: 80, plan: 60, outcome: 50, 'tool-output': 30, chatter: 10 };

function estTokens(text) {
  return Math.ceil(String(text == null ? '' : text).length / 4);
}

function normalizeBlock(b, i) {
  if (!b || typeof b.text !== 'string') throw new Error(`block ${i} needs string \`text\``);
  const kind = KINDS.includes(b.kind) ? b.kind : 'chatter';
  return { kind, text: b.text, ts: Number.isFinite(Number(b.ts)) ? Number(b.ts) : i, i, resolved: !!b.resolved };
}

function compressToolOutput(text, cap) {
  if (text.length <= cap) return text;
  const head = Math.floor(cap * 0.7);
  const tail = Math.floor(cap * 0.25);
  return `${text.slice(0, head)}\n...[curated: ${text.length - head - tail} chars elided]...\n${text.slice(-tail)}`;
}

function summarizePlan(text) {
  const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) || '(empty plan)';
  return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine;
}

/**
 * curate(blocks, budgetTokens, opts?) — build the upstream payload under a token budget.
 *
 * @param {Array} blocks — [{ kind, text, ts?, resolved? }] in conversation order. Kinds:
 *   constraint (user/hard constraints — inviolable), error (unresolved unless resolved:true),
 *   plan (the latest one is kept full), outcome (verification evidence), tool-output (verbose),
 *   chatter (narration — drops first, always, unless opts.keepChatter).
 * @param {number} budgetTokens — target budget; chars/4 estimate.
 * @param {Object} [opts] — { toolCap (default 1200 chars), keepChatter (default false) }
 * @returns {{blocks: Array, report: object}} — kept/compressed blocks in ORIGINAL order (each
 *   carries its original `index`) plus an audit report. When constraints alone exceed the budget
 *   the result is flagged overBudget and constraints are still kept in full — the caller decides;
 *   curation never hides a constraint.
 */
function curate(blocks, budgetTokens, opts = {}) {
  if (!Array.isArray(blocks) || blocks.length === 0) throw new Error('blocks must be a non-empty array');
  if (!Number.isFinite(Number(budgetTokens)) || Number(budgetTokens) <= 0) throw new Error('budgetTokens must be a positive number');
  const toolCap = Number.isFinite(Number(opts.toolCap)) && opts.toolCap > 0 ? opts.toolCap : 1200;
  const keepChatter = !!opts.keepChatter;

  const norm = blocks.map(normalizeBlock);
  // The latest plan = highest-ts plan block (ties: last index).
  let latestPlanIdx = -1;
  for (const b of norm) if (b.kind === 'plan') latestPlanIdx = b.i;

  const inviolable = (b) => b.kind === 'constraint' || (b.kind === 'error' && !b.resolved) || b.i === latestPlanIdx;

  // Phase 1 — inviolable blocks, kept FULL.
  const decisions = norm.map((b) => ({ b, action: 'drop', text: '' }));
  let used = 0;
  for (const d of decisions) {
    if (inviolable(d.b)) { d.action = 'keep'; d.text = d.b.text; used += estTokens(d.b.text); }
  }
  const overBudget = used > budgetTokens;

  // Phase 2 — everything else, by priority desc then recency desc, while budget remains.
  const rest = decisions
    .filter((d) => d.action === 'drop')
    .sort((x, y) => (PRIORITY[y.b.kind] - PRIORITY[x.b.kind]) || (y.b.ts - x.b.ts));
  for (const d of rest) {
    if (d.b.kind === 'chatter' && !keepChatter) continue; // chatter never spends budget by default
    if (d.b.kind === 'tool-output') {
      const compressed = compressToolOutput(d.b.text, toolCap);
      const cost = estTokens(compressed);
      if (used + cost <= budgetTokens) { d.action = 'compress'; d.text = compressed; used += cost; }
      continue;
    }
    if (d.b.kind === 'plan' || d.b.kind === 'error') {
      // older plans / resolved errors compress to one line
      const s = d.b.kind === 'plan' ? summarizePlan(d.b.text) : `resolved: ${summarizePlan(d.b.text)}`;
      const cost = estTokens(s);
      if (used + cost <= budgetTokens) { d.action = 'compress'; d.text = s; used += cost; }
      continue;
    }
    // outcome: keep full if it fits
    const full = estTokens(d.b.text);
    if (used + full <= budgetTokens) { d.action = 'keep'; d.text = d.b.text; used += full; }
  }

  const out = decisions
    .filter((d) => d.action !== 'drop')
    .map((d) => ({ kind: d.b.kind, text: d.text, index: d.b.i }));
  const report = {
    budgetTokens,
    estimatedTokens: used,
    overBudget,
    kept: decisions.filter((d) => d.action === 'keep').length,
    compressed: decisions.filter((d) => d.action === 'compress').length,
    dropped: decisions.filter((d) => d.action === 'drop').length,
    droppedKinds: decisions.filter((d) => d.action === 'drop').reduce((m, d) => { m[d.b.kind] = (m[d.b.kind] || 0) + 1; return m; }, {}),
  };
  return { blocks: out, report };
}

const PLAN_MARKER = /^\s*(#{0,3}\s*)?(current\s+)?(plan|objective|next steps?|方案|计划|目标|下一步)/i;

/**
 * curateConversation(messages, budgetTokens, opts?) — convenience wrapper over curate() for a
 * plain chat transcript [{ role, content }]. Classification: user messages are constraints
 * (inviolable); assistant messages that open with a plan marker are plans, others chatter;
 * any other role (tool/function) is tool-output. Returns the compacted transcript (roles
 * preserved, original order) plus the audit report.
 */
function curateConversation(messages, budgetTokens, opts = {}) {
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages must be a non-empty array');
  const blocks = messages.map((m, i) => {
    const role = m.role || 'user';
    let kind;
    if (role === 'user') kind = 'constraint';
    else if (role === 'assistant') kind = PLAN_MARKER.test(String(m.content || '').split('\n')[0] || '') ? 'plan' : 'chatter';
    else kind = 'tool-output';
    return { kind, text: String(m.content == null ? '' : m.content), ts: i };
  });
  const { blocks: kept, report } = curate(blocks, budgetTokens, opts);
  const out = kept.map((b) => ({ role: messages[b.index].role, content: b.text }));
  return { messages: out, report };
}

module.exports = { curate, curateConversation, estTokens, compressToolOutput, summarizePlan, PRIORITY };
