/**
 * internalMcp barrel (Wave 60 Phase E, updated Wave 22 Phase 6).
 *
 * Pre-Wave-60 this directory ran an in-process HTTP+SSE MCP server and a
 * stdio bridge. Both are deleted in Phase E. What remains:
 *
 *   - `injectIntoProjectSettings` / `removeFromProjectSettings` — write
 *     the ouroboros entry into `<root>/.mcp.json`. The entry points at
 *     the standalone MCP package (`codebase-graph-mcp/dist/index.js` in
 *     the sibling repo) which Claude Code spawns with `--root <projectRoot>`
 *     whether the IDE is running or not.
 *   - `internalMcpScope` — task-gated scope decision (used by
 *     scopedMcpConfig + codemodeStartup).
 *   - `internalMcpTypes` — shared `McpToolDefinition` etc.
 *
 * `internalMcp.transport` config is no longer consulted — entry shape is
 * always the standalone. The field is accepted on InjectOptions for
 * back-compat with stale config files but ignored.
 */
import path from 'path';

import type { InjectOptions } from './internalMcpAutoInject';

export {
  injectIntoProjectSettings,
  type InjectOptions,
  removeFromProjectSettings,
} from './internalMcpAutoInject';
export { type InternalMcpTransport } from './internalMcpTypes';

/**
 * Resolve the absolute path to the standalone codebase-graph-mcp package.
 *
 * Wave 22 (post-wrap): the package was extracted out of this repo into its
 * own git repo at `C:\Web App\codebase-graph-mcp\`. In dev, the IDE repo
 * is at `C:\Web App\AgentIDE\` (sibling), so the resolution walks up from
 * `<repo-root>/out/main/` to `C:\Web App\` then descends into the sibling
 * `codebase-graph-mcp/dist/index.js`.
 *
 * `mainOutDir` is `<ide-repo-root>/out/main/`. Three `..` reach `C:\Web App\`.
 *
 * Once `@hesnotsoharry/codebase-graph-mcp` is npm-published (Decision 7
 * follow-up `2026-05-26-codebase-graph-mcp-npm-publish.md`), this should
 * switch to `npx @hesnotsoharry/codebase-graph-mcp` for portability.
 *
 * TODO(Wave 23+): asar packaging — in a packaged Electron build the sibling
 * directory traversal won't work. The package must be shipped as an asar
 * resource (`extraResources`) or installed via `npx`. See:
 * roadmap/follow-ups/2026-05-27-internalmcp-asar-packaging.md
 */
export function resolvePackageEntry(mainOutDir: string): string {
  // out/main/ → ide repo root → C:\Web App\ → codebase-graph-mcp/dist/index.js
  const webAppRoot = path.resolve(mainOutDir, '..', '..', '..');
  return path.join(webAppRoot, 'codebase-graph-mcp', 'dist', 'index.js');
}

/**
 * Build the inject options for the current build.
 *
 * Wave 22 Phase 6: `standaloneScriptPath` points at the package entry
 * (`codebase-graph-mcp/dist/index.js` in the sibling repo), resolved from
 * `mainOutDir` via `resolvePackageEntry`.
 */
export function buildInjectOptions(mainOutDir: string): InjectOptions {
  return {
    standaloneScriptPath: resolvePackageEntry(mainOutDir),
  };
}
