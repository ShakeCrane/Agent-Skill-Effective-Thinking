# Cognitive Agent Skill

> **让 Agent 更有效地思考，而不是单纯思考得更久。**

Cognitive Agent Skill 是一个面向任意 AI 模型与 Agent 的实验性认知控制框架。

它试图解决一个实际问题：

> 当 Agent 面对复杂任务时，如何更准确地理解需求、判断任务难度、选择合适的思考与执行方式、主动验证结果、及时修正错误，并在长任务中维持稳定的上下文状态？

本项目不以生成更长的 Chain-of-Thought 为目标，也不假设“更多推理 Token = 更好的结果”。

目标是让有限的推理、工具调用和模型能力被用在**真正影响任务质量的位置**。

---

## 核心目标

希望 Agent 在真实任务中逐渐具备以下能力：

- **先理解，再执行**
- 识别真实目标、约束、假设和验收标准
- 判断任务的真实难度，而不是根据长度或术语数量判断
- 根据任务选择合适的思考强度
- 判断什么时候应该自己完成、什么时候先获取信息、什么时候升级模型
- 将复杂任务拆成适合不同 Agent 的子任务
- 主动寻找反例、替代方案和失败模式
- 使用测试、工具和外部证据验证结论
- 在有可靠反馈时进行自我修正
- 避免无意义的重复反思和过度思考
- 在长任务中主动维护和压缩上下文
- 在多 Agent 协作后重新收敛为一致状态
- 保持仓库整洁，避免实验和 Agent 工作过程污染正式项目

---

# 核心思想

## 1. Understand Before Acting

对于非简单任务：

```text
Task
 ↓
Understand
 ↓
Model
 ↓
Choose Strategy
 ↓
Execute
 ↓
Verify
 ↓
Update
 ↓
Compact
```

Agent 不应该：

```text
收到任务
→ 形成第一印象
→ 立即大量执行
→ 很晚才发现需求理解错误
```

应首先明确：

- Objective
- Hard Constraints
- Acceptance Criteria
- Confirmed Facts
- Assumptions
- Unknowns
- Risks
- Verification Strategy

简单任务不需要执行完整流程。

---

## 2. Adaptive Deliberation

不同任务不应该使用相同的“深度思考模板”。

Agent 应根据：

- 复杂度
- 不确定性
- 风险
- 可逆性
- 验证难度
- 信息完整度
- 当前模型能力
- 返工成本

动态选择方法。

可能的方法包括：

- Task Decomposition
- Constraint Analysis
- Counterexample Search
- Falsification
- Alternative Hypotheses
- Premortem
- Multi-solution Comparison
- Independent Review
- Tool-assisted Verification
- Adversarial Testing
- Information Gain Analysis

这些方法不会因为理论上听起来合理就自动进入正式 Skill。

它们必须经过实验验证。

---

# Task Router

当前项目的第一阶段重点是建立：

> **Task / Model Router**

Agent 在开始执行任务前，判断应该采用什么模式。

## Current Architecture

Router 输出的是**两个正交维度**，不是一套单一模式阶梯（实现见 [`router/task-router.js`](router/task-router.js)，
与 [`SKILL.md`](SKILL.md) 一致）：

```text
strategy      = fast | structured | deep          # 应该思考/规划多少
model_action  = keep | upgrade | delegate         # 是否更换执行模型
```

两个维度由不同的信号驱动，可以任意组合：

- **strategy** 由复杂度、验证难度、歧义、约束冲突、上下文规模等决定；
- **model_action** 由「具体能力不匹配 / one-shot 高风险 / 反复失败 / 可并行拆分」决定。

例如一个任务可以是 `fast/keep`（机械且低风险）、`deep/upgrade`（难推理且反复失败），
也可以是 `deep/keep`（高风险但当前模型足够，重点是认真验证）、`structured/delegate`（可并行拆分）。

> **升级是 mismatch 决策，不是 difficulty 决策。** 任务长、术语多、看起来陌生，都不构成升级理由。

