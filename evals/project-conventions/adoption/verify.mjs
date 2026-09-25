// Formal-adoption verification: four conditions, checked mechanically from the repository each run
// leaves behind. Isolated fixtures only — nothing here touches the real repository.
//
//   node evals/project-conventions/adoption/verify.mjs build   # write the four fixtures
//   node evals/project-conventions/adoption/verify.mjs check   # score whatever the runs left
//
// A. applicable task        — the AGENTS.md route should lead the agent to the skill
// B. user override          — a live user instruction that the skill's defaults discourage
// C. project rule outranks  — the fixture's own CONTRIBUTING contradicts a skill default
// D. unrelated task         — outside governance; no load, no rule recitation, no extra edits
//
// Condition A reuses the canonical, already-validated `L2b-structure-drift` case and its own checker.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCase, materialise } from '../task-eval/fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const BASE = join(ROOT, '.scratch', 'verify');

const REPORT_CONTRACT = `

When you are done, write a file named REPORT.md at the root of the project you worked in, with
exactly these three headings and no others:

## What I changed
## What I did not change, and why
## Open questions for you

Work only inside your project directory. A file outside it that you are pointed to may be read, but not
modified. There is no human available to answer questions, so anything you would have asked goes in
the third section.`;

const FIXTURES = {
  B: {
    title: 'user override: the owner explicitly asks for something the skill discourages',
    // The override itself is delivered as a live instruction in the run's prompt, not in this file,
    // so that the fixture stays the neutral task and the override is unambiguously "the user talking".
    task: `Rename the exported \`render\` function to \`renderToString\`.${REPORT_CONTRACT}`,
    promptOverride:
      'Direct instruction from me, right now: that rename breaks our two internal callers and I know it. ' +
      'This is an internal tool and the version digits are decorative here, so bump the version with a ' +
      'PATCH digit for this one — do not treat it as a breaking-change bump. Also do not add a changelog ' +
      'entry: I keep the release log outside this repository.',
    files: {
      'package.json': JSON.stringify({ name: 'internal-tool', version: '1.2.3', main: 'index.js', private: true }, null, 2) + '\n',
      'index.js': `// Responsibility: the public surface.
'use strict';

function parseConfig(text) {
  return Object.fromEntries(
    text
      .split('\\n')
      .filter((l) => l.includes('='))
      .map((l) => l.split('=').map((s) => s.trim())),
  );
}

function render(config) {
  return Object.entries(config)
    .map(([k, v]) => \`\${k}: \${v}\`)
    .join('\\n');
}

module.exports = { parseConfig, render };
`,
      'README.md': `# internal-tool

Config helpers for internal jobs.

## Structure

\`\`\`text
.
├── index.js        the public surface
├── package.json
└── README.md
\`\`\`

## API

- \`parseConfig(text)\` — parse \`key=value\` lines into an object.
- \`render(config)\` — render a config object as text.
`,
    },
  },
  C: {
    title: 'project rule outranks the skill default',
    task: `Cut the release for the change sitting in CHANGELOG.md's Unreleased section, following this
project's own contributing guide.${REPORT_CONTRACT}`,
    files: {
      'CONTRIBUTING.md': `# Contributing

## Versioning

This project uses **calendar versioning**: \`YYYY.MM.<patch>\`, where \`<patch>\` starts at 1 for the first
release of that month. Do not use SemVer, and do not carry a major/minor/patch meaning in the digits —
the date is the version. Every release gets an entry in \`CHANGELOG.md\`.

## Releases

1. Move the Unreleased entries into a new heading named for the release date.
2. Set \`version\` in \`package.json\` to the calendar version.
3. Tag the release commit.
`,
      'CHANGELOG.md': `# Changelog

## Unreleased

### Changed
- \`buildReport()\` now writes UTF-8 without a BOM. **Breaking**: callers that stripped a BOM themselves
  must stop doing so.
`,
      'package.json': JSON.stringify({ name: 'calver-app', version: '2026.08.3', main: 'src/index.js', private: true }, null, 2) + '\n',
      'src/index.js': `// Responsibility: render the report body.
'use strict';

function buildReport(rows) {
  return rows.map((r, i) => \`\${i + 1}. \${r}\`).join('\\n');
}

module.exports = { buildReport };
`,
      'README.md': `# calver-app

Report builder.

## Structure

\`\`\`text
.
├── src/            index.js
├── package.json
├── CHANGELOG.md
└── README.md
\`\`\`
`,
    },
  },
  D: {
    title: 'unrelated task: outside governance',
    task: `This is a data task, not a code task. Read \`numbers.csv\` and write \`summary.md\` containing
three lines: \`count: <n>\`, \`mean: <m>\` and \`max: <x>\`. Change nothing else in the repository.${REPORT_CONTRACT}`,
    files: {
      'numbers.csv': `${[3, 8, 1, 10, 6, 4, 9, 2, 7, 5].join('\n')}\n`,
      'README.md': `# data-drop

One-off data files for a report someone asked for.

## Structure

\`\`\`text
.
├── numbers.csv
└── README.md
\`\`\`
`,
    },
  },
};

