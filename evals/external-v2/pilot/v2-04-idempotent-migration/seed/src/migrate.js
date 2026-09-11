'use strict';

const DEFAULT_ENTRY = { id: 'builtin-safe', enabled: true };

function migrate(config) {
  if (!Array.isArray(config.plugins)) {
    config.plugins = [];
  }
  config.plugins.push(Object.assign({}, DEFAULT_ENTRY));
  return config;
}

module.exports = { migrate, DEFAULT_ENTRY };
