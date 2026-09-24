# Behavioural evaluation of the project-conventions skill

Result in one line: **the case set hit a ceiling — every condition passed almost everything — so no
behavioural benefit is demonstrated.** The measurement instrument itself is validated; the finding is
that this instrument cannot see a difference, not that a difference exists and was missed.

---

## 1. Question

Does loading `project-conventions` change what an agent decides, compared with not loading it?

## 2. Protocol

| Element | Value |
|---|---|
| Cases | 20, covering all 12 behaviour areas named by the task (organisation, scratch cleanup, structure-doc sync, module responsibility, comments, version choice, recovery, communication, help-seeking, naming, rule conflict, convergence) |
| Assertions | Each case states a required decision and a forbidden one, and carries a good example that must pass and a bad example that must fail — `suite-test.mjs` enforces that |
| Conditions | `baseline` = the case questions alone. `skill` = the same questions plus `SKILL.md` (and its `references/` were available to read) |
| Replicates | 3 per condition, 6 runs, 120 answers total |
| Runs | Fresh agents, no conversation seed, no tools, one output file each, forbidden from reading `evals/` |
| Scoring | **Blind independent judging.** Answers were shuffled with a fixed seed and relabelled `A001`–`A120`; two fresh judges scored all 120 against per-case criteria in decision terms, with the condition key withheld and withheld from them |
| Aggregation | A row passes only when both judges pass it; a judge disagreement counts against the condition |

The raw run is preserved under `evals/project-conventions/behaviour-run/` so the result can be
re-derived rather than trusted:

| file | what it is |
|---|---|
| `results.jsonl` | the 120 answers, with condition and run labels |
| `blind.jsonl` | the same answers shuffled and relabelled `A001`–`A120` — exactly what the judges saw |
| `judgements.md` | the judging pack: per-case criteria in decision terms |
| `blind-key.jsonl` | the mapping back to conditions. **Withheld from both judges.** |
| `judged-j1.jsonl`, `judged-j2.jsonl` | the two independent verdict files |

To re-derive the whole comparison from the preserved files:

```bash
node evals/project-conventions/behaviour-run/join.mjs
```

`join.mjs` lives in the repository rather than in scratch on purpose: the result is a **negative** one,
and a negative result nobody can re-derive is indistinguishable from a claim.

## 3. Instrument development — the first two measurements were wrong, and that is the main lesson

The suite was first scored with regexes over the answers. That produced _baseline 45/60 (75%) vs skill
50/60 (83%)_. Reading the failures showed the instrument was wrong far more often than the answers
were:

- `help-01` failed in **all six** runs because good answers contain the word "assume" inside a refusal
  ("rather than assume the flag"). The pattern matched a mention.
- `version-01` failed where the answer said "a MAJOR here would be a false alarm" — the forbidden word,
  correctly rejected.
- `commit-01` failed on "Three commits, not one", because the required pattern looked for "two
  commits".
- `conflict-01` failed on "or delete it once they confirm a backup exists".

A negation guard was added (a forbidden phrase preceded by a refusal cue in its own clause is not a
violation), which moved the same suite to _baseline 53/60 (88%) vs skill 53/60 (88%)_ — a different
number, from the same data, with no model involved. **A regex cannot decide whether a phrase is
endorsed or mentioned**, so the regex numbers are reported here only as a rejected instrument, never as
a result. This is the concrete reason the final measurement uses blind judges.

The episode is recorded because it is the failure this project already has a rule about: a measurement
that moves when you tune the instrument is measuring the instrument.

## 4. Results

| Condition | Pass (both judges) | Rate |
|---|---|---|
| `skill` | 60 / 60 | 100.0% |
| `baseline` | 58 / 60 | 96.7% |

- **Inter-judge agreement: 118/120 (98.3%).** The two disagreements are both on `org-01`, and they are
  the only reason the two conditions differ at all.
- **Ceiling: 19 of 20 cases were solved by all six runs**, in both conditions. The only case with any
  discriminating signal is `org-01` (choosing where a new file goes), where two baseline runs hedged
  between candidate directories and one judge scored that as a fail.
- The nominal +3.3 points therefore rests on 2 rows of 1 case, on which the judges disagreed. It is
  **within judge noise**, and it is not evidence of anything.

## 5. What this does and does not show

**Supported:**

- The suite's rubrics discriminate: every case's asserted-good answer passes and its asserted-bad answer
  fails, checked mechanically (`suite-test.mjs`), and that check was itself validated by mutating the
  instrument and confirming it fails.
- The skill is discoverable and loadable by a real host: writing the bundle into `.dsh/skills/` put it
  in this session's live catalog without a restart, and removing it removed the entry. That was tested
  directly, both directions.
- Both conditions solve these decisions. The baseline model is competent at the stated rules when asked
  the question directly — including the cases where the owner's magnitude preference conflicts with
  SemVer, and the deletion-safety traps.

**Not shown — and this is the honest headline:**

- **No behavioural benefit of the skill is demonstrated.** The case set is saturated.
- Nothing here measures behaviour in a *real task*, where the rules must fire without being asked. This
  protocol asks the question; a real task does not. That is the single biggest gap, and it is a
  different experiment.
- n = 3 per condition. Nothing about variance is established.
- The judges share a model family with the runs. A judge panel from another family would be a stronger
  check on the 98.3% agreement.
- The answers were produced under an instruction not to read `evals/`. That was an honour-system
  constraint; no mechanism enforced it.

## 6. Why the ceiling is not a surprise here

The same repository already recorded this outcome twice for its other skill: External Eval v1 and v2
both met a ceiling effect, where every condition solved every task, and the conclusion recorded then
was that no general improvement over a minimal scaffold had been demonstrated
(`reports/phase-2-v2-pilot.md`). The new skill reproduces that result on a different case set. Two
independent ceiling results on the same class of instrument is itself information: **asking a strong
model to decide well is not a hard test, whether or not a document told it how.**

## 7. What would make this measurable

Ordered by expected value per unit of effort:

1. **Task-level, not question-level.** Give the agent a small repository and a real job, then score the
   resulting repository state and transcript. The rule that matters most — PC-4, refuse to delete what
   you cannot classify — only has teeth when there is something to delete.
2. **Harder cases or a weaker baseline.** Nineteen of twenty cases are solved by the untutored model;
   they cannot separate arms. Cases should be selected *because* the baseline fails them.
3. **Inject the failure modes directly**: a repository that already contains stale comments, an
   unsynchronised structure map, an ambiguous version mode, and a tempting unattributable directory.
   Then measure whether the work leaves it better — which is the skill's actual claim.
4. **Cross-family judges** for the next round, to test the 98.3% agreement rather than assume it.

Until (1) or (3) is run, the correct status for the skill's behavioural effect is **NOT VERIFIED**.
The contract, the discovery path and the citation integrity are verified; the benefit is not.
