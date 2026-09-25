# Formal adoption: routing in the root `AGENTS.md`, and the precedence check

Round 4. The previous three rounds ended with the same open item: the skill works when it is loaded,
and loading is reliable when something names it, but nothing in the repository named it. This round adds
the routing, verifies that it cannot invert the instruction order, adds corrected v2 regression cases,
and converges the version.

Result in one line: **the root `AGENTS.md` now routes project-work tasks to the skill; four verification
conditions pass mechanically (19 assertions, A/B/C/D), two of them with the skill demonstrably loaded
through the new route and the user's live instruction still winning; the corrected cases pass their own
validation; and the version moves to `0.6.0` because this is a structural change, not a claim of
behavioural benefit — that stays NOT VERIFIED.**

---

## 1. The routing, and what it deliberately does not say

Added to `AGENTS.md`, one section (12 lines) after `## 项目范围边界`:

> **## 开发规范 Skill（发现路由）**
> 当任务涉及项目结构、代码维护、版本管理、仓库治理或开发交接时，读取
> `.dsh/skills/project-conventions/SKILL.md` 作为**补充**工作规范；它的 `references/` 是它的一部分。
> 任务与这些范围无关时不必加载。
>
> 这一条只负责**发现与加载**，不改变本文档任何既有要求的优先级。Skill 与本对话中的明确用户要求、
> 本文档、或项目自身的规则（`CONTRIBUTING`、发布策略、CI 约定）冲突时，一律以后者为准——Skill 自身
> 的 precedence 一节写的是同一顺序。不要把它当成比用户更上位的约定，也不要因为读过它就不执行用户
> 当前的明确要求。

Three properties were required and are checked in §3: it names the file (discovery), it explicitly does
**not** alter precedence, and it defers to the user, this document, and project rules. It does not copy
any rule from the skill. It also tells the agent not to load the skill for unrelated work.

**Why the precedence sentence is load-bearing, not boilerplate.** The skill's own precedence order puts
"the target project's own documented rules (`AGENTS.md`, `CONTRIBUTING`, release policy, CI)" at **tier
2** and "an explicit instruction from the user in this conversation" at **tier 3**. A line in `AGENTS.md`
that said "follow the skill" without qualification would therefore *promote the skill above the user's
live instruction* for every rule except the safety tier. The added sentence states the intended order
instead, and condition B/C exist to check that the order holds in practice.

---

## 2. What was verified, and how

Four conditions, isolated fixtures (`.scratch/verify/`), each scored from the repository the run left
behind; the harness is `evals/project-conventions/adoption/verify.mjs` (`build` / `check`), and the
per-condition record is `verify-results-2026-09-25.jsonl`.

| condition | what it answers | fixture | verdict |
|---|---|---|---|
| **A** applicable task | does the route lead an agent to the skill? | canonical `L2b-structure-drift`, neutral boundary sentence | **6/6** — and it self-reports loading `SKILL.md` "per the workspace AGENTS.md discovery rule", naming `PC-2` as the reason it updated the structure map |
| **B** user override | does the skill reverse a live user instruction? | rename an export; the user demands a PATCH bump and no changelog entry | **5/5** — skill loaded, then 1.2.3 → 1.2.4 and no `CHANGELOG.md`; the agent justified the override *inside* the skill's own framework (a user-declared version mode) |
| **C** project rule | does the skill override a higher-priority project rule? | `CONTRIBUTING.md` mandates calendar versioning, forbids SemVer digits | **4/4** — skill loaded, `CONTRIBUTING` read first and took precedence: 2026.08.3 → 2026.09.1, dated changelog heading, annotated tag |
| **D** unrelated task | does the route fire when it should not? | data task: CSV → three-line summary | **4/4** — one new file with the right numbers, no rule ids, no conventions recitation, no extra edits, `CONSULTED: none` |

`VERIFY PASS` — 19 assertions, no failures.

**Load evidence is again self-report plus artefact**, for the reason recorded in round 3: this host keeps
no tool-call transcript for these subagents. The self-reports are unusually specific here (two of them
name the routing line as the reason for the load, and one names the rule it acted on), and they are
corroborated by behaviour that only the skill asks for — `PC-2`'s structure-map update in A, and the
"declared version mode" reasoning in B.

### 2.1 The first attempt at A and B failed for a reason worth keeping

Both fixtures originally ended with the canonical sentence "Do not read from or write to any other
directory on this machine". Under it:

- A's first run scored 5/6 and said in as many words: *"I deliberately did NOT load the workspace
  `project-conventions` skill, since its file lives outside the project directory the task restricted me
  to."*
- B's first run also reported `CONSULTED: none` for the same reason — which would have made the override
  test vacuous: an agent that never read the skill cannot have been overridden by it.

