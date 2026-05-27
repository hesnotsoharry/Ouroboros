/**
 * internalMcp barrel (Wave 60 Phase E, updated Wave 22 Phase 6).
 *
 * Pre-Wave-60 this directory ran an in-process HTTP+SSE MCP server and a
 * stdio bridge. Both are deleted in Phase E. What remains:
 *
 *   - `injectIntoProjectSettings` / `removeFromProjectSettings` — write
 *     the ouroboros entry into `<root>/.mcp.json`. The entry points at
 *     the standalone MCP package (`packages/codebase-graph-mcp/dist/index.js`)
 *     which Claude Code spawns with `--root <projectRoot>` whether the IDE
 *     is running or not.
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
 * Resolve the absolute path to `packages/codebase-graph-mcp/dist/index.js`.
 *
 * Wave 22 Phase 6: the standalone is now the npm package at
 * `packages/codebase-graph-mcp/`. In a dev or production build,
 * `mainOutDir` is `<repo-root>/out/main/`; walking up two levels reaches
 * the repo root, then descending into the package gives the entry point.
 *
 * TODO(Wave 23+): asar packaging — in a packaged Electron build the
 * `packages/` directory is not included in the asar bundle. The package
 * must either be bundled as an asar resource or shipped as an unpacked
 * file alongside the installer. See:
 * roadmap/follow-ups/2026-05-27-internalmcp-asar-packaging.md
 */
export function resolvePackageEntry(mainOutDir: string): string {
  // out/main/ → repo root → packages/codebase-graph-mcp/dist/index.js
  const repoRoot = path.resolve(mainOutDir, '..', '..');
  return path.join(repoRoot, 'packages', 'codebase-graph-mcp', 'dist', 'index.js');
}

/**
 * Build the inject options for the current build.
 *
 * Wave 22 Phase 6: `standaloneScriptPath` now points at the package entry
 * (`packages/codebase-graph-mcp/dist/index.js`), resolved from `mainOutDir`.
 */
export function buildInjectOptions(mainOutDir: string): InjectOptions {
  return {
    standaloneScriptPath: resolvePackageEntry(mainOutDir),
  };
}
