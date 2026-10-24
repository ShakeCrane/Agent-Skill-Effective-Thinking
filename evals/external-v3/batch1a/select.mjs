#!/usr/bin/env node
// Batch 1a selection — freeze the prompt subset BEFORE any arm runs (pre-registration discipline).
// Stratified by instruction count (natural difficulty levels): 1 / 2 / 3+ instructions.
// Output: evals/external-v3/batch1a/ifeval-selected.json (frozen list with sha256).

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSelectable } from './checkers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SRC = join(REPO, '.scratch', 'r5', 'data', 'ifeval.jsonl');
const OUT = join(HERE, 'ifeval-selected.json');

const QUOTA = { 1: 18, 2: 14, rest: 8 };
const rows = readFileSync(SRC, 'utf8').trim().split('\n').map(JSON.parse);
const selectable = rows.filter(isSelectable);
const byCount = { 1: [], 2: [], rest: [] };
for (const r of selectable) {
  const n = r.instruction_id_list.length;
  if (n === 1) byCount[1].push(r);
  else if (n === 2) byCount[2].push(r);
  else byCount.rest.push(r);
}
// key order = deterministic (dataset order); no shuffling, no peeking at prompts.
const picked = [
  ...byCount[1].slice(0, QUOTA[1]),
  ...byCount[2].slice(0, QUOTA[2]),
  ...byCount.rest.slice(0, QUOTA.rest),
];
const payload = {
  source: 'google/IFEval via hf-mirror (ifeval_input_data.jsonl, 541 rows)',
  selectedAt: new Date().toISOString(),
  quota: QUOTA,
  availableSelectable: selectable.length,
  picked: picked.map((r) => ({
    key: r.key,
    prompt: r.prompt,
    instruction_id_list: r.instruction_id_list,
    kwargs: r.kwargs,
    level: r.instruction_id_list.length === 1 ? 1 : r.instruction_id_list.length === 2 ? 2 : 3,
  })),
  sha256: null,
};
payload.sha256 = createHash('sha256').update(JSON.stringify(payload.picked), 'utf8').digest('hex');
writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(`selectable ${selectable.length}/541 -> picked ${picked.length} (L1=${Math.min(QUOTA[1], byCount[1].length)} L2=${Math.min(QUOTA[2], byCount[2].length)} L3+=${Math.min(QUOTA.rest, byCount.rest.length)})`);
console.log(`frozen sha256: ${payload.sha256}`);
