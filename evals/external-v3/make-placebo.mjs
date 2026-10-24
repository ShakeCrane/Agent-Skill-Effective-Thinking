#!/usr/bin/env node
// Generates the length-matched placebo for the controlC arm, deterministically.
// Contract: same CHARACTER count as the frozen SKILL.md (the only property controlC needs),
// and NO content that could plausibly change cognitive behaviour: no task-modeling, routing,
// verification, deliberation, escalation or prioritization advice — just documentation of a
// fictional warehouse inventory system. Output: evals/external-v3/placebo.md (+ sha/length log).

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = readFileSync(join(HERE, '..', 'external-v2', 'frozen', 'SKILL.md'), 'utf8');
const TARGET = SKILL.length;

const SENTENCES = [
  'The Northgate warehouse ledger uses a fixed column order: item code, shelf label, quantity, and last audit date.',
  'Blue shelf labels are reserved for items heavier than forty kilograms; all other items use green labels.',
  'The receiving dock log must be signed by two operators before any pallet moves to storage aisle three.',
  'Inventory counts run on the second Tuesday of each month and cover aisles one through nine in order.',
  'A pallet that fails the wrap-tension check goes to the rework bench, never directly to a shelf.',
  'The item code format is four letters, a hyphen, and five digits, for example NRTQ-40817.',
  'Cold-chain items record two temperatures at intake: the truck reading and the dock-side reading.',
  'Damaged cartons are photographed, tagged, and stored in bay twelve until the insurance review closes.',
  'The forklift charging schedule alternates night shifts; daytime charging is only for break-glass use.',
  'Cycle counts for fast movers happen weekly; slow movers are counted once per quarter.',
  'Every aisle keeps a paper overflow sheet for lines the digital ledger rejects at intake time.',
  'The break room inventory is out of scope for the warehouse ledger and tracked separately.',
  'Returns enter through dock four and wait for a quality grade before joining any storage aisle.',
  'The audit binder lives on the shelf beside the north exit and never leaves the building.',
  'Shelf labels older than three years are replaced during the annual relabeling week in March.',
  'No pallet may be stacked higher than the yellow line painted on the storage rack uprights.',
  'The loading plan for outbound trucks is posted ninety minutes before each scheduled departure.',
  'Spill kits hang at the east and west ends of every second aisle, inspected each Monday.',
  'Serial-numbered goods are scanned twice: once at intake and once at final outbound staging.',
  'The warehouse radio channel two is reserved for dock coordination; channel one is for management.',
];

function build() {
  const parts = [];
  let n = 0;
  while (n < TARGET) {
    const s = SENTENCES[parts.length % SENTENCES.length];
    parts.push(s);
    n += s.length + 1;
  }
  let text = `# Warehouse Inventory Documentation\n\nThis document describes the conventions of a fictional warehouse inventory system. It is provided as reference material only.\n\n`;
  for (const s of parts) {
    if (text.length + s.length + 1 > TARGET) break;
    text += s + '\n';
  }
  // Pad to EXACT character count with newlines (length match is the pre-registered property).
  while (text.length < TARGET) text += '\n';
  text = text.slice(0, TARGET);
  return text;
}

const placebo = build();
writeFileSync(join(HERE, 'placebo.md'), placebo, 'utf8');
const sha = createHash('sha256').update(placebo, 'utf8').digest('hex');
console.log(JSON.stringify({
  target: TARGET,
  actual: placebo.length,
  exact: placebo.length === TARGET,
  sha256: sha,
}, null, 2));
