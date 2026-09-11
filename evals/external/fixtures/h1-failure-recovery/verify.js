'use strict';
const { percent } = require("./lib/percent.js");
let failed = 0;
function eq(name, got, want) {
  const ok = Math.abs(got - want) < 0.005;
  console.log((ok ? "ok   " : "FAIL ") + name + " got=" + got + " want=" + want);
  if (!ok) failed++;
}
eq("percent(1,3)", percent(1, 3), 33.333);
eq("percent(25,200)", percent(25, 200), 12.5);
eq("percent(1,8)", percent(1, 8), 12.5);
eq("percent(0,5)", percent(0, 5), 0);
if (failed) { console.log("FAILED: " + failed + " case(s)"); process.exit(1); }
console.log("ALL PASS");
