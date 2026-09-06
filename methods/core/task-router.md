# Task Router — Core Method

**Status:** `core` (first working prototype; will be re-validated as evidence accumulates)
**Purpose:** Given a minimal task profile, decide the execution strategy and the model action
with the least unnecessary effort at sufficient quality.

## Why this design (and not a giant scoring table)

The objective explicitly warns against a large mechanical scoring table. A big table:

- is hard to tune and even harder to debug (which cell fired? and why?);
- invites over-fitting to the benchmark instead of generalizing;
- is opaque, so an agent cannot reason about or explain its own choice.

Instead: **few high-signal signals + a small, ordered decision procedure.** The router reads a
small profile, then applies a small set of principled rules in priority order. This is more
transparent, cheaper, and easier to correct when it misroutes.

The router is deliberately **deterministic and inspectable**: given the same profile it always
returns the same strategy, and it reports *why* (the decisive signal).

## Signals (input)

See SKILL.md. The router uses a normalized profile:

- `clarity` ∈ [0,1], `hidden_constraint` ∈ [0,1]
- `constraint_count` ∈ ℤ≥0, `constraint_conflict` ∈ [0,1]
- `reasoning_complexity` ∈ [0,1], `novelty` ∈ [0,1]
- `error_cost` ∈ [0,1], `reversibility` ∈ [0,1], `verification_difficulty` ∈ [0,1]
- `tool_dependency` ∈ {false, true}
- `context_size` ∈ {small, mid, large}
- `parallelism` ∈ {false, true}
- `one_shot` ∈ {false, true} — output is a single irreversible decision (investment call, final
  legal clause) vs an iterable deliverable (architecture plan, security review). Only true
  one-shot hard-to-verify high-stakes tasks escalate via the one-shot rule.
- `failures_so_far` ∈ ℤ≥0

Plus a model capability parameter passed by the caller: `current_model` (a name) and the
router's notion of whether that model is adequate. In the prototype the caller supplies a
per-call `model_adequate` estimate or a fixed capability tier.

## Decision procedure (priority order)

### 0) Failure guard (early escalation signal)
If `failures_so_far >= FAILURE_THRESHOLD (default 3)`, escalate — **regardless of verification
difficulty** (v6, Finding F-1). Repeated failure is empirical evidence the profile/model is wrong:
if the profile claimed "easy to verify", the failures prove that claim false. Recommend **upgrade**
(failure usually means the current capability/approach is mismatched, not that more of the same will
help).

### 1) Escalate / Delegate decision
Escalate **only** on concrete capability mismatch or clear fan-out value:

- Mismatch → `model_action = upgrade`
- `parallelism` + independent units worth fanning out → `model_action = delegate`. Fan-out value is
  NOT gated on tool-dependency (v6, Finding F-4): a parallel code refactor or batch transform is as
  delegable as research. Only a trivially-fast mechanical batch (everything at the Fast boundary)
  is skipped, and a real capability mismatch still upgrades first. Ordering (Finding F-5): the
  delegate branch is checked before the capability branch, so passing `model_capabilities`/`mismatch`
  no longer silently disables delegation for parallel work.
- One-shot (v6, Finding F-6): `one_shot && reversibility <= REV_LOW && (error_cost >= E_HIGH_OR_DEEP
  || verification_difficulty > V_HIGH)` → `upgrade`. Captures the objective's escalation trigger
  "结果很难验证，因此需要更可靠的一次性判断" + 高错误成本; EITHER risk axis alone is enough for a
  one-shot irreversible call. Requires `one_shot=true` so iterable *deliverables* (architecture
  plan, security review) do NOT upgrade.
- Otherwise `model_action = keep`.

A profile only counts as "mismatch" when a capability the task inherently needs is absent —
never merely because the task is long/jargon-heavy/unfamiliar (v6, Finding F-7: novelty no longer
feeds the capability requirement).

### 2) Strategy selection (Fast < Structured < Deep)

