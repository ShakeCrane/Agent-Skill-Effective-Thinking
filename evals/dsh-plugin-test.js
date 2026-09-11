#!/usr/bin/env node
// DSH plugin contract test — the packaging + provider contract for the DeepSeek Harness adapter.
//
// TWO MODES, because "no DSH installed" and "DSH is broken" must not look the same:
//
//   ordinary  : node evals/dsh-plugin-test.js        (npm run test:dsh)
//               Static/package/sync checks always run. The provider contract runs against the REAL
//               DSH skill registry when a DSH installation is discoverable; if none is found it
//               reports SKIP and the exit stays 0, so a machine without a DSH host can still verify
//               the packaging contract.
//
//   strict    : node evals/dsh-plugin-test.js --require-host    (npm run test:dsh:host)
//               Identical checks, but a missing DSH host is a FAILURE (non-zero exit). This is the
//               real-host integration gate used by `release:verify` before publishing.
//               `REQUIRE_DSH=1` is accepted as the environment-variable spelling.
//
// The provider checks run against the ACTUAL host (`@deepseek-ai/dsh-skill` + `@deepseek-ai/cordis`)
// — registry, provider catalog, get, unload, reload — never against a hand-written mock. Nothing in
// this file fabricates a host: if a real host is absent, strict mode fails rather than passing.
//
// Usage:
//   node evals/dsh-plugin-test.js [--require-host]
//   REQUIRE_DSH=1 node evals/dsh-plugin-test.js
//   DSH_PACKAGES_DIR=<dir containing dsh-skill/ and cordis/> node evals/dsh-plugin-test.js
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const ASSET = path.join(ROOT, 'dsh', 'skill', 'effective-thinking.md');
const PATCH = path.join(ROOT, 'dsh', 'cordis.patch.yml');
const CANONICAL = path.join(ROOT, 'SKILL.md');

// Strict host mode: a missing real DSH host is a hard failure instead of a SKIP.
const requireDsh =
  process.argv.includes('--require-host') ||
  process.env.REQUIRE_DSH === '1';

let failures = 0;
let skipped = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};
const skip = (name, why) => { skipped++; console.log(`[SKIP] ${name} — ${why}`); };

/** Find the @deepseek-ai package directory of an installed DSH, or null. */
function findDshPackagesDir() {
  const candidates = [];
  if (process.env.DSH_PACKAGES_DIR) candidates.push(process.env.DSH_PACKAGES_DIR);
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai'));
  candidates.push(path.join(ROOT, 'node_modules', '@deepseek-ai'));
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'dsh-skill', 'lib', 'index.js')) &&
        fs.existsSync(path.join(dir, 'cordis', 'lib', 'index.js'))) return dir;
  }
  return null;
}

