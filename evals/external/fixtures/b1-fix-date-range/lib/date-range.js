// Date range helpers. Ranges are {start, end} with numeric endpoints.
'use strict';

function overlaps(a, b) {
  // BUG REPORT (#1142): two ranges that only touch at an endpoint are reported as overlapping.
  return a.start <= b.end && b.start <= a.end;
}

function merge(ranges) {
  // Merge overlapping ranges into the smallest equivalent list.
  const out = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) {
      if (r.end > last.end) last.end = r.end;
    } else {
      out.push({ start: r.start, end: r.end });
    }
  }
  return out;
}

module.exports = { overlaps, merge };
