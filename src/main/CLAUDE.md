# src/main/ — Electron main process

Node.js main process for the Ouroboros IDE. Entry point is `main.ts`. Each subdirectory has its own CLAUDE.md.

## Subsystem Map

| Directory / File     | Role                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `main.ts`            | Entry point — app lifecycle, window creation, startup sequencing                                       |
| `ipc.ts`             | IPC orchestration — registers all handler domains, deduplicates channels                               |
| `config.ts`          | electron-store schema + persistence                                                                    |
| `pty.ts`             | node-pty session management                                                                            |
| `hooks.ts`           | Named pipe server for Claude Code hook events                                                          |
| `windowManager.ts`   | BrowserWindow lifecycle, multi-window tracking                                                         |
| `lsp.ts`             | LSP server lifecycle (start/stop per workspace root)                                                   |
| `extensions.ts`      | VS Code extension loading and management                                                               |
| `approvalManager.ts` | Pre-execution approval flow — response-file protocol at `~/.ouroboros/approvals/`                      |
| `hookInstaller.ts`   | Auto-installs Claude Code hook scripts; version tracked via SHA-256 of contents                        |
| `agentChat/`         | Chat thread persistence, orchestration bridge, session projection — see `agentChat/CLAUDE.md`          |
| `codebaseGraph/`     | In-process codebase knowledge graph engine — see `codebaseGraph/CLAUDE.md`                             |
| `contextLayer/`      | Repo-aware context enrichment for agent sessions — see `contextLayer/CLAUDE.md`                        |
| `orchestration/`     | Context preparation and provider coordination — see `orchestration/CLAUDE.md`                          |
| `ipc-handlers/`      | Domain-split IPC handler registrars — see `ipc-handlers/CLAUDE.md`                                     |
| `storage/`           | SQLite database layer and JSON→SQLite migration — see `storage/CLAUDE.md`                              |
| `web/`               | HTTP + WebSocket server for browser-based IDE access — see `web/CLAUDE.md`                             |
| `codemode/`          | Cloudflare CodeMode integration layer — see `codemode/CLAUDE.md`                                       |
| `hooks/`             | Stop/start hook handlers (gotcha nudge, session lifecycle)                                             |
| `delegationCoach/`   | Wave 61 — pattern-matched nudges that fire when Opus skips delegation; see `delegationCoach/CLAUDE.md` |

## Key Patterns

- **Approval flow**: `approvalManager` uses a response-file protocol at `~/.ouroboros/approvals/` — hook scripts poll this path rather than holding a socket open. Important for debugging approval timeouts.
- **Hook version tracking**: `hookInstaller.ts` auto-computes its version from SHA-256 of script contents — no manual bumping ever needed.
- **Startup sequencing**: `storage/migrate.ts` runs before `createWindow()` — a sequencing constraint that would be easy to violate when reorganizing startup code.
- **Config schema split**: Schema is spread across `configSchema.ts` → `configSchemaMiddle.ts` → `configSchemaTail.ts` and merged in `config.ts`. Add new keys by domain, not by convenience. Do not consolidate — the split enforces the 300-line ESLint limit.
- **IDE tool server is a reverse channel**: Normal flow is renderer → IPC → main. `ideToolServer.ts` inverts this — external Claude Code hook scripts connect to pull IDE state via `webContents.executeJavaScript` with a 10s timeout.
- **PTY files decomposed by concern**: `ptySpawn.ts` is shared by all session types. `ptyClaude.ts` and `ptyCodex.ts` only build argv — they do not spawn.

## Gotchas

