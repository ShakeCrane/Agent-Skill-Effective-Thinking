// Orchestration test: fan-out tolerance, independent-reviewer agreement/disagreement, and
// consolidation (keep good results, surface failures). Uses deterministic injected workers and
// reviewers (environment-agnostic; real subagents can be wired later). INCLUDES async adapters
// (fanOutAsync/reviewAsync) — the bridge to wiring real subagents.
//
// Run: node evals/orchestrate-test.js
'use strict';
const { fanOutSync, fanOutAsync, reviewSync, reviewAsync, consolidate } = require('../multi-agent/orchestrate.js');

let failures = 0;
const check = (name, cond, detail) => {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

// ---- fan-out: runs all units in order, tolerates a throwing worker ----
{
  const out = fanOutSync(['a', 'b', 'c', 'd'], (item) => {
    if (item === 'c') throw new Error('worker failed on c');
    return item.toUpperCase();
  });
  check('fan-out keeps order and preserves successes', JSON.stringify(out.map((r) => (r.ok ? r.result : `ERR:${r.item}`))) === '["A","B","ERR:c","D"]',
    JSON.stringify(out.map((r) => (r.ok ? r.result : `ERR:${r.item}`))));
  check('fan-out records the failure, not abort', out.filter((r) => !r.ok).length === 1 && out[2].index === 2,
    `failed=${out.filter((r) => !r.ok).length}`);
}

// ---- review: all-agree => agreed; disagreement => disputed (must be surfaced) ----
{
  const claims = [
    { id: 'claim-1', text: 'X is true' },
    { id: 'claim-2', text: 'Y is true' },
  ];
  const reviewers = [
    () => ({ agree: true, note: 'have evidence' }),
    () => ({ agree: true, note: 'matches' }),
    (c) => ({ agree: c.id !== 'claim-2', note: 'counterexample found' }), // disputes claim-2 only
  ];
  const rev = reviewSync(claims, reviewers);
  check('unanimous agreement => agreed', rev[0].verdict === 'agreed', `claim-1 verdict=${rev[0].verdict}`);
  check('disagreement => disputed (surfaced to main agent)', rev[1].verdict === 'disputed',
    `claim-2 verdict=${rev[1].verdict} agreement=${rev[1].agreement.toFixed(2)}`);
  check('disputed claim carries reviewer notes', rev[1].votes.some((v) => /counterexample/.test(v.note)),
    JSON.stringify(rev[1].votes.map((v) => v.note)));
}

// ---- review: unanimous disagreement => rejected ----
{
  const r = reviewSync([{ id: 'c' }], [() => ({ agree: false }), () => ({ agree: false })]);
  check('unanimous disagreement => rejected', r[0].verdict === 'rejected', `verdict=${r[0].verdict}`);
}

// ---- review: a throwing reviewer is UNAVAILABLE (not a dissent) — verification failure is not
//      counter-evidence. One valid agree + one unavailable => agreed (with 1 valid vote exposed). ----
{
  const r = reviewSync([{ id: 'c' }], [() => ({ agree: true }), () => { throw new Error('reviewer down'); }]);
  check('throwing reviewer is unavailable, not a dispute (Case A shape)',
    r[0].verdict === 'agreed', `verdict=${r[0].verdict}`);
  check('unavailable vote recorded as diagnostics (not a dissent)',
    r[0].unavailableVotes === 1 && r[0].validVotes === 1 && r[0].disagreeVotes === 0
      && r[0].votes.some((v) => /reviewer error/.test(v.note)),
    JSON.stringify(r[0].votes.map((v) => `${v.status}:${v.note}`)));
}

// ---- Case A (explicit): 2 agree + 1 reviewer exception => agreed, NOT "2 agree / 1 disagree" ----
{
  const r = reviewSync([{ id: 'c', text: 'X' }], [
    () => ({ agree: true, note: 'A ev' }),
    () => ({ agree: true, note: 'B ev' }),
    () => { throw new Error('reviewer down'); },
  ]);
  check('Case A: 2 agree + 1 exception => agreed (not disputed)',
    r[0].verdict === 'agreed' && r[0].validVotes === 2 && r[0].agreeVotes === 2
      && r[0].disagreeVotes === 0 && r[0].unavailableVotes === 1,
    `verdict=${r[0].verdict} valid=${r[0].validVotes} agree=${r[0].agreeVotes} unavailable=${r[0].unavailableVotes}`);
}

// ---- Case B (explicit): all reviewers throw => unavailable (NOT rejected) ----
{
  const r = reviewSync([{ id: 'c' }], [() => { throw new Error('down a'); }, () => { throw new Error('down b'); }]);
  check('Case B: all reviewers unavailable => unavailable (never rejected)',
    r[0].verdict === 'unavailable' && r[0].validVotes === 0 && r[0].unavailableVotes === 2,
    `verdict=${r[0].verdict} valid=${r[0].validVotes}`);
  check('Case B: failures preserved as diagnostics',
    r[0].votes.every((v) => v.status === 'unavailable' && /reviewer error/.test(v.note)),
    JSON.stringify(r[0].votes.map((v) => v.status)));
}

// ---- Case C (explicit): valid reviewers genuinely disagree => still disputed ----
{
  const r = reviewSync([{ id: 'c' }], [() => ({ agree: true }), () => ({ agree: false, note: 'counterexample' })]);
  check('Case C: real disagreement => disputed',
    r[0].verdict === 'disputed' && r[0].validVotes === 2 && r[0].agreeVotes === 1 && r[0].disagreeVotes === 1,
    `verdict=${r[0].verdict} agree=${r[0].agreeVotes} disagree=${r[0].disagreeVotes}`);
}

// ---- quorum: valid votes below minReviews => insufficient_review, never agreed/rejected ----
{
  const r = reviewSync([{ id: 'c' }], [() => ({ agree: true }), () => { throw new Error('down'); }], { minReviews: 2 });
  check('quorum not met => insufficient_review (not agreed)',
    r[0].verdict === 'insufficient_review' && r[0].quorumMet === false && r[0].validVotes === 1,
    `verdict=${r[0].verdict} quorumMet=${r[0].quorumMet}`);
}

// ---- a reviewer returning no boolean `agree` is also unavailable (not silently agree) ----
{
  const r = reviewSync([{ id: 'c' }], [() => ({}), () => null]);
  check('reviewer without boolean agree => unavailable (no silent agree)',
    r[0].verdict === 'unavailable' && r[0].unavailableVotes === 2,
    `verdict=${r[0].verdict} unavailable=${r[0].unavailableVotes}`);
}

// ---- consolidate: keep good results, surface failures ----
{
  const out = fanOutSync([1, 2, 3], (n) => {
    if (n === 2) throw new Error('boom');
    return n * 10;
  });
  const c = consolidate(out);
  check('consolidate keeps successes', c.okCount === 2 && JSON.stringify(c.results) === '[10,30]',
    `results=${JSON.stringify(c.results)}`);
  check('consolidate surfaces failures (not silently dropped)', c.failedCount === 1 && c.failures[0].index === 1,
    `failed=${c.failedCount}`);
}

// ---- async adapters: fanOutAsync / reviewAsync (bridge to real subagents) ----
;(async () => {
  // fanOutAsync tolerates a rejecting worker and preserves order, like the sync version.
  const out = await fanOutAsync(['a', 'b', 'c'], async (item) => {
    if (item === 'b') throw new Error('agent b failed');
    return item.toUpperCase();
  });
  check('fanOutAsync keeps order and preserves successes', JSON.stringify(out.map((r) => (r.ok ? r.result : `ERR:${r.item}`))) === '["A","ERR:b","C"]',
    JSON.stringify(out.map((r) => (r.ok ? r.result : `ERR:${r.item}`))));
  check('fanOutAsync records rejection, not abort', out.filter((r) => !r.ok).length === 1 && out[1].index === 1,
    `failed=${out.filter((r) => !r.ok).length}`);

  // reviewAsync: async reviewers vote; disagreement surfaces as disputed.
  const rev = await reviewAsync(
    [{ id: 'c1', text: 'async claim' }],
    [
      async () => ({ agree: true, note: 'A ev' }),
      async () => ({ agree: false, note: 'B counterexample' }),
    ]
  );
  check('reviewAsync disagreement => disputed', rev[0].verdict === 'disputed',
    `verdict=${rev[0].verdict} agreement=${rev[0].agreement.toFixed(2)}`);
  check('reviewAsync carries reviewer notes', rev[0].votes.some((v) => /counterexample/.test(v.note)),
    JSON.stringify(rev[0].votes.map((v) => v.note)));

  // A rejecting async reviewer is UNAVAILABLE (not a dissent): one valid agree + one unavailable
  // => agreed, with the failure preserved as diagnostics.
  const rev2 = await reviewAsync([{ id: 'c' }], [async () => ({ agree: true }), async () => { throw new Error('reviewer down'); }]);
  check('rejecting async reviewer is unavailable (not a dispute)',
    rev2[0].verdict === 'agreed' && rev2[0].unavailableVotes === 1 && rev2[0].validVotes === 1
      && rev2[0].votes.some((v) => /reviewer error/.test(v.note)),
    `verdict=${rev2[0].verdict} valid=${rev2[0].validVotes} unavailable=${rev2[0].unavailableVotes}`);

  // consolidate over async fan-out results works identically.
  const c = consolidate(out);
  check('consolidate on async fan-out keeps successes and surfaces failures',
    c.okCount === 2 && c.failedCount === 1 && c.failures[0].index === 1,
    `ok=${c.okCount} failed=${c.failedCount}`);

  console.log(failures === 0 ? 'ORCHESTRATE TEST PASS: fan-out/review/consolidate implement multi-agent principles correctly'
    : `ORCHESTRATE TEST FAIL: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();