### Strategy

**fast** — 直接执行。

任务明确、机械、局部、低风险、容易验证、可逆。最小规划，直接做，做一次快速验证。
不要为了显得思考充分而制造分析。

**structured** — 轻量计划 + 验证。

中等复杂度：多步骤、若干约束、需要一些规划或检查，但不需要深度取舍分析。
开始前至少明确：**Objective · Hard Constraints · Assumptions · Plan · Verification**，保持简短。

**deep** — 深度审议。

高复杂度、高风险、架构 / 根因 / 方法设计、多个相互作用的约束、难以直接验证、需求模糊。
按需使用：任务分解、替代方案、反例搜索、最强反对意见、假设检查、外部证据、独立评审、对抗测试。

### Model Action

**keep** — 当前模型继续执行（默认姿态：在足够质量下使用最低合理成本）。

**upgrade** — 仅在存在**具体不匹配**时：

- 当前模型能力与任务要求的具体差距；
- one-shot 且不可逆、难以事后验证的判断；
- 反复尝试仍然失败（`failures_so_far` 达到阈值）——失败是经验证据，不是猜测；
- 长程上下文一致性关键、复杂因果推理或大量相互作用约束。

**delegate** — 存在可并行的独立单元，适合拆分给多个执行者。
one-shot 判断优先于并行委派：单个不可逆决策不应该被 fan out。

同时支持**降级（de-escalate）**：如果一个任务已经足够明确、机械、可验证，
可以交给更便宜的模型——**但只有在当前模型本身是强模型时才建议**（否则已经没有可降级的空间）。

### Notes on older terminology

历史文档中出现过一套更早的 taxonomy（`FAST` / `DELIBERATE` / `PROBE` / `ESCALATE`）。
它与当前实现并不是同一层次的概念，保留仅用于理解演进：

- **DELIBERATE** ≈ 当前的 `structured` + `deep`（审议强度被拆成了两档）；
- **PROBE**（先收集信息）是**执行过程中的动作**，不是独立的 router strategy：
  它通常表现为 `structured` 或 `deep` 下的一个执行步骤，而不是 router 的输出；
- **ESCALATE** 是当前的 `model_action = upgrade`，属于模型维度，不是审议策略。

如果继续引用旧术语，必须明确标注为历史演进，不得当作 Current Architecture。

---

# Model / Agent Routing

本项目特别关注多模型环境下的动态协作。

当前实践中的典型角色：

### Web GPT

负责：

- 理解用户目标
- 判断任务性质
- Task Routing
- Prompt 生成
- 方案审核
- 实验设计
- 最终收敛

### GPTwork

优先处理：

- 高复杂度问题
- 高不确定性问题
- 架构设计
- 跨文件理解
- 困难调试
- 关键方案取舍
- 高质量要求任务

### dsh

优先处理：

- 机械化 Coding
- 批量修改
- 搜索与资料初筛
- 测试
- Benchmark
- 文件整理
- 明确规则下的重复执行

核心原则：

> **强模型负责认知瓶颈，快速 Agent 负责执行瓶颈。**

而不是简单使用：

```text
大任务 → 强模型
小任务 → 弱模型
```

任务很长可能只是机械。

任务很短也可能包含困难的架构决策。

---

# Dynamic Re-routing

路由不是一次性的。

Agent 应在执行过程中重新判断。实现见 [`router/adaptive-loop.js`](router/adaptive-loop.js)：
它把执行结果反馈回 router（`failures_so_far`、新信息），在阈值处重新路由。

例如出现：

- 连续失败
- 新的硬约束
- 项目结构与预期不同
- 无法可靠验证
- Patch 数量不断增加
- 需要新的架构决策
- 原本机械的问题变成复杂推理问题

两个维度都可以在执行中改变：

```text
strategy:      fast → structured → deep
model_action:  keep → upgrade
               keep → delegate
```

