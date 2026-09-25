# DeepSeek Harness adapter

A thin host adapter that exposes the Cognitive Agent Skill as a native DSH skill. It does not
re-implement the skill: the instruction body is still the repository root [`SKILL.md`](../SKILL.md),
and the runtime library is still the root package.

```text
dsh/index.mjs          Cordis plugin: registers one packaged skill provider on ctx.skills
dsh/skill-meta.mjs     catalog metadata (name, description, whenToUse, invocation) — the identity source
dsh/cordis.patch.yml   bundle patch: one loader row, no duplicate insert
dsh/skill/             GENERATED packaged asset (do not hand-edit)
```

`dsh/skill/effective-thinking.md` is generated from the canonical `SKILL.md`:

```bash
npm run dsh:sync    # regenerate
npm run dsh:check   # fail if the asset drifted from SKILL.md
```

The body is copied byte-for-byte; only the YAML frontmatter is generated. Editing the packaged copy
by hand is a drift, and `npm run dsh:check` (also part of `npm run test:dsh`) refuses it.

## What the plugin does

Exactly one thing: it makes `effective-thinking` discoverable in the skill catalog and loads its body
**only when the model or user selects it**. It has no runtime dependencies, reads one packaged file,
and registers one provider.

It does **not** inject the skill into every system prompt, route tasks, escalate models, spawn agents,
patch the agent loop, write the workspace, or touch credentials, profiles, or sandbox policy.

## Install

```bash
# from a local checkout
dsh plugin --profile <profile> add /absolute/path/to/Agent-Skill-Effective-Thinking

# or from a packed tarball
npm pack
dsh plugin --profile <profile> add /absolute/path/to/cognitive-agent-skill-<version>.tgz
```

Then verify and use:

```bash
dsh --profile <profile> --dump-config     # the bundle layer and its single loader row appear
dsh --profile <profile> "Use the effective-thinking skill for this task."
```

Remove:

```bash
dsh plugin --profile <profile> remove cognitive-agent-skill
```

See [`docs/dsh-integration.md`](../docs/dsh-integration.md) for architecture, trust boundary, and the
tested version range.
