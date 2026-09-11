'use strict';
// Two plausible wrong fixes for v2-04.
const fs = require('fs');
const path = require('path');

// M1: copies nothing and still pushes unconditionally — a second run appends a duplicate.
const ALWAYS_PUSH = `'use strict';

const DEFAULT_ENTRY = { id: 'builtin-safe', enabled: true };

function migrate(config) {
  const plugins = Array.isArray(config.plugins) ? config.plugins.slice() : [];
  plugins.push(Object.assign({}, DEFAULT_ENTRY));
  return Object.assign({}, config, { plugins });
}

module.exports = { migrate, DEFAULT_ENTRY };
`;

// M2: detects the id but "normalises" an existing entry back to the default, destroying user values.
const FORCE_REPLACE = `'use strict';

const DEFAULT_ENTRY = { id: 'builtin-safe', enabled: true };

function migrate(config) {
  const source = Array.isArray(config.plugins) ? config.plugins : [];
  const plugins = source.map((entry) => Object.assign({}, entry));
  const index = plugins.findIndex((entry) => entry && entry.id === DEFAULT_ENTRY.id);
  if (index === -1) plugins.push(Object.assign({}, DEFAULT_ENTRY));
  else plugins[index] = Object.assign({}, DEFAULT_ENTRY);
  return Object.assign({}, config, { plugins });
}

module.exports = { migrate, DEFAULT_ENTRY };
`;

const MUTATIONS = [
  {
    id: 'm1-always-push',
    description: 'Appends the default entry unconditionally, so running the migration twice duplicates it.',
    expectedKilledBy: ['V2-04-C1'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'migrate.js'), ALWAYS_PUSH); },
  },
  {
    id: 'm2-force-replace',
    description: 'Finds the existing entry but overwrites it with the default, discarding the user\'s configuration.',
    expectedKilledBy: ['V2-04-C2'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'migrate.js'), FORCE_REPLACE); },
  },
];

module.exports = { MUTATIONS };
