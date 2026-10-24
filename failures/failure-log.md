# Failure Log

Long-term record of meaningful failures that changed the design. One entry per real root cause.

---

## F1 — High error cost alone forced Deep → overthinking (v1)

**When:** Session 01, adversarial probe.
**Task:** high error cost (0.85) but trivially verifiable (0.1), reversible (0.9), high clarity.
**Observed failure:** router returned `deep` solely because `error_cost >= 0.7`.
**Why it is a failure:** this is overthinking. High stakes raise the need for *verification*, not
for more deliberation. When an automated check catches mistakes cheaply and the work is reversible,
Deep is wasteful — a Fast/Structured path plus an explicit verify is equally safe and much cheaper.
Corroborated by external evidence that overthinking degrades easy/cheap tasks and wastes compute
([When More Thinking Hurts](https://arxiv.org/html/2604.10739)).
**Root cause:** the `E_HIGH_OR_DEEP` rule fired on `error_cost` alone and ignored
`verification_difficulty`, which is the real mediator. Stakes × inability-to-verify-cheaply is the
deep trigger; stakes alone is not.
**Fix (v2):** error-cost Deep trigger now requires `verification_difficulty > V_MID` as well.
**Prevention rule:** *Cost/risk assessments must be mediated by verification difficulty. High stakes
with cheap verification → "fast but verified," not deep.*
**Generality:** likely general (cost × verification is a common coupling), but only demonstrated on
one adversarial case so far.

---

## F2 — Benchmark "100%" is training-set overfitting (meta-failure, partially closed)

**When:** Session 01, after first benchmark run.
**Observed:** router hit 100% strategy + model accuracy on all 13 labeled tasks.
**Why this is a problem:** 100% on the same set used to set thresholds and hand-label expectations
does not demonstrate generalization — it indicates the thresholds and labels were co-fit. Reporting
it as "validated" would be dishonest and is exactly the trap the objective warns about
(基准过拟合).
**Resolution (Session 02):** added a held-out validation set (`evals/validation.js`, 12 tasks
authored independently of the thresholds, labels reasoned from task nature). v2 generalizes to
**12/12 (100%) strategy and model** there. This is co-fit-independent evidence and substantially
closes F2. Residual caveat: the validation labels are still author-judged, and 12 cases is small;
keep growing the set. Prevention rule retained: never tune thresholds to the validation set.

---

## F3 — Boundary disagreement: large mechanical batch → fast vs structured (observation, no code change)

**When:** Session 02, held-out validation run.
**Task:** classify 10,000 reviews with an existing classifier (mechanical, low risk, easily
verifiable). Router chose `fast`; initial label said `structured`.
**Analysis:** the router's `fast` is the more defensible reading (existing pipeline, low risk,
easily spot-verified, reversible). "Multi-step" alone is not a reason to leave Fast. Re-labeled
`fast` on task-nature grounds.
**Why no code change:** forcing a threshold to flip this one case would re-create F2 co-fitting.
**Genuine open idea (candidate):** large mechanical *batches* may benefit from a light safety
protocol (count assertions, sample-verify) even at trivial reasoning complexity. Recorded as an
open candidate in `methods/core/task-router.md`; to be tested with its own validation cases before
any implementation.
**Generality:** likely general (batch-scale is a distinct axis from reasoning complexity), but
unverified.

---

## F4 — Signal extraction is the real bottleneck; naive extractor misroutes a meaningful share (mostly fixed)

**When:** Session 03, end-to-end harness (`evals/extraction.js`) added.
**Observed:** routing on hand-built profiles is near-perfect (~100%), but running the router from
raw task text via a keyword extractor dropped combined e2e accuracy to **80%** (20/25) initially.
**Root causes (all general, mechanism-level):**
- Bare "migrat"/"move" ("mechanical migration pattern") fired the architecture rule before the
  mechanical rule → misrouted a mechanical move to Deep. Fix: sharpened the architecture rule to
  require architectural intent; moved mechanical below architecture.
- Repair language ("make it stop failing") not recognized as debug → treated as trivial.
  Fix: added repair triggers to the debug category.
- Multi-step pipelines ("parse a CSV, filter rows, ...") matched the trivial `/csv/` rule.
  Fix: added a multi-step action-verb rule ahead of mechanical.
- **Introduced regression:** raising debug `verification_difficulty` to 0.75 (to fix a failure-
  upgrade case) forced *all* debug tasks to Deep, over-thinking a single flaky test. Fix: added a
  general router rule (repeated failures + not-trivially-verifiable ⇒ Deep) and set debug verif to
  a moderate 0.6. This also targets the "upgrade-late" failure mode.
**Result:** e2e combined **24/25 (96%)**; train e2e 13/13, held-out validation e2e 11/12.
**Remaining known limitation (left open, not over-fit):** `regex rewrite with escaped quotes`
still routes fast/structured — a pure keyword extractor cannot capture the subtle "escaped quotes"
edge-case constraint. Keyword extraction has a ceiling; an agent's own reading is richer.
**Prevention rule (general):** *Repeated failures are strong evidence a task is harder than it
appears — deepen, don't just retry. And never raise a category's thresholds to fix one case without
re-checking every peer case (the F4 regression was caused by exactly that).*

---

## F5 — Enlarging the held-out set exposed real overfitting + extractor numeric false positives (fixed)

**When:** Session 04.
**Observed:** growing the held-out validation set 12→21 (harder, independent tasks) dropped
profile-based validation from 100% to **85.7%** — genuine overfitting the small set had masked.
Four misses surfaced:
- `many trivial constraints` (4 trivial, unit-testable constraints) routed **deep** — constraint
  count fired with trivial verification.
- `novel mechanical boilerplate` (new but compilable-verifiable) routed **deep** — novelty fired
  alone.
- `one-shot investment decision` (no oracle) stayed **keep** — escalation gap.
- `simple bugfix` (mild hidden constraint) — router's structured was the more defensible read;
  corrected the label, not the router.
**Fixes (v4):** constraint-count & novelty Deep triggers now require `verification_difficulty >
V_EASY`; added `one_shot` signal + one-shot high-stakes escalation rule (gated on `one_shot` so
iterable deliverables don't escalate — my first attempt over-fired and wrongly escalated
architecture-plan and security-review tasks, caught and corrected). Profile-based validation back
to **21/21**.
**Extractor numeric false positives (also F5):** my context-size detector matched "**500 files**"
and "**30-line function**" and forced Deep on mechanical work (two regressions introduced and
fixed). Lesson: a scale/numeric detector must not treat file-count or small line-count as "large
context" — context size is about document/window scale.
**Result:** profile-based validation 21/21 (100%), e2e extraction combined 91% (31/34), probe PASS,
train benchmark 13/13. `npm test` exits 0.
**Remaining (documented ceilings, not over-fit):** keyword extractor still routes 3 hard tasks to
fast (regex-rewrite, many-trivial-constraints, novel-mechanical) — semantic signal extraction has
a heuristic ceiling; an agent's own reading is richer.
**Prevention rule:** *Always re-run the ENTIRE eval suite after any router/extractor change; a fix
to one case must not regress peers (`npm test` is the gate).*

---

## F6 — Threshold-robustness finding (closes F2 over-fit concern with evidence; no code change)

**When:** Session 15 — after the deliverables gate, added `evals/robustness-test.js`.
**Question:** are the ~100% eval scores over-fit to the exact threshold values (the F2 concern)?
**Measurement:** perturb every default threshold ±10% and ±20% (single-axis and all-at-once) and
count routing-decision flips across the full 35-item set (train + held-out).
**Result:**
- single-axis ±10/±20% → max 2/35 (5.7%) decisions flip;
- all-axes at once ±10% → 11.4%, ±20% → 14.3% flip.
- The flipping items are ALWAYS boundary cases flipping between ADJACENT strategies (struct↔deep,
  fast↔structured) — never a fast↔deep jump: `seemingly-simple-hidden-constraint`,
  `debug-flaky-test`, `val-batch-classify`, `val-novel-mechanical-boilerplate`,
  `val-currency-convert-tool`, `architecture-design`, `high-risk-financial`, `val-flaky-ci-debug`,
  `val-mechanical-csv-parse`.
**Conclusion:** the router is decisive on clear tasks and only wavers (by at most one strategy
level) on genuinely ambiguous ones. The eval scores are largely NOT an artifact of exact thresholds.
**Prevention rule:** keep the robustness test in `npm test` — if a future change makes decisions
flip widely under small threshold perturbation, that is a real fragility signal worth investigating.

---

## F7 — Repeated-failure evidence silently dropped by a verification gate (Session 29, router finding R-1)

**When:** Session 29, independent adversarial review.
**Observed:** a task that had already failed 5 times but reported `verification_difficulty <= 0.5`
still routed `fast/keep` — the failure-based escalation was gated on `verif > V_MID`, so all
failure evidence vanished whenever the profile claimed "easy to verify."
**Why a failure:** repeated failure is *empirical* proof the profile/model is wrong; it should not be
overridden by the very profile the failures disprove.
**Fix:** failure escalation (both model upgrade and Deep) is now unconditional on verification
difficulty.
**Prevention rule (general):** *empirical failure signals override stated verification estimates.*

---

## F8 — Ambiguity could never force Deep (Session 29, router finding R-2)

**When:** Session 29, independent adversarial review.
**Observed:** `clarity` only gated Fast (low clarity → Structured); nothing ever read `clarity` for
the Deep decision, so a genuinely ambiguous hard-to-verify task could not be routed Deep on
ambiguity alone.
**Fix:** added `clarity < CLR_DEEP && verif > V_MID` → Deep (vague + not-cheaply-verifiable is deep;
a cheap vague task stays Structured/clarify).
**Prevention rule:** *every signal in the profile should be able to influence the decision along both
directions it logically affects; a signal that only lowers one strategy is suspect.*

---

## F9 — "Trivial verification" was two different thresholds (Session 29, router finding R-3)

**When:** Session 29, independent adversarial review.
**Observed:** constraint-count/novelty Deep guards used `verif > V_EASY` (0.3) while the high-stakes
guard used `verif > V_MID` (0.5) — so the same `verif=0.4` meant "not trivially verifiable" for
novelty but "cheaply verifiable" for stakes, giving contradictory behavior.
**Fix:** unified the "not trivially verifiable" non-trivial barrier to `> V_EASY` for
novelty/constraints/stakes; hidden/ambiguity keep the stricter `> V_MID` (they signal *risk of
misinterpretation*).
**Prevention rule:** *one concept should have one numeric boundary; if two thresholds are both
"trivial verification", unify them.*

---

## F10 — Parallel delegation over-gated on tool_dependency and disabled by capability edges (Session 29, R-4/R-5)

**When:** Session 29, independent adversarial review.
**Observed:** (a) parallel work only delegated when `tool_dependency` was true, so a parallel code
refactor or batch transform never fanned out; (b) passing `model_capabilities`/`mismatch` silently
disabled delegation via else-if ordering (capability branch swallowed the delegate branch).
**Fix:** delegation now fires for ANY non-trivial parallel fan-out (skip only trivially-fast
mechanical batches); the delegate branch is checked before the capability branch (a real capability
mismatch still upgrades).
**Prevention rule:** *delegation (parallelism) and escalation (capability) are different axes; a
feature that opts into capability checks must not disable delegation for parallel work.*

---

## F11 — One-shot upgrade gate too strict; later the one-shot-loses-to-parallel ordering bug (Sessions 29 & 37)

**When:** Session 29 (R-6) and Session 37 (F-6b, live test).
**Observed (A):** the one-shot gate required ALL of high cost + low reversibility + hard-to-verify,
so a one-shot hard-to-verify call with moderate cost never upgraded. Fix (R-6): EITHER high cost OR
hard-to-verify is enough for an irreversible one-shot call.
**Observed (B, Session 37):** after R-6 the parallel-delegate branch sat before the one-shot branch;
a live LLM-filled profile with `one_shot:true + parallelism:true` (a board making ONE irreversible
acquisition decision, with parallel background notes) **delegated instead of upgraded**. Fix (F-6b):
one-shot outranks parallel-delegation — a single irreversible decision is never fan-out work. Locked
in by benchmark item `one-shot-parallel-judgment` + P7.
**Prevention rule (general):** *a one-shot irreversible judgment is a single decision by definition;
it must never be fanned out, and ordering bugs between escalation rules are caught only by testing
mixed-signal profiles.*

---

## F12 — Novelty seeped into the capability requirement (Session 29, R-7)

**When:** Session 29, independent adversarial review.
**Observed:** `taskRequirements` added `novelty * 0.15` to the reasoning requirement, so a
novel-but-mechanical task could tip over the capability-mismatch margin into upgrade — despite the
module header claiming "never for novelty alone."
**Fix:** removed the novelty term from the capability requirement (novelty is handled at the strategy
level: deep for novel + non-trivial-verify).
**Prevention rule:** *a claim in a header comment must be enforced by the code; capability mismatch
must measure capability, not a strategy signal.*

---

## F13 — Planted bugs must be proven real before measuring (Session 33, construction lesson)

**When:** Session 33, self-review reliability study.
**Observed:** my first R3 wrap-text "bug" (duplicate last line) never actually triggered, and R4's
"4-segment version is invalid" rule was not in the written contract — neither was a real bug, so
measuring "does self-review catch it" would have been meaningless (and flattering).
**Fix:** run ground-truth execution on every subject BEFORE dispatching reviewers; rebuild subjects
that are not genuinely buggy. This mirrors the Session 27 verify-field-test construction discipline.
**Prevention rule (general):** *any benchmark for "can X detect the bug" must first prove the bug
exists and is detectable by the intended channel; a vacuous subject is a false pass.*

---

## F14 — Pipeline crashed on empty/blank task text (input-robustness gap, Session 44)

**When:** Session 44, new `evals/fuzz-test.js` fed adversarial/malformed/extreme strings (empty,
whitespace, control chars, emoji, JSON-like, 10k chars) through extract → route → certainty →
verify → cost → CLI → batch.
**Observed:** `extract('')` and `extract('  ')` THREW ("task must be a non-empty string"), so the
whole pipeline and the CLI crashed on a blank/truncated task — a real agent can legitimately
receive empty input (typo, truncated paste).
**Why a failure:** violates the objective's "diagnose → alternative → degrade → keep evidence →
finish everything finishable" principle: a blank task should not crash the skill.
**Fix:** `extract` no longer throws on empty/whitespace; it degrades to a NEUTRAL low-signal profile
(clarity/hidden/reasoning/etc. ≈ 0.5 → routes structured/keep). Deliberately NOT fast (we have no
evidence a blank task is trivial). Added `evals/fuzz-test.js` (4 checks, wired into `npm test`).
**Prevention rule (general):** *every pipeline stage must degrade gracefully on malformed/empty
input, never throw at the boundary a caller can reach; fuzz the whole pipeline, not just valid
profiles.*

---

## F15 — batch + --profile-json silently cross-contaminated rows (Session 50)

**When:** Session 50, batch-mode audit.
**Observed:** `planTasks` passed the SAME `opts` (with one `profileJson`) to every row, so `echo
"taskA\ntaskB" | node bin/router.js --batch --profile-json '{...}'` applied ONE task's injected
profile to ALL rows — e.g. a trivial "rename" got deep/keep only because an architecture task's
injected profile leaked into it. No crash (fuzz passed), so it was a silent semantics bug.
**Why a failure:** batch = independent tasks, each with its own signals; `--profile-json` is a
per-single-task construct. Applying it across rows corrupts decisions without the user knowing.
**Fix:** `planTasks` now strips `profileJson` (marks `profileJsonIgnored=true`, source stays
'keyword') and batch `main()` warns "NOTE: --profile-json is ignored in --batch mode"; single-task
injection unchanged. Regression added to `evals/cli-batch-test.js`.
**Prevention rule (general):** *option combinations must be validated per-mode; a single-task option
must be explicitly inert (and warn) in batch/aggregate modes, not silently broadcast.*

---

## F16 — Action-loop degeneration (real external failure evidence; NOT resolved by the current skill)

**When:** observed in real agent runs during later development (autonomous goal rounds), collected
as long-term failure evidence.

**Phenomenon:** the agent has ALREADY decided to call a tool, but then repeatedly emits "现在执行 /
now invoke / no more preamble" text without actually invoking the tool — and even after recognizing
that it is in a repetition loop, it keeps repeating the declaration instead of acting.

**Why it matters:** this is not a reasoning/probability failure — it is an **action-selection →
action-execution** gap. Deliberation and stopping logic can both be correct while the loop still
fails to convert "stop deliberating" into an actual tool call. A cognitive skill that only governs
deliberation stops short of governing action.

**Possible mechanism:** repeated self-narration ("I will now call X") is being treated as progress
(the narration itself looks like a step), combined with no external check that the promised action
actually happened; the model therefore drifts into re-asserting intent rather than emitting the tool
call token.

**Relation to stopping / action control:** `strategies/stopping.js` only decides WHEN deliberation
should end; it has no notion of "declared action not yet executed". The adaptive loop also treats a
returned executor result as the action having happened — it cannot detect an executor that only
narrates. Closing this would require a separate action-control signal (e.g. "tool call actually
observed this round"), which the current skill does NOT include.

**Current status:** **unknown / unresolved.** The current skill has no test or mechanism that proves
it prevents action-loop degeneration. Do not claim this is handled.

---

## F17 — Meta-policy self-exemption (real external failure evidence; NOT resolved by the current skill)

**When:** observed across the project's own long-running development (autonomous goal rounds that
kept continuing after multiple "complete" declarations).

**Phenomenon:** the same agent can design a stopping / convergence policy for a TARGET task, but
when it is the HOST driving its own long development, it keeps auto-discovering "the next piece of
work" and starting further sessions even after repeatedly declaring completion. The policy constrains
the task it is applied to, but not the host that applies it.

**Failure mechanism:** the stopping/convergence policy is an OBJECT of the skill, evaluated on task
executions the host delegates — while the host's own loop ("found another improvement → continue") is
governed by a different, looser rule (e.g. a large session round budget). The meta-level (who decides
to stop the host) is not subject to the first-order stopping policy.

**Implication for future skill design:** a cognitive skill for agents needs an explicit self-application
boundary: the same convergence criteria the skill imposes on target tasks should be applied to the
agent's own meta-work (declared complete = stop until external direction). Non-trivial and currently
unaddressed by the skill's `stopping.js`/`convergence` machinery.

**Current status:** **unresolved; treated as real external failure evidence.** No feature was added
to address it (out of scope for the release-blocker fix); it is recorded so the limitation is not
overclaimed.

---

## F18 — 无等长对照的行为评测会把「注入效应」读成「内容效应」（Round 5, 2026-10-24）

**When:** Round 5（External Eval v3，弱被试 beam，144+320+320 runs）。
**Observed:** v2–v4 轮的四臂/三臂设计里，treatment 与 control 的差异始终为注入「更长的结构化文本」
与「认知技能内容」的混合效应。Round 5 首次加入等长安慰剂臂（controlC）：在唯一有能力余量的任务
（v2-09）上裸跑 1/3 而三种注入全部 3/3；输出 token 上安慰剂（980/614）与技能（970/624）在两个
语料上几乎相同且都与裸跑差异显著。**全部可观测差异来自注入动作本身，与内容无关。**
**Why it matters:** 若无 controlC，本轮会得出「技能把 v2-09 从 1/3 提到 3/3、并把输出压缩 30%」
这样的阳性结论——它实际是长度/结构效应。
**Prevention rule (general):** *prompt 注入类 treatment 的行为评测必须含等长安慰剂臂；
任何「treatment 有效」的结论都要先问：安慰剂臂是不是同样有效。*
**Generality:** likely general（对弱被试已三次复现；对强被试 v2 轮的天花板使该混淆未被检验）。

---

## F19 — 预注册的判定标准必须把计量口径写到操作级（Round 5, 2026-10-24）

**When:** Round 5 成本红线判定。
**Observed:** 预注册写「token 总量不超过 controlB 的 120%」但未定义是否包含被注入的技能文本。
实测两个口径结论相反：输出口径 -30.2%/+2.5%（过线），总口径 +56%/+299%（破线）。v2 的
`inputSizePolicy` 早有「注入不计入产出」的先例，但预注册时没有把它带进红线上——与 README
结构图计数口径教训（引用标签而非工作树）同构：**口径不写明，数字无法复核。**
**Fix:** 本轮两口径全部报告，不事后择优；预注册模板补「每个计量指标注明口径（含/不含注入、
中位数/均值、按 run 还是按题聚合）」。
**Prevention rule (general):** *预注册里每个阈值的每个名词都要能被直接翻译成一行聚合代码；
写不出代码的阈值就是没定义清楚。*

---

## F20 — 评分器静默失效：相对路径使 require 型 checker 全部抛异常（Round 5, 2026-10-24 当日发现并修正）

**When:** Round 5 批次 0 评分（144 runs，同日在 glmflash 冒烟诊断中发现）。
**Observed:** runner 接受相对 `--out` 路径；v2 checker 用 `require()` 加载工作区内的 agent 产物
文件，而 Node 把不以 `./` 开头的相对说明符当**模块名**（按 checker 所在目录向上找 node_modules），
与 cwd 无关。结果 12 个 checker 中 9 个全量抛 `Cannot find module`，被我方的 catch 记成
`taskPass=false`、criteria 为空——**已解出的任务被记为失败**（108/144 受污染）。初版报告据此
错误宣布"v2 语料对免费被试是地板（6.9%）"；重评分后为 75.7%，且四臂差异完全改观。
**Root cause 两层：(a) 路径未规范化为绝对路径；(b) 聚合器没有完整性门禁**——0/0 criteria 的
run 与真实失败在聚合输出里不可区分，108 个这样的 run 溜过了所有检查。
**Fix:** runner 强制 `path.resolve`；`rescore.mjs` 对现存工作区全量重评分（episode 未重跑，
工作区在磁盘上完好——这也是"评分与执行分离"的价值）；`aggregate.mjs` 增加完整性警告
（checkerError/空 criteria 计数，永不静默）。
**Prevention rule (general):** *任何"失败"结论之前先证明评分器真的运行过：失败 run 必须
携带评分器执行证据（非空 criteria 或显式 checkerError 分类）；聚合器把"评分器未执行"当作
一级告警而不是失败的一种。*（与 F13 同族：基准必须先证明它能测，再谈测出了什么。）
**Generality:** likely general——所有"外部 checker + 中间层目录传参"的评测 harness 都可能踩；
本轮损失约 2 小时与一次报告重写，幸因评分与执行分离而无须重跑 144 episodes。

---

## F21 — 基础设施失败混入行为失败：免费 provider 的渲染上限伪装成"认知差异"（Round 5, 2026-10-24 当日发现并修正）

**When:** Round 5 批次 0 二次分析（F20 修复、重评分之后）。
**Observed:** 重评分后四臂出现"显著差异"——三行引导 88.9% > 等长安慰剂 63.9%（Fisher
p=0.025），初判为"长无关注入有害"。逐任务 transcript 检查破案：长注入臂（安慰剂与技能，
400 率相同）的失败几乎全部是 provider 中途抛
`HTTP 400 "The request could not be rendered into a prompt for this model"`——9KB 注入 +
内容大的任务超出免费 provider 的提示渲染能力，episode 在第 6-7 轮死亡。按失败原因分层后：
行为层面四臂全在天花板（91–100%，treatment 甚至 0 行为失败），原"显著差异"整体消失；
真正的显著效应是注入长度与 400 率（长臂 23.7% vs 短臂 7.6%，p=0.0009）。
**Why a failure:** 预注册的 pass-rate 把"模型做不出"与"请求根本没被服务"混为同一格；
在容量受限的 provider 上，这个混合度量测的是 provider，不是模型。若止步于 p=0.025 的
臂间对比，本轮会第二次得出错误的行为学结论（第一次是 F20）。
**Fix:** 失败按原因分层（pass / infra-error / behavioral-fail）为分析的一级口径；
`status` 字段携带 `api_error` 前缀使分层可机判。
**Prevention rule (general):** *任何臂间行为比较之前，先把失败按原因分类；基础设施失败率
本身要作为独立结果报告（它可能是注入长度等设计属性的真实成本）。与 F13/F20 同族：基准先
证明它在测你想测的东西。*
**Generality:** likely general——一切跑在免费/限额 provider 上的 agent 评测；注入类 treatment
的"长度成本"从此多了一种计量方式：被杀死的 episode 比例。
