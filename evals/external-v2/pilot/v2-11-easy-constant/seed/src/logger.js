'use strict';
// Minimal structured logger. Not related to server defaults.
function log(level, message) {
  return `[${level}] ${message}`;
}

module.exports = { log };
