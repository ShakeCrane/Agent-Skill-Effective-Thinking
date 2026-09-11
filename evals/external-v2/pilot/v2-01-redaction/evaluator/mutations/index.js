'use strict';
// Two plausible wrong fixes for v2-01. Each must be killed by the criteria it was designed to break.
const fs = require('fs');
const path = require('path');

// M1: the naive patch — keep the original top-level-only shape but add the missing key names.
const TOP_LEVEL_ONLY = `'use strict';

const SENSITIVE = ['password', 'token', 'apitoken', 'secret'];

function redactSecrets(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = SENSITIVE.includes(String(key).toLowerCase()) ? '[REDACTED]' : value[key];
    }
    return out;
  }
  return value;
}

module.exports = { redactSecrets };
`;

// M2: recursion and casing are right, but the input object is written through (mutating).
const MUTATES_INPUT = `'use strict';

const SENSITIVE = ['password', 'token', 'apitoken', 'secret'];

function redactSecrets(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = redactSecrets(value[i]);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (SENSITIVE.includes(String(key).toLowerCase())) value[key] = '[REDACTED]';
      else redactSecrets(value[key]);
    }
    return value;
  }
  return value;
}

module.exports = { redactSecrets };
`;

const MUTATIONS = [
  {
    id: 'm1-top-level-only',
    description: 'Adds the missing sensitive key names but still only redacts the top level (no recursion into objects/arrays).',
    expectedKilledBy: ['V2-01-C1', 'V2-01-C2'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'redact.js'), TOP_LEVEL_ONLY); },
  },
  {
    id: 'm2-mutates-input',
    description: 'Correctly recursive and case-insensitive, but redacts in place and returns the caller\'s own object.',
    expectedKilledBy: ['V2-01-C6'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'redact.js'), MUTATES_INPUT); },
  },
];

module.exports = { MUTATIONS };
