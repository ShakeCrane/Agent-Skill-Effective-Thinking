// Contract test for the project-conventions skill.
//
// WHY THIS EXISTS
// A skill is a prose document, so most of its behaviour cannot be unit-tested. But the parts that
// rot are mechanical: a rule in the operative file with no record behind it, a record with no rule,
// a class or evidence level outside the vocabulary, a ledger row that drifted, a reference to a file
// that was never written, an id that skipped a number after a renumbering, a body that outgrew its
// documented budget.
//
// Every one of those is a real defect class this document has already produced once. This script is
// the cheapest thing that can fail. It needs no network and no dependencies.
//
//   node evals/project-conventions/contract-test.mjs
//
// Exit 0 = the skill's own contract holds.

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const SKILL_DIR = join(REPO, '.dsh', 'skills', 'project-conventions');
const SKILL_MD = join(SKILL_DIR, 'SKILL.md');
const RULES_MD = join(SKILL_DIR, 'references', 'rules.md');

// Documented budgets. The 500-line / 5k-token skill cap is the vendor-documented one; the token
// figure is estimated from characters because no tokenizer is available offline, so it is a guard
// rail against runaway growth, not a measurement.
const MAX_BODY_LINES = 500;
const MAX_BODY_TOKENS = 5000;

const CLASSES = new Set(['HARD', 'DEFAULT', 'WHEN', 'PREFERENCE', 'HYPOTHESIS']);
const EVIDENCE = new Set(['strong', 'moderate', 'weak', 'none']);
const STATUSES = new Set(['candidate', 'active', 'deprecated']);

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

/** Split YAML frontmatter from the body. Returns { fields, body, raw }. */
function frontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { fields: null, body: raw };
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { fields, body: raw.slice(m[0].length) };
}

/** Rule ids in the operative file: `**PC-n** \`CLASS\` — ...` */
function operativeRules(body) {
  const out = new Map();
  const re = /\*\*(PC-\d+)\*\*\s+`([A-Z]+)`/g;
  let m;
  while ((m = re.exec(body)) !== null) out.set(m[1], m[2]);
  return out;
}

/** Full records: `### PC-n · CLASS · evidence: LEVEL · status: STATUS` */
function ruleRecords(text) {
  const out = new Map();
  const re = /^### (PC-\d+) · ([A-Z]+) · evidence: (\w+) · status: (\w+)\s*$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[0].length;
    const next = text.indexOf('\n### ', start);
    out.set(m[1], {
      cls: m[2],
      evidence: m[3],
      status: m[4],
      body: text.slice(start, next === -1 ? text.length : next),
    });
  }
  return out;
}

/** Ledger rows: `| PC-n | CLASS | EVIDENCE | gate | fires on |` */
function ledger(text) {
  const section = text.split('### Ledger')[1] ?? '';
  const out = new Map();
  for (const line of section.split(/\r?\n/)) {
    const m = /^\|\s*(PC-\d+)\s*\|\s*([A-Z]+)\s*\|\s*(\w+)\s*\|/.exec(line);
    if (m) out.set(m[1], { cls: m[2], evidence: m[3] });
  }
  return out;
}

/** Every relative markdown link target in `text`, resolved against `baseDir`. */
function links(text, baseDir) {
  const out = [];
  for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = m[1].split('#')[0].trim();
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // external or anchor-only
    out.push({ target, abs: resolve(baseDir, target) });
  }
  return out;
}

// ---------------------------------------------------------------- files exist

check('SKILL.md exists', existsSync(SKILL_MD), relative(REPO, SKILL_MD).split(sep).join('/'));
check('references/rules.md exists', existsSync(RULES_MD), relative(REPO, RULES_MD).split(sep).join('/'));

const skillRaw = readFileSync(SKILL_MD, 'utf8');
const rulesRaw = readFileSync(RULES_MD, 'utf8');
const { fields, body } = frontmatter(skillRaw);

// ---------------------------------------------------------------- frontmatter

