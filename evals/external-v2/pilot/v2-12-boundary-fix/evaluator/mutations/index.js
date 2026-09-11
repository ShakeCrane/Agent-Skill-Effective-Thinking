'use strict';
// Two plausible wrong fixes for v2-12.
const fs = require('fs');
const path = require('path');

// M1: fixes only the lower boundary and leaves the upper one exclusive.
const MIN_ONLY = `'use strict';

function isWithin(value, min, max) {
  return value >= min && value < max;
}

module.exports = { isWithin };
`;

// M2: correct fix, but also "improves" the unrelated helper and adds a scratch file.
const SCOPE_CREEP = (ws) => {
  fs.writeFileSync(path.join(ws, 'src', 'range.js'), `'use strict';

function isWithin(value, min, max) {
  return value >= min && value <= max;
}

module.exports = { isWithin };
`);
  fs.writeFileSync(path.join(ws, 'src', 'format.js'), `'use strict';
// Tidied up while fixing the range helper.
function formatPercent(ratio, digits = 0) {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return (safe * 100).toFixed(digits) + '%';
}

module.exports = { formatPercent };
`);
  fs.writeFileSync(path.join(ws, 'range-notes.md'), '# scratch notes\n\nfixed the boundary\n');
};

const MUTATIONS = [
  {
    id: 'm1-min-only',
    description: 'Changes only the lower comparison, leaving the max boundary exclusive.',
    expectedKilledBy: ['V2-12-C2'],
    apply(ws) { fs.writeFileSync(path.join(ws, 'src', 'range.js'), MIN_ONLY); },
  },
  {
    id: 'm2-scope-creep',
    description: 'Fixes the helper correctly but also edits the unrelated module and adds a scratch file.',
    expectedKilledBy: ['V2-12-C5', 'V2-12-C6'],
    apply(ws) { SCOPE_CREEP(ws); },
  },
];

module.exports = { MUTATIONS };
