---
status: OPEN
created: 2026-05-27
updated: 2026-05-27
source: wave-22-graph-standalone-mcp Phase 6 (sonnet-implementer) + 2026-05-27 post-wrap package extraction
severity: MEDIUM
scope: src/main/internalMcp + electron-builder config
phase_target: Wave 23+ (or fold into vestigial-chat-orchestration-cleanup)
---

# internalMcp asar packaging: standalone package path not available in packaged builds

## Context

Wave 22 Phase 6 rewired `src/main/internalMcp/` to inject the standalone codebase-graph package path into `<root>/.mcp.json` on project open. The 2026-05-27 post-wave extraction moved the package out of the Agent IDE repo entirely — it now lives at `C:\Web App\codebase-graph-mcp\` as its own git repo, AND is npm-published as `@hesnotsoharry/codebase-graph-mcp`.

In dev mode, the IDE's path resolver walks `out/main/` → ide repo root → `C:\Web App\` → `codebase-graph-mcp\dist\index.js`. This works because the IDE and the package are siblings under `C:\Web App\`.

In a packaged Electron build (via `electron-builder`), the IDE ships as an installer that places the app under `C:\Users\<user>\AppData\Local\Programs\Ouroboros\` (or wherever the installer points). The sibling `codebase-graph-mcp/` directory at `C:\Web App\codebase-graph-mcp\` no longer exists relative to `__dirname` after install. The path resolver returns a path that doesn't exist on the user's machine.

## Required fix for packaged builds

Two viable approaches now that the package is npm-published:

1. **npx invocation (preferred, simplest).** When `app.isPackaged`, the path resolver returns `{ command: 'npx', args: ['@hesnotsoharry/codebase-graph-mcp', '--root', projectRoot] }` instead of the absolute file path. The package is on npm; first invocation downloads + caches it locally, subsequent invocations use the cache. No need to bundle the package with the IDE installer.

   In dev (`!app.isPackaged`), fall back to the existing sibling-traversal path so developers don't need npm install for `@hesnotsoharry/codebase-graph-mcp`.

2. **`extraResources` (bundles package with installer).** Add the package's `dist/` directory to electron-builder's `extraResources` config so it ships inside the installer. Path resolver detects `app.isPackaged` and resolves from `process.resourcesPath`. Heavier installer but works offline.

Approach 1 (npx) is the cleaner answer post-publish: it relies on the npm-published artifact, keeps the installer small, and matches how other MCP servers in `~/.claude.json` (the meta-level global config) are invoked.

## Files to touch

- `src/main/internalMcp/index.ts` — update `resolvePackageEntry` (or rename to `resolveLaunchCommand`) to return a structured `{ command, args }` shape that switches on `app.isPackaged`.
- `src/main/internalMcp/internalMcpAutoInject.ts` — update `buildOuroborosEntry` to consume the structured return.
- `src/main/orchestration/providers/scopedMcpConfig.ts` — same resolver update at `resolvePackageEntryPath`.
- 4 codemode tests + the internalMcp test files that assert the current entry shape.

## Relationship to other follow-ups

- **`2026-05-27-vestigial-chat-orchestration-cleanup.md`** — if the internalMcp + chat orchestration chain is deleted wholesale (the cleanup that catalog drives), this asar packaging concern becomes moot. The chain that USES the packaged path (claudeCodeLaunch → claudeCodeAdapter → agentChatOrchestration IPC) is itself vestigial in Cole's terminal-only workflow. Resolving the cleanup follow-up first may eliminate this one.
