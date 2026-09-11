'use strict';
// GOLD: option-driven versioning; the default path is untouched.
const fs = require('fs');
const path = require('path');

const GOLD = `'use strict';

function escapeField(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\\|/g, '\\\\|');
}

function exportRecord(record, options = {}) {
  const version = options.formatVersion === 2 ? 2 : 1;
  const fields = [escapeField(record.id), escapeField(record.name)];
  if (version === 2) fields.push(escapeField(record.note));
  return fields.join('|');
}

module.exports = { exportRecord, escapeField };
`;

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'exporter.js'), GOLD);
}

module.exports = { apply };
