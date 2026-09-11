#!/usr/bin/env node
// sync-dsh-skill.js — generate the DSH packaged skill asset from the canonical root `SKILL.md`.
//
// The root `SKILL.md` is the ONE source of truth for the skill's instruction body. The DSH package
// needs a self-describing asset (DSH skill assets conventionally carry YAML frontmatter), so this
// script produces:
//
//     generated frontmatter (from dsh/skill-meta.mjs)
//   + canonical SKILL.md body, byte-for-byte
//   -> dsh/skill/effective-thinking.md
//
// The body is never hand-written here, so the two files cannot drift: `check-dsh-skill-sync.js`
// re-derives the expected bytes and fails loudly on any difference.
//
// Usage: node scripts/sync-dsh-skill.js
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CANONICAL_SKILL = path.join(ROOT, 'SKILL.md');
const META_MODULE = path.join(ROOT, 'dsh', 'skill-meta.mjs');
const ASSET_PATH = path.join(ROOT, 'dsh', 'skill', 'effective-thinking.md');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Render a YAML scalar safely: always single-quoted, with embedded quotes doubled.
 * @param value - the raw string value.
 * @returns the quoted YAML scalar.
 */
function yamlScalar(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Build the full packaged asset content: generated frontmatter plus the canonical body.
 * @returns the asset text and the pieces it was built from.
 */
async function generateAsset() {
  const meta = await import(require('url').pathToFileURL(META_MODULE).href);
  const body = fs.readFileSync(CANONICAL_SKILL, 'utf8');
  const frontmatter = [
    '---',
    `name: ${yamlScalar(meta.SKILL_NAME)}`,
    `description: ${yamlScalar(meta.SKILL_DESCRIPTION)}`,
    `whenToUse: ${yamlScalar(meta.SKILL_WHEN_TO_USE)}`,
    '---',
    '',
    '',
  ].join('\n');
  return {
    content: frontmatter + body,
    frontmatter,
    body,
    meta,
  };
}

/** Extract the body after a leading frontmatter block. @param text - full asset text. */
function bodyAfterFrontmatter(text) {
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  return text.slice(end + 4).replace(/^\n+/, '');
}

async function main() {
  const { content, body, meta } = await generateAsset();
  fs.mkdirSync(path.dirname(ASSET_PATH), { recursive: true });
  fs.writeFileSync(ASSET_PATH, content);
  console.log('sync-dsh-skill: wrote', path.relative(ROOT, ASSET_PATH));
  console.log('  skill name   :', meta.SKILL_NAME);
  console.log('  canonical    : SKILL.md', sha256(fs.readFileSync(CANONICAL_SKILL)), `(${body.length} chars)`);
  console.log('  asset        :', sha256(Buffer.from(content)), `(${content.length} chars)`);
  console.log('  body preserved byte-for-byte:', body === fs.readFileSync(CANONICAL_SKILL, 'utf8'));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { generateAsset, bodyAfterFrontmatter, ASSET_PATH, CANONICAL_SKILL, sha256 };
