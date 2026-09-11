'use strict';
const { mean, median } = require("./lib/stats.js");
let failed = 0;
const eq = (n, got, want) => { const ok = Object.is(got, want) || Math.abs(got - want) < 1e-9;
  console.log((ok ? "ok   " : "FAIL ") + n + " got=" + got + " want=" + want); if (!ok) failed++; };
eq("mean empty", mean([]), 0);
eq("mean basic", mean([1, 2, 3]), 2);
eq("median odd", median([3, 1, 2]), 2);
eq("median even", median([1, 2, 3, 4]), 2.5);
eq("median even 2", median([4, 1, 3, 2]), 2.5);
if (failed) { console.log("FAILED: " + failed); process.exit(1); }
console.log("ALL PASS");