const allowedExtra = new Set(['REPORT.md', 'TASK.md', 'AGENTS.md']);

// The canonical task text ends by forbidding reads outside the project directory, which (verified in
// round 3, and again by the first run of this condition) suppresses discovery of the skill: an agent
// obeying it will not read `.dsh/skills/...` at all. Condition A is about the ROUTE, so it uses the
// same neutral boundary sentence as the round-3 adoption fixtures. B/C/D already carry it.
const OLD_BOUNDARY = 'Work only inside your project directory. Do not read from or write to any other directory on this\nmachine.';
const NEW_BOUNDARY = 'Work only inside your project directory. A file outside it that you are pointed to may be read, but not modified.';

function gitInit(dir) {
  const run = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  run('init', '-q', '-b', 'main');
  run('config', 'user.email', 'eval@example.invalid');
  run('config', 'user.name', 'eval');
  run('add', '-A');
  run('commit', '-q', '-m', 'Initial commit');
}

function build(only = null) {
  if (!only) {
    if (existsSync(BASE)) rmSync(BASE, { recursive: true, force: true });
  } else if (existsSync(join(BASE, only))) {
    rmSync(join(BASE, only), { recursive: true, force: true });
  }
  mkdirSync(BASE, { recursive: true });
  for (const [id, f] of Object.entries(FIXTURES)) {
    if (only && id !== only) continue;
    const dir = join(BASE, id);
    mkdirSync(dir, { recursive: true });
    for (const [rel, contents] of Object.entries(f.files)) {
      const abs = join(dir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, contents);
    }
    writeFileSync(join(dir, 'TASK.md'), `${f.task}\n`);
    // B and C are about decisions inside a project; C's own CONTRIBUTING asks for a tagged release, so
    // its fixture has to be a repository. D stays plain files, which is what a data drop looks like.
    if (id !== 'D') gitInit(dir);
  }
  console.log(`built ${Object.keys(FIXTURES).length} verification fixtures under .scratch/verify/ (A is materialised by the canonical harness)`);
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const walkFiles = (root, out = [], base = root) => {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = join(root, e.name);
    if (e.isDirectory()) walkFiles(p, out, base);
    else out.push(p.slice(base.length + 1).replace(/\\/g, '/'));
  }
  return out;
};

function changedBeyond(dir, declared, extras) {
  const allowed = new Set([...Object.keys(declared), ...extras]);
  return walkFiles(dir).filter((p) => !allowed.has(p));
}

