---
status: TRIAGED
created: 2026-05-30
severity: CRITICAL
summary: Whole-machine lockup (13+ min) from a storm of codebase/MCP processes spawned per Claude session
---

# Machine lockup — codebase-MCP process storm (NOT approval, NOT telemetry-SQLite)

## What the user observed (ground truth — Task Manager)
The machine **locked up for ~13 minutes** after launching the IDE. In Task Manager the user
saw the app spinning up a **huge number of `codebase-memory-mcp.exe` processes**. User's read:
the ~94 "sessions" (sockets) we'd been chasing each launch an MCP server, and each MCP starts a
**repo scan** of its target — N concurrent heavy scans = total CPU/disk saturation.

## Why this is a NEW root cause (not the ones already fixed)
- **NOT the telemetry-SQLite freeze** — wave-101 already removed that store (HANDOFF says "freeze
  permanently fixed"; the 193 s synchronous `flushEvents` is gone). This lockup is a *different*
  freeze: an external process storm, not a main-thread SQLite write.
- **NOT the approval system** — removed this session (commit `684e9f81`). The approval sockets were
  real but a *symptom layer*, not the machine-killer.
- The smoking gun in the log is **`[jank] event loop blocked for ~107101ms` with `ops: []`** — 107
  seconds, no tracked async op. That is the Electron main thread being **starved at the OS level**
  (it can't get scheduled), not the IDE's own code blocking. Corroborating: `files:mkdir` 12,856 ms,
  `files:saveFile` 12,200 ms, `git:branch` **104,315 ms** — every subprocess crawls because the OS
  is swamped. ~94 `Socket` handles persist throughout.

## The concrete lead — stale `.mcp.json` spawns a heavy MCP per session
`C:\Web App\AgentIDE\.mcp.json` (gitignored, per-machine) currently reads:
```json
{ "mcpServers": { "ouroboros": {
  "type": "stdio",
  "command": "C:\\Web App\\Agent IDE\\node_modules\\electron\\dist\\electron.exe",
  "args": ["C:\\Web App\\Agent IDE\\out\\main\\ouroborosMcp.js"],
  "env": { "ELECTRON_RUN_AS_NODE": "1" } } } }
```
Two problems:
1. **It launches a full `electron.exe`** (run-as-node) per session — heavy, not the lightweight
   standalone the CLAUDE.md describes (Wave 22/60 moved the graph to `C:\Web App\codebase-graph-mcp`).
2. **The path is the legacy space-bearing `C:\Web App\Agent IDE`** (pre-rename) + `out/main/ouroborosMcp.js`,
   which is stale/possibly-missing. A failing-then-retrying MCP launch could itself become a spawn storm.

Each project root (AgentIDE / Gamify / ContractorApp) likely has its own `.mcp.json`; check all three.

## Hypothesis for the fresh session to VERIFY (do not assume — this is where I stopped)
**Many Claude sessions × (1 heavy MCP spawn per `.mcp.json` per session) × (full repo scan per launch)
= machine lockup.** Open questions, in priority order:
1. **How many `codebase-memory-mcp.exe` / `electron.exe`(run-as-node) / `node` MCP processes are
   actually running, and who is their PARENT?** Run `tasklist` / `Get-Process` + parent-PID lookup.
   Parent = `claude.exe`? the IDE? Are they orphaned (never reaped)?
2. **Why ~94?** The user has only ~4 real external Claude sessions. Is the IDE **spawning phantom/
   historical sessions** (session-restore loop, re-spawn on disconnect via `onConnectionDisconnect`,
   a background-jobs loop)? Or is ONE session spawning many MCP instances (spawn-per-tool-call leak,
   or retry storm from the stale `.mcp.json` path)?
3. **Does each MCP launch do a FULL cold repo scan** instead of reading the cached SQLite DB? If the
   standalone re-indexes on every startup, each of the 94 launches is a full tree-sitter scan. (See
   prior art below — cold-index is already known-problematic.)
4. **Is the `.mcp.json` stale-path the trigger?** Fix the path/command first (point at the real
   standalone, no-space path) and see if the storm stops — cheap, high-signal.

## Prior art to connect (already in the repo)
- `roadmap/bugs/2026-05-26-fk-constraint-failures-on-cold-index.md` — cold-index issues.
- `silent-buildrepoindex-hang` (HANDOFF backlog) — repo-index build hanging.
- `roadmap/bugs/2026-05-20-packaged-ram-leak.md`.
- `roadmap/docs/standalone-mcp.md` — standalone MCP reference (install, storage, debugging).
- CLAUDE.md "Standalone MCP absolute-path install" known-issue: `.mcp.json` uses machine-local
  absolute paths, "not portable" — this is exactly that hazard biting.

## What was done THIS session (committed on `freeze-fix-and-wave-101-scaffold`, NOT pushed)
1. `e0c1f822` git subprocess semaphore (cap concurrent git) — crash-stopper, helped but not the cause.
2. `b58cbb03` gate diff-review to IDE-owned sessions — removed one uncached git flood.
3. `59283e03` remove xterm debug logs.
4. `684e9f81` **remove the entire tool-approval subsystem** + ignore external (non-paneId) sessions
   at dispatch + make `pre_tool_use.mjs` fire-and-forget (no approval socket). 97 files, ~6.5k deleted.
5. `e63e43a4` post-removal cleanup (docs, instrumentation, dead `getPermissionContext`).
All verified green (tsc + `npm run build` + test:hooks 254 + test:ipc 549). These removed real socket
problems but did **NOT** stop the machine lockup — confirming the cause is the MCP process storm.

## Anti-pattern to avoid (what looped this session)
Four wrong mechanism theories (process-table → semaphore-queue → diffReview → hook-dispatch) all came
from trusting in-app instrumentation that pointed at sockets/git. The lockup is an **OS-level process
storm** the in-app `[trace:*]` could never see. **Start at the OS process list, not the app log.**

---

## Raw log (2026-05-30 14:23–14:32 launch, machine lockup)

```
[bootstrap] UV_THREADPOOL_SIZE set to 32
14:23:11.939 > Running SQLite data migrations...
14:23:11.942 > All migrations complete
14:23:11.951 > [sessionStore] initialised
14:23:12.113 > listening on named pipe \\.\pipe\agent-ide-hooks
14:23:12.114 > listening on named pipe \\.\pipe\ouroboros-tools
14:23:12.184 > installed lib/ouroboros.mjs -> C:\Users\coles\.claude\hooks\lib\ouroboros.mjs
14:23:12.187 > installed pre_tool_use.mjs -> C:\Users\coles\.claude\hooks\pre_tool_use.mjs   (fire-and-forget hook reinstalled)
14:23:12.260 > updated install complete -- version cbf73bc06dc0c3d7
14:23:12.265 > [claude-usage-poller] spawning: powershell.exe [ '-NoLogo', '-Command', '& claude' ]
14:23:30.179 > [perf] startup: app-ready=179ms ... window-ready=2303ms renderer-bundle-loaded=18578ms first-render=18633ms
14:24:02.187 > [jank] event loop blocked for ~504ms -- janks 1; active handles=146 (Socket:96, MessagePort:46, Server:3, ChildProcess:1)
14:24:05.466 > [ipc-perf] slow handler { channel: 'git:branch', ms: 3802 } (x3)
14:24:32.956 > [jank] event loop blocked for ~1183ms -- janks 2; Socket:94
14:24:37.537 > [jank] event loop blocked for ~2975ms -- janks 3; Socket:103
14:24:40.966 > [jank] event loop blocked for ~3229ms -- janks 4; Socket:111
14:24:50.413 > [jank] event loop blocked for ~9247ms -- janks 5; Socket:98
14:25:01.023 > [jank] ~2595ms; 14:25:05.537 ~4314ms (janks 9,10)
14:25:05.750 > [ipc-perf] slow handler { channel: 'git:branch', ms: 34088 } (x3, ~32-34s)
14:25:07.423 > [ipc-perf] slow handler { channel: 'files:saveFile', ms: 1666/1904 }
14:25:12.192 > [ipc-perf] git:branch ms: 6433 (x3)
14:27:04.900 > [jank] event loop blocked for ~107101ms (107 SECONDS) -- janks 17; ops: []; active handles=145 (Socket:96)
14:27:23.207 > [ipc-perf] files:mkdir ms: 12856 (x2)
14:27:23.401 > [jank] ~18301ms -- janks 18
14:28:34.979 > [jank] ~68142ms (68s) -- janks 19; Socket:94
14:28:49.876 > [ipc-perf] files:mkdir ms: 1249/698 (x6)
14:28:49.883 > [claude-usage-poller] spawning: powershell.exe [ '& claude' ]   (2nd poller spawn)
14:28:52.507 > [jank] ~17328ms -- janks 20; MessagePort:47
14:28:54.666 > [ipc-perf] git:branch ms: 104315 (x3)  (104 SECONDS)
14:29:06.319 > [ipc-perf] files:saveFile ms: 12198 (x6)
14:29:17.051 > [jank] ~21061ms -- janks 23
14:29:26.974 > [ipc-perf] files:mkdir ms: 4170 (x2)
14:29:27.106 > [claude-usage-poller] timeout -- trust: false usage: false exit: false   (poller starved out)
14:29:27.706 > [ipc-perf] git:branch ms: 31915 / 21393 (x3)
14:29:28.604 > active handles=149 (Socket:96, MessagePort:47, Server:3, ChildProcess:2, Pipe:1)
14:29:42.245 > [ipc-perf] git:branch ms: 14272 (x3); 14:29:46 git:branch 4451 (x3)
14:30:18..14:31:23 > sustained [jank] 0.2-1.7s blocks, eldP99 climbing 100->312ms; Socket:92, MessagePort:46
14:30:52.688 > [jank] ~11349ms -- janks 79
14:31:02.997 > [jank] ~5854ms -- janks 81
14:31:10.756 > [jank] ~7559ms -- janks 82; files:mkdir 646 (x2)
14:31:14.288 > git:branch 4179 (x3); files:saveFile 2907 (x2)
14:31:23.135 > [jank] ~2341ms -- janks 90
... sustained 0.2-1s blocks through 14:32; janks total reached ~99; Socket:92 steady; heap ~28MB (NOT a heap problem)
```

Note: heap stays ~21–33 MB the entire time — this is **not** a memory leak in the Electron process
itself. The blocking is external (other processes starving the OS), consistent with the MCP storm.
