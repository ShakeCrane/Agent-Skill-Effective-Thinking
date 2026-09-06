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
 * reviewSync(claims, reviewers) -> [{ claim, index, votes, agreement, verdict }]
 * Each reviewer(claim) -> { agree: boolean, note?: string }. verdict is
 *   'agreed'   -> all or a strong majority agree,
 *   'disputed' -> meaningful disagreement exists (must be resolved by the main agent),
 *   'rejected' -> unanimous disagreement.
 * Survivorship: a reviewer that throws contributes a vote { agree:false, note:'reviewer error' }.
 */
function reviewSync(claims, reviewers) {
  return claims.map((claim, index) => {
    const votes = reviewers.map((reviewer, rIdx) => {
      try {
        const v = reviewer(claim) || {};
        return { reviewer: rIdx, agree: v.agree !== false, note: v.note || '' };
      } catch (err) {
        return { reviewer: rIdx, agree: false, note: `reviewer error: ${err && err.message ? err.message : err}` };
      }
    });
    const agreeCount = votes.filter((v) => v.agree).length;
    const total = votes.length;
    const agreement = total ? agreeCount / total : 0;
    let verdict = 'agreed';
    if (agreement === 0) verdict = 'rejected';
    else if (agreement < 1) verdict = 'disputed';
    return { claim, index, votes, agreement, verdict };
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
 * reviewAsync(claims, reviewers) -> Promise<[{ claim, index, votes, agreement, verdict }]>
 * Async variant of reviewSync for REAL reviewers (subagents): each reviewer(claim) may return
 * { agree, note } or a Promise. Survivorship: a throwing/rejecting reviewer contributes
 * { agree:false, note:'reviewer error' } (self-eval cannot be trusted blindly).
 */
async function reviewAsync(claims, reviewers) {
  const out = [];
  for (let index = 0; index < claims.length; index++) {
    const claim = claims[index];
    const votes = [];
    for (let rIdx = 0; rIdx < reviewers.length; rIdx++) {
      try {
        const v = (await reviewers[rIdx](claim)) || {};
        votes.push({ reviewer: rIdx, agree: v.agree !== false, note: v.note || '' });
      } catch (err) {
        votes.push({ reviewer: rIdx, agree: false, note: `reviewer error: ${err && err.message ? err.message : err}` });
      }
    }
    const agreeCount = votes.filter((v) => v.agree).length;
    const total = votes.length;
    const agreement = total ? agreeCount / total : 0;
    let verdict = 'agreed';
    if (agreement === 0) verdict = 'rejected';
    else if (agreement < 1) verdict = 'disputed';
    out.push({ claim, index, votes, agreement, verdict });
  }
  return out;
}

module.exports = { fanOutSync, fanOutAsync, reviewSync, reviewAsync, consolidate };