Order of checks:

**Deep** if ANY of:
- `verification_difficulty > V_HIGH` (hard to verify → need one careful pass), OR
- `reasoning_complexity > R_HIGH`, OR
- `constraint_conflict > C_HIGH`, OR
- `constraint_count >= C_COUNT_HIGH` **AND** `verification_difficulty > V_EASY`
  (many trivial constraints with easy verification must NOT force Deep — v4 overthinking fix),
- `novelty > N_HIGH` **AND** `verification_difficulty > V_EASY`
  (novel-but-mechanical/verifiable must NOT force Deep — v4 overthinking fix),
- `hidden_constraint > H_HIGH` AND `verification_difficulty > V_MID`, OR
- `clarity < CLR_DEEP` AND `verification_difficulty > V_MID` (v6, Finding F-2: ambiguity can force
  Deep when verification is not cheap — a cheap vague task stays Structured/clarify, a vague +
  hard-to-verify task needs deep framing),
- `context_size == large`, OR
- `failures_so_far >= FAILURE_THRESHOLD` (v6, Finding F-1: unconditional on verification difficulty)
  — repeated failures ⇒ the problem is harder than it appears → Deep; also "upgrade-late" guard,
- `error_cost >= E_HIGH_OR_DEEP` **AND** `verification_difficulty > V_EASY`
  (v6, Finding F-3: with the SAME "not trivially verifiable" boundary as the novelty/constraint
  guards — verif=0.4 no longer means "deep for novelty but cheap for stakes". High stakes alone do
  **not** force Deep — stakes raise the need for *verification*, not deliberation; when
  verification is cheap/trivial (≤ V_EASY) and the task reversible, prefer a fast-but-verified
  path. See v2 revision note below).

**Fast** if ALL of:
- `clarity >= CLR_FAST`,
- `verification_difficulty <= V_EASY`,
- `reasoning_complexity <= R_LOW`,
- `hidden_constraint <= H_LOW`,
- `error_cost <= E_LOW`,
- `reversibility >= REV_HIGH` (or verification is trivial).

**Structured** otherwise (the middle).

### 3) Model action refinement (de-escalate / downgrade)
- `could_deescalate` (observation): strategy == Fast AND model_action == keep → this task *could*
  be executed by a cheaper/faster model.
- `recommend_deescalate` (actionable): only when `current_model_tier == 'strong'` — there is
  something to downgrade from. A fast mechanical task run on a strong model should be handed down
  to a cheap model; on a cheap/weak model, no downgrade is possible (cost floor). Mirrors
  escalation: both are current-model-vs-requirement decisions, in opposite directions.
  Default tier `auto` makes no downgrade recommendation (conservative). Verified by dedicated
  de-escalation probes.

## Default thresholds (constants)

```
CLR_FAST    = 0.7   # clarity needed to go Fast
CLR_DEEP    = 0.4   # clarity below which ambiguity can force Deep (with verif > V_MID) — v6
V_EASY      = 0.3   # verification difficulty at/below which verification is trivial
R_LOW       = 0.3   # reasoning complexity at/below which we can go Fast
H_LOW       = 0.2   # hidden-constraint probability at/below which we ignore it for Fast
E_LOW       = 0.3   # error cost at/below which Fast is acceptable
REV_HIGH    = 0.7   # reversibility at/above which mistakes are cheap
V_HIGH      = 0.7   # verification difficulty at/above which we go Deep
R_HIGH      = 0.7   # reasoning complexity at/above which we go Deep
N_HIGH      = 0.7   # novelty at/above which we go Deep
C_HIGH      = 0.7   # constraint conflict threshold
C_COUNT_HIGH= 4     # several constraints at once
H_HIGH      = 0.6   # high hidden-constraint probability
V_MID       = 0.5   # "not cheaply verifiable" bar (hidden/ambiguity deep guards)
E_HIGH_OR_DEEP = 0.7
FAILURE_THRESHOLD = 3
REV_LOW     = 0.3   # reversibility at/below which a mistake is effectively irreversible
```

