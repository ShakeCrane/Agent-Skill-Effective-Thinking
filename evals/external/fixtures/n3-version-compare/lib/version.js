'use strict';
// NOTE: the split regex below is suspected by the reporter.
function parse(v) { return String(v).split(/[.]/).map(Number); }
function maxVersion(list) {
  let best = list[0];
  for (const v of list) { if (String(v) > String(best)) best = v; }
  return best;
}
module.exports = { maxVersion, parse };