async function main() {
  console.log('== DSH PLUGIN CONTRACT TEST ==\n');

  // ---------- 1. package manifest ----------
  const pkg = require(path.join(ROOT, 'package.json'));
  check('package declares dsh.bundle.patch', typeof pkg.dsh?.bundle?.patch === 'string', JSON.stringify(pkg.dsh || null));
  check('bundle patch file exists on disk', fs.existsSync(PATCH), path.relative(ROOT, PATCH));
  check('main entry unchanged (CJS library)', pkg.main === 'index.js', String(pkg.main));
  check('root require() still exposes the library', typeof require(ROOT).route === 'function', 'index.js loads');
  check('no runtime dependencies added', Object.keys(pkg.dependencies || {}).length === 0, JSON.stringify(pkg.dependencies || {}));
  check('no peer dependencies (no DSH-internal coupling)', Object.keys(pkg.peerDependencies || {}).length === 0);

  // ---------- 2. exports / resolution ----------
  const dshEntry = pkg.exports?.['./dsh'];
  check('exports exposes ./dsh', typeof dshEntry === 'string', String(dshEntry));
  check('./dsh points at an existing file', dshEntry && fs.existsSync(path.join(ROOT, dshEntry)), String(dshEntry));
  check('exports keeps a catch-all for deep paths', pkg.exports?.['./*'] === './*');
  check('exports exposes the patch path', pkg.exports?.['./dsh/cordis.patch.yml'] === './dsh/cordis.patch.yml');

  // ---------- 3. sync: packaged asset vs canonical skill ----------
  const { generateAsset, bodyAfterFrontmatter } = require('../scripts/sync-dsh-skill.js');
  const { content: expected, body: canonicalBody } = await generateAsset();
  const assetExists = fs.existsSync(ASSET);
  check('packaged skill asset exists', assetExists, path.relative(ROOT, ASSET));
  if (assetExists) {
    const actual = fs.readFileSync(ASSET, 'utf8');
    check('asset equals the regenerated form (no hand edits)', actual === expected, `${actual.length} chars`);
    check('asset body === canonical SKILL.md, byte-for-byte', bodyAfterFrontmatter(actual) === canonicalBody, `${canonicalBody.length} chars`);
    check('asset carries generated frontmatter', actual.startsWith('---\n') && actual.includes('\nname: '), 'frontmatter block present');
  }

  // ---------- 4. patch row ----------
  const patchText = fs.existsSync(PATCH) ? fs.readFileSync(PATCH, 'utf8') : '';
  check('patch inserts exactly one loader row', (patchText.match(/^\s*- id:/gm) || []).length === 1, 'no duplicate insert');
  check('patch mounts the package DSH entry', patchText.includes("name: 'cognitive-agent-skill/dsh'"), 'row name');
  check('patch does not mount a second id for the same plugin', !/id:\s*effective-thinking-dsh[\s\S]*id:\s*effective-thinking-dsh/.test(patchText));

  // ---------- 5. provider contract against the REAL registry ----------
  console.log(`\n-- provider contract (${requireDsh ? 'REQUIRED real host' : 'real host if available'}) --`);
  const dshDir = findDshPackagesDir();
  if (!dshDir) {
    const why = 'no installed DSH found (set DSH_PACKAGES_DIR, or install the DSH host)';
    if (requireDsh) {
      // Strict mode: absence of the real host is exactly the failure this mode exists to report.
      // Never mock the host to fake a pass here.
      check('provider contract (real DSH registry) is runnable', false,
        `${why} — strict mode (--require-host / REQUIRE_DSH=1) FAILS instead of skipping`);
    } else {
      skip('provider contract (real DSH registry)', why);
    }
  } else {
    console.log(`using DSH host packages at ${dshDir}`);
    const cordisUrl = pathToFileURL(path.join(dshDir, 'cordis', 'lib', 'index.js')).href;
    const skillUrl = pathToFileURL(path.join(dshDir, 'dsh-skill', 'lib', 'index.js')).href;
    const { Context } = await import(cordisUrl);
    const skillMod = await import(skillUrl);
    const plugin = await import(pathToFileURL(path.join(ROOT, dshEntry)).href);

    check('plugin exports name/inject/apply', typeof plugin.name === 'string' && Array.isArray(plugin.inject) && typeof plugin.apply === 'function', JSON.stringify({ name: plugin.name, inject: plugin.inject }));
    check('plugin injects the skills service', plugin.inject.includes('skills'));
    check('plugin name is unique-looking and stable', plugin.name === 'effective-thinking-dsh');

    // a. catalog + body through the real registry
    const ctx = new Context();
    await ctx.plugin(skillMod.SkillRegistry);
    const fiber = await ctx.plugin(plugin.default ?? plugin);
    const list = await ctx.skills.list();
    check('catalog exposes exactly one skill', list.length === 1, `count=${list.length}`);
    check('catalog entry is named effective-thinking', list[0]?.name === 'effective-thinking');
    check('catalog entry advertises a description', typeof list[0]?.description === 'string' && list[0].description.length > 20);
    check('catalog entry is model- and user-invocable', list[0]?.invocation?.modelInvocable === true && list[0]?.invocation?.userInvocable === true, JSON.stringify(list[0]?.invocation));
    check('catalog entry lists a resource base', list[0]?.resourceBase?.path !== undefined, JSON.stringify(list[0]?.resourceBase));

    const def = await ctx.skills.get('effective-thinking');
    check('get() returns the definition', !!def && typeof def.content === 'string');
    check('loaded content === canonical SKILL.md body', def?.content === canonicalBody, `${def?.content?.length} vs ${canonicalBody.length} chars`);
    check('loaded content has no frontmatter leak', !String(def?.content).startsWith('---'), String(def?.content).slice(0, 24));
    check('loaded content is not truncated', def?.content === canonicalBody && def.content.length === canonicalBody.length);
    check('registry renderer accepts the definition', typeof skillMod.renderSkillContent(def) === 'string' && skillMod.renderSkillContent(def).includes('effective-thinking'));

    // b. duplicate identity must fail loud, not silently produce a second skill
    let dupError = null;
    try { await ctx.plugin(plugin.default ?? plugin); } catch (e) { dupError = String(e.message); }
    check('duplicate provider registration fails loud', dupError !== null && /already registered/.test(dupError), dupError || 'no error thrown');

    // c. unload: disposing the plugin's fiber removes the provider with no residue, in the SAME
    //    registry (so this cannot pass merely because a fresh context is empty)
    check('plugin mount returns a disposable fiber', typeof fiber?.dispose === 'function');
    await fiber.dispose();
    const afterUnload = await ctx.skills.list();
    check('after unload the catalog has no residue', afterUnload.length === 0, `count=${afterUnload.length}`);
    let getAfterUnload = null;
    try { getAfterUnload = await ctx.skills.get('effective-thinking'); } catch (e) { getAfterUnload = null; }
    check('after unload the skill is no longer loadable', !getAfterUnload, String(getAfterUnload?.name ?? getAfterUnload));

    // d. reinstall sanity: loading again restores exactly one entry
    await ctx.plugin(plugin.default ?? plugin);
    const list3 = await ctx.skills.list();
    check('plugin reloads cleanly after unload', list3.length === 1 && list3[0].name === 'effective-thinking', `count=${list3.length}`);
    await ctx.fiber.dispose();
  }

  console.log('');
  if (failures === 0) {
    console.log(`DSH PLUGIN CONTRACT TEST PASS${skipped ? ` (${skipped} skipped)` : ''}`);
    if (skipped && requireDsh) {
      // Unreachable by construction (a skip in strict mode is a failure), kept as a tripwire so a
      // future edit cannot make strict mode pass while silently skipping the host.
      console.log('DSH PLUGIN CONTRACT TEST FAIL: strict mode skipped a check');
      process.exit(1);
    }
    process.exit(0);
  }
  console.log(`DSH PLUGIN CONTRACT TEST FAIL: ${failures} failing check(s)`);
  process.exit(1);
}

main().catch((e) => { console.error('contract test crashed:', e); process.exit(1); });
