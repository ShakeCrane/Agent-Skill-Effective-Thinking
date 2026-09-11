'use strict';
// Turns a label into a URL slug.
// Non-string scalars (numbers, booleans) are coerced so that numeric ids can be slugged too.
function slugify(value) {
  const text = typeof value === 'number' || typeof value === 'boolean' ? String(value) : value;
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

module.exports = { slugify };
