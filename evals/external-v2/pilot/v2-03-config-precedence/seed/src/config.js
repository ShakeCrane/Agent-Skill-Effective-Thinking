'use strict';

const DEFAULTS = { timeout: 30, retries: 3, verbose: true };

function loadConfig({ cli = {}, env = {}, file = {} } = {}) {
  return {
    timeout: env.TIMEOUT || cli.timeout || file.timeout || DEFAULTS.timeout,
    retries: env.RETRIES || cli.retries || file.retries || DEFAULTS.retries,
    verbose: env.VERBOSE || cli.verbose || file.verbose || DEFAULTS.verbose,
  };
}

module.exports = { loadConfig, DEFAULTS };
