'use strict';
// Two plausible wrong fixes for v2-10.
const fs = require('fs');
const path = require('path');

// M1: guards with a truthiness check, which also swallows the legal falsy scalars 0 and false.
const FALSY_GUARD = `'use strict';

function slugify(value) {
  if (!value) return '';
  const text = typeof value === 'number' || typeof value === 'boolean' ? String(value) : value;
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

module.exports = { slugify };
`;

// M2: fixes the reported bug correctly, but also "tidies up" the unrelated modules and adds a helper.
const SCOPE_CREEP = (ws) => {
  fs.writeFileSync(path.join(ws, 'src', 'slugify.js'), `'use strict';

function slugify(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number' || typeof value === 'boolean' ? String(value) : value;
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

module.exports = { slugify };
`);
  // unrelated refactors
  fs.writeFileSync(path.join(ws, 'src', 'parser.js'), `'use strict';
// Refactored while fixing the slug bug.
function parseArgs(argv) {
  if (typeof argv !== 'string') return [];
  return argv.split(/\\s+/).filter(Boolean);
}

module.exports = { parseArgs };
`);
  fs.writeFileSync(path.join(ws, 'src', 'database.js'), `'use strict';
// Refactored while fixing the slug bug.
class Database {
  constructor() { this.rows = new Map(); }
  put(key, value) { this.rows.set(key, value); return this; }
  get(key) { return this.rows.get(key); }
}

module.exports = { Database };
`);
  fs.writeFileSync(path.join(ws, 'src', 'text-utils.js'), `'use strict';
// Added while fixing the slug bug.
module.exports = {};
`);
};

const MUTATIONS = [
  {
    id: 'm1-falsy-guard',
    description: 'Uses `if (!value) return ""`, which silently changes the behaviour of 0 and false.',
    expectedKilledBy: ['V2-10-C4'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'slugify.js'), FALSY_GUARD); },
  },
  {
    id: 'm2-scope-creep',
    description: 'Fixes the bug correctly but also refactors unrelated modules and adds a new file.',
    expectedKilledBy: ['V2-10-C5', 'V2-10-C6'],
    apply(ws) { SCOPE_CREEP(ws); },
  },
];

module.exports = { MUTATIONS };