**反复失败是最强的重新路由信号**：它会同时推动 strategy 变深和 model_action 升级
（`failures_so_far` 达到阈值时），因为连续失败本身就是「当前任务模型或当前模型不匹配」的经验证据。

重路由同时受两个**互相独立**的预算约束（不要混为一谈）：

- **execution attempt budget**：`execute()` 最多被调用多少次；用尽即终止，
  stop reason 为 `execution: attempt budget exhausted`；
- **deliberation budgets**（[`strategies/stopping.js`](strategies/stopping.js)）：deep 策略何时停止审议
  （证据充分 / 连续多轮没有新信息 / 审议尝试上限）。

execution attempt budget 用尽时，结果是 `done === true`、`success === false`——
它表示「在允许的尝试次数内没有成功」，而不是「思考结束了」。

同时也允许复杂分析结束后把明确的执行工作交回快速 Agent：

```text
GPTwork
   ↓
问题已经明确
   ↓
dsh
```

避免强模型承担后续大量机械执行。

---

# Verification Before Confidence

本项目遵循：

> **Reflection is not evidence.**

“重新想了一遍”不是可靠验证。

验证优先级通常为：

1. 真实测试或直接观察
2. 编译器 / Runtime / Formal Check
3. 权威一手资料
4. 独立计算
5. 多来源证据
6. 独立 Reviewer
7. 模型自评

如果存在可靠、便宜的外部验证方式，应优先验证，而不是继续生成推理。

---

# Controlled Self-Correction

自我修正不是无条件执行。

错误的 Critic 可能：

- 推翻正确答案
- 引入新的错误
- 制造虚假的不确定性
- 导致无限反思

因此项目重点研究：

```text
When to reflect?
What feedback should trigger revision?
When should the original answer be preserved?
When should deliberation stop?
```

目标不是增加反思次数，而是提高：

> **每次额外推理带来的有效信息增益。**

---

# Context Management

长任务中，Agent 必须把上下文视为有限工作记忆。

持续维护：

```text
OBJECTIVE

HARD CONSTRAINTS

CONFIRMED FACTS

ASSUMPTIONS

DECISIONS

CURRENT PLAN

PROGRESS

VERIFICATION

FAILED ATTEMPTS

OPEN QUESTIONS

NEXT ACTIONS
```

核心规则：

> **完整保留最新计划，旧计划和制定计划的过程可以压缩。**

跨 Agent 交接时，优先传递当前有效状态，而不是复制完整历史对话。

---

# Repository Convergence

另一个核心原则是：

> **探索可以发散，仓库必须收敛。**

Agent 的工作过程不应该污染正式仓库。

避免无必要地留下：

- 临时 Markdown
- 中间报告
- 一次性脚本
- Debug 文件
- 重复实现
- Agent 独立工作日志
- 被淘汰的候选方案
- 无长期价值的实验产物

复杂任务结束前应执行一次 **Convergence Pass**：

```text
Inspect
 ↓
Compare
 ↓
Select
 ↓
Merge
 ↓
Verify
 ↓
Cleanup
 ↓
Converge
```

最终仓库应该比执行前：

> **更明确，而不是更混乱。**

---

# Multi-Agent

如果执行环境支持：

- Agent Teams
- Subagents
- Parallel Agents
- Worker Agents
- Independent Reviewer

并且确实能够提高任务质量，应主动使用。

适合并行处理：

- 不同方案探索
- 独立资料研究
- Benchmark
- 反例搜索
- 独立 Review
- 测试
- 批量执行

但：

> **多个 Agent 可以产生多个候选结果，最终项目只能收敛成一个一致状态。**

主 Agent 负责：

```text
Decompose
→ Delegate
→ Compare
→ Verify
→ Decide
→ Merge
→ Cleanup
```

多 Agent 本身不是目标。

只有产生实际收益时才应该使用。

---

# Method Admission

任何新的 Cognitive Method 都必须经过：

