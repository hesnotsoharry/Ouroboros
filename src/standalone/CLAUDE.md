# `src/standalone/` — Standalone Node binaries

> **Wave 22 update.** The `ouroborosMcp/` in-tree standalone (Wave 60) was deleted in Wave 22 because it depended entirely on `src/main/codebaseGraph/` which was removed. The replacement is the standalone package at `C:\Web App\codebase-graph-mcp\` (own git repo, moved out of IDE post Wave 22). See Phase 6/7 of Wave 22 for wiring and smoke testing.

## Current state

- `ouroborosMcp/` directory deleted in Wave 22 Phase 5 (depended on deleted codebaseGraph).
- Replacement: `C:\Web App\codebase-graph-mcp\` (own git repo, independent of Electron ABI, post Wave 22 post-wrap).
- `internalMcp/` injection rewired in Wave 22 Phase 6 to point at `codebase-graph-mcp/dist/index.js` (sibling-repo path) with `--root <projectRoot>`.
