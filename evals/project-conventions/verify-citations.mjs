// Citation verifier for the project-conventions evidence base.
//
// WHY THIS EXISTS
// The skill's rules carry an evidence level (strong/moderate/weak/none). That level is only
// trustworthy if someone re-checked the sources after they were cited. Delegated research is a
// work report, not evidence; this script re-reads the primary source and looks for the exact
// sentence the citation rests on.
//
// WHAT IT DOES
// Fetches each URL over Node's own TLS stack (curl/.NET fail on this host with
// SEC_E_NO_CREDENTIALS, so those are not usable probes) and asserts that a quoted needle still
// appears in the retrieved body. A needle that disappears is a broken citation, not a flake —
// re-read the source before changing a rule.
//
// Network-dependent and therefore NOT part of `npm test`. Run it deliberately:
//
//   node evals/project-conventions/verify-citations.mjs
//   node evals/project-conventions/verify-citations.mjs --only B1,C3
//   node evals/project-conventions/verify-citations.mjs --offline-tolerant
//
// Exit codes, and why the distinction matters:
//   MISS  the source was reached and the quoted sentence is not there. A broken citation. Always fails.
//   NET   the source could not be reached at all. This means NOT VERIFIED NOW — never "verified".
//         Fails by default; `--offline-tolerant` downgrades it to a reported skip so a run behind a
//         hostile network can still be read, at the cost of saying out loud how much went unchecked.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, 'citations.json');

const only = (() => {
  const i = process.argv.indexOf('--only');
  return i === -1 ? null : new Set(process.argv[i + 1].split(',').map((s) => s.trim()));
})();
const offlineTolerant = process.argv.includes('--offline-tolerant');

/**
 * Fetch a URL with a bounded wait. Returns { ok, status, body, error }.
 * A redirect to an HTML landing page is fine; we match against whatever came back.
 */
async function get(url, { timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // arXiv and several spec hosts serve an interstitial to unknown agents.
        'user-agent': 'project-conventions-citation-check/1.0 (+https://github.com/ShakeCrane/Agent-Skill-Effective-Thinking)',
        accept: 'text/html,application/xhtml+xml,application/xml,text/plain,application/json;q=0.9,*/*;q=0.8',
      },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Collapse whitespace and HTML entities so a needle spanning markup still matches. */
function flatten(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Typographic punctuation is the classic false negative: keepachangelog.com renders
    // "Don’t" with U+2019, so an ASCII apostrophe in a needle would miss a claim that is present.
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const corpus = JSON.parse(readFileSync(CORPUS, 'utf8'));
  const checks = corpus.checks.filter((c) => !only || only.has(c.id));

  console.log(`CITATION VERIFICATION — ${checks.length} check(s)`);
  console.log(`corpus: ${CORPUS}`);
  console.log('');

  let pass = 0;
  let miss = 0;
  let net = 0;
  const failures = [];

  for (const c of checks) {
    const res = await get(c.url);
    const label = `${c.id} (${c.rule ?? '—'})`;
    if (!res.ok) {
      net += 1;
      const why = res.error ? `fetch error: ${res.error}` : `HTTP ${res.status}`;
      console.log(`[NET ] ${label} NOT REACHED — ${why} — ${c.url}`);
      failures.push({ id: c.id, kind: 'net', why, url: c.url });
      continue;
    }
    const text = flatten(res.body);
    const missing = c.needles.filter((n) => !text.toLowerCase().includes(flatten(n).toLowerCase()));
    if (missing.length === 0) {
      pass += 1;
      console.log(`[OK  ] ${label} ${c.needles.length} needle(s) reconfirmed — ${c.url}`);
    } else {
      miss += 1;
      console.log(`[MISS] ${label} missing ${missing.length}/${c.needles.length} — ${c.url}`);
      for (const m of missing) console.log(`         absent: "${m.slice(0, 120)}"`);
      failures.push({ id: c.id, kind: 'miss', why: `missing: ${missing.join(' | ').slice(0, 300)}`, url: c.url });
    }
  }

  console.log('');
  console.log(`Checks: ${pass} reconfirmed, ${miss} claim missing, ${net} not reached.`);
  if (failures.length) {
    console.log('NOT RECONFIRMED:');
    for (const f of failures) console.log(`  - ${f.id} [${f.kind}]: ${f.why} (${f.url})`);
  }
  if (net > 0) {
    console.log('');
    console.log(`${net} citation(s) were NOT REACHED. That means NOT VERIFIED NOW — it does not mean they`);
    console.log('are fine. Any rule resting on them is only as strong as its last successful run.');
  }

  const failed = miss > 0 || (net > 0 && !offlineTolerant);
  if (failed) {
    console.log('CITATION VERIFY FAIL');
    process.exit(1);
  }
  console.log(miss === 0 && net === 0
    ? 'CITATION VERIFY PASS: every quoted claim is still present at its source.'
    : `CITATION VERIFY PARTIAL: ${pass} reconfirmed, ${net} not reached (--offline-tolerant).`);
  process.exit(0);
}

main();
