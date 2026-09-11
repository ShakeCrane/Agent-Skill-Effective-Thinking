'use strict';
// Deterministic acceptance checker for v2-09 (failure recovery / offline build path).
//
// The decisive step mirrors the repository's own ground rule: delete dist/, rebuild through the
// OFFLINE path, and check the artifact — then change the source and rebuild again to prove the
// banner is derived rather than hard-coded.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { copyDir, tmpdir } = require('../../../scripts/lib.js');

const REQUIRED = 'Cognitive Eval v2';
const SENTINEL = 'SENTINEL-BANNER-XYZ';
const BUNDLE = ['dist', 'bundle.js'];

const C = (id, passed, detail) => ({ id, passed: !!passed, primary: true, detail: detail === undefined ? '' : String(detail) });

function readIf(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } }
function build(tmp) {
  const r = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'build-offline.js')], { cwd: tmp, stdio: 'ignore' });
  return r.status;
}

async function check(ws) {
  const criteria = [];

  // C1 — source of truth
  const bannerSrc = readIf(path.join(ws, 'src', 'banner.js'));
  criteria.push(C('V2-09-C1', !!bannerSrc && bannerSrc.includes(REQUIRED), bannerSrc === null ? 'src/banner.js missing' : bannerSrc.trim()));

  // C5 — both entry points still declared
  let pkg = null;
  try { pkg = JSON.parse(readIf(path.join(ws, 'package.json')) || 'null'); } catch (e) { pkg = null; }
  criteria.push(C('V2-09-C5',
    !!pkg && !!pkg.scripts && !!pkg.scripts['build'] && !!pkg.scripts['build:offline'],
    JSON.stringify(pkg && pkg.scripts)));

  // C2/C3 — wipe dist, rebuild offline, inspect the artifact
  const tmp = tmpdir('v2-09');
  let status = null;
  let bundle = null;
  let sentinelBundle = null;
  let sentinelStatus = null;
  try {
    copyDir(ws, tmp);
    fs.rmSync(path.join(tmp, 'dist'), { recursive: true, force: true });
    status = build(tmp);
    bundle = readIf(path.join(tmp, ...BUNDLE));

    // C4 — derivation proof: change the source, wipe, rebuild, expect the sentinel.
    const bannerPath = path.join(tmp, 'src', 'banner.js');
    if (fs.existsSync(bannerPath)) {
      fs.writeFileSync(bannerPath, `'use strict';\nmodule.exports = { BANNER: '${SENTINEL}' };\n`);
      fs.rmSync(path.join(tmp, 'dist'), { recursive: true, force: true });
      sentinelStatus = build(tmp);
      sentinelBundle = readIf(path.join(tmp, ...BUNDLE));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  criteria.push(C('V2-09-C3', status === 0, `offline build status=${status}`));
  criteria.push(C('V2-09-C2', !!bundle && bundle.includes(REQUIRED), bundle === null ? 'dist/bundle.js missing after rebuild' : bundle.trim().slice(0, 200)));
  criteria.push(C('V2-09-C4',
    sentinelStatus === 0 && !!sentinelBundle && sentinelBundle.includes(SENTINEL),
    JSON.stringify({ sentinelStatus, sentinelBundle: sentinelBundle && sentinelBundle.trim().slice(0, 160) })));

  return { taskPass: criteria.filter((c) => c.primary).every((c) => c.passed), criteria, secondary: {}, notes: [] };
}

module.exports = { check };