```text
Discover
 ↓
Source Evaluation
 ↓
Mechanism Extraction
 ↓
Benefit Analysis
 ↓
Failure Analysis
 ↓
Applicability Analysis
 ↓
Cost Analysis
 ↓
Minimal Implementation
 ↓
Baseline Comparison
 ↓
Adversarial Test
 ↓
Decision
```

方法状态：

```text
candidate
experimental
validated
core
rejected
```

只有明确知道：

- 为什么有效
- 在哪里有效
- 在哪里无效
- 成本是多少
- 什么时候启动
- 什么时候停止

之后，才应该进入 `core`。

---

# Evaluation

所有重要机制都应该与 Baseline 对比。

关注：

- Requirement Recall
- Constraint Violation Rate
- Accuracy
- Hallucination Rate
- First-pass Quality
- Rework Count
- Tool-call Efficiency
- Verification Quality
- Context Retention
- Token Cost
- Latency
- Routing Accuracy
- Overthinking Rate
- Over-escalation Rate
- Late-escalation Rate
- Subtask Assignment Quality

特别保留：

> **Skill 让模型表现变差的案例。**

这些失败案例是项目的重要资产。

---

# 项目结构

## 当前结构（以真实仓库为准）

这是**实际存在**的目录及其职责。修改目录后必须同步更新本节（`project-conventions` skill 的
PC-2）。**条目以 `v0.3.0` 标签为准**（该标签不变，因此这个数字可长期复核）：

```bash
git ls-tree -r --name-only v0.3.0 | wc -l                              # 323 个文件
git ls-tree -r --name-only v0.3.0 | cut -d/ -f1 | sort -u | wc -l      # 23 个顶层条目
```

当前工作树的文件数会随提交增长（本节首次写就后已增长两次），所以**不要引用工作树的数字** ——
引用标签。这正是"计数必须写明口径"的意义：审计时 `reports/session-01.md` 的数字之所以被判为
过期，不是因为它错了，而是因为它没有写口径，因此没有人能复核它。

```text
.
├── AGENTS.md                  agent 工作规则、方法准入流程、上下文管理
├── SKILL.md                   effective-thinking 的规范正文（唯一真源）
├── README.md                  项目说明；本结构图所在处（项目理解文件）
├── changelog.md               按轮次记录的变更历史
├── package.json               npm 清单：测试链、发布契约、DSH 打包声明
├── index.js                   公开库 API（require('./') 即整个 skill）
├── LICENSE                    MIT（与 package.json 声明一致）
├── .gitattributes             规范换行；保护哈希冻结与字节级资产
├── .gitignore                 忽略策略：agent 运行产物、缓存、打包产物、临时目录
│
├── .dsh/skills/               宿主自动发现的项目内 Skill（每个子目录一个独立 Skill）
│   └── project-conventions/   项目开发行为规范 Skill（与本包相互独立，见下节）
│
├── .github/workflows/         CI：无宿主契约门禁 + 打包校验
├── bin/                       CLI：router / self-audit / consume-pack
├── dsh/                       effective-thinking 的 DSH 插件适配层（provider + 打包资产）
├── docs/                      子系统文档（dsh-integration）
├── evals/                     验证与回归
│   ├── *.js                   26 个测试链脚本 + 3 个链外脚本
│   ├── external/              External Eval v1 冻结语料
│   ├── external-v2/           External Eval v2 冻结语料（84 个哈希冻结产物）
│   └── project-conventions/   契约测试、引用核验、问答用例、task-eval/ 任务级评测与保留结果
├── failures/                  失败日志（F1–F17）
├── methods/                   方法状态卡：core/ 与 experimental/
├── multi-agent/               编排：fan-out / 独立评审 / 收敛
├── reports/                   阶段性报告（session-01 为当前状态报告）
├── research/                  研究记录
│   └── project-conventions/   01–08：五个证据簇、仓库审计、两轮行为评测
├── router/                    路由核心：extract / task-router / capabilities / calibrate / adaptive-loop
├── scripts/                   DSH 资产同步与漂移检查
└── strategies/                执行策略：protocol / stopping / cost / certainty / verify
```

