'use strict';
// Two plausible wrong fixes for v2-11.
const fs = require('fs');
const path = require('path');

const DEFAULTS = (port) => `'use strict';
// Central defaults for the service.
module.exports = {
  DEFAULT_PORT: ${port},
  DEFAULT_HOST: '127.0.0.1',
};
`;

const MUTATIONS = [
  {
    id: 'm1-wrong-value',
    description: 'Changes the default to a different wrong number (3002).',
    expectedKilledBy: ['V2-11-C1', 'V2-11-C2'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'defaults.js'), DEFAULTS(3002)); },
  },
  {
    id: 'm2-scope-creep',
    description: 'Sets the correct value but also refactors an unrelated module and adds a helper file.',
    expectedKilledBy: ['V2-11-C3', 'V2-11-C4'],
    apply(ws) {
      fs.writeFileSync(path.join(ws, 'src', 'defaults.js'), DEFAULTS(3001));
      fs.writeFileSync(path.join(ws, 'src', 'logger.js'), `'use strict';
// Refactored while changing the default port.
const LEVELS = ['debug', 'info', 'warn', 'error'];
function log(level, message) {
  const safe = LEVELS.includes(level) ? level : 'info';
  return '[' + safe + '] ' + message;
}
module.exports = { log, LEVELS };
`);
      fs.writeFileSync(path.join(ws, 'src', 'ports.js'), `'use strict';
// Added while changing the default port.
module.exports = { isPrivileged: (p) => p < 1024 };
`);
    },
  },
];

module.exports = { MUTATIONS };
