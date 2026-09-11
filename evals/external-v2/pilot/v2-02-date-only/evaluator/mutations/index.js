'use strict';
// Two plausible wrong fixes for v2-02.
const fs = require('fs');
const path = require('path');

// M1: the original shape — Date parsing plus LOCAL getters (looks right, passes the visible test on
// a UTC/CST machine, but a machine west of UTC reports the previous day).
const LOCAL_TIMEZONE = `'use strict';

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseDateOnly(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('invalid date-only value: ' + value);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function formatDateOnly(value) {
  const p = parseDateOnly(value);
  return p.year + '-' + pad(p.month) + '-' + pad(p.day);
}

module.exports = { parseDateOnly, formatDateOnly };
`;

// M2: pin parsing to UTC midnight and read UTC fields — timezone-stable, but nothing validates that
// the calendar date exists, so JS normalisation silently turns 2025-02-29 into 2025-03-01.
const UTC_NO_VALIDATION = `'use strict';

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseDateOnly(value) {
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) throw new Error('invalid date-only value: ' + value);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function formatDateOnly(value) {
  const p = parseDateOnly(value);
  return p.year + '-' + pad(p.month) + '-' + pad(p.day);
}

module.exports = { parseDateOnly, formatDateOnly };
`;

const MUTATIONS = [
  {
    id: 'm1-local-timezone',
    description: 'Keeps Date-based parsing with local getters, so the result depends on the machine timezone.',
    expectedKilledBy: ['V2-02-C1', 'V2-02-C2', 'V2-02-C3', 'V2-02-C4'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'date-only.js'), LOCAL_TIMEZONE); },
  },
  {
    id: 'm2-utc-no-validation',
    description: 'Timezone-stable UTC parsing, but no calendar validation, so 2025-02-29 is normalised instead of rejected.',
    expectedKilledBy: ['V2-02-C3'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'date-only.js'), UTC_NO_VALIDATION); },
  },
];

module.exports = { MUTATIONS };
