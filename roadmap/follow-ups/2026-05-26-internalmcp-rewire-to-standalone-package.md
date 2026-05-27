---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
source: wave-22-graph-standalone-mcp Phase 5 review (sonnet-phase-reviewer)
severity: HIGH
scope: src/main/internalMcp + src/main/codemode tests
phase_target: Wave 22 Phase 6 (cross-project smoke + per-project settings)
---

# internalMcp injects a path to a deleted standalone server

## Context

Wave 22 Phase 5 deleted `src/main/codebaseGraph/` AND `src/standalone/ouroborosMcp/`. The standalone replacement now lives at `packages/codebase-graph-mcp/`.

But `src/main/internalMcp/` still injects the **old** path into Claude Code's MCP config:

- `src/main/internalMcp/index.ts:39` — `standaloneScriptPath: path.join(mainOutDir, 'ouroborosMcp.js')` (file no longer exists in `out/main/`)
- `src/main/internalMcp/internalMcpAutoInject.ts` — writes the entry to `<root>/.mcp.json mcpServers.ouroboros` and `~/.claude.json projects[<root>].enabledMcpjsonServers`
- `src/main/internalMcp/scopedMcpConfig.ts` — same wiring lineage

## Runtime impact

- IDE boots fine — `injectStandaloneMcpEntry()` writes the path string but does not load the file. `runStartupStep` at `main.ts:133` is non-critical so any failure logs but does not block boot.
- Claude Code sessions spawned inside the IDE attempt to load `out/main/ouroborosMcp.js` via the injected `.mcp.json` and fail. **`mcp__ouroboros__*` tools are unavailable in any Claude Code session inside the IDE.**
- This is the capability regression already acknowledged in `src/standalone/CLAUDE.md` and Decision 4 (A2). It is intermediate state — Phase 6 closes it.

## Fix paths

Two design options for Phase 6:

**Option A: Rewire `internalMcpAutoInject` to point at the new package.**
The injected entry becomes:
```json
{
  "ouroboros": {
    "type": "stdio",
    "command": "node",
    "args": [
      "<absolute-path-to>/packages/codebase-graph-mcp/dist/index.js",
      "--root",
      "<project-root>"
    ]
  }
}
```
Keeps the in-IDE auto-inject capability. Path resolution needs to walk up from `__dirname` to find the package (works in dev; in packaged builds, the package would need to be bundled or its dist shipped as an asar resource).

**Option B: Delete `internalMcp` entirely; require users to install the package via `.mcp.json` themselves.**
Matches Decision 4's "remove" stance more cleanly. Loses the "tools just work in fresh sessions" UX but matches the wave's overall direction.

**Option C (hybrid, recommended):** Rewire `internalMcpAutoInject` to point at `npx @hesnotsoharry/codebase-graph-mcp --root <project-root>`. This works without bundling the package (npm resolves the binary on first invoke; user just needs Node + npm). Requires the npm publish (Decision 7 + Phase 8) — if publish defers via follow-up, then the entry falls back to a local file:// install or to Option B.

## Test impact

The following codemode tests assert the old path and must update with whichever fix lands:

- `src/main/codemode/codemode.internalMcp.integration.test.ts:171` — `expect(entry.args![0]).toMatch(/ouroborosMcp\.js$/)`
- `src/main/codemode/codemodeStartup.test.ts:116` — `config: { command: 'node', args: ['/path/ouroborosMcp.js'] }`
- `src/main/codemode/crashRecovery.test.ts:194,214` — same assertion

## Acceptance criteria for the Phase 6 fix

- `src/main/internalMcp/` either points at the new package OR is deleted.
- The 4 codemode tests above pass against whichever choice lands.
- A fresh Claude Code session opened in Agent IDE surfaces `mcp__codebase-graph-mcp__*` tools (or `mcp__ouroboros__*` if the name is kept) and a `ping` call returns `pong`.
