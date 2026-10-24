#!/usr/bin/env node
// check-dsh-skill-sync.js — fail loudly if any DSH packaged skill asset has drifted.
//
// Verifies, byte-for-byte, for EVERY packaged skill:
//   1. the on-disk asset equals what `sync-dsh-skill.js` would generate right now; and
//   2. the asset body (after generated frontmatter) equals its canonical root file exactly.
//
// A drift means someone hand-edited the packaged copy, or changed a canonical file without
// re-running the sync. Either way the packaged skill would stop matching the canonical skill,
// so this exits nonzero. Run it in the test suite and before publishing.
//
// Usage: node scripts/check-dsh-skill-sync.js
'use strict';
const fs = require('fs');
const path = require('path');
const { generateAll, bodyAfterFrontmatter, SKILL_ENTRIES, sha256 } = require('./sync-dsh-skill.js');

async function main() {
  const problems = [];

  for (const entry of SKILL_ENTRIES) {
    if (!fs.existsSync(entry.asset)) {
      console.error('FAIL: packaged DSH skill asset is missing:', path.relative(path.join(__dirname, '..'), entry.asset));
      console.error('      run: node scripts/sync-dsh-skill.js');
      process.exit(1);
    }
  }

  for (const { content: expected, body: canonicalBody, entry, meta } of await generateAll()) {
    const actual = fs.readFileSync(entry.asset, 'utf8');
    const label = entry.id;

    if (actual !== expected) {
      problems.push(
        `[${label}] asset differs from the regenerated form\n` +
        `      expected sha256 ${sha256(Buffer.from(expected))}\n` +
        `      actual   sha256 ${sha256(Buffer.from(actual))}`
      );
    }

    const actualBody = bodyAfterFrontmatter(actual);
    if (actualBody !== canonicalBody) {
      problems.push(
        `[${label}] asset body differs from canonical ${path.relative(path.join(__dirname, '..'), entry.canonical)}\n` +
        `      expected sha256 ${sha256(Buffer.from(canonicalBody))}\n` +
        `      actual   sha256 ${sha256(Buffer.from(actualBody))}`
      );
    }

    if (!actual.startsWith('---\n')) {
      problems.push(`[${label}] asset is missing its generated frontmatter block`);
    }

    if (!problems.length) {
      console.log(`  [${label}] body === ${path.relative(path.join(__dirname, '..'), entry.canonical)} (sha256 ${sha256(Buffer.from(canonicalBody))}; skill name ${meta[entry.metaKeys.name]})`);
    }
  }

  if (problems.length > 0) {
    console.error('DSH SKILL SYNC CHECK FAILED');
    for (const p of problems) console.error('  - ' + p);
    console.error('  fix: node scripts/sync-dsh-skill.js');
    process.exit(1);
  }

  console.log('DSH SKILL SYNC CHECK PASS (' + SKILL_ENTRIES.length + ' skills)');
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { main };
