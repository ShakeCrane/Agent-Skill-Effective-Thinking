'use strict';
// GOLD: existence check + copy-on-write migration (idempotent, order-preserving, non-mutating).
const fs = require('fs');
const path = require('path');

const GOLD = `'use strict';

const DEFAULT_ENTRY = { id: 'builtin-safe', enabled: true };

function migrate(config) {
  const source = Array.isArray(config.plugins) ? config.plugins : [];
  const plugins = source.map((entry) => Object.assign({}, entry));
  const alreadyPresent = plugins.some((entry) => entry && entry.id === DEFAULT_ENTRY.id);
  if (!alreadyPresent) {
    plugins.push(Object.assign({}, DEFAULT_ENTRY));
  }
  return Object.assign({}, config, { plugins });
}

module.exports = { migrate, DEFAULT_ENTRY };
`;

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'migrate.js'), GOLD);
}

module.exports = { apply };