被忽略、不在版本控制内：`AI-Runs/`（前次自主运行的原始工件，14.8 MB，保留为证据而非项目内容）、
`node_modules/`、`*.tgz`、`__pycache__/`。忽略策略见 `.gitignore`。

## 目标结构（尚未实现，仅为方向）

项目预计逐步发展为：

```text
.
├── AGENTS.md
├── SKILL.md
├── README.md
│
├── methods/
│   ├── candidate/
│   ├── experimental/
│   ├── validated/
│   ├── core/
│   └── rejected/
│
├── profiles/
│   ├── glm-5.3-flash.md
│   ├── dsh.md
│   ├── gptwork.md
│   └── ...
│
├── routing/
│   ├── task-router/
│   └── escalation/
│
├── evals/
│   ├── tasks/
│   ├── baselines/
│   ├── regressions/
│   └── results/
│
├── failures/
├── research/
├── context/
└── changelog/
```

这是目标结构而不是强制结构。

> 不应为了架构完整而创建没有实际用途的目录和文件。

仓库结构应随着真实需求逐步形成。

---

# 第二个 Skill：`project-conventions`

本仓库同时承载第二个、**相互独立**的 Skill：项目开发行为规范。它与 `effective-thinking` 没有
依赖关系，也不修改后者的任何文件。

```text
.dsh/skills/project-conventions/
├── SKILL.md                    规范正文（19 条规则，5 个触发闸门）
└── references/
    ├── rules.md                每条规则的完整记录 + 新增规则的准入流程
    └── evidence.md             证据强度、未证实清单、复核方法
```

- **它是什么**：在「放文件、清临时文件、写代码与注释、提交/版本/打标签/回滚、对用户提问或汇报」
  这五个时刻约束 agent 行为的规则集。每条规则带 `class`（HARD/DEFAULT/WHEN/PREFERENCE/HYPOTHESIS）
  与 `evidence`（strong/moderate/weak/none）；未证实的偏好不会被写成已验证的规则。
- **怎么被发现**：DSH 的文件系统 skill provider 在 rank 100 扫描 `<项目根>/.dsh/skills`，识别
  `<name>/SKILL.md` 目录包。无需改动 `dsh/` 适配层，也无需重启——本会话已实测（写入后出现在
  catalog 中，删除后立即消失）。
- **怎么验证**：

  ```bash
  npm run test:project-conventions        # 契约测试：规则集一致、词表、预算、链接、编码、失效规则引用
  npm run test:project-conventions:cite   # 重新抓取每条引用并核对其原始语句（需要网络）
  npm run task-eval:validate              # 任务级用例自校验：原始状态必失败、参考解必通过
  npm run task-eval:score -- <runsDir>    # 对一批真实运行留下的仓库状态评分
  ```

  这几条**不在** `npm test` 链内：`npm test` 是 `effective-thinking` 的冻结发布契约，把第二个
  Skill 的检查塞进去会改变它的含义。两个 Skill 各自拥有独立的验证命令。
- **状态**：`experimental`。契约（结构、规则集一致性、引用可核验性）已机器验证；**行为收益未验证**。
  两轮独立评测都撞上天花板：问答式套件 20 题几乎全对；任务级评测 baseline 与 skill 均为
  **59/61 断言**（修掉一处评分标准缺陷后为 **60/62**），十个用例里八个无差异，保留集 4/4 双方全解。
  唯一确认的行为差异是「改动使注释失真时是否顺手修正」：baseline 0/2、skill 2/2——但该差异来自规则澄清
  **之前**的 skill 文本，澄清本身至今没有任何一次运行读过，因此只算「已观察到的差异」，不算「已验证的修改」。
  补跑的触发条件还显示：**在 catalog 中但不被点名时，它不会自己触发**——三个有区分度的用例上行为与
  baseline 一致，11 次 skill 报告中有 3 次引用规则编号，baseline 0/11、trigger 0/3。因此目前的结论
  只适用于「被点名遵循时的 skill」，而不是「已安装的 skill」；要用它，必须由 `AGENTS.md`、包装层或
  用户点名。该臂只有 3 次运行，且「引用编号」只测是否点名规则、不测是否加载，结论按这个强度读。
  轮末对抗性复核又发现 9 处问题（含一处引用了并不存在的运行记录），其中一处修改了评分标准并迫使
  `H3` 用例在两条臂上重跑；全部处置与负面结果见
  [`research/project-conventions/08-task-level-evaluation.md`](research/project-conventions/08-task-level-evaluation.md)，
  中文交付报告见 [`reports/project-conventions-round2.md`](reports/project-conventions-round2.md)。

