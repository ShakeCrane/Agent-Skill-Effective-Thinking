# Cross-Author Label Agreement Study (held-out validation set)

Status: `experimental` (measured on the 22-item set in Session 30, re-measured on the expanded
32-item set in Session 54; stable across both — see below). Purpose: quantify how much the
validation set's expected labels reflect AUTHOR judgment vs shared/common judgment — the objective's
"Agent 的自评不能直接作为结论" applied to our own labels.
Updated: Session 54 (cross-author re-measurement on the 32-item set).

## Method (repeatable)

- Two FRESH, no-seed subagents (`A`, `B`) were given only the **task texts** of
  `evals/validation.js` (no profiles, no thresholds, no author labels) plus the same strategy and
  model-action definitions the skill uses, and independently labeled each as
  `strategy/model_action` (fast/structured/deep, keep/upgrade/delegate). Session 30: the original 22
  items. Session 54: all 32 items (original 22 + the 10 Session-53 additions).
- Labeler outputs are persisted as durable reproducibility data in `research/cross-author-labels/`
  (`labelerA.json`, `labelerB.json` — the Session-54 full-32 run).
- The complete comparison harness lives in `evals/cross-author-check.js`
  (`node evals/cross-author-check.js labelerA.json labelerB.json`); it prints the per-item table and
  all pairwise agreement totals.

## Re-measurement (32 items, Session 54 — labels by two fresh judges, task text only)

### Full strategy/model agreement

| pair                     | agreement | rate  |
|--------------------------|-----------|-------|
| author vs router         | 32/32     | 100%  |
| author vs A              | 22/32     | 68.8% |
| author vs B              | 23/32     | 71.9% |
| router vs A              | 22/32     | 68.8% |
| router vs B              | 23/32     | 71.9% |
| A vs B (inter-labeler)   | 30/32     | 93.8% |

### Strategy-only agreement (the load-bearing "how hard to think" dimension)

| pair                     | agreement | rate  |
|--------------------------|-----------|-------|
| author vs router         | 32/32     | 100%  |
| author vs A              | 25/32     | 78.1% |
| author vs B              | 26/32     | 81.3% |
| router vs A              | 25/32     | 78.1% |
| router vs B              | 26/32     | 81.3% |
| A vs B (inter-labeler)   | 31/32     | 96.9% |

**The Session-30 findings reproduce on the expanded set, nearly identically:**
- Router↔A and Router↔B equal Author↔A and Author↔B on BOTH dimensions (68.8%/71.9% full,
  78.1%/81.3% strategy) — the router is again NO more fitted to the author than the author is to
  independent judges.
- Inter-labeler strategy agreement stays very high (96.9% over 32, vs 100% over 22); the two fresh
  judges agree 100% on all 10 NEW items.
- On the 10 new boundary items the judges coalesced WITH the router/author on 6
  (prod-outage-cheap-repro, one-shot-outranks-parallel, mech-parallel-delegate,
  single-research-no-delegate, yaml-json-comments, failed-twice-boundary) and AGAINST it — both
  judges together — on 4, all defensible judgement boundaries:
  - `val-ambiguous-cheap-reversible` → both judges **fast** (author/router: structured): the text
    says "just try the lighter change first", so both judges read the ACTION as clear and cheaply
    reversible. The author's profile reads "we cannot decide between endpoints" as ambiguity
    (clarity 0.35), which lands structured (and correctly NOT deep under F-2; the anti-overthinking
    claim holds under every reading). A live LLM-profile fill that reads "just try it" as clarity
    would route fast — a documented signal-extraction boundary, not a router error.
  - `val-many-constraints-trivial-verify` → both judges **structured** (author/router: fast):
    several constraints → caution wins with the judges even with a unit-test oracle; the router
    (and author) let the trivial oracle keep it fast (anti-overthinking). Mirror of the original
    `val-many-trivial-constraints`, where the router also takes the anti-overthinking side.
  - `val-contract-review-large-hd` → both judges **delegate** (author/router: deep/keep): a 200-page
    review is genuinely splittable into independent sections; the router's rule delegates only when
    the profile marks the work parallel (the author read the deliverable as one consolidated
    assessment). Delegability is a defensible-author-vs-defensible-judges boundary.
  - `val-novel-hard-verify-algo` → both judges **upgrade** (author/router: deep/keep): "no test
    harness" reads to the judges as needing a stronger model; the skill's rule upgrades only on a
    concrete mismatch (one-shot / repeated failure / capability edge), not on difficulty per se, and
    this is an iterable design task. The upgrade-vs-keep variance the objective itself treats as
    "seriously consider" (caller-adjustable).

