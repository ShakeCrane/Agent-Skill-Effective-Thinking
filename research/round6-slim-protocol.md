# 第六轮迷你预注册：技能瘦身实验（Slim Injection Test）

**日期**：2026-10-25（第五轮终版当日之后启动；所有者以「继续」批准按第五轮建议顺序执行）
**动机（第五轮证据）**：9KB 注入（技能或安慰剂同罪）在免费 provider 上使 episode 的
HTTP-400 渲染失败率从 7.6% 升至 23.7%（p=0.0009）——技能体积是其唯一被证明有害的属性。
**问题**：把技能压缩到 ~1.2KB 是否消除该惩罚，且不损失行为质量？

## 设计

- 被试：`reflection/beam:free`（与第五轮同批条件漂移最小）。
- 语料：v2 冻结 12 任务 × 3 重复。
- 五臂（同一批内直接比较）：
  - `controlA` 裸跑 / `controlB` 三行引导（第五轮对照）；
  - `treatment` 原版 9230 字符冻结 SKILL.md（第五轮 treatment 原样）；
  - `slimControl` 瘦安慰剂（**1175 字符**，与瘦技能精确等长，同一仓储文本生成器）；
  - `slimTreatment` 瘦技能（**1175 字符**，sha256 `351c3dc9…78f28`，保留：三档策略判据、
    升级仅限具体失配/一次性/反复失败、验证阶梯与「反思不是证据」、停止条件）。
- 总量：12×5×3 = **180 runs**；评分与失败原因分层沿用第五轮终版口径（pass / infra-400 /
  behavioral-fail），`aggregate.mjs` 原样可用（新增臂自动进入盲映射）。

## 预注册假设与判定（先于 dispatch）

- **H1（主假设，基础设施）**：`slimTreatment` 的 infra-400 率 ≤ 10%（短臂基线量级），
  显著低于同批 `treatment`（预期 ~24%）。判定：Fisher 双侧 p<0.05 且方向一致。
- **H2（非劣性，行为）**：`slimTreatment` 剔 400 后通过率 ≥ 90%（不低于天花板带）。
- **H3（成本）**：`slimTreatment` 中位总 token 比 `treatment` 低 ≥60%（体积直接决定注入 token）。
- **探索性（不设显著性声明）**：slimTreatment vs slimControl 行为差（天花板下预期无差）。

## 处置（预注册）

- H1 成立 → 「瘦身消除容量惩罚」记为 validated 级证据；是否把瘦身文本升格为正式 SKILL.md
  是所有者决策（涉及 dsh 资产同步与冻结链，不自动执行）。
- H1 不成立 → 容量惩罚与长度无关或非线性，记失败日志并重审归因。
- H2 不成立 → 瘦身损失了行为质量，瘦技能弃用（rejected），体积-质量权衡写入报告。

## 冻结

本文件与 `slim-skill.md`（`351c3dc9…78f28`）、`slim-placebo.md`（`3023b75d…7202`）在首次
dispatch 前冻结；运行产物 `.scratch/r5/runs/batch6-slim/`。
