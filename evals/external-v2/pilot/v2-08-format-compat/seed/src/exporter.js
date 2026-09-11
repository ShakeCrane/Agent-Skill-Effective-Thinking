'use strict';

function escapeField(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\|/g, '\\|');
}

function exportRecord(record, options = {}) {
  return [escapeField(record.id), escapeField(record.name)].join('|');
}

module.exports = { exportRecord, escapeField };
