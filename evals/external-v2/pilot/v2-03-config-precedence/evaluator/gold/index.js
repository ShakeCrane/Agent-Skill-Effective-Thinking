'use strict';
// GOLD: presence-based (undefined-checking) merge in the documented order.
const fs = require('fs');
const path = require('path');

const GOLD = `'use strict';

const DEFAULTS = { timeout: 30, retries: 3, verbose: true };

function firstDefined(...values) {
  for (const v of values) {
    if (v !== undefined) return v;
  }
  return undefined;
}

function loadConfig({ cli = {}, env = {}, file = {} } = {}) {
  return {
    timeout: firstDefined(cli.timeout, env.TIMEOUT, file.timeout, DEFAULTS.timeout),
    retries: firstDefined(cli.retries, env.RETRIES, file.retries, DEFAULTS.retries),
    verbose: firstDefined(cli.verbose, env.VERBOSE, file.verbose, DEFAULTS.verbose),
  };
}

module.exports = { loadConfig, DEFAULTS };
`;

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'config.js'), GOLD);
}

module.exports = { apply };