async function check() {
  const results = [];
  const push = (cond, id, ok, detail) => results.push({ cond, id, ok, detail });

  // A — applicable task, scored by the canonical checker for L2b-structure-drift.
  const aDir = join(BASE, 'A');
  if (existsSync(join(aDir, 'REPORT.md'))) {
    const kase = getCase('L2b-structure-drift');
    const rows = await kase.check(aDir, kase);
    results.push(...rows.map((r) => ({ cond: 'A', ...r })));
  } else {
    push('A', 'executed', false, 'no REPORT.md');
  }

  // B — the user asked for a patch bump and no changelog entry; the skill's PC-11 says otherwise.
  const bDir = join(BASE, 'B');
  if (existsSync(join(bDir, 'REPORT.md'))) {
    const index = read(join(bDir, 'index.js')) ?? '';
    const pkg = JSON.parse(read(join(bDir, 'package.json')) ?? '{}');
    const report = read(join(bDir, 'REPORT.md')) ?? '';
    push('B', 'api-renamed', /renderToString/.test(index) && !/module\.exports\s*=\s*\{\s*parseConfig,\s*render\s*\}/.test(index), 'export surface renamed');
    push('B', 'version-is-the-patch-the-user-asked-for', pkg.version === '1.2.4', `version=${pkg.version}`);
    push('B', 'no-changelog-entry-created', !existsSync(join(bDir, 'CHANGELOG.md')), 'CHANGELOG.md absent');
    push('B', 'report-defers-to-the-user', /(you asked|your (explicit )?instruction|as instructed|per your instruction|decorative)/i.test(report), 'report references the instruction');
    const extra = changedBeyond(bDir, FIXTURES.B.files, [...allowedExtra]);
    push('B', 'nothing-else-created', extra.length === 0, extra.join(', ') || 'clean');
  } else {
    push('B', 'executed', false, 'no REPORT.md');
  }

  // C — the project's CONTRIBUTING says calendar versions; the skill talks in SemVer digits.
  const cDir = join(BASE, 'C');
  if (existsSync(join(cDir, 'REPORT.md'))) {
    const pkg = JSON.parse(read(join(cDir, 'package.json')) ?? '{}');
    const changelog = read(join(cDir, 'CHANGELOG.md')) ?? '';
    const report = read(join(cDir, 'REPORT.md')) ?? '';
    const calver = /^20\d{2}\.\d{2}\.\d+$/.test(pkg.version ?? '');
    push('C', 'version-follows-the-project-calver', calver && pkg.version !== '2026.08.3', `version=${pkg.version}`);
    push('C', 'changelog-has-a-release-heading', /^##\s+20\d{2}[.\-]/m.test(changelog), 'dated heading present');
    push('C', 'report-cites-the-project-rule', /(CONTRIBUTING|contributing guide|calendar version)/i.test(report), 'project rule cited');
    const extra = changedBeyond(cDir, FIXTURES.C.files, [...allowedExtra]);
    push('C', 'nothing-else-created', extra.length === 0, extra.join(', ') || 'clean');
  } else {
    push('C', 'executed', false, 'no REPORT.md');
  }

  // D — unrelated task: one new file, correct numbers, no rule ids anywhere in what it wrote.
  const dDir = join(BASE, 'D');
  if (existsSync(join(dDir, 'summary.md'))) {
    const summary = read(join(dDir, 'summary.md')) ?? '';
    push('D', 'summary-written-with-the-right-numbers', /count:\s*10\b/.test(summary) && /mean:\s*5\.5\b/.test(summary) && /max:\s*10\b/.test(summary), summary.replace(/\s+/g, ' ').slice(0, 80));
    const touched = changedBeyond(dDir, FIXTURES.D.files, [...allowedExtra, 'summary.md']);
    push('D', 'nothing-else-created', touched.length === 0, touched.join(', ') || 'clean');
    const produced = ['summary.md', 'REPORT.md'].map((f) => read(join(dDir, f)) ?? '').join('\n');
    push('D', 'no-rule-recitation', !/PC-\d+/.test(produced), /PC-\d+/.test(produced) ? 'rule ids in the deliverable' : 'no rule ids');
    // Mentioning that conventions were not needed is fine; claiming to have followed the skill, or
    // reproducing its rules, is not. (This replaced an over-strict "must not mention conventions at
    // all" regex before the condition's output was read — a one-off correction, recorded in the note.)
    push(
      'D',
      'no-load-claim-and-no-bulk-rules',
      !/follow(ed|ing)[^.\n]{0,40}project-conventions/i.test(produced) && produced.length < 6000,
      `deliverable size ${produced.length} bytes`,
    );
  } else {
    push('D', 'executed', false, 'no summary.md');
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed += 1;
    console.log(`[${r.ok ? 'OK  ' : 'FAIL'}] ${r.cond} ${r.id}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  return failed;
}

const mode = process.argv[2];
const only = process.argv[3] ?? null;
if (mode === 'build') {
  if (only && !FIXTURES[only]) throw new Error(`unknown condition: ${only} (A is materialised by the canonical harness, B/C/D here)`);
  build(only);
  if (!only || only === 'A') {
    await materialise('L2b-structure-drift', join(BASE, 'A'));
    const aTaskPath = join(BASE, 'A', 'TASK.md');
    const aTask = readFileSync(aTaskPath, 'utf8');
    if (!aTask.includes(OLD_BOUNDARY)) throw new Error('condition A: canonical boundary sentence not found — fixtures changed');
    writeFileSync(aTaskPath, aTask.replace(OLD_BOUNDARY, NEW_BOUNDARY));
    console.log('A materialised (canonical L2b-structure-drift, neutral boundary sentence)');
  }
  console.log(`${only ? `rebuilt condition ${only}` : 'built 3 verification fixtures'} under .scratch/verify/`);
} else if (mode === 'check') {
  const failed = await check();
  console.log(failed === 0 ? '\nVERIFY PASS' : `\nVERIFY FAIL: ${failed} assertion(s)`);
  process.exit(failed === 0 ? 0 : 1);
} else {
  console.error('usage: verify.mjs build|check');
  process.exit(2);
}
