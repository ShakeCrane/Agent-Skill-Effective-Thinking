#!/usr/bin/env node
// sync-dsh-skill.js — generate the DSH packaged skill assets from the canonical root bodies.
//
// Each packaged skill has exactly ONE source of truth in the repository root:
//   `SKILL.md`          -> dsh/skill/effective-thinking.md
//   `SKILL-DISPATCH.md` -> dsh/skill/task-dispatch.md
// The generated asset is:
//
//     generated frontmatter (from dsh/skill-meta.mjs)
//   + canonical body, byte-for-byte
//
// The body is never hand-written here, so canonical and asset cannot drift:
// `check-dsh-skill-sync.js` re-derives the expected bytes and fails loudly on any difference.
//
// Usage: node scripts/sync-dsh-skill.js
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const META_MODULE = path.join(ROOT, 'dsh', 'skill-meta.mjs');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** The packaged-skill table: canonical root file -> generated asset + metadata keys. */
const SKILL_ENTRIES = [
  {
    id: 'effective-thinking',
    canonical: path.join(ROOT, 'SKILL.md'),
    asset: path.join(ROOT, 'dsh', 'skill', 'effective-thinking.md'),
    metaKeys: { name: 'SKILL_NAME', description: 'SKILL_DESCRIPTION', whenToUse: 'SKILL_WHEN_TO_USE' },
  },
  {
    id: 'task-dispatch',
    canonical: path.join(ROOT, 'SKILL-DISPATCH.md'),
    asset: path.join(ROOT, 'dsh', 'skill', 'task-dispatch.md'),
    metaKeys: { name: 'DISPATCH_SKILL_NAME', description: 'DISPATCH_SKILL_DESCRIPTION', whenToUse: 'DISPATCH_SKILL_WHEN_TO_USE' },
  },
];

/**
 * Render a YAML scalar safely: always single-quoted, with embedded quotes doubled.
 * @param value - the raw string value.
 * @returns the quoted YAML scalar.
 */
function yamlScalar(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Build one packaged asset: generated frontmatter plus the canonical body.
 * @param {object} entry - a SKILL_ENTRIES row.
 * @param {object} meta - the imported dsh/skill-meta.mjs module.
 * @returns the asset text and the pieces it was built from.
 */
function generateFor(entry, meta) {
  const body = fs.readFileSync(entry.canonical, 'utf8');
  const frontmatter = [
    '---',
    `name: ${yamlScalar(meta[entry.metaKeys.name])}`,
    `description: ${yamlScalar(meta[entry.metaKeys.description])}`,
    `whenToUse: ${yamlScalar(meta[entry.metaKeys.whenToUse])}`,
    '---',
    '',
    '',
  ].join('\n');
  return { content: frontmatter + body, frontmatter, body, meta, entry };
}

/** Legacy single-skill helper: generate the effective-thinking asset (kept for downstream imports). */
async function generateAsset() {
  const meta = await import(require('url').pathToFileURL(META_MODULE).href);
  return generateFor(SKILL_ENTRIES[0], meta);
}

/** Generate every packaged asset. @returns array of generation results. */
async function generateAll() {
  const meta = await import(require('url').pathToFileURL(META_MODULE).href);
  return SKILL_ENTRIES.map((entry) => generateFor(entry, meta));
}

/** Extract the body after a leading frontmatter block. @param text - full asset text. */
function bodyAfterFrontmatter(text) {
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  return text.slice(end + 4).replace(/^\n+/, '');
}

async function main() {
  for (const { content, body, entry, meta } of await generateAll()) {
    fs.mkdirSync(path.dirname(entry.asset), { recursive: true });
    fs.writeFileSync(entry.asset, content);
    console.log('sync-dsh-skill: wrote', path.relative(ROOT, entry.asset));
    console.log('  skill name   :', meta[entry.metaKeys.name]);
    console.log('  canonical    :', path.relative(ROOT, entry.canonical), sha256(fs.readFileSync(entry.canonical)), `(${body.length} chars)`);
    console.log('  asset        :', sha256(Buffer.from(content)), `(${content.length} chars)`);
    console.log('  body preserved byte-for-byte:', body === fs.readFileSync(entry.canonical, 'utf8'));
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { generateAsset, generateAll, generateFor, SKILL_ENTRIES, bodyAfterFrontmatter, ASSET_PATH: SKILL_ENTRIES[0].asset, CANONICAL_SKILL: SKILL_ENTRIES[0].canonical, sha256 };