## Original measurement (22 items, Session 30 — retained as baseline)

| pair                     | agreement | rate  |
|--------------------------|-----------|-------|
| author vs router         | 22/22     | 100%  |
| author vs A              | 15/22     | 68.2% |
| author vs B              | 17/22     | 77.3% |
| router vs A              | 15/22     | 68.2% |
| router vs B              | 17/22     | 77.3% |
| A vs B (inter-labeler)   | 18/22     | 81.8% |

### Strategy-only agreement (the load-bearing "how hard to think" dimension)

| pair                     | agreement | rate  |
|--------------------------|-----------|-------|
| author vs router         | 22/22     | 100%  |
| author vs A              | 18/22     | 81.8% |
| author vs B              | 18/22     | 81.8% |
| router vs A              | 18/22     | 81.8% |
| router vs B              | 18/22     | 81.8% |
| A vs B (inter-labeler)   | 22/22     | 100%  |

Two independent, no-seed labelers agree **perfectly** (22/22) on every strategy call, and the
router matches them at 82% — the same rate the author does. The 4 strategy disagreements are all
documented fast↔structured boundary items (below). Model-action variance (68–77% full agreement) is
concentrated in upgrade-vs-keep, which the objective itself treats as "seriously consider" (a
caller-adjustable hint), so it carries less evidential weight than the strategy dimension.

## Interpretation (the important part)

1. **Router↔Author 22/22 is author-fit, not universality.** The router reproduces the author's
   labels exactly, but the author's labels agree with independent labelers only 68–77%
   (strategy-only: 82%). So the defensible claim is "...matches the author 100% AND independent
   labelers 82% (strategy) / 68–77% (full)."

2. **The router is NOT disproportionately fitted to the author.** Router↔A and Router↔B equal
   Author↔A and Author↔B exactly on BOTH the full and strategy-only dimensions. An author-fitted
   router would agree with the author MORE than with labelers; instead it matches independent
   judgment at the same rate the author does. The residual therefore reflects genuine judgment
   variance in the task, not a router defect.

3. **Strategy consensus is strong:** two fully-independent labelers agree 100% on strategy, and the
   router sits at 82% against both — the same ceiling as the author. Fast↔structured boundaries
   (below) are where a "reasonable expert" can argue either way; the router picks the author's side
   each time, which is defensible but not universal.

3. **The four items where BOTH labelers independently chose the same alternative highlight label
   ambiguity, and the router's match to the author is defensible each time:**
   - `val-microservice-migration` (labelers: deep/**upgrade**; author/router: deep/keep): big
     architecture call with `error_cost=0.7`; the objective's upgrade list includes "重要架构
     decision", but the skill's rule is upgrade only on real (capability/failure/one-shot) mismatch.
     Both readings are defensible; this is a known judgment boundary (see task-router.md status).
   - `val-simple-bugfix` (labelers: **fast**; author/router: structured): a clearly-scoped
     pagination bugfix. The router/author treat "keep response shape" as a mild hidden constraint
     worth Structured; labelers read it as a one-line verifiable fix. Anti-overthinking would favor
     fast; caution favors structured. Defensible either way.
   - `val-mechanical-csv-parse` (labelers: **fast**; author/router: structured): mechanical
     parse+aggregate. Same fast-vs-structured boundary.
   - `val-mass-header-replace` (labelers: **structured**; author/router: fast, A even suggested
     delegate): a 500-file mechanical rewrite. Same boundary, mirror image.

   Conclusion: these are *label-quality caveats* (what a reasonable expert could dispute), NOT
   router errors. Overfitting the router to any single judge would recreate the author-fit problem.

4. **Actionable takeaway:** report validation as "32/32 author, 68–77% full / 78–81% strategy
   independent (re-measured on 32; 22-item baseline was 68–77% full / 82% strategy)"; re-run the
   harness when labels or the router change materially; consider a third labeler or voting if we
   need a single "consensus" reference (deferred — cost/benefit is low while the router matches
   both judges equally).

## Files
- `evals/cross-author-check.js` — repeatable comparison harness (runs from any two label JSONs).
- `research/cross-author-labels/labelerA.json`, `labelerB.json` — Session-54 full-32 judge labels
  (task-text only), persisted as durable reproducibility data.
