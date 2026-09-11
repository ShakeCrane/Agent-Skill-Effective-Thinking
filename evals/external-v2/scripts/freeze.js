#!/usr/bin/env node
// freeze.js — materialise the freeze manifest for the v2 pilot.
//
// This runs ONCE, before the pilot. After the pilot starts, rewriting the manifest is FORBIDDEN:
// an altered frozen artifact is an evaluation-integrity failure, not something to be papered over by
// regenerating hashes (see protocol.json → measurementFixProtocol). Re-running this script without
// --force refuses, so a drift cannot be silently absorbed.
'use strict';
const fs = require('fs');
const path = require('path');
const {
  V2_ROOT, PILOT, listTaskIds, sha256, treeHash, exists, readJSON, FREEZE_MANIFEST, FROZEN_SKILL,
} = require('./lib.js');

function rel(p) { return path.relative(V2_ROOT, p).split(path.sep).join('/'); }

function build() {
  const artifacts = [];
  const add = (kind, p) => {
    if (!exists(p)) throw new Error(`missing frozen artifact: ${p}`);
    artifacts.push({ kind, path: rel(p), sha256: sha256(p) });
  };
  const addTree = (kind, p) => {
    if (!exists(p)) throw new Error(`missing frozen tree: ${p}`);
    artifacts.push({ kind, path: rel(p) + '/', tree: true, sha256: treeHash(p) });
  };

  // top-level protocol documents
  for (const f of ['protocol.json', 'conditions.json', 'pilot-manifest.json', 'run-order.json', 'README.md']) {
    add('protocol', path.join(V2_ROOT, f));
  }
  // frozen skill snapshot + its metadata
  add('frozenSkill', FROZEN_SKILL);
  add('frozenMetadata', path.join(V2_ROOT, 'frozen', 'freeze-metadata.json'));
  // harness scripts participate in the frozen state too
  for (const f of ['lib.js', 'prepare-run.js', 'check-run.js', 'generate-order.js', 'selftest.js']) {
    add('harness', path.join(V2_ROOT, 'scripts', f));
  }
  // per-task artifacts
  for (const t of listTaskIds()) {
    const base = path.join(PILOT, t);
    add('taskText', path.join(base, 'task.md'));
    addTree('seed', path.join(base, 'seed'));
    add('criteria', path.join(base, 'evaluator', 'criteria.json'));
    add('checker', path.join(base, 'evaluator', 'checker.js'));
    addTree('gold', path.join(base, 'evaluator', 'gold'));
    addTree('mutations', path.join(base, 'evaluator', 'mutations'));
  }
  return artifacts;
}

function main() {
  const force = process.argv.includes('--force');
  if (exists(FREEZE_MANIFEST) && !force) {
    console.error('REFUSING: freeze-manifest.json already exists.');
    console.error('A frozen artifact changing after the pilot starts is an integrity failure.');
    console.error('Use the measurement-fix protocol, or pass --force only before the pilot begins.');
    process.exit(1);
  }
  const artifacts = build();
  const meta = readJSON(path.join(V2_ROOT, 'frozen', 'freeze-metadata.json'));
  const manifest = {
    suite: 'external-eval-v2',
    protocolVersion: meta.pilotProtocolVersion,
    freezeTimestamp: meta.freezeTimestamp,
    phase1BaselineCommit: meta.phase1BaselineCommit,
    phase1PackageVersion: meta.phase1PackageVersion,
    frozenSkillSha256: meta.frozenSkillSha256,
    sourceSkillSha256: meta.sourceSkillSha256,
    generatedAt: new Date().toISOString(),
    artifactCount: artifacts.length,
    artifacts,
  };
  fs.writeFileSync(FREEZE_MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`freeze-manifest.json written: ${artifacts.length} artifacts`);
  const byKind = {};
  for (const a of artifacts) byKind[a.kind] = (byKind[a.kind] || 0) + 1;
  console.log(JSON.stringify(byKind, null, 2));
}

if (require.main === module) main();
module.exports = { build };