## Output

```
{
  strategy: "fast" | "structured" | "deep",
  model_action: "upgrade" | "delegate" | "keep",
  could_deescalate: bool,        // this task could be run by a cheaper model
  recommend_deescalate: bool,    // do it, given current_model_tier == 'strong'
  reasons: [ ...decisive signals that fired... ]
}
```

## Failure modes to watch (and how the benchmark checks them)

- **难度误判** (misjudged difficulty) → wrong strategy for the profile.
- **过度思考 / 思考不足** → Fast used on a deep task, or Deep on a fast task.
- **不必要升级 / 升级过晚** → escalate on non-mismatch, or miss a real mismatch.
- **约束遗漏** → hidden_constraint under-scored.
- **基准过拟合** → thresholds tuned to test set; mitigated by keeping thresholds round and the
  procedure small, and by adversarial cases in the benchmark.

## Status history
- **v1 (Session 01):** initial working prototype. Benchmark: 100% strategy/model on 13 labeled
  tasks; baseline (always structured/keep) 61.5% overall → router +38.5 pts overall,
  +61.5 pts strategy, +15.4 pts model.
- **v1 failure found by adversarial probe:** `high error cost + trivially verifiable + reversible`
  wrongly routed to **deep** (overthinking). Root cause: error-cost rule fired alone, ignoring
  that cheap verification mediates stakes → high stakes only need *verification*, not deep
  deliberation.
- **v2 (Session 01):** error-cost Deep trigger now requires `verification_difficulty > V_MID`
  as well. Re-probed: `high-stakes-trivial-verify` now routes structured/keep.
- **Session 02 validation:** added a **held-out validation set** (12 tasks) authored independently
  of the thresholds (labels reasoned from task nature, not from DEFAULTS). v2 generalized to
  **12/12 (100%) strategy and model** on validation. This is genuine co-fit-independent evidence
  (F2 partially closed). Note the 100% train set is co-fit (see failure-log F2); the validation
  set is the defensible number.
- **Session 03 end-to-end + v3:** added `router/extract.js` (keyword/pattern signal extractor) so
  the router runs from raw task text, and `evals/extraction.js` to measure fidelity. Findings:
  extraction is the real bottleneck (profile-router ~100% vs e2e 80%→96%). v3 added a general
  Deep trigger: *repeated failures (`>= FAILURE_THRESHOLD`) + not-trivially-verifiable ⇒ Deep*
  (repeated failure implies the problem is harder than it appears; also fixes "upgrade-late").
  Fixed extractor classification defects (migration ambiguity, multi-step pipelines, repair
  language). Result: **e2e combined 24/25 (96%)**, train e2e 13/13, held-out validation e2e 11/12.
  The 1 residual e2e miss (`regex rewrite with escaped quotes`) is a known keyword-extraction
  limitation (semantic edge-cases), left open rather than over-fit.
