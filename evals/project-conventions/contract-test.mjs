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
const vagueCheck = [...records]
  .filter(([, r]) => {
    const m = /\*\*Check\*\*\s*—\s*([\s\S]*?)(?:\n- \*\*|\n###|$)/.exec(r.body);
    return m && /\bnone\b/i.test(m[1]) === false && m[1].trim().length < 20;
  })
  .map(([id]) => id);
check('no rule carries a placeholder-length check', vagueCheck.length === 0, vagueCheck.join(', ') || 'ok');

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
