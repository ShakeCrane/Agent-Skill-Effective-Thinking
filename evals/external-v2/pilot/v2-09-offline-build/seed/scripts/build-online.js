'use strict';
// Online build: fetches release metadata before bundling. Requires network access.
const fs = require('fs');
const path = require('path');

function main() {
  if (process.env.EVAL_OFFLINE === '1' || process.env.CI_OFFLINE === '1') {
    console.error(
      'online build cannot run here: no network access (offline environment detected).\n' +
      'Use the offline build instead:  npm run build:offline'
    );
    process.exit(1);
  }
  // In a networked environment this would fetch release metadata.
  console.error('online build cannot reach the release metadata endpoint in this environment.');
  process.exit(1);
}

if (require.main === module) main();
