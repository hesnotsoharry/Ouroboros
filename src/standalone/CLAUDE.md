# `src/standalone/` — Standalone Node binaries

> **Wave 22 update.** The `ouroborosMcp/` in-tree standalone (Wave 60) was deleted in Wave 22 because it depended entirely on `src/main/codebaseGraph/` which was removed. The replacement is `packages/codebase-graph-mcp/` — a proper npm-distributable standalone server. See Phase 6/7 of Wave 22 for wiring and smoke testing.

## Current state

- `ouroborosMcp/` directory deleted in Wave 22 Phase 5 (depended on deleted codebaseGraph).
- Replacement: `packages/codebase-graph-mcp/` (new standalone, independent of Electron ABI).
- `internalMcp/` injection still references `out/main/ouroborosMcp.js` — update to new package path in Phase 6/7.
