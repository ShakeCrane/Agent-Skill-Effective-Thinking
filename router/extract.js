// Signal extraction: raw task string -> task profile.
// A transparent, keyword/pattern-driven heuristic. NOT a learned classifier. It exists to let
// the router run end-to-end from natural language and to let us MEASURE extraction fidelity.
// Design is minimalist and inspectable (matches project philosophy: small, explainable stages).
//
// This stage is deliberately simple and will misjudge some tasks — measuring how it misjudges
// is the point (see evals/extraction.js).

'use strict';

// ---- Category baselines: reasoned from task nature, rounded numbers ----
// Each returns a base profile. Modifiers (constraint/high-stakes/failure/parallel/tool/context)
// then adjust.
function baseCategory(task) {
  const t = task.toLowerCase();

  // Debug / root-cause / flaky / REPAIR (must come before "why .* fail" only; order matters:
  // repair language like "make it stop failing" is a strong debug signal).
  if (/(stop failing|keep.*\bfail|repeatedly fails?|fix.*(bug|this)|make it stop|root cause|flaky|intermittent)/.test(t)
      || /(debug|why .* fail|why .* (time.?out|not work)|bug)/.test(t)) {
    return {
      clarity: 0.6, hidden_constraint: 0.6, constraint_count: 2, constraint_conflict: 0.3,
      reasoning_complexity: 0.7, novelty: 0.5, error_cost: 0.45, reversibility: 0.6,
      verification_difficulty: 0.6, tool_dependency: false, context_size: 'small', parallelism: false,
    };
  }

  // Multi-step pipeline: several ordered action verbs (parse/filter/compute/aggregate+then).
  if (/\b(parse|filter|compute|aggregate|transform|analyze)\b/.test(t)
      && /(,|\band\b|\bthen\b|\betc\b|\.\.\.)/.test(t)) {
    return {
      clarity: 0.8, hidden_constraint: 0.3, constraint_count: 2, constraint_conflict: 0.1,
      reasoning_complexity: 0.45, novelty: 0.3, error_cost: 0.25, reversibility: 0.8,
      verification_difficulty: 0.35, tool_dependency: false, context_size: 'small', parallelism: false,
    };
  }

  // High-stakes / security review / production approval
  if (/(security|auth|production launch|approve|financial|reconcil|compliance|irreversib)/.test(t)) {
    return {
      clarity: 0.7, hidden_constraint: 0.6, constraint_count: 2, constraint_conflict: 0.3,
      reasoning_complexity: 0.7, novelty: 0.5, error_cost: 0.85, reversibility: 0.25,
      verification_difficulty: 0.7, tool_dependency: false, context_size: 'small', parallelism: false,
    };
  }

  // Architecture / design / migration-with-tradeoffs (require architectural intent, NOT bare
  // "migrate"/"move" which are often mechanical).
  if (/(architect|design the|design a|monolith|microservices|trade-?off|assess options|evaluate (options|approaches)|phased (plan|approach)|high.?level)/.test(t)) {
    return {
      clarity: 0.55, hidden_constraint: 0.6, constraint_count: 3, constraint_conflict: 0.6,
      reasoning_complexity: 0.8, novelty: 0.6, error_cost: 0.6, reversibility: 0.4,
      verification_difficulty: 0.75, tool_dependency: false, context_size: 'mid', parallelism: false,
    };
  }

  // Multi-constraint code modification (refactor constrained)
  if (/(refactor|rewrite|modify|change|update).*(while|without|backward|not break|must)/.test(t)) {
    return {
      clarity: 0.7, hidden_constraint: 0.5, constraint_count: 3, constraint_conflict: 0.5,
      reasoning_complexity: 0.6, novelty: 0.4, error_cost: 0.5, reversibility: 0.6,
      verification_difficulty: 0.5, tool_dependency: false, context_size: 'mid', parallelism: false,
    };
  }

  // Research / summarization of papers / external docs (possibly parallel)
  if (/(summariz|research|read the (docs|paper)|papers|third.?party)/.test(t)) {
    return {
      clarity: 0.8, hidden_constraint: 0.3, constraint_count: 2, constraint_conflict: 0,
      reasoning_complexity: 0.4, novelty: 0.4, error_cost: 0.25, reversibility: 0.85,
      verification_difficulty: 0.3, tool_dependency: true, context_size: 'small', parallelism: false,
    };
  }

  // Mechanical batch / list / convert / move (explicitly after architecture so "migration
  // pattern" does not override mechanical moves).
  if (/(convert|list|rename|move|classif|files?|batch|10,?000|100,?000|csv|report the|folder a|import paths)/.test(t)) {
    return {
      clarity: 0.85, hidden_constraint: 0.15, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.15, novelty: 0.1, error_cost: 0.12, reversibility: 0.9,
      verification_difficulty: 0.15, tool_dependency: false, context_size: 'small', parallelism: false,
    };
  }

  // Creative / brainstorm (low stakes)
  if (/(brainstorm|tagline|idea|creative|generate .* ideas)/.test(t)) {
    return {
      clarity: 0.85, hidden_constraint: 0.15, constraint_count: 1, constraint_conflict: 0,
      reasoning_complexity: 0.25, novelty: 0.35, error_cost: 0.1, reversibility: 0.95,
      verification_difficulty: 0.15, tool_dependency: false, context_size: 'small', parallelism: false,
    };
  }

  // Trivial fact / arithmetic / mechanical single action (default low-complexity catch-all)
  return {
    clarity: 0.9, hidden_constraint: 0.1, constraint_count: 1, constraint_conflict: 0,
    reasoning_complexity: 0.15, novelty: 0.1, error_cost: 0.1, reversibility: 0.9,
    verification_difficulty: 0.1, tool_dependency: false, context_size: 'small', parallelism: false,
  };
}

