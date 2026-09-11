'use strict';
// Two plausible wrong fixes for v2-03.
const fs = require('fs');
const path = require('path');

// M1: precedence order is right, but the merge still decides with truthiness, so 0 and false are
// silently replaced by a lower-priority source.
const TRUTHINESS = `'use strict';

const DEFAULTS = { timeout: 30, retries: 3, verbose: true };

function loadConfig({ cli = {}, env = {}, file = {} } = {}) {
  return {
    timeout: cli.timeout || env.TIMEOUT || file.timeout || DEFAULTS.timeout,
    retries: cli.retries || env.RETRIES || file.retries || DEFAULTS.retries,
    verbose: cli.verbose || env.VERBOSE || file.verbose || DEFAULTS.verbose,
  };
}

module.exports = { loadConfig, DEFAULTS };
`;

// M2: presence-based merging is implemented correctly, but the sources are consulted in the wrong
// order (ENV before CLI).
const ENV_OVER_CLI = `'use strict';

const DEFAULTS = { timeout: 30, retries: 3, verbose: true };

function firstDefined(...values) {
  for (const v of values) {
    if (v !== undefined) return v;
  }
  return undefined;
}

function loadConfig({ cli = {}, env = {}, file = {} } = {}) {
  return {
    timeout: firstDefined(env.TIMEOUT, cli.timeout, file.timeout, DEFAULTS.timeout),
    retries: firstDefined(env.RETRIES, cli.retries, file.retries, DEFAULTS.retries),
    verbose: firstDefined(env.VERBOSE, cli.verbose, file.verbose, DEFAULTS.verbose),
  };
}

module.exports = { loadConfig, DEFAULTS };
`;

const MUTATIONS = [
  {
    id: 'm1-truthiness',
    description: 'Correct precedence order but truthiness-based merging, so retries:0 / verbose:false are lost.',
    expectedKilledBy: ['V2-03-C5', 'V2-03-C6'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'config.js'), TRUTHINESS); },
  },
  {
    id: 'm2-env-over-cli',
    description: 'Presence-based merging, but ENV is consulted before CLI, inverting the documented order.',
    expectedKilledBy: ['V2-03-C1'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'config.js'), ENV_OVER_CLI); },
  },
];

module.exports = { MUTATIONS };
