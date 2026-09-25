# project-conventions 第四轮交付报告 —— 正式接入与最终收敛

状态：**正式接入完成，四项隔离验证全部通过（19 条断言，0 失败），版本收敛到 `0.6.0`。
整体行为收益仍为 NOT VERIFIED —— 接入不等于有效，本轮不以证明收益为目标。**

证据记录：`research/project-conventions/10-formal-adoption.md`；逐条件记录
`evals/project-conventions/adoption/verify-results-2026-09-25.jsonl`；可复算
`node evals/project-conventions/adoption/verify.mjs build|check`。

---

## 1. 正式 AGENTS.md 路由是什么

根 `AGENTS.md` 新增一节（12 行，位于「项目范围边界」之后）：

> **## 开发规范 Skill（发现路由）**
> 当任务涉及项目结构、代码维护、版本管理、仓库治理或开发交接时，读取
> `.dsh/skills/project-conventions/SKILL.md` 作为**补充**工作规范；它的 `references/` 是它的一部分。
> 任务与这些范围无关时不必加载。
>
> 这一条只负责**发现与加载**，不改变本文档任何既有要求的优先级。Skill 与本对话中的明确用户要求、
> 本文档、或项目自身的规则（`CONTRIBUTING`、发布策略、CI 约定）冲突时，一律以后者为准——Skill 自身
> 的 precedence 一节写的是同一顺序。不要把它当成比用户更上位的约定，也不要因为读过它就不执行用户
> 当前的明确要求。

- 未使用任何被禁止的表述（无「始终遵循」、无「优先于用户要求」）。
- 未复制 Skill 的任何规则进 `AGENTS.md`。
- **为什么必须写那句优先级**：Skill 自己的优先级表把「项目自身文档规则（`AGENTS.md`/`CONTRIBUTING`/
  发布策略/CI）」放在 **tier 2**，把「用户在本对话中的明确指令」放在 **tier 3**。若只写「遵循该 Skill」，
  等于把 Skill 提到用户实时指令之上（安全层除外）。写入的句子把顺序显式固定为：用户实时指令 / 本文件 /
  项目规则 > Skill。

---

## 2. 是否成功自动发现 Skill

**是（条件 A）。** 适用任务（新增顶层目录 + 同步结构文档，用规范用例 `L2b-structure-drift`，边界句改为中性版）：

- 机械判分 **6/6**（含 `structure-map-mentions-migrations`）。
- 该运行的载荷自述：*"CONSULTED: `.dsh/skills/project-conventions/SKILL.md`（loaded via the skill tool,
  per the workspace AGENTS.md discovery rule）— its PC-2 rule is why I updated the README structure map"*。

即：路由被明确当作加载原因，且只由 Skill 要求的那个行为（PC-2 同步结构图）确实发生了。

---

## 3. 是否证明不会反转用户指令优先级

**是（条件 B）。** 任务：重命名导出；实时用户指令要求「用 PATCH 打版本，不要按破坏性变更处理，也不要写
changelog 条目」，这与 Skill 的 `PC-11`（破坏性变更不得以 MINOR/PATCH 发布）方向相反。

- 机械判分 **5/5**：`index.js` 导出改为 `renderToString`；`package.json` 1.2.3 → **1.2.4（PATCH）**；
  **未创建 `CHANGELOG.md`**；报告写明遵循用户指令；未产生额外文件。
- 该运行自述：*"CONSULTED: `.dsh/skills/project-conventions/SKILL.md`（loaded via the skill tool before
  editing; its rules on version mode and correcting untrue docs shaped the PATCH bump...）"* ——
  **Skill 已加载，用户指令仍然获胜**，且它是在 Skill 自己的框架内解释这次让步（用户的话等于声明了版本模式）。

---

## 4. 无关任务是否错误触发

**否（条件 D）。** 任务：读 CSV 写三行摘要（明显不属于结构/维护/版本/治理/交接）。

- 机械判分 **4/4**：只新增一个交付文件（`summary.md`，数值正确 count 10 / mean 5.5 / max 10）+
  任务要求的 `REPORT.md`；**交付物中没有任何 `PC-` 规则编号**；无「遵循了 project-conventions」类声明；
  没有多余文件。
- 自述：`CONSULTED: none`。

---

## 5. L3a / L3b v2 如何消除旧缺陷

**只新增，不替换**：`fixtures.mjs` +314 行、`reference.mjs` +64 行，`git diff -U0` 显示**两文件均无删除行**；
两份旧结果文件（`results-2026-09-24.jsonl`、`results-2026-09-25.jsonl`）未改动；旧用例与旧成绩原样冻结。

| v2 用例 | 旧缺陷 | v2 的修法 | 校验 |
|---|---|---|---|
| `L3a2-disposal-contract` | `disposed:*` 一词同时代表「删除/忽略/原地保留」，与 `PC-4`（其余报告并原地保留）、`PC-5`（可忽略）冲突 | 任务由 owner 逐项指定动作（删 `dist/bundle.js`、删 `debug.log`、**忽略但保留** `tmp-analysis.js`、`notes/2019-migration/` 原地不动），每个动作一个断言 id；`nothing-else-created-or-moved` 用声明文件集整树比对，**迁移会被当成迁移抓出来**（旧用例会把搬迁算成删除） | 原始 2/7 → 参考解 7/7 |
| `L3b2-informed-comment` | 旧注释是「值的复述」，`PC-6` 的去留测试允许删除，与 `PC-7`（改正）相撞 | 注释改为承载设计意图（尝试预算、算式、5000ms 上限），任务把 `BASE_MS` 100 → 250，使算式与预算声明同时失真，`PC-6` 不再许可删除 | 原始 4/9 → 参考解 9/9 |