check('SKILL.md declares frontmatter', fields !== null);
check('frontmatter has a name', Boolean(fields?.name), fields?.name);
check('name is kebab-case', /^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields?.name ?? ''), fields?.name);
check('name matches the bundle directory', fields?.name === 'project-conventions', fields?.name);
check('frontmatter has a description', Boolean(fields?.description && fields.description.length >= 20),
  `${(fields?.description ?? '').length} chars`);
check('description fits a catalog entry', (fields?.description ?? '').length <= 1024,
  `${(fields?.description ?? '').length} chars`);

// ---------------------------------------------------------------- budgets

const bodyLines = body.split(/\r?\n/).length;
const approxTokens = Math.ceil(body.length / 4);
check('body is inside the line budget', bodyLines <= MAX_BODY_LINES, `${bodyLines} <= ${MAX_BODY_LINES}`);
check('body is inside the token budget', approxTokens <= MAX_BODY_TOKENS, `~${approxTokens} <= ${MAX_BODY_TOKENS}`);

// ---------------------------------------------------------------- encoding

// This check exists because it was earned. A negative-control run mutated SKILL.md in place with a
// shell tool that re-encoded it as a legacy codepage; every rule still parsed, so the whole suite
// stayed green while the file became unreadable to the agent host, which silently dropped the skill
// from the catalog. A test suite that cannot see that is not testing the artefact the host reads.
const decoded = readFileSync(SKILL_MD, 'utf8');
check('SKILL.md is valid UTF-8 with no replacement characters', !decoded.includes('\uFFFD'));
check('SKILL.md has no byte-order mark', skillRaw.charCodeAt(0) === 0x2d, `U+${skillRaw.charCodeAt(0).toString(16)}`);
check('rules.md has no byte-order mark', rulesRaw.charCodeAt(0) === 0x23, `U+${rulesRaw.charCodeAt(0).toString(16)}`);
check('frontmatter opens on the first line', skillRaw.startsWith('---\n') || skillRaw.startsWith('---\r\n'));

// ---------------------------------------------------------------- rule sets agree

const operative = operativeRules(body);
const records = ruleRecords(rulesRaw);
const led = ledger(rulesRaw);

check('the operative file declares rules', operative.size > 0, `${operative.size} rule(s)`);
check('every operatve rule has a record', [...operative.keys()].every((id) => records.has(id)),
  [...operative.keys()].filter((id) => !records.has(id)).join(', ') || 'all present');
check('every record has an operative rule', [...records.keys()].every((id) => operative.has(id)),
  [...records.keys()].filter((id) => !operative.has(id)).join(', ') || 'all present');

const classMismatch = [...operative.entries()]
  .filter(([id, cls]) => records.has(id) && records.get(id).cls !== cls)
  .map(([id, cls]) => `${id}: skill=${cls} record=${records.get(id).cls}`);
check('class agrees between the two files', classMismatch.length === 0, classMismatch.join('; ') || 'agree');

// ---------------------------------------------------------------- vocabularies

const badClass = [...records].filter(([, r]) => !CLASSES.has(r.cls)).map(([id]) => id);
check('every class is in the vocabulary', badClass.length === 0, badClass.join(', ') || [...CLASSES].join('/'));

const badEvidence = [...records].filter(([, r]) => !EVIDENCE.has(r.evidence)).map(([id]) => id);
check('every evidence level is in the vocabulary', badEvidence.length === 0,
  badEvidence.join(', ') || [...EVIDENCE].join('/'));

const badStatus = [...records].filter(([, r]) => !STATUSES.has(r.status)).map(([id]) => id);
check('every status is in the vocabulary', badStatus.length === 0, badStatus.join(', ') || [...STATUSES].join('/'));

// ---------------------------------------------------------------- record completeness

const incomplete = [];
for (const [id, r] of records) {
  for (const field of ['Trigger', 'Action', 'Check']) {
    const re = new RegExp(`\\*\\*${field}\\*\\*\\s*—\\s*\\S`);
    if (!re.test(r.body)) incomplete.push(`${id}.${field}`);
  }
}
check('every record has Trigger, Action and Check', incomplete.length === 0,
  incomplete.join(', ') || `${records.size} records complete`);

