// DeepSeek Harness native plugin: expose the Cognitive Agent Skill as a DSH skill.
//
// This is a thin host adapter, not a second implementation. It registers exactly one packaged
// skill provider on the HOST layer of the DSH skill registry (`ctx.skills`), so every agent preset
// can discover `effective-thinking` and load its body on demand.
//
// Design constraints (deliberate, see docs/dsh-integration.md):
//   * No always-on prompt injection. Nothing is added to any system prompt; the catalog carries a
//     short summary and the full body enters the context only when the model or user selects it.
//   * No behaviour change when the skill is not loaded. The plugin does not route, escalate, spawn
//     agents, patch the agent loop, or touch the workspace.
//   * No host powers. It reads its own packaged asset and registers one provider: no shell, no
//     network, no arbitrary filesystem writes, no credentials, no profile or policy mutation.
//   * No dependency on `@deepseek-ai/*` internal packages, so the plugin resolves on its own.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  PACKAGED_SKILL_RANK,
  PLUGIN_NAME,
  SKILL_DESCRIPTION,
  SKILL_INVOCATION,
  SKILL_NAME,
  SKILL_SOURCE,
  SKILL_WHEN_TO_USE,
} from './skill-meta.mjs';

/** Absolute URL of the generated skill asset (frontmatter + canonical `SKILL.md` body). */
const SKILL_ASSET_URL = new URL('./skill/effective-thinking.md', import.meta.url);

/** Directory resource base, so a loaded body could resolve relative references if it ever had any. */
const RESOURCE_BASE = {
  kind: 'directory',
  path: fileURLToPath(new URL('./skill/', import.meta.url)),
};

/**
 * The advertised catalog entry. The body is intentionally NOT read here: `list()` must stay cheap
 * so that discovery never pays the cost of every skill's full text.
 */
const CANDIDATE = {
  name: SKILL_NAME,
  description: SKILL_DESCRIPTION,
  whenToUse: SKILL_WHEN_TO_USE,
  invocation: SKILL_INVOCATION,
  provider: PLUGIN_NAME,
  source: SKILL_SOURCE,
  rank: PACKAGED_SKILL_RANK,
  locator: SKILL_ASSET_URL,
  path: fileURLToPath(SKILL_ASSET_URL),
  resourceBase: RESOURCE_BASE,
};

/**
 * Strip the generated frontmatter block from the packaged asset.
 *
 * The asset is produced by `scripts/sync-dsh-skill.js` as generated frontmatter plus the canonical
 * `SKILL.md` body verbatim. DSH receives metadata from this adapter, so the body is what the model
 * must see — passing the frontmatter through would leak YAML into the model-facing content.
 * @param text - the raw asset contents.
 * @returns the body with the frontmatter block removed, or the input when there is no block.
 */
export function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  return text.slice(end + 4).replace(/^\n+/, '');
}

/** Cordis plugin name. */
const name = PLUGIN_NAME;

/** Service required by the provider: the skill registry. */
const inject = ['skills'];

/**
 * Register the packaged `effective-thinking` provider on `ctx.skills`.
 *
 * Registration happens once per plugin load. The provider is a pure read-only catalog: `list()`
 * returns the single candidate, `get()` returns the full definition with the body loaded on demand.
 * @param ctx - the Cordis context carrying the skill registry.
 */
function apply(ctx) {
  ctx.skills.registerProvider(() => ({
    name: PLUGIN_NAME,
    list: () => Promise.resolve([CANDIDATE]),
    async get(_candidate) {
      const raw = await readFile(SKILL_ASSET_URL, 'utf8');
      return {
        name: CANDIDATE.name,
        description: CANDIDATE.description,
        whenToUse: CANDIDATE.whenToUse,
        invocation: CANDIDATE.invocation,
        provider: CANDIDATE.provider,
        source: CANDIDATE.source,
        resourceBase: RESOURCE_BASE,
        path: CANDIDATE.path,
        content: stripFrontmatter(raw),
      };
    },
  }));
}

export { apply, inject, name, SKILL_ASSET_URL };
export default { apply, inject, name };
