'use strict';
// Percent formatting helper. Not related to the range helper.
function formatPercent(ratio, digits = 0) {
  return `${(ratio * 100).toFixed(digits)}%`;
}

module.exports = { formatPercent };
