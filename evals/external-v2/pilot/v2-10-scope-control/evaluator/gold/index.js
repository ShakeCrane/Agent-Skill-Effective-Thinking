'use strict';
// GOLD: the minimal local fix — one guard clause in slugify, nothing else touched.
const fs = require('fs');
const path = require('path');

const GOLD = `'use strict';
// Turns a label into a URL slug.
// Non-string scalars (numbers, booleans) are coerced so that numeric ids can be slugged too.
function slugify(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number' || typeof value === 'boolean' ? String(value) : value;
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

module.exports = { slugify };
`;

function apply(ws) {
  fs.writeFileSync(path.join(ws, 'src', 'slugify.js'), GOLD);
}

module.exports = { apply };
