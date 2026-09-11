#!/usr/bin/env node
// Condition prompt builder — the ONLY thing that differs between Control and Treatment.
//
// Everything outside the preamble below is byte-identical across conditions (same task text, same
// workspace instruction, same "work only here" rule), so the manipulated variable is exactly one
// thing: whether the Cognitive Skill is loaded.
//
// Usage:
//   node evals/external/prompts.js preamble controlA|controlB|treatment   (dump the preamble once)
//   node evals/external/prompts.js build <taskId> <runId> <condition>     (full run prompt)

'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO, 'SKILL.md');

const CONTROL_A_PREAMBLE = '';

const CONTROL_B_PREAMBLE = [
  'Before you start working, follow this simple routine:',
  '1. Make sure you understand what is being asked, including any constraints.',
  '2. Do the work.',
  '3. Check your result before you finish.',
  '',
].join('\n');

function treatmentPreamble() {
  const skill = fs.readFileSync(SKILL_PATH, 'utf8');
  return [
    'The following cognitive skill is ENABLED for this run. Read it and apply it to the task below.',
    '',
    '--- BEGIN SKILL ---',
    skill.trim(),
    '--- END SKILL ---',
    '',
    `The skill's implementation lives in ${REPO} (CLI: \`npm run route -- --task "..."\`; library: \`require('${REPO}')\`).`,
    'You may use it if it helps. Apply the skill to the task below.',
    '',
  ].join('\n');
}

const PREAMBLES = {
  controlA: () => CONTROL_A_PREAMBLE,
  controlB: () => CONTROL_B_PREAMBLE,
  treatment: treatmentPreamble,
};

function build(taskId, runId, condition, ws) {
  const { ITEMS } = require('./corpus.js');
  const item = ITEMS.find((i) => i.task_id === taskId);
  if (!item) throw new Error('unknown task ' + taskId);
  const pre = (PREAMBLES[condition] || PREAMBLES.controlA)();
  const suffix = [
    '',
    '---',
    `Working directory (work ONLY inside it): ${ws}`,
    'Complete the task, leave your deliverables in that directory, then stop.',
  ].join('\n');
  return pre + item.task_text + '\n' + suffix + '\n';
}

// write: materialise the run prompt as <ws>/TASK.md.
//
// Why: the dispatch message sent to every run is then byte-identical across conditions
// ("read TASK.md and follow it"), so the only manipulated variable is the content of TASK.md.
// It also keeps a 177-line SKILL.md out of the dispatcher's own context on every single run.
function write(taskId, runId, condition, ws) {
  const body = build(taskId, runId, condition, ws);
  fs.mkdirSync(ws, { recursive: true });
  fs.writeFileSync(path.join(ws, 'TASK.md'), body);
  return path.join(ws, 'TASK.md');
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'preamble') process.stdout.write(PREAMBLES[rest[0]]());
  else if (cmd === 'write') {
    const ws = rest[3] || path.join(require('os').tmpdir(), 'cog-skill-eval', rest[1]);
    console.log(write(rest[0], rest[1], rest[2], ws));
  }
  else if (cmd === 'build') {
    const ws = rest[3] || path.join(require('os').tmpdir(), 'cog-skill-eval', rest[1]);
    process.stdout.write(build(rest[0], rest[1], rest[2], ws));
  } else console.log('usage: prompts.js preamble <cond> | build <taskId> <runId> <cond> [ws]');
}

if (require.main === module) main();
module.exports = { build, PREAMBLES };