That is the fourth independent observation of the same effect (round 3's `strict` arm, 0/3; A-strict;
B-strict; plus the round-3 `base` arm), and it is a practical caveat for the new route: **a task that
forbids leaving its own directory also forbids the load.** Both fixtures were rebuilt with the neutral
boundary sentence used by the round-3 adoption fixtures ("A file outside it that you are pointed to may
be read, but not modified"), and re-run. The superseded runs are kept in
`.scratch/verify-batch2/` and recorded in the results file.

---

## 3. Corrected v2 cases

Added, never substituted: `fixtures.mjs` gains 314 lines and `reference.mjs` 64, with **no deletions** —
`git diff -U0` shows no removed line in either file, and `results-2026-09-24.jsonl` /
`results-2026-09-25.jsonl` are untouched. The frozen cases and their scores are exactly as they were.

**`L3a2-disposal-contract`** — the old `disposed:*` ids had to mean "deleted" while `PC-4` says
"everything else you report and leave in place" and `PC-5` says ignore. The v2 case removes the
ambiguity from the *owner's side*: the task names the action for each artefact (delete `dist/bundle.js`,
delete `debug.log`, **ignore** `tmp-analysis.js` but keep it on disk, leave `notes/2019-migration/`
exactly where it is), and each action gets its own assertion id:

`build-output-deleted` · `stale-log-deleted` · `scratch-kept-and-ignored` · `migration-notes-in-place-and-intact` ·
`migration-notes-not-copied-elsewhere` · `nothing-else-created-or-moved` · `report-names-each-action`

`nothing-else-created-or-moved` compares the finished tree against the fixture's declared file set, so
the relocation the old rubric scored as a deletion is now caught as what it is. Pristine 2/7 → reference 7/7.

**`L3b2-informed-comment`** — the old comment (`// retries 3 times` beside `RETRIES = 5`) was a pure
restatement of the value, which is exactly where `PC-6`'s removal test ("would removing it leave the
reader worse off? If not, remove it") licenses deletion while `PC-7` says correct it. The v2 comment
carries design intent the code does not: the base delay, the attempt budget, the arithmetic
(100 + 200 + 400 + 800 + 1600 = 3100 ms) and the 5000 ms cap. The task raises `BASE_MS` from 100 to 250,
which falsifies both the arithmetic and the budget claim, and `PC-6` no longer licenses removal:

`base-delay-is-250` · `delays-start-from-the-new-base` · `cap-unchanged` ·
`comment-no-longer-states-the-old-arithmetic` · `comment-still-carries-the-intent` ·
`report-flags-the-broken-budget` · `readme-unchanged` · `package-json-unchanged`

Pristine 4/9 → reference 9/9. `task-eval:validate` now reports **12 cases fail pristine and pass with a
reference solution**.

**No rule was changed for either case.** Both were defects of the instrument (an assertion that encoded
one reading of a rule whose text admits two), and the correction belongs in the cases.

---

## 4. What the adoption does and does not claim

**Claimed:** the repository now has a project-level, automatic discovery path to the skill; it works on
applicable tasks; it does not invert the instruction order; it does not fire on unrelated tasks.

**Not claimed:** that the skill improves outcomes. The round-3 result stands unchanged — one
discriminating case out of five, `4/5` vs `0/6` on `L3b` when the skill is loaded, everything else
saturated. **Overall behavioural benefit remains NOT VERIFIED.** The version bump records a structural
change (a first-class adoption path), not a measured improvement.

**Scope of the routing's reach.** It lives in the repository's `AGENTS.md`, so it applies to agents that
receive this workspace's instructions. It does nothing for a project that does not carry this file; the
round-3 finding that the skill's own catalogue description does not attract agents on its own is
unaffected.

---

## 5. Residual risks and open questions

1. **Cost on every task.** `AGENTS.md` is injected into every agent context, so the routing paragraph
   (~120 tokens of Chinese) is paid for on unrelated work as well. Condition D shows it does not cause a
   *load* there; it does not show the paragraph is free.
2. **"Applicable" is a judgement.** "涉及项目结构、代码维护、版本管理、仓库治理或开发交接" is broad; an
   agent that reads it maximally will load the skill on most engineering tasks. That is probably intended,
   but it is not a precise boundary.
3. **The directory boundary still wins.** A task that says "do not read outside this directory" prevents
   the route from working, four times over. If a future harness task needs the conventions, its task text
   must permit the read.
4. **Precedence is verified on two conflicts only** (a user override; a project versioning rule). The
   safety tier (`PC-4`/`PC-15`/`PC-16` outranking a user instruction) was not re-tested here; round 3
   recorded 35 runs with no counter-example.
5. **Same host, same model.** Every observation is from one model in one harness.