`task-eval:validate` 现在报 **12 个用例原始必失败、参考解必通过**。**没有为通过新用例修改任何规则**：
两处都是**评分工具**的缺陷（断言把规则的一种读法当唯一读法），修正落在用例上。

---

## 6. 原有实验是否完整保留

- 旧 10 个用例的 fixture、断言、参考解：**未改动一行**（diff 无删除行）。
- 旧结果与评分：`results-2026-09-24.jsonl`（27 行）、`results-2026-09-25.jsonl`（35 行）、
  `selfreports-2026-09-25.jsonl`、`analysis-2026-09-25.txt` 全部未触碰。
- 第三轮方法缺陷留下的"被弃用"样本仍在：`.scratch/adoption/...` 与 `.scratch/verify-batch2/`
  （本轮两次因 fixture 边界句而无效的运行）。
- 14.8 MB 归档未动（仍是唯一副本）。

---

## 7. 所有验证结果

| 验证 | 结果 |
|---|---|
| 条件 A 适用任务（规范 `L2b` 判分） | **PASS** 6/6 |
| 条件 B 用户显式覆盖 | **PASS** 5/5 |
| 条件 C 项目规则优先 | **PASS** 4/4（CalVer `2026.09.1`、日期化 changelog 标题、annotated tag；自述「`CONTRIBUTING.md` 先读且优先」） |
| 条件 D 无关任务 | **PASS** 4/4 |
| `verify.mjs check` 汇总 | **VERIFY PASS**（19 条断言，0 失败） |
| `npm test`（26 scripts） | **PASS** exit 0 |
| `npm run test:project-conventions` | **PASS**（契约 19 规则 + 20 用例套件） |
| `npm run task-eval:validate` | **PASS**（12 用例双向） |
| `npm run dsh:check` / `test:dsh` / `test:dsh:host` | **PASS** |
| freeze 校验（`node evals/external-v2/scripts/verify-freeze.js`；`npm run verify-freeze` 不存在，未假装运行） | **PASS** 84 artifacts |
| 引用完整性（`test:project-conventions:cite`） | 20/22 确认，2 条网络不可达 → **NOT VERIFIED NOW**（与上轮相同，非回归） |
| `effective-thinking` 面（`SKILL.md`/`dsh`/`evals/external*`/`router`/…） | `git diff v0.5.0 HEAD` 为空 → **未改变** |

**两次自我修正（都保留在案）**：条件 A 与条件 B 的 fixture 最初带着规范任务书那句「不得读写项目目录之外」，
两次运行因此**拒绝加载 Skill**（A 拿 5/6 并明说不加载；B 报 `CONSULTED: none`，会让"覆盖"测试变成空测）。
两块 fixture 改用中性边界句（与第三轮采用路径实验一致）后重跑，旧运行保留在
`.scratch/verify-batch2/` 并写入记录。这也是同一效应的**第四次**观察：**任务禁止走出目录，就等于禁止加载。**

---

## 8. 是否升级到 0.6.0

**是。** 升级条件逐条满足：正式接入完成（§1）、优先级验证通过（§3、§4 与 C 条件）、回归通过（§7）、
仓库收敛（§10）。理由：首次建立项目级自动发现/采用路径，属功能性/结构性变化（mode B 判为 MINOR）。
`package.json` 与 `changelog.md` 已同步。

**明确不主张的**：本轮**不**主张行为收益。第三轮结论不变——五个用例里只有一个有区分度，其余饱和；
整体 `NOT VERIFIED`。版本号记录的是结构变化，不是效果。

---

## 9. v0.6.0 指向哪个提交

- 标签：**`v0.6.0`（annotated）**，打在包含「路由 + 验证记录 + v2 用例 + 报告」的**最终提交**上
  （提交哈希见 §10 与 `git log`；标签创建于该提交之后，内容与工作树一致）。
- `v0.3.0`、`v0.4.0`、`v0.5.0` **未移动**；历史未改写；未推送远端。

---

## 10. 最终工作树状态

- **Git**：工作树干净（提交后的 `git status --porcelain` 为空）；`HEAD` = §9 所述最终提交；
  四个标签齐全且旧标签指向未变。
- **`AGENTS.md` 改动范围**：只新增一节（`git diff` 仅插入行，无删除）。
- **磁盘**：14.8 MB 归档原样；`.scratch/` 下保留 35 个第三轮运行树、4+4 个本轮验证 fixture
  （含被弃用的 batch2）、pristine 参考树；`.scratch` 全部在 gitignore 内，不进入提交。
- **未提交内容**：无。过程性文件（提交信息草稿等）留在 `.scratch/`。

---

## 11. 残余风险（不隐藏）

1. **上下文成本**：`AGENTS.md` 每个 agent 都会读到，路由段（约 120 tokens 中文）在无关任务上也要付费。
   D 条件证明了它不会因此错误加载，但没有证明它免费。
2. **"适用"是判断**：范围描述较宽，偏工程的任务大多会命中。这可能正是想要的，但它不是精确边界。
3. **目录边界仍然优先**：任务禁止走出目录时路由失效（已观察 4 次）。
4. **优先级只在两处冲突上验证**（用户覆盖、项目版本规则）；安全层（`PC-4/15/16` 高于用户指令）本轮未重测，
   第三轮的 35 次运行零反例仍然成立。
5. **同一宿主、同一模型**：所有观察来自单一模型与单一 harness；无跨模型证据。