// A rule whose check is not `none` should look like something a reader could run or observe.
//
// An earlier version of this check tested only `m[1].trim().length < 20`, and the adversarial review
// broke it in one move: a long, entirely vague sentence passed. A length test cannot detect vagueness —
// the honest response was to delete the fake check rather than keep a green light that means nothing.
// What replaces it: every Check must be non-empty, and the split between mechanical checks (which name
// a command or artefact) and judgement checks is *reported*. The reporting is the point — a reader can
// see how much of this ruleset is mechanically checkable, and nobody is told a heuristic is a proof.
const emptyChecks = [...records].filter(([, r]) => !/\*\*Check\*\*\s*—\s*\S/.test(r.body)).map(([id]) => id);
check('every rule has a non-empty Check', emptyChecks.length === 0, emptyChecks.join(', ') || `${records.size} checks`);

const mechanical = [...records].filter(([, r]) => {
  const m = /\*\*Check\*\*\s*—\s*([\s\S]*?)(?:\n- \*\*|\n###|$)/.exec(r.body);
  return m && /`[^`]+`/.test(m[1]);
}).map(([id]) => id);
console.log(
  `[NOTE] checks naming a command or artefact (mechanical): ${mechanical.length}/${records.size} — ${mechanical.join(', ')}`,
);
console.log('[NOTE] the remainder are judgement checks: a yes/no question put to the agent itself.');

// ---------------------------------------------------------------- evidence levels agree with evidence.md

// This check was added after the review found PC-7 claimed at both `strong` and `moderate` in the same
// file. The convention it enforces: a bullet claims a level for a rule only when it writes `-> PC-n`;
// a bullet that merely relates a finding to a rule says so in words instead. Without this, the honesty
// layer can contradict the records and nothing notices.
const LEVEL_BY_SECTION = {
  'What is strong': 'strong',
  'What is moderate': 'moderate',
  'What is weak': 'weak',
  'What has no evidence at all': 'none',
};
const evidenceMd = join(SKILL_DIR, 'references', 'evidence.md');
const claims = new Map();
if (existsSync(evidenceMd)) {
  const text = readFileSync(evidenceMd, 'utf8');
  for (const part of text.split(/^## /m).slice(1)) {
    const heading = part.slice(0, part.indexOf('\n')).trim().replace(/^#+\s*/, '');
    const level = LEVEL_BY_SECTION[heading];
    if (!level) continue;
    for (const m of part.matchAll(/\u2192\s*(PC-\d+(?:\s*,\s*PC-\d+)*)/g)) {
      for (const id of m[1].split(',').map((s) => s.trim())) {
        if (!claims.has(id)) claims.set(id, new Set());
        claims.get(id).add(level);
      }
    }
  }
}
const contradictory = [...claims]
  .filter(([, levels]) => levels.size > 1)
  .map(([id, levels]) => `${id}: ${[...levels].join(' + ')}`);
check('no rule is claimed at two different evidence levels', contradictory.length === 0,
  contradictory.join('; ') || `${claims.size} rule(s) claimed once each`);

const mismatched = [...claims]
  .filter(([id, levels]) => records.has(id) && !levels.has(records.get(id).evidence))
  .map(([id, levels]) => `${id}: evidence.md says ${[...levels].join('/')}, record says ${records.get(id).evidence}`);
check('evidence.md agrees with the per-rule records', mismatched.length === 0,
  mismatched.join('; ') || 'agree');

// ---------------------------------------------------------------- citations point at real rules

// Also added after review: 14 of 22 citations referenced rule ids from a numbering that no longer
// existed, and setting every id to `PC-999` left both tests green. A citation that names a rule which
// does not exist is worse than an uncited rule, because it looks like support.
const citationsPath = join(REPO, 'evals', 'project-conventions', 'citations.json');
if (existsSync(citationsPath)) {
  const corpus = JSON.parse(readFileSync(citationsPath, 'utf8'));
  const badRefs = [];
  const citedRules = new Set();
  for (const c of corpus.checks) {
    for (const id of String(c.rule ?? '').split(',').map((s) => s.trim())) {
      if (id === '' || id === '\u2014') continue;
      if (!records.has(id)) badRefs.push(`${c.id} -> ${id}`);
      else citedRules.add(id);
    }
  }
  check('every citation names a rule that exists', badRefs.length === 0, badRefs.join(', ') || 'all resolve');

  const unsupported = [...records]
    .filter(([id, r]) => ['strong', 'moderate'].includes(r.evidence) && !citedRules.has(id))
    .map(([id]) => id);
  check('every strong or moderate rule has at least one citation', unsupported.length === 0,
    unsupported.join(', ') || `${citedRules.size} rule(s) cited`);

  const uncited = [...records].filter(([id]) => !citedRules.has(id)).map(([id]) => id);
  console.log(`[NOTE] rules with no machine-checked citation (expected for weak/none): ${uncited.join(', ') || 'none'}`);
} else {
  check('citations.json exists', false, citationsPath);
}

// ---------------------------------------------------------------- ledger agreement

check('the ledger covers every rule', [...records.keys()].every((id) => led.has(id)),
  [...records.keys()].filter((id) => !led.has(id)).join(', ') || 'covered');
const ledgerDrift = [...records.entries()]
  .filter(([id, r]) => led.has(id) && (led.get(id).cls !== r.cls || led.get(id).evidence !== r.evidence))
  .map(([id, r]) => `${id}: record=${r.cls}/${r.evidence} ledger=${led.get(id).cls}/${led.get(id).evidence}`);
check('ledger class and evidence agree with the records', ledgerDrift.length === 0,
  ledgerDrift.join('; ') || 'agree');

// ---------------------------------------------------------------- id continuity

const nums = [...records.keys()].map((id) => Number(id.slice(3))).sort((a, b) => a - b);
const gaps = [];
for (let i = 0; i < nums.length; i += 1) if (nums[i] !== i + 1) gaps.push(`expected PC-${i + 1}, found PC-${nums[i]}`);
check('rule ids are contiguous from PC-1', gaps.length === 0, gaps.join('; ') || `PC-1..PC-${nums.length}`);

// ---------------------------------------------------------------- links resolve

// This is the check that would have caught the dangling references/evidence.md: four pointers to a
// file that did not exist, in the skill whose own subject is documentation rot.
const allLinks = [
  ...links(skillRaw, SKILL_DIR).map((l) => ({ ...l, from: 'SKILL.md' })),
  ...links(rulesRaw, dirname(RULES_MD)).map((l) => ({ ...l, from: 'rules.md' })),
];
const missing = allLinks.filter((l) => !existsSync(l.abs));
check('every relative link resolves', missing.length === 0,
  missing.map((l) => `${l.from} -> ${l.target}`).join('; ') || `${allLinks.length} link(s) resolve`);

// Every file under references/ must be reachable from SKILL.md; an unreferenced reference file is
// material no reader will ever load — the quiet form of the same defect.
const refDir = join(SKILL_DIR, 'references');
const linked = new Set(allLinks.filter((l) => l.from === 'SKILL.md').map((l) => l.abs));
const orphanRefs = existsSync(refDir)
  ? readdirSync(refDir)
      .map((name) => join(refDir, name))
      .filter((abs) => statSync(abs).isFile() && !linked.has(abs))
  : [];
check('every reference file is reachable from SKILL.md', orphanRefs.length === 0,
  orphanRefs.map((abs) => relative(SKILL_DIR, abs).split(sep).join('/')).join(', ') || 'all reachable');

console.log('');
console.log(failures === 0
  ? `PROJECT-CONVENTIONS CONTRACT PASS: ${operative.size} rules, ${records.size} records, frontmatter and budgets valid`
  : `PROJECT-CONVENTIONS CONTRACT FAIL: ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
