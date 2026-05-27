# `src/main/internalMcp/` — MCP entry injection (post-Wave-60, updated Wave 22 Phase 6)

> **Status: shrunken.** Pre-Wave-60 this directory ran an in-process HTTP+SSE MCP server, a stdio bridge, a port registry, a 14-tool registry, and a separate utility-process variant under `mcpHost/`. Wave 60 Phase E deleted all of that. Wave 22 Phase 5 deleted `src/standalone/ouroborosMcp/` and the replacement lives at `C:\Web App\codebase-graph-mcp\` (own git repo, moved out of IDE post Wave 22). This directory only writes the IDE-side injection that points Claude Code at the standalone package.

## File map

| File | Role |
|------|------|
| `index.ts` | Barrel — exports `injectIntoProjectSettings`, `removeFromProjectSettings`, `buildInjectOptions`, `resolvePackageEntry`. |
| `internalMcpAutoInject.ts` | Writes `<root>/.mcp.json mcpServers.ouroboros` and updates `~/.claude.json projects[<root>].enabledMcpjsonServers`. The entry is: `{type:'stdio', command:'node', args:[<C:\Web App\codebase-graph-mcp\dist\index.js>, '--root', <projectRoot>]}`. |
| `internalMcpScope.ts` | Pure decision logic for the `internalMcpScope` config (`always` / `task-gated` / `never`). Used by codemodeStartup and scopedMcpConfig. |
| `internalMcpTypes.ts` | Shared `McpToolDefinition` and `InternalMcpTransport` types. |

## What's no longer here (Wave 60 Phase E deletions)

- `internalMcpServer.ts` — HTTP+SSE server. No consumers; standalone replaces it.
- `internalMcpStdioTransport.ts` — stdio→SSE bridge. Was a workaround for the standalone we now have.
- `internalMcpPortRegistry.ts` — port file machinery. Standalone resolves DB path itself; no port.
- `internalMcpTools*.ts` — in-process tool registry. Standalone uses `codebaseGraph/mcpToolHandlers.ts` directly.
- `mcpHost/` directory — parallel utility-process MCP host. Same fate.

## Gotchas

- **`internalMcp.transport` config is vestigial.** Pre-Wave-60 it switched between SSE (URL entry) and stdio (bridge entry). The standalone has only one shape. The field is still accepted on config + `InjectOptions` for back-compat but ignored. Removed in a future cleanup wave.
- **`internalMcpEnabled: false` still honored** as a kill switch — main.ts skips injection when false; Claude Code sees no ouroboros server.
- **Command is plain `'node'`, not `process.execPath`.** The standalone `codebase-graph-mcp` package has its own `better-sqlite3` compiled for the system Node ABI (not Electron's ABI). `ELECTRON_RUN_AS_NODE=1` is no longer needed or set.
- **`--root <projectRoot>` is required.** The standalone package uses `--root` to locate the graph DB. `buildOuroborosEntry` passes the per-project root. Without it, the server falls back to `process.cwd()`.
- **Asar packaging is unresolved (Wave 23+).** In a packaged Electron build the sibling-repo path traversal won't work. See `roadmap/follow-ups/2026-05-27-internalmcp-asar-packaging.md`.
