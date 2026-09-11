'use strict';
// GOLD: a one-line change to the single place that defines the default.
const fs = require('fs');
const path = require('path');

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'defaults.js'), `'use strict';
// Central defaults for the service.
module.exports = {
  DEFAULT_PORT: 3001,
  DEFAULT_HOST: '127.0.0.1',
};
`);
}

module.exports = { apply };
