'use strict';
// GOLD implementation of the SECURITY.md contract (recursive, case-insensitive, immutable).
const fs = require('fs');
const path = require('path');

const GOLD = `'use strict';

const SENSITIVE = ['password', 'token', 'apitoken', 'secret'];

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = SENSITIVE.includes(String(key).toLowerCase()) ? '[REDACTED]' : redactSecrets(value[key]);
    }
    return out;
  }
  return value;
}

module.exports = { redactSecrets };
`;

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'redact.js'), GOLD);
}

module.exports = { apply };
