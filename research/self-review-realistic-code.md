# Self-Review Reliability on Realistic Code — Session 33 follow-on

Status: `experimental` (n=4 realistic subjects this round; combined with Session 32 n=14). Purpose:
extend the self-review reliability study from tiny hand-picked functions to **longer, realistic,
multi-branch production-style code** — the regime Session 32 flagged as the true test of
"反思不是证据". Updated: Session 33.

## Why this round

Session 32's 14/14 clean catches were all small single-purpose functions shown to fresh agents with
an explicit verify instruction. The skeptical reading: real bugs live in longer code (5–20 lines,
several branches, domain logic), where self-review is most likely to confidently miss. This round
measures that.

## Protocol

- 4 realistic subjects (each ~10–40 lines, real domain logic), each with a confirmed PLANTED bug
  (author + direct execution established ground truth; two initial subjects R3/R4 had construction
  errors — code duplicated or contract didn't state the rule — and were rebuilt and re-verified):
  - R1 `calculateOrderTotal` — free-shipping threshold tested on UNIT COUNT instead of DISCOUNTED
    SUBTOTAL (domain-logic bug; example 2 coincidentally correct, example 1 wrong → 110.15 vs 102.6).
  - R2 `validateConfig` — cross-field consistency check INVERTED (`else` fires on the valid case,
    invalid case silently passes) → good config flagged, bad config accepted.
  - R3 `wrapText` — final accumulated line never pushed → last line silently dropped from every
    wraptext output.
  - R4 `parseVersion` — no guard for >3 core segments → `'1.2.3.4'` (malformed) accepted as valid.
- Each subject: a fresh no-seed agent, SELF-REVIEW ONLY (no tools/execution), given the function,
  the spec, and 2–3 reference examples — but no hint about where the bug is (unanchored).

## Results

| subject | ground truth | self-review verdict | confidence | correct? |
|---|---|---|---|---|
| R1 order-total | BUGGY | BUGGY | high | ✓ |
| R2 config-validator | BUGGY | BUGGY | high | ✓ |
| R3 wrapText | BUGGY | BUGGY | high | ✓ |
| R4 parseVersion | BUGGY | BUGGY | high | ✓ (also flagged a bonus misparse of '-1.2') |

Combined with Session 32's 14/14: **18/18 caught at high confidence, zero false "CORRECT" verdicts**.

## Interpretation

1. Even on realistic, multi-branch production-style code, unanchored self-review (explicitly asked
   to trace carefully) caught every bug. R1's is a genuinely sneaky domain bug (the misleadingly
   correct example 2!), yet the agent still spotted the wrong shipping variable — the strongest
   single guard against the naive "self-review is always wrong" claim yet.
2. Consistent with Session 32's conclusion: the verify ladder's rule is about **guarantee, not
   average failure** — a run yields reproducible evidence; self-review yields an assertion that in
   these controlled conditions happened to be correct. The honest position remains: prefer the run
   when available; never promote self-review above a real check; do not claim self-review always
   fails (our data says otherwise) — but neither should anyone rely on it as primary evidence.
3. **Construction lesson (failure analysis):** my first R3/R4 had no real bug — R3's "duplicate
   line" never triggered and R4's 4-segment rule wasn't in the written contract. This is itself
   evidence that "planted bugs" must be verified to actually exist before measuring catch rate;
   ground truth by execution caught my own mistakes before any agent saw the code. (Same discipline
   as the verify-field-test construction in Session 27.)
4. Limits: n=4 this round (still small), one model family, bugs deliberately findable by traced
   reading. Does not measure: long multi-file code, concurrency/timing bugs, domain-knowledge
   errors requiring external facts. It remains an upper bound on self-review competence.

## Files
- Subjects live only in OS temp (transient). This record is the durable artifact.
