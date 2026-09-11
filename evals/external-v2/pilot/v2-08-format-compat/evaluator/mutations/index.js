'use strict';
// Two plausible wrong fixes for v2-08.
const fs = require('fs');
const path = require('path');

// M1: adds the note field to every line, which silently changes the default (v1) shape.
const ALWAYS_NOTE = `'use strict';

function escapeField(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\\|/g, '\\\\|');
}

function exportRecord(record, options = {}) {
  if (options.formatVersion === 2) {
    return [escapeField(record.id), escapeField(record.name), escapeField(record.note)].join('|');
  }
  return [escapeField(record.id), escapeField(record.name), escapeField(record.note)].join('|');
}

module.exports = { exportRecord, escapeField };
`;

// M2: flips the default format version to 2 — the new feature "just works", and every existing
// consumer silently receives an extra field.
const DEFAULT_V2 = `'use strict';

function escapeField(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\\|/g, '\\\\|');
}

function exportRecord(record, options = {}) {
  const version = options.formatVersion === 1 ? 1 : 2;
  const fields = [escapeField(record.id), escapeField(record.name)];
  if (version === 2) fields.push(escapeField(record.note));
  return fields.join('|');
}

module.exports = { exportRecord, escapeField };
`;

const MUTATIONS = [
  {
    id: 'm1-always-note',
    description: 'Emits the note field on every call, including the default and explicit v1 paths.',
    expectedKilledBy: ['V2-08-C1', 'V2-08-C2'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'exporter.js'), ALWAYS_NOTE); },
  },
  {
    id: 'm2-default-v2',
    description: 'Makes v2 the default so the new field always appears unless v1 is requested explicitly.',
    expectedKilledBy: ['V2-08-C1'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'exporter.js'), DEFAULT_V2); },
  },
];

module.exports = { MUTATIONS };