// Modifiers: adjust the base profile from explicit signals in the text.
function applyModifiers(p, task) {
  const t = task.toLowerCase();

  // Hidden-constraint & clarity: "but/while/without/and preserve" after a simple premise hints
  // at unstated requirements.
  const hiddenHints = /\b(but|while|without|and\s+(preserve|must|still|keep)|not break|edge cases?|however)\b/.test(t);
  if (hiddenHints) {
    p.hidden_constraint = Math.min(1, p.hidden_constraint + 0.25);
    p.constraint_count += 1;
  }

  // Vague / user didn't specify (aspirational "improve X", "better", unspecified measures)
  if (/(\bbetter\b|improve (the )?(product|performance|quality|speed|time)|just make|unspecified|no (specific|clear)|user did not)/.test(t)) {
    p.clarity = 0.2;
    p.hidden_constraint = 0.8;
    p.verification_difficulty = Math.max(p.verification_difficulty, 0.65);
    p.reversibility = Math.min(p.reversibility, 0.3);
  }

  // Repeated / repeated failures
  const failMatch = t.match(/\bfailed (\d+)\b|(\d+) times? in a row|repeatedly fails?|keep[s]? failing/);
  if (failMatch) {
    const n = parseInt(failMatch[1] || failMatch[2], 10) || 3;
    p.failures_so_far = n;
  }

  // Parallelism: independent units
  if (/(each|independently|separate|before I (combine|merge)|simultaneously|in parallel)/.test(t)) {
    p.parallelism = true;
  }

  // Novelty signals (mechanical-but-new, rarely-seen)
  if (/\bnew\b|\bnovel\b|unfamiliar|never done|rarely[ -]?seen|never used|have not used/.test(t)) {
    p.novelty = Math.min(1, p.novelty + 0.3);
  }

  // Context scale — DOCUMENT/WINDOW size, NOT file count and NOT small line counts.
  // A "30-line function" or "500 files" is NOT large context. Only clearly large-scale
  // signals (pages/tokens/codebase/long-context) force deep. (Two false positives were
  // introduced and fixed here: matching "500 files" and "30-line".)
  if (/(\d+\s*(pages?|tokens?))\b|\d+\s*(k|thousand)\s*(tokens?|lines?)\b|long (document|context|report)|entire repo|large codebase|\bcodebase\b/.test(t)) {
    p.context_size = 'large';
  }

  // High error cost / no oracle / one-shot decision signals (model's judgment is the product,
  // irreversible, unverifiable). Detected for the one-shot-high-stakes escalation rule.
  if (/(very|extremely) costly|errors? (are|is) (very )?costly|no way to test|no test oracle|cannot (verify|be tested)|irreversib|vital (contract|clause)|decide whether to (invest|approve|acquire)|(choose|must choose|pick) (one|a single)|single irreversible|one final/.test(t)) {
    p.error_cost = Math.max(p.error_cost, 0.8);
    p.verification_difficulty = Math.max(p.verification_difficulty, 0.8);
    p.reversibility = Math.min(p.reversibility, 0.2);
    if (/(decide whether to|approve|invest|acquire|final clause|vital contract|choose (one|a single)|single irreversible|one final)/.test(t)) {
      p.one_shot = true;
    }
  }

  // ---- High-stakes MODIFIER (orthogonal to the base category) ----
  // `baseCategory` is first-match-wins, so a task whose SURFACE is "bug"/"debug"/"repair" was
  // classified as an ordinary debug task and silently inherited the ordinary-debug risk baseline
  // (error_cost 0.45, reversibility 0.6), even when the text says the failure is security-, auth-
  // or money-critical ("Fix this security bug before production launch."). Stakes are ORTHOGONAL to
  // task surface, so they belong here as a modifier — NOT as another early-return in baseCategory
  // (reordering the category list would only move the shadowing to a different input class).
  //
  // Deliberately narrow: it touches ONLY the two RISK axes. It does NOT set one_shot, does NOT
  // raise verification_difficulty, and does NOT itself cause a model upgrade — those stay governed
  // by the existing rules in applyModifiers/task-router (concrete capability mismatch, one-shot
  // high-stakes, repeated failures). High stakes mean "this needs care and real verification", not
  // "use a bigger model".
  //
  // Two-part guard — a bare high-stakes noun is not enough:
  //   anchor: a genuine high-stakes context (security, release/deploy/Prod, payment, compliance,
  //           irreversibility, ...)
  //   hint  : a stated CONSEQUENCE / exposure (loss, breach, outage, incorrect, money, customer, ...)
  //   minus : transient/retryable recovery framing ("failed twice", "flaky", "intermittent"). A
  //           flaky-credential retry is a recovery task, not an irreversible release decision;
  //           without this exclusion "flaky credentials error" would be promoted to irreversibility.
  const highStakesAnchor = /(security|production (launch|deploy|release)|vulnerabilit|exploit|data ?breach|credential|financial (loss|penalt|harm)|financial|payment|revenue|reconcil|compliance|audit trail|irreversib|before (release|launch|deploy|production|go.?live)|in production|production system|live traffic|safety.?critical|patient|regulat)/.test(t);
  const highStakesExposure = /(loss|penalt|harm|damage|outage|breach|incorrect|wrong|customers?|money|revenue|production|release|launch|deploy)/.test(t);
  const transientRecovery = /(failed (once|twice|two times|\d+ times?)|flaky|intermittent|retry|retries|retrying|transient|timeout|timed out|occasionally|sometimes)/.test(t);
  if (highStakesAnchor && highStakesExposure && !transientRecovery) {
    p.error_cost = Math.max(p.error_cost, 0.85);
    p.reversibility = Math.min(p.reversibility, 0.25);
  }

  return p;
}

/**
 * extract(task) -> profile (same shape as route() expects).
 * The task string is required. Returns a best-effort profile with the fields route() needs.
 * Empty / whitespace-only input does NOT throw: it degrades to a neutral low-signal profile
 * (structured/keep — "we cannot judge the task", i.e. deliberately NOT fast, because we have no
 * evidence it is trivial). This honors the "diagnose -> alternative -> degrade -> keep evidence ->
 * finish" principle: a real agent may legitimately receive a blank/truncated task and the pipeline
 * must not crash.
 */
function extract(task) {
  if (typeof task !== 'string' || !task.trim()) {
    return {
      clarity: 0.5, hidden_constraint: 0.5, constraint_count: 1, constraint_conflict: 0.2,
      reasoning_complexity: 0.5, novelty: 0.4, error_cost: 0.4, reversibility: 0.5,
      verification_difficulty: 0.5, tool_dependency: false, context_size: 'small', parallelism: false,
    };
  }
  const p = baseCategory(task);
  return applyModifiers(p, task);
}

module.exports = { extract };