---

# Current Focus

当前第一阶段：

## Task / Model Routing

主要研究：

- Task Difficulty Estimation
- Model Capability Estimation
- Adaptive Reasoning Effort
- Information Gathering / Probing（执行过程中的动作，不是独立 strategy）
- Model Escalation（`model_action = upgrade`）
- Dynamic Re-routing
- Subtask Routing
- Cost / Quality Trade-offs

重点解决：

> Agent 如何知道什么时候应该直接执行，什么时候应该认真思考，什么时候应该先获取信息，以及什么时候应该把困难部分交给更强模型？

---

# Project Philosophy

这个项目不追求：

> 一个看起来非常聪明、非常复杂的 Prompt。

它追求：

> 一套可以被测试、失败、修正和逐渐验证的 Agent Cognitive System。

我们更关心：

```text
Did it understand better?

Did it choose better?

Did it verify better?

Did it recover from mistakes?

Did it use the right model?

Did it preserve the right context?

Did it finish with a clean state?
```

而不是：

```text
Did it think for longer?
```

---

# DeepSeek Harness

本仓库同时是一个 **DSH 原生插件包**：通过 DSH 自己的 Skill Registry 暴露 `effective-thinking`，
catalog 只展示摘要，完整 Skill 正文在模型或用户真正选择时才加载。

Design: one source project, one skill source of truth (`SKILL.md`), one thin adapter (`dsh/`).
The plugin is a pure provider — no always-on prompt injection, no automatic routing, no model
switching. See [`docs/dsh-integration.md`](docs/dsh-integration.md).

### Install from local checkout

```bash
dsh plugin --profile <profile> add /absolute/path/to/Agent-Skill-Effective-Thinking
# or from a packed tarball:
npm pack && dsh plugin --profile <profile> add /absolute/path/to/cognitive-agent-skill-<version>.tgz
```

`dsh plugin add` reconciles `dsh.profile.bundles` automatically (the package declares
`dsh.bundle.patch`), so no profile file needs hand-editing.

### Verify

```bash
dsh --profile <profile> --dump-config   # bundle layer + exactly one loader row
npm run dsh:check                       # packaged skill has not drifted from SKILL.md
npm run test:dsh                        # plugin contract test (manifest, sync, provider, unload)
npm run test:dsh:host                   # STRICT: fails if no real DSH host is installed
```

### Release contract

分层的发布契约——普通构建**不要求**机器上安装 DSH：

| command | 保证什么 | 没有 DSH host 时 |
|---|---|---|
| `npm test` | frozen Phase 1 回归链（26 个 eval 文件） | PASS（不依赖 host） |
| `npm run dsh:check` | 打包的 skill asset 与 `SKILL.md` 未漂移 | PASS（纯静态） |
| `npm run test:dsh` | DSH 打包 + provider 契约；静态检查始终执行 | 静态 PASS，provider **SKIP**，exit 0 |
| `npm run test:dsh:host` | 同上，但**必须**使用真实 DSH registry（`get`/`unload`/`reload`） | **FAIL**（exit ≠ 0） |
| `npm run release:check` | `npm test` + `dsh:check` + `test:dsh`：可复现的 release 检查 | PASS |
| `npm run release:verify` | `test:dsh:host` + `release:check`：真实 host 集成 gate | FAIL（这是发布前的最终 gate） |

