'use strict';
function mean(arr) { let s = 0; for (const v of arr) s += v; return s / arr.length; }
function median(arr) { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
module.exports = { mean, median };
