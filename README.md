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

目前实验中的基本模式包括：

```text
FAST
DELIBERATE
PROBE
ESCALATE
```

### FAST

任务：

- 明确
- 机械
- 局部
- 低风险
- 容易验证

直接执行。

---

### DELIBERATE

任务仍然适合当前模型，但需要更认真地：

- 理解
- 规划
- 比较
- 验证

之后再执行。

---

### PROBE

当前最大问题不是推理能力，而是：

> **缺少信息。**

先：

- 阅读文件
- 搜索资料
- 检查项目
- 查看日志
- 执行小测试

然后重新判断任务。

---

### ESCALATE

当前任务的真正瓶颈已经成为：

> **模型能力或推理质量。**

此时可以将困难部分交给更强或更适合的模型。

升级不意味着整个任务必须全部转移。

例如：

```text
Architecture / Hard Reasoning
        ↓
      GPTwork
        ↓
明确后的实现方案
        ↓
       dsh
        ↓
Coding / Tests / Batch Work
```

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

Agent 应在执行过程中重新判断。

例如出现：

- 连续失败
- 新的硬约束
- 项目结构与预期不同
- 无法可靠验证
- Patch 数量不断增加
- 需要新的架构决策
- 原本机械的问题变成复杂推理问题

可以动态进行：

```text
FAST → DELIBERATE

FAST → PROBE

DELIBERATE → PROBE

DELIBERATE → ESCALATE

PROBE → FAST

PROBE → DELIBERATE

PROBE → ESCALATE
```

同时也允许复杂分析结束后：

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

# Current Focus

当前第一阶段：

## Task / Model Routing

主要研究：

- Task Difficulty Estimation
- Model Capability Estimation
- Adaptive Reasoning Effort
- PROBE / Information Gathering
- Model Escalation
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
```

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

Experimental. Tested against DeepSeek Harness `0.1.1-rc.2` only — other DSH versions are unverified.
Availability and packaging are verified; **behavioural benefit is not**: both External Eval v1 and v2
met a ceiling effect on the tested agent (every condition solved every task), so no general
improvement of the full skill over a minimal scaffold has been demonstrated
(see [`reports/phase-2-v2-pilot.md`](reports/phase-2-v2-pilot.md)).

---

# Status

项目处于早期实验阶段。

当前机制和结构可能随着 Benchmark、失败案例和实际 Agent 工作持续调整。

除非经过明确实验验证，否则任何方法都不应被视为稳定的最佳实践。

---

## 最终目标

理想状态下，这个 Skill 应让 Agent：

> **理解得更准确，选择得更合理，质疑得更有效，验证得更充分，在真正困难的地方投入更多计算，并在长任务和多 Agent 工作中始终保持可控、清晰且可收敛的状态。**