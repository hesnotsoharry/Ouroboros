---
status: OPEN
created: 2026-05-30
updated: 2026-05-30
---

# .mcp.json amplifier cleanup (machine-lockup follow-on)

## Context
The 2026-05-30 machine-lockup root cause (fixed in commit `5634e1fe`) was a runaway session-restore
spawn loop. The per-machine `.mcp.json` files were the **amplifier** — they made each spawned session
heavy. Cleaning them reduces per-session cost even after the spawn-loop fix.

## Findings (this session, from an OS process census + reading all 3 roots' .mcp.json)
- **ContractorApp** `C:\Web App\ContractorApp\.mcp.json` declares TWO graph servers:
  - `codebase-memory-mcp` → `C:/Users/coles/.local/bin/codebase-memory-mcp.exe` (a **164 MB** packaged binary), AND
  - `ouroboros` → `node C:/Web App/codebase-graph-mcp/dist/index.js` (the standalone node graph server).
  Redundant — two graph servers per session. Drop the `codebase-memory-mcp` entry; the node standalone covers it.
- **AgentIDE** `C:\Web App\AgentIDE\.mcp.json` `ouroboros` points at a **stale legacy path**:
  `electron.exe` (run-as-node) → `C:\Web App\Agent IDE\out\main\ouroborosMcp.js`. All three paths are
  MISSING (legacy space-bearing pre-rename dir + a deleted build output) so it fails fast (harmless,
  but wrong). Repoint at `node C:/Web App/codebase-graph-mcp/dist/index.js --root C:/Web App/AgentIDE`,
  matching Gamify's correct config.

## Notes / open questions
- `.mcp.json` is gitignored / per-machine, so this is local config hygiene, not a repo change.
- Are these `.mcp.json` files hand-written or IDE-generated? If the IDE generates the stale AgentIDE
  one, the generator is the real bug — investigate before hand-editing.
- The 164 MB `codebase-memory-mcp.exe` at `C:/Users/coles/.local/bin/` is an OLD packaged build; the
  current graph server is `@hesnotsoharry/codebase-graph-mcp` (npm global) / the standalone. Consider
  removing the stale binary once nothing references it.

## Origin
`bugs/2026-05-30-machine-lockup-mcp-process-storm.md`.
