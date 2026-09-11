'use strict';
// GOLD: change the banner at its single source of truth and rebuild through the OFFLINE path.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function apply(ws) {
  fs.writeFileSync(
    path.join(ws, 'src', 'banner.js'),
    `'use strict';\n// Single source of truth for the build banner.\nmodule.exports = { BANNER: 'Cognitive Eval v2' };\n`
  );
  fs.rmSync(path.join(ws, 'dist'), { recursive: true, force: true });
  spawnSync(process.execPath, [path.join(ws, 'scripts', 'build-offline.js')], { cwd: ws, stdio: 'ignore' });
}

module.exports = { apply };
