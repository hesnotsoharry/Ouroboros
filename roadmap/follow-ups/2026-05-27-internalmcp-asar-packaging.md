---
status: OPEN
created: 2026-05-27
updated: 2026-05-27
source: wave-22-graph-standalone-mcp Phase 6 (sonnet-implementer)
severity: MEDIUM
scope: src/main/internalMcp + packages/codebase-graph-mcp + electron-builder config
phase_target: Wave 23+
---

# internalMcp asar packaging: `packages/codebase-graph-mcp/dist/` not included in packaged builds

## Context

Wave 22 Phase 6 rewired `src/main/internalMcp/` to inject `packages/codebase-graph-mcp/dist/index.js` instead of the deleted `out/main/ouroborosMcp.js`. The path is resolved at runtime by walking up from `out/main/` to the repo root, then descending into the package directory. This works correctly in dev mode and unpackaged production builds.

In a packaged Electron build (via `electron-builder`), the main process code runs from inside an asar archive. The `packages/` directory at the repo root is NOT included in the asar bundle by default, so `path.resolve(__dirname, '..', '..', 'packages', 'codebase-graph-mcp', 'dist', 'index.js')` points to a path that does not exist on disk after packaging.

## Required fix for packaged builds

One of three approaches:

1. **`extraResources` in electron-builder config** — copy `packages/codebase-graph-mcp/dist/` into the packaged app's `resources/` directory and update the path resolver to detect the packaged context (`app.isPackaged`) and resolve from `process.resourcesPath` instead.

2. **`asarUnpack` for the package directory** — add `packages/codebase-graph-mcp/**` to `asarUnpack` in `electron-builder.yml` so the package is extracted alongside the asar archive. Update the path resolver to use `__dirname.replace('app.asar', 'app.asar.unpacked')` for the packaged path.

3. **npx fallback** — when the local path doesn't exist (packaged build), fall back to `command: 'npx', args: ['@hesnotsoharry/codebase-graph-mcp', '--root', projectRoot]`. Requires the npm package to be published (Decision 7, Wave 22 Phase 8 or deferred).

Approach 1 (extraResources) is the simplest and most self-contained — no npm publish required, and the path resolver pattern is standard in Electron apps.

## Files to touch

- `electron-builder.yml` (or wherever extraResources config lives) — add the package dist directory
- `src/main/internalMcp/index.ts` — update `resolvePackageEntry` to detect `app.isPackaged` and use `process.resourcesPath`
- `src/main/orchestration/providers/scopedMcpConfig.ts` — same resolver update
