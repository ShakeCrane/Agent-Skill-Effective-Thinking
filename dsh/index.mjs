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
  DISPATCH_PACKAGED_SKILL_RANK,
  DISPATCH_SKILL_DESCRIPTION,
  DISPATCH_SKILL_INVOCATION,
  DISPATCH_SKILL_NAME,
  DISPATCH_SKILL_SOURCE,
  DISPATCH_SKILL_WHEN_TO_USE,
  PACKAGED_SKILL_RANK,
  PLUGIN_NAME,
  SKILL_DESCRIPTION,
  SKILL_INVOCATION,
  SKILL_NAME,
  SKILL_SOURCE,
  SKILL_WHEN_TO_USE,
} from './skill-meta.mjs';

/** Absolute URLs of the generated skill assets (frontmatter + canonical bodies). */
const SKILL_ASSET_URL = new URL('./skill/effective-thinking.md', import.meta.url);
const DISPATCH_SKILL_ASSET_URL = new URL('./skill/task-dispatch.md', import.meta.url);

/**
 * The advertised catalog entries. Bodies are intentionally NOT read here: `list()` must stay
 * cheap so that discovery never pays the cost of every skill's full text.
 */
function candidate(name, description, whenToUse, invocation, rank, source, locator) {
  return {
    name,
    description,
    whenToUse,
    invocation,
    provider: PLUGIN_NAME,
    source,
    rank,
    locator,
    path: fileURLToPath(locator),
    resourceBase: {
      kind: 'directory',
      path: fileURLToPath(new URL('./skill/', import.meta.url)),
    },
  };
}

const CANDIDATES = [
  candidate(SKILL_NAME, SKILL_DESCRIPTION, SKILL_WHEN_TO_USE, SKILL_INVOCATION,
    PACKAGED_SKILL_RANK, SKILL_SOURCE, SKILL_ASSET_URL),
  candidate(DISPATCH_SKILL_NAME, DISPATCH_SKILL_DESCRIPTION, DISPATCH_SKILL_WHEN_TO_USE,
    DISPATCH_SKILL_INVOCATION, DISPATCH_PACKAGED_SKILL_RANK, DISPATCH_SKILL_SOURCE,
    DISPATCH_SKILL_ASSET_URL),
];

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
 * Register the packaged skill providers on `ctx.skills`.
 *
 * Registration happens once per plugin load. The provider is a pure read-only catalog: `list()`
 * returns the candidates, `get()` returns the requested definition with its body loaded on
 * demand (matched by candidate name).
 * @param ctx - the Cordis context carrying the skill registry.
 */
function apply(ctx) {
  ctx.skills.registerProvider(() => ({
    name: PLUGIN_NAME,
    list: () => Promise.resolve(CANDIDATES.map((c) => ({ ...c }))),
    async get(wanted) {
      const c = CANDIDATES.find((x) => x.name === (wanted && wanted.name)) || CANDIDATES[0];
      const raw = await readFile(c.locator, 'utf8');
      return {
        name: c.name,
        description: c.description,
        whenToUse: c.whenToUse,
        invocation: c.invocation,
        provider: c.provider,
        source: c.source,
        resourceBase: c.resourceBase,
        path: c.path,
        content: stripFrontmatter(raw),
      };
    },
  }));
}

export { apply, inject, name, SKILL_ASSET_URL, DISPATCH_SKILL_ASSET_URL, CANDIDATES };
export default { apply, inject, name };