`prepack` 运行 `npm run release:check`，所以普通 `npm pack` 在没有 DSH 的环境也能完成并验证包内容。
**不会**把外部全局 DSH 安装要求偷偷塞进普通 npm lifecycle；需要真实 host 的检查只在 `release:verify`
（以及 CI release job，如果它安装了 pin 版本的 DSH）中执行。

### Use

The skill appears in the agent's skill catalog as `effective-thinking`; the model loads it when a
task warrants it, and a user can invoke it explicitly:

```text
Use $effective-thinking to handle this task.
```

### Remove

```bash
dsh plugin --profile <profile> remove cognitive-agent-skill
```

### Status

Experimental. Verified against DeepSeek Harness `0.1.1-rc.2` and, on 2026-09-24,
`0.1.5-rc.1` — `npm run test:dsh:host` passes all 21 host checks on the latter (registry mount,
catalog entry, `get`, `unload`, `reload`). Other DSH versions remain unverified.
Availability and packaging are verified; **behavioural benefit is not**: both External Eval v1 and v2
met a ceiling effect on the tested agent (every condition solved every task), so no general
improvement of the full skill over a minimal scaffold has been demonstrated
(see [`reports/phase-2-v2-pilot.md`](reports/phase-2-v2-pilot.md)).

---

# 版本与发布

## 版本模式

本仓库采用 **(B) house scheme**，并在此明确声明——这不是 SemVer 兼容性承诺。

`package.json` 的 `exports` 确实构成一个公开 API，但版本一直是 `0.y.z`。SemVer 2.0.0 对 `0.y.z` 的
规定是 "Major version zero (0.y.z) is for initial development. Anything MAY change at any time. The
public API SHOULD NOT be considered stable." —— 即此阶段不承诺任何兼容性。在此之前本仓库从未声明过
自己属于哪种模式，因此每一个版本号含义都是任意的。

- 数字按**规模**语义递增（项目所有者约定）：重大功能与重大重构 → MAJOR；功能性或结构性调整 → MINOR；
  文档与小任务 → PATCH。
- **数字不构成兼容性承诺。** 依赖本包时请假定任何升级都可能包含破坏性变更；需要稳定接口时固定到具体
  commit 或 tarball，而不是版本区间。
- 有两条底线不受上述约定影响：**破坏性变更不得以 MINOR/PATCH 发布**；已发布的版本与标签不可改写。
- 若将来要真正声称 SemVer 兼容，必须先声明公开 API、改由兼容性（而非规模）决定数字，并同时改写本节。

## 恢复点

版本号不是恢复点；恢复点是有名字的标签。

- 发布 = 在通过 `npm run release:check`（有真实 DSH 宿主时再加 `release:verify`）的提交上打
  **annotated tag**。
- 已发布的标签不可移动、已发布版本的内容不可修改，只能前向修复。
- 回滚使用 `git revert`（不是 `git reset`），在组成提交层面进行，并在提交信息中记录原因。

## 历史

`0.2.0` 自首次提交起从未变动，且此前**没有任何标签**——也就是说在本节写入之前，本仓库无法回答
"`0.2.0` 对应的究竟是哪一棵树"。首个真实恢复点是 `v0.3.0`。详见 `changelog.md`。

---

# Status

项目处于早期实验阶段。

当前机制和结构可能随着 Benchmark、失败案例和实际 Agent 工作持续调整。

除非经过明确实验验证，否则任何方法都不应被视为稳定的最佳实践。

---

## 最终目标

理想状态下，这个 Skill 应让 Agent：

> **理解得更准确，选择得更合理，质疑得更有效，验证得更充分，在真正困难的地方投入更多计算，并在长任务和多 Agent 工作中始终保持可控、清晰且可收敛的状态。**