'use strict';
// GOLD: explicit field parsing + real calendar validation, fully timezone-free.
const fs = require('fs');
const path = require('path');

const GOLD = `'use strict';

function pad(n) {
  return String(n).padStart(2, '0');
}

function daysInMonth(year, month) {
  // Date.UTC + getUTCDate never consults the local timezone.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseDateOnly(value) {
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(value));
  if (!m) throw new Error('invalid date-only value: ' + value);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) throw new Error('invalid month: ' + month);
  if (day < 1 || day > daysInMonth(year, month)) throw new Error('invalid day: ' + day);
  return { year, month, day };
}

function formatDateOnly(value) {
  const p = parseDateOnly(value);
  return p.year + '-' + pad(p.month) + '-' + pad(p.day);
}

module.exports = { parseDateOnly, formatDateOnly };
`;

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'date-only.js'), GOLD);
}

module.exports = { apply };
