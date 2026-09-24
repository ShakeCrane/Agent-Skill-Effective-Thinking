# DeepSeek Harness integration

How the Cognitive Agent Skill is packaged as a native DSH plugin, and why it is built this way.

## Architecture

One source project, one skill source of truth, one thin adapter:

```text
Agent-Skill-Effective-Thinking/
├── SKILL.md              canonical skill body (unchanged, still the source of truth)
├── index.js, router/,    the runtime library (unchanged)
├── dsh/
│   ├── index.mjs         Cordis plugin: registers one packaged skill provider
│   ├── skill-meta.mjs    catalog identity: name, description, whenToUse, invocation
│   ├── cordis.patch.yml  bundle patch: one loader row
│   ├── skill/            GENERATED asset = generated frontmatter + canonical body
│   └── README.md
└── scripts/
    ├── sync-dsh-skill.js        root SKILL.md -> dsh/skill/effective-thinking.md
    └── check-dsh-skill-sync.js  fails if the two ever diverge
```

The plugin is a **pure provider**. Its whole runtime surface is:

```js
inject = ['skills']
apply(ctx) { ctx.skills.registerProvider(() => ({ name, list, get })) }
```

`list()` returns one catalog entry and reads no body; `get()` reads the packaged asset and strips the
generated frontmatter. There is no other behaviour to review.

## Why a native skill provider

The host already owns skill discovery, catalog rendering, invocation policy, and on-demand loading.
Reusing that machinery means:

- the model decides *when* the skill is worth loading, using the same mechanism as every other skill;
- the user can invoke it explicitly with the host's normal skill syntax;
- install, enable, discover, load, and remove all follow the host's own lifecycle (no bespoke
  activation path to maintain).

## Why not an always-on system prompt

Appending the full `SKILL.md` to every model call would:

- spend context on every request, including trivial ones the skill explicitly says to skip;
- break prompt/KV caching;
- contradict the skill's own core rule — *spend the right effort on the right task* — by making a
  simple task pay the full cognitive budget;
- duplicate a capability the host already provides.

The adapter therefore ships a **summary in the catalog** and the **body only on selection**.

## Why no `cognitive_route` tool yet

The library exposes `route`, `extract`, `fillProfile`, `verificationPlan`, `stopping`, `cost`,
`certainty`, `adaptiveLoop`, and orchestration helpers. None of them are registered as model-facing
tools here, deliberately. Turning `route()` into a host tool changes the integration category from
"skill packaging" to "agent control integration", which introduces new tool-policy, schema,
recursion, model-action, and automatic-escalation semantics that would each need their own
behavioural evaluation.

The seam is left open: `dsh/index.mjs` can gain additional registered tools later without disturbing
the provider, but no host-control behaviour ships in this version.

## Invariants

1. **Installed but not loaded ≈ plain DSH.** The only difference is one extra catalog entry. This is
   verified against a real session trace (see the integration report).
2. **Full body only on demand.** Confirmed by decoding session logs: the catalog summary is present
   in runs that never invoke the skill, while the body text is absent; it appears in full (first,
   middle, and last line) only in the run that invoked it.
3. **No drift.** The packaged asset is generated from `SKILL.md`; `npm run dsh:check` fails on any
   difference, including a hand-edit of the packaged copy.
4. **No duplicate identity.** The host registry fails loud if the provider is registered twice
   (`a skill provider named "effective-thinking-dsh" is already registered`), so a duplicated loader
   row surfaces as an error instead of a second catalog entry. `dsh/cordis.patch.yml` therefore
   inserts exactly one row and must not be inserted manually as well.

## Host trust boundary

The plugin is host code, so it is written to the smallest possible privilege:

| Allowed | Not used |
|---|---|
| read its own packaged skill asset | shell / process spawning |
| register one skill provider | arbitrary filesystem writes |
| | network access |
| | credentials or secret access |
| | profile, approval-policy, or sandbox-policy mutation |
| | background tasks, watchers, or timers |

A packaged Markdown skill provider does not need any of the right-hand column, so none of it is
present, and there is no environment variable, config key, or user input that changes this.

## Compatibility

Tested against the versions actually present on the machine used for integration, plus a later
re-verification on a newer host:

| Component | Version | Host gate |
|---|---|---|
| DeepSeek Harness | `0.1.1-rc.2` | integration (original) |
| DeepSeek Harness | `0.1.5-rc.1` | re-verified 2026-09-24 — `npm run test:dsh:host` passes all 21 host checks |
| Node.js | `v24.19.0` | both runs |
| npm | `11.17.0` | both runs |
| pnpm (used by `dsh plugin`) | `11.25.0` | original only |
| OS | Windows 10.0.26200 | original only |

The `0.1.5-rc.1` row is a real re-verification, not a version-string edit: the strict host gate
(`test:dsh:host`) was re-run against the installed host and exercised registry mount, catalog entry,
`get`, `unload` and `reload`. It does not re-verify install/remove via `dsh plugin`, which was checked
only on `0.1.1-rc.2`.

DSH is a developer preview and its plugin contract may change. **Other DSH versions are unverified.**
No version range is asserted in `package.json` because the adapter depends on no DSH package at all —
it calls only the `ctx.skills` service contract it is injected with.

If a future DSH changes that contract, the failure is expected to be loud at load time rather than
silent: an unresolved module or a rejected registration fails the boot.

## Install / verify / remove

```bash
# install (verified in an isolated profile, both forms)
dsh plugin --profile <profile> add /abs/path/to/Agent-Skill-Effective-Thinking
dsh plugin --profile <profile> add /abs/path/to/cognitive-agent-skill-<version>.tgz

# verify composition: the bundle layer plus exactly one loader row
dsh --profile <profile> --dump-config

# use
dsh --profile <profile> "Use the effective-thinking skill for this task."

# remove
dsh plugin --profile <profile> remove cognitive-agent-skill
```

`dsh plugin add` reconciles the profile automatically: a dependency whose package declares
`dsh.bundle.patch` joins `dsh.profile.bundles`, and removing it drops the layer again. Nobody has to
hand-edit a profile patch file.

## Status

`experimental`. The skill's own behavioural evaluations (Phase 2 v1 and v2) both met a ceiling effect
on the tested agent: every condition solved every task, so a general behavioural benefit of the full
skill over a three-line scaffold has **not** been demonstrated. This adapter claims availability and
correct packaging only — not improved outcomes.