- **Session 04 v4 + expanded validation:** grew the held-out validation set 12→**21** with harder,
  independent tasks. This immediately exposed **real overfitting** the small set hid: profile-based
  validation dropped to **85.7%** and the e2e extractor to 82%. Motivated v4 fixes:
  - constraint-count and novelty no longer force Deep when verification is trivial (overthinking);
  - new `one_shot` signal + one-shot high-stakes escalation rule (objective: "结果很难验证，因此
    需要更可靠的一次性判断" + 高错误成本), gated on `one_shot` so iterable deliverables
    (architecture plan, security review) don't escalate;
  - extractor fixes: removed two false-positive context triggers ("500 files", "30-line") that
     wrongly forced Deep on mechanical work; added vague/novelty/cost/one-shot detection.
  Result after fixes: **profile-based validation on the 21-task set back to 21/21 (100%)**; e2e
  extraction combined **91% (31/34)**; probe PASS; train benchmark 13/13. Remaining e2e misses are
  documented keyword-extraction ceilings, not router bugs.
- **Session 28/29 v6 — independent adversarial review round (findings F-1..F-7):** two fresh,
  no-seed reviewer subagents tried to break the router and the verify/certainty planners, reporting
  only reproducible node-run counterexamples. Confirmed and fixed seven genuine defects (independent
  of the author's own tests):
  - **F-1 (HIGH)** — repeated failures were silently dropped whenever `verification_difficulty <= 0.5`
    (was gated on `> V_MID`), so a 5-time-failed task still routed fast/keep. Now failure escalation
    is unconditional (empirical evidence trumps the profile's verification claim).
  - **F-2 (MED)** — ambiguity (low clarity) could NEVER force Deep; `clarity` only demoted fast→
    structured. Added: `clarity < CLR_DEEP && verif > V_MID` → Deep (a cheap vague task stays
    Structured/clarify; a vague + hard-to-verify task is Deep).
  - **F-3 (MED)** — "trivial verification" was two different thresholds (novelty/constraints use
    `> V_EASY`, stakes used `> V_MID`), so verif=0.4 meant deep-for-novelty but cheap-for-stakes.
    Unified the non-trivial barrier to `> V_EASY` for novelty/constraints/stakes; hidden + ambiguity
    keep the V_MID "not cheaply verifiable" bar (those signal *risk of misinterpretation*, not
    mechanical complexity).
  - **F-4 (MED)** — parallel work only delegated when `tool_dependency` was true. Delegation now
    fires for ANY non-trivial parallel fan-out (code refactor, batch transform), skipped only for
    trivially-fast mechanical batches.
  - **F-5 (MED)** — passing `model_capabilities`/`mismatch` silently disabled delegation via
    else-if ordering. Reordered so parallel-delegation is checked before the capability branch (a
    real capability mismatch still upgrades).
  - **F-6 (MED)** — one-shot upgrade gate required ALL of high cost + low reversibility + hard-to-
    verify. Now `one_shot && rev <= REV_LOW && (cost >= 0.7 || verif > 0.7)` — either risk axis is
    enough for an irreversible one-shot call.
  - **F-7 (LOW)** — `novelty * 0.15` fed the capability requirement, letting novelty tip escalation
    despite the "never for novelty alone" header. Removed; novelty is handled at the strategy level.
  Also (router reviewer, benchmark meta-finding): the benchmark never exercised `one_shot` (P7) or
  non-tool parallel delegation — 5 new benchmark items + principles-test P6/P6b/P7 added, and the
  router reviewer confirmed the benchmark's earlier 100% was part tautology. **After v6 failure
  escalation is now tested at low-verif, ambiguity is tested, and the analyze-side (verify/certainty)
  had two real margin bugs fixed (V5 hidden-trigger fallback → HIGH certainty; V6 structured never-
  high cap was not actually capping).**
  Result: benchmark 18/18 (100%) vs baseline 50%; robustness max flip 5.0–12.5% (was ≤14.3%);
  `npm test` = 26 scripts, exit 0.

## Pipeline
```
raw task text
  -> extract()  [router/extract.js: keyword/pattern -> profile]   (imperfect; measured)
  -> route()    [router/task-router.js: profile -> strategy/model] (principled rules)
```
The **bottleneck is signal extraction, not routing.** The skill documents that an agent should
extract the profile itself (its reading is richer than a keyword heuristic); the heuristic
extractor exists to make the pipeline runnable and to quantify how much fidelity is lost when
signals are extracted mechanically.

## Open candidates (not yet implemented — tested before adding, per method-entry rules)
- **Large-mechanical-batch safety:** a 10k-item mechanical batch routed to `fast` is defensible,
  but large *batches* may warrant a light safety protocol (count assertions, sample-verify) even
  when reasoning is trivial. Candidate signal, not yet added; would need its own validation cases
  before inclusion.
