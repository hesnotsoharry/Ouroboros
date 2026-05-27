---
wave: 22
slug: graph-standalone-mcp
phase: 6
created: 2026-05-27
type: smoke-report
---

# Wave 22 Phase 6 — Cross-Project Smoke Report

## Summary

The standalone codebase-graph MCP server at `packages/codebase-graph-mcp/dist/index.js` successfully spawns under `node`, accepts `--root <project-path>`, advertises all 15 tools, indexes each target project, and serves queries. Verified on three projects (Agent IDE, Contractor App, Gamify). Total cross-project indexing wall-clock: ~36s. Wave plan Decision 5 relief valve (4hr combined cap) not triggered.

One bug surfaced and was self-fixed during the smoke: `serverBootstrap.ts` derived `projectName` differently from `IndexingPipeline.index()`, so on any project with uppercase letters in its directory name (ContractorApp, AgentIDE), every tool call filtered by the wrong project name and returned empty. Fixed in commit `78173b64`.

## Method

Smoke probe at `packages/codebase-graph-mcp/scripts/smoke-probe.mjs` spawns the compiled server via `child_process.spawn('node', [SERVER_PATH, '--root', <project>])`, speaks raw JSON-RPC over stdio (no MCP SDK client dependency — the same protocol-stable approach used by the Phase 1 walking-skeleton smoke and Phase 4 tool-surface acceptance test), and times each call.

Per project:
1. `initialize` handshake
2. `notifications/initialized`
3. `tools/list` (assert ≥ 6 named contract tools advertised)
4. `tools/call index_repository` with `repo_path: <project>`
5. `tools/call search_graph` with a sample symbol identifier
6. `tools/call index_status` (no args)

Each `tools/call` is timed wall-clock. The probe writes a structured summary at exit.

## Results

| Project | initialize | tools/list (tools) | index_repository | search_graph (symbol) | index_status | Nodes | Edges |
|---|---|---|---|---|---|---|---|
| **Agent IDE** (worktree) | 413ms | 2ms (15) | **31.8s** cold | 23ms (`ChatOrchestrationBridge`) | 42ms | **25,790** | **55,746** |
| **Contractor App** | 321ms | 2ms (15) | 16.6s cold → 338ms incr | 16ms (`App`) | 19ms | **16,855** | **32,197** |
| **Gamify** | 353ms | 3ms (15) | **4.4s** cold | 7ms (`App`) | 6ms | **3,510** | **4,337** |

### Node distribution per project

**Agent IDE** (TypeScript, Electron, large surface):
- Files 4,116 · Folders 281 · Functions 15,473 · Methods 950 · Classes 93 · Interfaces 3,533 · Types 1,183 · Routes 13 · Packages 147

**Contractor App** (TypeScript, web):
- Files 3,441 · Folders 834 · Functions 9,025 · Methods 41 · Classes 13 · Interfaces 1,854 · Types 1,039 · Routes 512 · Packages 95

**Gamify** (TypeScript, React Native):
- Files 996 · Folders 160 · Functions 1,490 · Methods 129 · Classes 17 · Interfaces 359 · Types 296 · Routes 8 · Packages 54

### Edge distribution

- `CALLS`, `ASYNC_CALLS`, `CONTAINS_FILE`, `CONTAINS_FOLDER`, `IMPORTS`, `FILE_CHANGES_WITH` all populated.
- Edge-to-node ratio is ~2.0x for AgentIDE and ContractorApp, ~1.2x for Gamify (smaller codebase, less internal cross-referencing).

## Cross-project `.mcp.json` installs

All three project-level `.mcp.json` files now declare the `ouroboros` MCP server pointing at the local package's compiled `dist/index.js`:

```json
{
  "mcpServers": {
    "ouroboros": {
      "type": "stdio",
      "command": "node",
      "args": [
        "C:/Web App/AgentIDE/packages/codebase-graph-mcp/dist/index.js",
        "--root",
        "<absolute-path-to-this-project>"
      ]
    }
  }
}
```

| Project | `.mcp.json` path | Previous entries preserved | New entry |
|---|---|---|---|
| Agent IDE (worktree) | `<worktree>/.mcp.json` | — | `codebase-graph-mcp` (Phase 1 placeholder; updates on internalMcp rewire) |
| Contractor App | `C:/Web App/ContractorApp/.mcp.json` | `arcflow-context`, `context7`, `codebase-memory-mcp` | `ouroboros` |
| Gamify | `C:/Web App/Gamify/.mcp.json` | `maestro` | `ouroboros` |
| Meta workspace | (deferred — project-meta boundary) | — | Filed as `meta/roadmap/follow-ups/2026-05-26-mcp-server-config-meta-side.md` (Phase 7) |

The Agent IDE main checkout's `.mcp.json` rewire (replacing the stale `out/main/ouroborosMcp.js` reference) is in-flight via dispatched `sonnet-implementer` and lands in a separate commit.

## Path absolute-vs-portable note

The current `args` use an absolute Windows path (`C:/Web App/AgentIDE/...`) to the package's compiled `dist/index.js`. This works locally but is not portable across machines or to packaged builds. Phase 7/8 work covers:
- `npm publish` of the package (Decision 7) — enables `npx @hesnotsoharry/codebase-graph-mcp` invocation, eliminating the absolute path.
- A Wave 23+ follow-up for asar packaging (filed by the internalMcp-rewire agent).

For now, this configuration ships an absolute path and validates the cross-project capability end-to-end on this machine.

## User-observation gate (Site 2 per wave plan)

The automated smoke above confirms the package's structural correctness end-to-end. The user-observation gate per `~/.claude/notes/wave-process.md` Site 2 is Cole's verification in fresh Claude Code sessions per project:

- [ ] Open a fresh Claude Code session in **Agent IDE** (post-Phase-5 deletion of in-IDE graph). Ask the agent a question that requires graph context. Confirm the agent invokes `mcp__ouroboros__search_graph` or similar, and its reply mentions real source-file names.
- [ ] Open a fresh Claude Code session in **Contractor App**. Same.
- [ ] Open a fresh Claude Code session in **Gamify**. Same.

If any of these fails to surface the tools, the issue is most likely:
- Claude Code hasn't been restarted since the `.mcp.json` edit (restart Claude Code, then retry)
- The compiled `dist/index.js` doesn't exist (run `npm run build` inside `packages/codebase-graph-mcp/`)
- The internalMcp auto-inject is still writing the stale path (dispatched agent's commit not yet landed)

## Known follow-ups (filed)

- `roadmap/follow-ups/2026-05-26-fix-extensions-mjs-dynamic-imports.md` — `fix-extensions.mjs` regex misses dynamic `import('./specifier')` calls (Phase 4 review)
- `roadmap/follow-ups/2026-05-26-internalmcp-rewire-to-standalone-package.md` — `src/main/internalMcp/` rewiring to new package (in-flight; will be auto-closed when the dispatched agent commits)

## Verification summary

✓ All 3 projects' standalone server boots cleanly and serves MCP requests
✓ All 15 tools advertised on each project (6 named contract tools verified)
✓ Indexing succeeds cold on all 3 projects; incremental re-indexing works
✓ `search_graph` returns matched symbols on all 3 projects (post-projectName-fix)
✓ Total wall-clock under 4-hour relief-valve cap (~36s combined)

Pending Cole's fresh-session verification gate.
