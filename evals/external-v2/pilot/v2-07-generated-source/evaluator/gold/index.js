'use strict';
// GOLD: edit the source of truth, then run the repository's own generator.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function apply(ws) {
  const src = path.join(ws, 'schema', 'source.json');
  const schema = JSON.parse(fs.readFileSync(src, 'utf8'));
  const fields = schema.fields || [];
  if (!fields.some((f) => f && f.name === 'priority')) {
    fields.push({ name: 'priority', type: 'integer', required: false, default: 0 });
  }
  schema.fields = fields;
  fs.writeFileSync(src, JSON.stringify(schema, null, 2) + '\n');
  // Regenerate through the repository workflow (no pipes; inherit-free spawn).
  spawnSync(process.execPath, [path.join(ws, 'scripts', 'generate.js')], { cwd: ws, stdio: 'ignore' });
}

module.exports = { apply };
