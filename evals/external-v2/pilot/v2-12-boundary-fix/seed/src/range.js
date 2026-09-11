'use strict';
// Returns true when value lies within [min, max].
function isWithin(value, min, max) {
  return value > min && value < max;
}

module.exports = { isWithin };
