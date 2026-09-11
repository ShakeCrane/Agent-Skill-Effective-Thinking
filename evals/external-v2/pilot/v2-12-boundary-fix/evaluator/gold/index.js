'use strict';
// GOLD: two operator fixes. Nothing else is touched.
const fs = require('fs');
const path = require('path');

const GOLD = `'use strict';
// Returns true when value lies within [min, max].
function isWithin(value, min, max) {
  return value >= min && value <= max;
}

module.exports = { isWithin };
`;

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'range.js'), GOLD);
}

module.exports = { apply };
