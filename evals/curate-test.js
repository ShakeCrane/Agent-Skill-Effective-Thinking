// Mechanical tests for context/curate.js — inviolability, compression, budget behaviour, audit.
// Deterministic, no network, no LLM. Run: node evals/curate-test.js
'use strict';
const assert = require('assert');
const { curate, curateConversation, estTokens, compressToolOutput } = require('../context/curate.js');

let failures = 0;
const check = (name, cond, detail) => {
  if (!cond) failures++;
  console.log(`[${cond ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const constraint = (t) => ({ kind: 'constraint', text: t });
const plan = (t, ts) => ({ kind: 'plan', text: t, ts });
const tool = (t, ts) => ({ kind: 'tool-output', text: t, ts });

// 1. constraints survive an impossible budget, flagged overBudget (never silently dropped)
{
  const { blocks, report } = curate([constraint('A'.repeat(4000))], 10);
  check('constraint kept under tiny budget', blocks.length === 1 && blocks[0].text.length === 4000);
  check('overBudget flagged', report.overBudget === true);
}

// 2. latest plan kept FULL; older plan compressed to one line
{
  const old = plan('v1: do the thing\nsecond line\nthird line', 1);
  const latest = plan('v2 FINAL: do the other thing\ndetails', 5);
  const { blocks, report } = curate([old, latest, constraint('must not break API')], 100000);
  const keptOld = blocks.find((b) => b.index === 0);
  const keptNew = blocks.find((b) => b.index === 1);
  check('latest plan kept full', keptNew && keptNew.text.includes('details'), keptNew && keptNew.text);
  check('old plan compressed to first line', keptOld && keptOld.text === 'v1: do the thing' && !keptOld.text.includes('second'), keptOld && keptOld.text);
  check('constraint present', blocks.some((b) => b.text === 'must not break API'));
  check('report counts 2 kept + 1 compressed', report.kept === 2 && report.compressed === 1, JSON.stringify(report));
}

// 3. unresolved error inviolable; resolved error compresses
{
  const { blocks, report } = curate(
    [
      { kind: 'error', text: 'UNRESOLVED: port conflict on 8080', ts: 1 },
      { kind: 'error', text: 'resolved: typo in import\nextra lines', resolved: true, ts: 2 },
    ],
    100000,
  );
  check('unresolved error kept full', blocks.some((b) => b.text.includes('UNRESOLVED')));
  const res = blocks.find((b) => b.text.startsWith('resolved:'));
  check('resolved error one-lined', res && !res.text.includes('extra lines'), res && res.text);
}

// 4. tool output compressed to head+tail under cap; audit lists it
{
  const long = tool('X'.repeat(5000), 1);
  const { blocks, report } = curate([long, constraint('k')], 100000, { toolCap: 1000 });
  const t = blocks.find((b) => b.kind === 'tool-output');
  check('tool output compressed', t && t.text.includes('[curated:') && t.text.length < 1200, t && String(t.text.length));
  check('compression audited', report.compressed === 1);
}

// 5. chatter drops first and by default entirely; keepChatter opts respected
{
  const { blocks, report } = curate(
    [constraint('c'), { kind: 'chatter', text: 'thinking aloud...', ts: 1 }, { kind: 'chatter', text: 'more narration', ts: 2 }],
    100000,
  );
  check('chatter dropped by default', blocks.length === 1 && report.droppedKinds.chatter === 2, JSON.stringify(report.droppedKinds));
  const { blocks: b2 } = curate([constraint('c'), { kind: 'chatter', text: 'note' }], 100000, { keepChatter: true });
  check('keepChatter keeps it', b2.length === 2);
}

// 6. budget respected: outcome that does not fit is dropped, not truncated
{
  const { blocks, report } = curate(
    [constraint('c'), { kind: 'outcome', text: 'O'.repeat(4000), ts: 1 }, { kind: 'outcome', text: 'fits', ts: 2 }],
    estTokens('c') + estTokens('fits'),
  );
  check('oversized outcome dropped whole', !blocks.some((b) => b.text.startsWith('OOO')));
  check('fitting outcome kept', blocks.some((b) => b.text === 'fits'));
  check('estimatedTokens <= budget', report.estimatedTokens <= report.budgetTokens, `${report.estimatedTokens} <= ${report.budgetTokens}`);
}

// 7. order preserved in output
{
  const { blocks } = curate(
    [constraint('first'), plan('p1', 1), tool('t', 2), plan('p2 latest', 3), constraint('last')],
    100000,
  );
  check('original order preserved', blocks.map((b) => b.index).join(',') === '0,1,2,3,4', blocks.map((b) => b.index).join(','));
}

// 8. contract errors
{
  let e1 = null, e2 = null, e3 = null;
  try { curate([], 100); } catch (e) { e1 = e; }
  try { curate([constraint('x')], 0); } catch (e) { e2 = e; }
  try { curateConversation([], 100); } catch (e) { e3 = e; }
  check('empty blocks rejected', !!e1 && /non-empty/.test(e1.message));
  check('non-positive budget rejected', !!e2 && /positive/.test(e2.message));
  check('empty conversation rejected', !!e3);
}

// 9. curateConversation: roles preserved, plan-marker classification, tool compression
{
  const messages = [
    { role: 'user', content: 'Constraint: no new dependencies.' },
    { role: 'assistant', content: 'I will now inspect the files.' },
    { role: 'tool', content: 'T'.repeat(3000) },
    { role: 'assistant', content: 'Plan: rewrite the parser, then run tests, then update docs.' },
  ];
  const { messages: out, report } = curateConversation(messages, 100000);
  check('user constraint kept with role', out.some((m) => m.role === 'user' && m.content.includes('no new dependencies')));
  check('plan-marker assistant kept as plan', out.some((m) => m.role === 'assistant' && m.content.startsWith('Plan:')));
  check('narration dropped', !out.some((m) => m.content.includes('inspect the files')));
  check('tool result compressed with role', out.some((m) => m.role === 'tool' && m.content.includes('[curated:')));
  check('order: constraint first, plan last', out[0].role === 'user' && out[out.length - 1].content.startsWith('Plan:'));
  check('audit counts consistent', report.kept + report.compressed + report.dropped === messages.length, JSON.stringify(report));
}

// 10. compressToolOutput shape
{
  const c = compressToolOutput('0123456789'.repeat(100), 100);
  check('head+tail+marker shape', c.startsWith('0123456789') && c.endsWith('0123456789'.slice(-Math.floor(100 * 0.25))) && c.includes('[curated:'));
}

console.log(failures === 0 ? '\nCURATE TEST PASS' : `\nCURATE TEST FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
