#!/usr/bin/env node
// check-dsh-skill-sync.js — fail loudly if the DSH packaged skill asset has drifted.
//
// Verifies, byte-for-byte:
//   1. the on-disk asset equals what `sync-dsh-skill.js` would generate right now; and
//   2. the asset body (after generated frontmatter) equals the canonical root `SKILL.md` exactly.
//
// A drift means someone hand-edited the packaged copy, or changed `SKILL.md` without re-running the
// sync. Either way the packaged skill would stop matching the canonical skill, so this exits
// nonzero. Run it in the test suite and before publishing.
//
// Usage: node scripts/check-dsh-skill-sync.js
'use strict';
const fs = require('fs');
const path = require('path');
const { generateAsset, bodyAfterFrontmatter, ASSET_PATH, sha256 } = require('./sync-dsh-skill.js');

async function main() {
  const problems = [];

  if (!fs.existsSync(ASSET_PATH)) {
    console.error('FAIL: packaged DSH skill asset is missing:', path.relative(path.join(__dirname, '..'), ASSET_PATH));
    console.error('      run: node scripts/sync-dsh-skill.js');
    process.exit(1);
  }

  const { content: expected, body: canonicalBody } = await generateAsset();
  const actual = fs.readFileSync(ASSET_PATH, 'utf8');

  if (actual !== expected) {
    problems.push(
      `asset differs from the regenerated form\n` +
      `      expected sha256 ${sha256(Buffer.from(expected))}\n` +
      `      actual   sha256 ${sha256(Buffer.from(actual))}`
    );
  }

  const actualBody = bodyAfterFrontmatter(actual);
  if (actualBody !== canonicalBody) {
    problems.push(
      `asset body differs from canonical SKILL.md\n` +
      `      expected sha256 ${sha256(Buffer.from(canonicalBody))}\n` +
      `      actual   sha256 ${sha256(Buffer.from(actualBody))}`
    );
  }

  if (!actual.startsWith('---\n')) {
    problems.push('asset is missing its generated frontmatter block');
  }

  if (problems.length > 0) {
    console.error('DSH SKILL SYNC CHECK FAILED');
    for (const p of problems) console.error('  - ' + p);
    console.error('  fix: node scripts/sync-dsh-skill.js');
    process.exit(1);
  }

  console.log('DSH SKILL SYNC CHECK PASS');
  console.log('  asset body === canonical SKILL.md (sha256 ' + sha256(Buffer.from(canonicalBody)) + ')');
  console.log('  asset file  === regenerated form (sha256 ' + sha256(Buffer.from(actual)) + ')');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
