# Repository audit — target repo baseline and findings

Scope: the repository that is also the target of the maintenance work — `<repo root>`
(git root = working directory, branch `integration/dsh-plugin`, HEAD `c868111`).

All findings below are backed by a command a reader can re-run. No finding is recorded from inference
where a measurement was available. Anything I could not confirm is marked `UNVERIFIED` and excluded
from the action list.

Evidence classes used: `measured` (I ran it in this session) · `documented` (a file in the repo says
so) · `inferred` · `unknown`.

---

## 0. Baseline (Phase 0)

| Item | Value | How measured |
|---|---|---|
| Working directory | `<repo root>` | `pwd` |
| Git root | same directory | `git rev-parse --show-toplevel` |
| Branch | `integration/dsh-plugin` | `git rev-parse --abbrev-ref HEAD` |
| HEAD | `c868111a59ca640eadcc46603636f9caddc88298` (2026-09-13 16:54:49 +0800) | `git log -1` |
| Commits / branches | 8 commits; `master`, `integration/dsh-plugin`, `phase2-external-behavioral-eval`; remote `origin` = GitHub `ShakeCrane/Agent-Skill-Effective-Thinking` | `git rev-list --count`, `git for-each-ref`, `git remote -v` |
| Tags | **none** | `git tag` (empty) |
| Tracked files | 299, across 21 top-level entries | `git ls-files` |
| Package version | `0.2.0` — unchanged in **every** commit that touched `package.json` | `git show <c>:package.json` for all 8 commits |
| Pre-existing uncommitted work | **none tracked**. Two untracked entries: `AI-Runs/` and `nul` | `git status --porcelain --untracked-files=all` |
| Baseline test state | green | `npm test` → 26 scripts, exit 0 |

Existing Skill in the repo: `effective-thinking` — canonical body `SKILL.md` (root), packaged asset
`dsh/skill/effective-thinking.md`, adapter `dsh/`. Out of scope for modification (see §4).

Project-understanding documents already present: `README.md` (overview + intended structure),
`AGENTS.md` (agent rules + intended structure), `reports/session-01.md` (consolidated final-state
report), `docs/dsh-integration.md` (one subsystem). No separate structure document is created — the
existing ones are corrected instead (avoids the duplicate-document failure mode).

---

## 1. Findings

Severity: **P0** data-safety/correctness/severe risk · **P1** long-term maintenance & recovery ·
**P2** clear structure/documentation defects · **P3** optional.

### P0 — none

Explicitly: no data-loss, security, correctness, or irreversible-risk defect was found in the tracked
tree. Checks run and their results:

| Check | Command | Result |
|---|---|---|
| Temp / debug / scratch files in tracked tree | `git ls-files` filtered on `tmp\|temp\|scratch\|debug\|old\|bak\|untracked\|*.bak\|*.orig\|*.pyc\|~$` | **no matches** |
| Oversized tracked files (> 200 KB) | size scan over `git ls-files` | **none** |
| Secrets in tracked tree | `git grep -n -I -E 'api[_-]?key\|secret\|password'` | only eval-fixture content for the redaction test (`evals/external-v2/pilot/v2-01-redaction/`) and a docs table row; **no credentials** |
| Duplicate implementations across real source | manual responsibility review of `index.js`, `router/`, `strategies/`, `multi-agent/`, `bin/`, `scripts/` (18 files, ~1.8k lines) | responsibilities are distinct and non-overlapping; no superseded implementation found |
| LRU / comment accuracy sweep | comment scan across real source for counts and referenced paths | all referenced paths exist; **one** stale count (§1.6) |

---

### P1-1 — Agent run artifacts (14.8 MB) accumulated inside the repository, with no ignore policy

**Evidence (`measured`, 2026-09-24).**

```
AI-Runs/ : 3653 files, 1920 directories, 14.8 MB
           includes 27 nested .git repositories and 104 __pycache__ directories
git status --porcelain --untracked-files=all : 2170 entries
Test-Path .gitignore : False
git grep -n "AI-Runs" -- . : no tracked file references it
```

**Why it is a defect, not just untidiness.** The repository states the opposite policy about itself:

- `AGENTS.md` → *"探索可以发散，仓库必须收敛"*, and `README.md:395-414` lists the exact things that
  must not be left behind: *临时 Markdown / 中间报告 / 一次性脚本 / Debug 文件 / Agent 独立工作日志*.
- The generating run itself intended to stay outside the tree. `AI-Runs/overnight-20260913/FARM_STATE.md:11`
  declares *"主工作树禁止写入/污染；实验一律在 `D:\AI-Runs\overnight-20260913\`"*.

**Documentation-vs-reality drift found in the same artifact.** `AI-Runs/overnight-20260913/MORNING_REPORT.md:5`
and `:148` both state the artifact root is `D:\AI-Runs\overnight-20260913\`.
`Test-Path D:\AI-Runs` → **False**. The only copy is inside the repository. So the prior run's own
report mis-states where its evidence lives — a reader following the report would not find it.

**Impact.** Untracked-but-unignored mass makes `git status` unreadable, makes any `git add -A` /
`git clean` decision dangerous, and leaves 27 nested repositories inside the project tree. It is also
exactly the failure this project's own convergence rule exists to prevent.

**Fix applied (low risk).** Add a minimal `.gitignore` so agent-run scratch can never be staged,
documenting *why* rather than silently hiding it.

**Deliberately NOT done, and why.** The 14.8 MB tree is not deleted. It contains the primary evidence
of a 7.8-hour behavioural evaluation (76 blind reviews, machine-readable `synthesis/*.jsonl`). Deleting
another agent's test evidence is an irreversible action the task rules forbid without confirmation
(*"不要删除用途不明的文件"*, *"不要清除重要测试证据"*). Its purpose is now known and recorded; its
disposition is raised as an open decision in the final report.

**Risk of the fix:** none (adding an ignore file changes no tracked content).
**Verification:** `git status --porcelain` returns only intended changes; `git status --porcelain --untracked-files=all` no longer lists `AI-Runs/`.

---

### P1-2 — No reliable recovery point: the version number never moved, and there are zero tags

**Evidence (`measured`).**

```
git show <commit>:package.json | grep '"version"'   for all 8 commits  ->  "0.2.0" every time
git tag     -> (empty)
```

The commits that changed `package.json` are:

```
dcf5e41  建立 Cognitive Skill 首个实验性基线            (initial, version 0.2.0)
bdab27f  integration: 增加 DeepSeek Harness 原生 Skill 插件适配层   <- functional/structural change
810aa81  fix: 修复 adaptive-loop 执行预算语义、extractor 高风险遮蔽与 DSH 发布契约
c868111  fix(release): 将核心回归纳入发布门禁
```

**Impact.** The repository cannot answer "which exact tree is `0.2.0`?" — there is no tag and the
number has been constant since the first commit, while a whole integration layer was added afterwards.
This directly defeats the user's stated requirement that version management support reliable rollback,
and violates their own preference that the three version levels each have a distinct role.

**Fix applied.** Bump the version to match the accumulated unreleased changes and create an annotated
tag at the current HEAD as a real recovery point. No history is rewritten; nothing is pushed.

**Risk:** low — additive only. **Verification:** `git tag` lists the new tag, `git rev-parse <tag>^{commit}`
resolves to the release commit, and the version string agrees across `package.json` and `changelog.md`.

---

### P2-1 — The project-understanding documents do not describe the actual repository

**Evidence (`measured` + `documented`).** `README.md:564-609` ("项目结构") and `AGENTS.md`
("建议目录") both present a tree containing paths that **do not exist**:

| Documented | Reality |
|---|---|
| `methods/candidate/`, `methods/validated/`, `methods/rejected/` | only `methods/core/` and `methods/experimental/` exist |
| `profiles/` | absent |
| `routing/task-router/`, `routing/escalation/` | the real directory is `router/` (flat) |
| `context/` | absent |
| `changelog/` (directory) | `changelog.md` (file) |
| `evals/tasks/`, `evals/baselines/`, `evals/regressions/`, `evals/results/` | real: `evals/` (29 scripts) + `evals/external/` + `evals/external-v2/` |

Undocumented but real: `bin/`, `docs/`, `dsh/`, `multi-agent/`, `reports/`, `scripts/`, `strategies/`.

**Nuance, recorded honestly.** Both documents label the tree as aspirational
(`README.md:603` *"这是目标结构而不是强制结构"*). So this is not a false statement — but there is
**no** document anywhere that maps the *current* tree, so no reader (human or agent) can navigate the
repository from its own docs. The task requires the project-understanding file to keep an accurate
structure diagram, so the gap is real regardless of the aspirational labelling.

**Impact.** Navigation cost and doc-drift risk; agents act on a structure that is not there.
**Fix applied.** Add an accurate current-structure map with per-directory responsibilities to
`README.md`, cross-checked entry-by-entry against `git ls-files`; leave the aspirational tree in place,
still labelled as the target.
**Risk:** low (documentation only). **Verification:** every path in the new map resolved against the
working tree; every existing top-level directory appears in the map.

---

### P2-2 — Stale current-state inventory numbers in the consolidated report

**Evidence (`measured`).** `reports/session-01.md:15` and `:139` state the converged tree is
"69 files, 9 dirs". Measured now: **299 tracked files** across **21 top-level entries / 14 directories**.
The report is explicitly maintained as a *current-state* document (Sessions 47 and 52 updated its
numbers), so a reader is entitled to trust these figures.

**Nuance.** 214 of the 299 files are frozen evaluation corpora (`evals/external-v2` 139,
`evals/external` 75). The 69-file figure may have been produced under a different counting rule that
the report never states — which is itself the defect: **the claim is not reproducible**, because the
rule is not written down.

**Fix applied.** State the counting rule and the measured number, or scope the claim explicitly.
**Risk:** low. **Verification:** re-run the inventory command quoted in the corrected text.

---

### P2-3 — The DSH compatibility claim is narrower than the verified reality

**Evidence (`measured`).** `README.md:733` and `docs/dsh-integration.md:100-110` state the package was
tested against DeepSeek Harness `0.1.1-rc.2` only and that "other DSH versions are unverified". The
DSH actually installed on this machine is **`0.1.5-rc.1`**.

Running the repository's own strict host gate against that host:

```
npm run test:dsh:host   ->   DSH PLUGIN CONTRACT TEST PASS (exit 0)
```

All 21 checks pass, including registry mount, catalog entry, `get`, `unload` and `reload`.

**Impact.** A real, newly-verified compatibility fact is missing, and the document currently
understates the package. **Fix applied.** Record the second verified host version.
**Risk:** none. **Verification:** the command above, exit 0.

---

### P3-1 — 0-byte Windows reserved-name artifact `nul`

**Evidence (`measured`).** `[System.IO.File]::Exists('\\?\<repo root>\nul')`
→ `True`, length `0`, created `2026-09-14 05:31:20`. `AI-Runs/.../MORNING_REPORT.md:147` independently
documents it as an agent's `>nul` redirect typo in the repository cwd, and records that the prior run
declined to delete it under its own "delete nothing" rule.
**Fix applied.** Delete via the `\\?\` extended-length path (a plain `Remove-Item .\nul` cannot address
a reserved device name). **Risk:** none — zero bytes, untracked, documented accident.

---

### P3-2 — Stale count in a source comment

**Evidence (`measured`).** `bin/self-audit.js:5` — *"single run instead of inspecting 22 reports"*.
The chain now contains **26** node scripts (`package.json` `scripts.test`, split on `&&`, filtered on
`node `). The console output of the same program already reports the live total, so the hard-coded
number is pure liability.
**Fix applied.** Remove the number rather than re-hard-code it (it will drift again otherwise).
**Verification:** `node -e` parse of `scripts.test` → 26.

---

### P3-3 — Structure map duplicated between `AGENTS.md` and `README.md`

**Evidence (`documented`).** Both files carry the same aspirational directory tree, plus overlapping
copies of the cognitive loop, method admission, and evaluation-metric lists.
**Assessment.** `partial duplication by audience` — `AGENTS.md` is always-loaded agent instruction,
`README.md` is the human overview; some overlap is legitimate. But the duplicated *structure map* is
what produced P2-1 in two places at once.
**Decision: no restructuring.** Per the task rule *"不为了统一风格而全面重构"*, the duplication is
recorded, and the fix is to keep the accurate map in one place and let the other point at it. No
file is split or merged.

---

### Checked and deliberately left alone

| Item | Why no action |
|---|---|
| `evals/external/` (v1) kept alongside `evals/external-v2/` | Not redundant: different protocols, both frozen, both cited by `changelog.md` and `reports/phase-2-*.md`; `evals/external-v2/scripts/verify-freeze.js` passes over the v2 manifest (84 artifacts). Removing either would destroy evaluation evidence. |
| `reports/session-01.md`, `reports/phase-2-*.md` | Long-lived records referenced from `README.md` and `changelog.md`; only the stale numbers in §P2-2 are touched. |
| `methods/experimental/*` cards | Status labels are honest (`experimental` vs `validated`); no drift found. |
| 214 files of frozen eval corpora | Intentional, hash-frozen, and gate-protected. |
| `dsh/`, `scripts/sync-dsh-skill.js`, `scripts/check-dsh-skill-sync.js` | The `effective-thinking` packaging path — a different Skill's surface (§4). |

---

## 2. Version and release state, summarised

- Scheme in use: SemVer-shaped (`0.2.0`), but **not SemVer-honest** — no MAJOR/MINOR/PATCH movement at
  all, and no declared intent about what the number means for consumers.
- Recovery points: none (no tags).
- Commit style: mixed. `fix(...)`, `integration:`, `eval:` — close to Conventional Commits but not
  consistently applied, and no `feat:`/`BREAKING CHANGE` markers anywhere.
- Working tree at audit time: clean apart from the two untracked entries in P1-1/P3-1.

These feed directly into the Skill's version-management rules (evidence: research cluster B).

---

## 3. Audit → action → verification ledger

| ID | Severity | Action taken | Verified by |
|---|---|---|---|
| P1-1 | P1 | add `.gitignore` for agent-run scratch | `git status` clean; `--untracked-files=all` no longer lists `AI-Runs/` |
| P1-2 | P1 | version bump + annotated tag at HEAD | `git tag`, version string agreement |
| P2-1 | P2 | accurate current-structure map in `README.md` | every path cross-checked against `git ls-files` |
| P2-2 | P2 | state counting rule + measured inventory | re-run of the quoted command |
| P2-3 | P2 | record DSH `0.1.5-rc.1` as a verified host | `npm run test:dsh:host` exit 0 |
| P3-1 | P3 | delete `nul` via `\\?\` path | `Test-Path` → false |
| P3-2 | P3 | drop the hard-coded count in the comment | chain length re-measured = 26 |
| P3-3 | P3 | **no action** (recorded) | — |

---

## 4. Scope boundary

The repository already contains one Skill: **`effective-thinking`** (root `SKILL.md`, packaged asset
`dsh/skill/effective-thinking.md`, adapter `dsh/`, sync guards in `scripts/`). The task for this
session is a *different, independent* Skill, and the task rules state: *"不得创建其他 Skill，也不得
修改其他 Skill"*.

Boundary therefore enforced as follows:

- `SKILL.md`, `dsh/**`, `scripts/sync-dsh-skill.js`, `scripts/check-dsh-skill-sync.js`,
  `evals/dsh-plugin-test.js`, and the frozen `npm test` chain in `package.json` are **not modified**.
- The new Skill lives in its own root, `.dsh/skills/project-conventions/`, and is discovered by the
  host's own filesystem skill provider — it needs no change to the existing adapter.
- Its tests get their own script name, so the existing release gate keeps exactly its current meaning.

**Verified delivery mechanism** (this is what makes the Skill usable rather than a draft):
DSH's filesystem skill provider scans `<projectRoot>/.dsh/skills` at rank 100, one level deep,
recognising `<name>/SKILL.md` bundles with `name` + `description` frontmatter. This was confirmed
**experimentally in this session**, not just read from documentation: writing
`.dsh/skills/zz-discovery-probe/SKILL.md` made the skill appear in the live session catalog without a
restart, and deleting it removed the entry again. That probe file was removed immediately.
