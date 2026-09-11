'use strict';

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseDateOnly(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid date-only value: ${value}`);
  }
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function formatDateOnly(value) {
  const p = parseDateOnly(value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

module.exports = { parseDateOnly, formatDateOnly };