- **Extension sandbox uses Node `vm`**: Not `worker_threads`. Extensions run synchronously in the main-process vm context. Long-running extension code blocks the main process.
- **LSP connections are per-project root**: `lspState.ts` maps `projectPath → client`. Opening a new project root spawns a new language server; the old one stays alive until explicitly stopped.
- **`jankDetector.ts`**: Logs main-thread event loop stalls above a threshold. If you see `[jank]` log lines, a synchronous operation in main is blocking. Don't remove the detector — investigate the cause.
- **`hookInstaller.ts` skips when `config.autoInstallHooks === false`**: Check this flag before debugging "why didn't hooks install".
- **IPC perf net**: `patchIpcMainHandle()` in `ipc.ts` wraps every `ipcMain.handle` channel; handlers taking ≥500ms emit `[ipc-perf] slow handler { channel, ms }` to the main-process log.
- **Both lifecycle hooks must emit `paneId`**: `assets/hooks/session_start.mjs` AND `assets/hooks/agent_start.mjs` must each read `process.env.OUROBOROS_PANE_ID` and set `payload.paneId`. If one omits it, pane-scoped renderer surfaces (`AgentSidebar` via `useWorkbenchAgentData(paneId)`) silently never match the session and render the empty state — data still reaches the global pool (the title-bar globe shows it), so the failure looks like a renderer bug, not a hook bug. Reason: the renderer matches a session to the focused tab by `session.paneId === activeTabId`; an `undefined` paneId never matches. Regression guard: `src/main/sessionStartHookPaneId.test.ts`.
- **Project-root paths persist across MANY config stores, not one**: a single project root is referenced in `sessionsData[].projectRoot`, `multiRoots`, `recentProjects`, `defaultProjectRoot`, `trustedWorkspaces`, `terminalSessions[].cwd`, and the **path-keyed** objects `canonWorkbenchSessions` / `terminalSessionsPerProject`. An out-of-band folder rename (renaming the dir on disk) leaves stale entries in all of them, which resurface in the UI. `runStaleRootsMigration()` (`migrateStaleRoots.ts`) drops entries whose path fails `fs.existsSync` at startup, and MUST run before `restoreWindowSessions` (wired in `main.ts` before `initWindowsAndServices`). `workspaceSnapshots` has no path field and is intentionally NOT pruned. Separately, rail removals prune `sessionsData` via `setWindowProjectRoots` (`windowManagerRailSync.ts`) — but ONLY on explicit removal, never on window close (closing a window must not destroy its session record).
- **Workspace trust is path-keyed and there is no trust-prompt UI**: `main.ts` `startBackgroundServices` enters "Restricted mode" (hooks + extensions + Claude auto-launch + MCP writes all DISABLED) when `defaultProjectRoot` isn't in `trustedWorkspaces` (`workspaceTrust.ts`, compared via `path.resolve` + lowercase on Windows). A folder rename silently breaks trust (the new path was never trusted) and there's NO renderer UI calling `workspace:trust` — so without intervention the app locks into restricted mode with no escape. `ensureRootTrusted(defaultProjectRoot, fs.existsSync)` runs at startup (`main.ts`, before `startBackgroundServices`) to auto-trust the configured default root if it exists. Symptom of restricted mode: in-app Claude sessions emit no hook events (so the AgentSidebar/globe only ever show EXTERNAL sessions).
- **`setConfigValue` is debounced + async, NOT immediate**: the underlying `conf`/electron-store `.set()` does a synchronous full-file read+write of the entire config every call; calling it on hot paths (bounds, sessionsData, terminalSessions) blocked the main event loop. `setConfigValue` now buffers in memory (`configWriteBuffer.ts`) and flushes ~200ms later, collapsing bursts into one write. Consequences: (1) reads stay correct because `getConfigValue` checks the pending buffer first (read-your-writes); (2) crash/security-sensitive keys MUST use `setConfigValueImmediate` (already wired for `trustedWorkspaces`, secret-migration keys) — it writes synchronously AND drops any queued debounced write for that key so a stale flush can't clobber it; (3) pending writes are flushed SYNCHRONOUSLY on quit via `flushPendingWritesSync()` called first in `performWillQuitShutdown` (`mainShutdown.ts`) — do not reorder it after subsystem teardown or writes will be lost.
