// Multi-agent orchestration layer.
// Implements the objective's "多 Agent 使用原则" as testable machinery:
//   - fan-out independent work to workers (research, counterexample search, benchmark units),
//   - independent REVIEWERS vote on claims (Agent 自评不能直接作为结论),
//   - consolidate: 汇总 → 选择 → 合并, keep good results, surface failures instead of dropping
//     everything when one unit fails.
//
// Environment-agnostic: workers/reviewers are injected functions. With deterministic test doubles
// now, and real subagents later (the sync API here is for deterministic orchestration; real
// agents would be wired via an async adapter in a future integration).
//
// Failure tolerance (mirrors per-item resilience): a throwing worker/reviewer is recorded as a
// failure and does NOT discard the other units' results.

'use strict';

/**
 * fanOutSync(items, worker) -> [{ item, index, ok, result }]
 * Runs each independent unit through worker(item, index). Results stay in input order. A worker
 * that throws yields { ok:false, error } instead of aborting the batch.
 */
function fanOutSync(items, worker) {
  return items.map((item, index) => {
    try {
      return { item, index, ok: true, result: worker(item, index) };
    } catch (err) {
      return { item, index, ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
}

/**
 * reviewSync(claims, reviewers, opts?) -> [{ claim, index, votes, ...verdictSummary }]
 * Each reviewer(claim) -> { agree: boolean, note?: string }. A vote has status:
 *   'agree' | 'disagree' | 'unavailable' (throwing / no boolean agree).
 * Verdict semantics (verification failure is NOT counter-evidence — a throwing reviewer is
 * unavailable, never a dissent):
 *   'agreed'            -> all VALID votes agree AND quorum met,
 *   'disputed'          -> valid votes genuinely disagree AND quorum met (main agent must resolve),
 *   'rejected'          -> all valid votes disagree AND quorum met,
 *   'unavailable'       -> zero valid votes (no evidence either way — never 'rejected'),
 *   'insufficient_review' -> valid votes present but below opts.minReviews (default 1).
 * The result exposes agreeVotes / disagreeVotes / unavailableVotes / validVotes / quorumMet so a
 * caller can see how much real evidence supports the verdict, and preserves reviewer failures as
 * diagnostics (votes[*].note / status), never silently dropping them.
 */
function reviewSync(claims, reviewers, opts = {}) {
  return claims.map((claim, index) => {
    const votes = reviewers.map((reviewer, rIdx) => {
      try {
        const v = reviewer(claim);
        if (v && typeof v === 'object' && typeof v.agree === 'boolean') {
          return { reviewer: rIdx, agree: v.agree, note: v.note || '', status: v.agree ? 'agree' : 'disagree' };
        }
        return { reviewer: rIdx, agree: undefined, note: 'reviewer error: no boolean agree returned', status: 'unavailable' };
      } catch (err) {
        return { reviewer: rIdx, agree: undefined, note: `reviewer error: ${err && err.message ? err.message : err}`, status: 'unavailable' };
      }
    });
    return { claim, index, votes, ...summarizeVotes(votes, opts) };
  });
}

/**
 * consolidate(fanOutResults) -> { total, okCount, failedCount, results, failures }
 * 汇总 → 选择（只保留成功结果）→ 合并；失败单元不丢弃其它结果，并作为 evidence 保留。
 */
function consolidate(fanOutResults) {
  const results = fanOutResults.filter((r) => r.ok).map((r) => r.result);
  const failures = fanOutResults.filter((r) => !r.ok).map((r) => ({
    index: r.index,
    item: r.item,
    error: r.error,
  }));
  return {
    total: fanOutResults.length,
    okCount: results.length,
    failedCount: failures.length,
    results,
    failures,
  };
}

/**
 * fanOutAsync(items, worker) -> Promise<[{ item, index, ok, result }]>
 * Async variant of fanOutSync for REAL subagents: worker(item, index) may return a value or a
 * Promise. Results stay in input order; a throwing/rejecting worker yields { ok:false, error }
 * instead of aborting the batch (per-item resilience preserved). This is the adapter that lets a
 * host wire actual subagents (e.g. awaiting each agent's report) into the fan-out machinery.
 */
async function fanOutAsync(items, worker) {
  const settled = await Promise.all(items.map(async (item, index) => {
    try {
      const result = await worker(item, index);
      return { item, index, ok: true, result };
    } catch (err) {
      return { item, index, ok: false, error: err && err.message ? err.message : String(err) };
    }
  }));
  return settled;
}

/**
 * reviewAsync(claims, reviewers, opts?) -> Promise<[{ claim, index, votes, ...verdictSummary }]>
 * Async variant of reviewSync for REAL reviewers (subagents): each reviewer(claim) may return
 * { agree, note } or a Promise. Same unavailable/quorum semantics as reviewSync: a throwing or
 * rejecting reviewer, or one that returns no boolean `agree`, is `unavailable` (never a dissent).
 */
async function reviewAsync(claims, reviewers, opts = {}) {
  const out = [];
  for (let index = 0; index < claims.length; index++) {
    const claim = claims[index];
    const votes = [];
    for (let rIdx = 0; rIdx < reviewers.length; rIdx++) {
      try {
        const v = await reviewers[rIdx](claim);
        if (v && typeof v === 'object' && typeof v.agree === 'boolean') {
          votes.push({ reviewer: rIdx, agree: v.agree, note: v.note || '', status: v.agree ? 'agree' : 'disagree' });
        } else {
          votes.push({ reviewer: rIdx, agree: undefined, note: 'reviewer error: no boolean agree returned', status: 'unavailable' });
        }
      } catch (err) {
        votes.push({ reviewer: rIdx, agree: undefined, note: `reviewer error: ${err && err.message ? err.message : err}`, status: 'unavailable' });
      }
    }
    out.push({ claim, index, votes, ...summarizeVotes(votes, opts) });
  }
  return out;
}

const DEFAULT_REVIEW_QUORUM = 1; // minimum valid (non-unavailable) votes for a definite verdict

function summarizeVotes(votes, opts) {
  const minReviews = Number.isFinite(Number(opts && opts.minReviews))
    ? Math.max(1, Math.round(Number(opts.minReviews)))
    : DEFAULT_REVIEW_QUORUM;
  const valid = votes.filter((v) => v.status !== 'unavailable');
  const agreeVotes = valid.filter((v) => v.agree === true).length;
  const disagreeVotes = valid.filter((v) => v.agree === false).length;
  const unavailableVotes = votes.length - valid.length;
  const validVotes = valid.length;
  // Agreement is measured over VALID votes only (unavailable is not counter-evidence).
  const agreement = validVotes ? agreeVotes / validVotes : 0;
  const quorumMet = validVotes >= minReviews;
  let verdict;
  if (validVotes === 0) {
    verdict = 'unavailable';
  } else if (!quorumMet) {
    verdict = 'insufficient_review';
  } else if (agreement === 1) {
    verdict = 'agreed';
  } else if (agreeVotes === 0) {
    verdict = 'rejected';
  } else {
    verdict = 'disputed';
  }
  return { agreeVotes, disagreeVotes, unavailableVotes, validVotes, minReviews, quorumMet, agreement, verdict };
}

module.exports = { fanOutSync, fanOutAsync, reviewSync, reviewAsync, consolidate, summarizeVotes };
