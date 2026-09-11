'use strict';
function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function truncate(s, n) {
  const t = s.trim();
  return t.length <= n ? t : t.slice(0, n) + "...";
}
module.exports = { slugify, truncate };
