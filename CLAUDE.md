# Ouroboros — Claude Code Instructions

Agent-first Electron desktop IDE for launching/monitoring Claude Code sessions. Three-process architecture (main → preload → renderer) with strict context isolation.

## Build / reload notes

- `npm run dev` — spawns an Electron dev instance with Vite HMR for the renderer; main-process changes require restarting the dev instance.
- `npm run build` — produces `out/`. Anything that loads from `out/` (notably the codemode proxy's `ouroboros` MCP server defined in `~/AppData/Local/Temp/codemode-proxy-config.json`) keeps using the previously-loaded code in memory. To pick up rebuilt code, restart whatever forked the subprocess (e.g., the Claude Code session that spawned the MCP server).
- `npm run dist` — builds + packages with electron-builder for distribution.

## Gotcha maintenance rule

When you discover a non-obvious constraint, surprise behavior, or load-bearing pattern during work, you MUST append a line to the nearest subsystem `CLAUDE.md`'s `## Gotchas` section before completing the task. Do this in the same commit as the fix or change that revealed the gotcha.

Format: `- **<topic>**: <rule>. Reason: <why>.`

Examples of what counts: a flag that must be set in a specific order, a state machine transition that looks redundant but isn't, an import that must use a specific path for a non-obvious build reason, a workaround for a third-party bug.

If the discovery doesn't fit any existing CLAUDE.md, add it to the most directly affected subsystem's CLAUDE.md or, if truly cross-cutting, to this root CLAUDE.md.

## Commands

- `npm run dev` — start dev server + Electron (hot-reload renderer)
- `npm run build` — production build (electron-vite)
- `npm run dist` — build + package with electron-builder
- `npm test` — run the full vitest suite (~17 min Windows-local, agent-unfriendly — prefer scoped scripts below)
- `npm run test:watch` — vitest in watch mode

### Scoped vitest scripts — agents should prefer these

The full suite consistently exceeds agent timeouts (~1000s / ~17 min on Windows-local; CI Windows is ~25–30 min). After touching files in a subsystem, run the matching scoped script — each finishes in 30-120s. Composition: scoped runs are NOT mutually exhaustive, pick the smallest one that covers your change.

| Script | Path scope | Use when you touched |
|---|---|---|
| `test:main` | `src/main` | Electron main process, IPC handlers, native deps |
| `test:renderer` | `src/renderer` | React UI (large — prefer narrower) |
| `test:layout` | `src/renderer/components/Layout` | App shell, panes, title bar (does **NOT** cover Workbench — sibling dir, no scoped script; run `npx vitest run src/renderer/components/Workbench` directly, see `.claude/known-issues.md`) |
| `test:filetree` | `src/renderer/components/FileTree` | File tree |
| `test:orchestration` | `src/main/orchestration` | Orchestration runtime |
| `test:ipc` | `src/main/ipc-handlers` | IPC handler implementations |
| `test:hooks` | `src/main/hookInstaller`, `src/main/hooks` | Hook installer / named pipe server |
| `test:preload` | `src/preload` | contextBridge surface |
| `test:web` | `src/web` | Web stub layer (mobile / capacitor) |
| `test:shared` | `src/shared` | Shared types / pure helpers |
| `test:tools` | `tools`, `scripts` | Build / analysis tooling |

Use scoped tests during implementation. Run `npm run validate` for broad shared changes; the full suite remains scheduled/manual because it exceeds ordinary agent timeouts.

**CI runs affected-only tests** (`.github/workflows/ci.yml`): push/PR runs `vitest --changed <base>` — only tests the module graph links to the diff. A green PR/push CI does NOT mean the full suite ran. The full suite runs on the **weekly schedule** (Monday 06:00 UTC) and via manual `workflow_dispatch`. `forceRerunTriggers` in `vitest.config.ts` escalates to a full run when `package.json`, the lockfile, any vite/vitest config, or the IPC contract (`src/renderer/types/electron*.d.ts`) changes — the contract is type-only so the import graph can't see it. Before a release, trigger a manual full run from the Actions tab.

### Lockfile

`package-lock.json` is regenerated **only** via `npm run lockfile:sync` — never hand-edited, never Windows-regenerated. The wrapper runs a from-scratch install in WSL2 (`~/lockgen/agent-ide/` on ext4) to produce a complete cross-platform lockfile (win32+linux+darwin optional deps). The pre-push hook (`scripts/hooks/pre-push`, install once: `git config core.hooksPath scripts/hooks`) blocks any lockfile change lacking a valid `.lockfile-sync.marker`. Advisory bypass: `LOCKFILE_SYNC_GUARD_BYPASS=1 git push`. Background: `roadmap/wave-92-cross-platform-lockfile-stryker/`.

## Key Files

| File                               | Role                                       |
| ---------------------------------- | ------------------------------------------ |
| `src/main/main.ts`                 | Electron entry point                       |
| `src/main/ipc.ts`                  | All IPC handlers                           |
| `src/main/pty.ts`                  | node-pty session management                |
| `src/main/hooks.ts`                | Named pipe server for Claude Code events   |
| `src/main/config.ts`               | electron-store schema + persistence        |
| `src/preload/preload.ts`           | contextBridge — typed `window.electronAPI` |
| `src/renderer/App.tsx`             | Root React component                       |
| `src/renderer/types/electron.d.ts` | Single source of truth for IPC shapes      |

## Folder Map

| Path                          | Contents                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `C:\Web App\codebase-graph-mcp\` | Standalone MCP server (own git repo, post Wave 22 post-wrap) — 14 graph tools + ping, stdio transport, SQLite + tree-sitter |
| `src/main/`                   | Node.js main process — IPC, PTY, hooks server, config                                           |
| `src/preload/`                | contextBridge — typed API surface                                                               |
| `src/renderer/components/`    | Feature folders: Layout, Terminal, FileTree, FileViewer, AgentMonitor, CommandPalette, Settings |
| `src/renderer/hooks/`         | Shared hooks: useConfig, useTheme, usePty, useAgentEvents, useFileWatcher                       |
| `src/renderer/contexts/`      | React contexts: ProjectContext                                                                  |
| `src/renderer/themes/`        | Theme definitions (retro, modern, warp, cursor, kiro, material, light, high-contrast)           |
| `src/renderer/types/`         | `electron.d.ts` — full IPC type contract                                                        |

Each subdirectory has its own `CLAUDE.md` with a subsystem-specific file map.

## Codebase Graph

The codebase-graph MCP server is a standalone Node process configured in `.mcp.json` at the repo root
(gitignored — present on each machine after Wave 22 install). Tools surface as `mcp__ouroboros__*` in
fresh Claude Code sessions (restart Claude Code after any `.mcp.json` edit to pick up the config).

For call and dependency questions such as "who calls X" or "what depends on X",
the graph can be faster and more accurate than text matching. Useful tools include
`mcp__ouroboros__trace_call_path`, `mcp__ouroboros__search_graph`, `mcp__ouroboros__get_code_snippet`,
`mcp__ouroboros__detect_changes`, and `mcp__ouroboros__query_graph`. Use Grep for
exact text, configuration, paths, and simple lookups. Pick the cheaper tool for
the question; graph use is not a gate.

Codemode is also enabled — graph tools surface as `servers.ouroboros.*` inside `execute_code`
(the codemode proxy's single tool). Example:
`await servers.ouroboros.trace_call_path({ symbol: 'parseConfig', direction: 'callers' })`.

Current graph size (Agent IDE, Wave 22 smoke): ~25.7K nodes / ~55.7K edges.

**Capability regression (Wave 22):** terminal Claude Code sessions running INSIDE the IDE no longer
receive auto-injected context. They behave like plain Claude Code CLI sessions anywhere else — Grep/Read
on demand, no pre-built context. Graph queries still work; they just require explicit tool calls instead
of automatic injection. See `roadmap/docs/standalone-mcp.md` for the full package reference.

## Key Conventions

### Two Event Systems — Don't Confuse Them

1. **Electron IPC** — `ipcRenderer.on` / `ipcMain.handle` via preload bridge (`menu:new-terminal`, `pty:data:${id}`)
2. **DOM CustomEvents** — `window.dispatchEvent` / `window.addEventListener` (`agent-ide:new-terminal`, `agent-ide:set-theme`, `agent-ide:open-settings`)

Never mix these. IPC events flow through preload. DOM events are renderer-only.

### Per-Window Project Isolation

Each window owns its project roots independently via `ManagedWindow.projectRoots` in `windowManager.ts`. The renderer persists roots per-window via `window.setProjectRoots()` IPC (not the global `multiRoots` config key). `pathSecurity` reads per-window roots first, with `defaultProjectRoot` as a cold-boot fallback only. Window sessions (roots + bounds) are persisted to `sessionsData` (SQLite) and restored on relaunch.

### Product Philosophy — Amplifier, Not Replacement

Ouroboros is not a generalist AI IDE like Cursor or Windsurf. It exists specifically to improve the Claude Code / Codex experience by amplifying the underlying agent, never throttling it.

- Never impose artificial turn limits, wall-clock timeouts, or cost-throttling on an agent surface — match CLI behavior; the model decides when it's done, not the IDE.
- Never build tool execution, agent loops, or subagent infrastructure inside the IDE — that is Claude Code's / Codex's job. The IDE observes and prepares context; it doesn't execute.
- Internal capabilities (e.g. the codebase graph) are valid when they make the IDE a better observer/preparer of context — not when they turn the IDE into a competing agent.
- Before building a new capability, ask: does this make the IDE a better observer/preparer, or is it trying to be the agent? If the latter, stop.

(Lesson from a 2026-03 incident: ~24 hours were spent building a full tool-execution engine — Anthropic API tool loop, subagent runner — that directly contradicted this philosophy and was later killed as policy-incompatible dead code. Check new work against this philosophy while it's still cheap to redirect, not after it's built.)

### New Boolean Feature Flags Default to `true`

When adding a new feature flag / opt-in setting to `ClaudeCliSettings`, `AgentChatSettings`, `configSchema*.ts`, or equivalent config schemas — default it to `true`, not `false`. Cole is the IDE's primary user; flags defaulted off don't get exercised in practice, so soak-testing never happens.

Default `false` remains correct for: destructive operations (data loss / state overwrite risk), security-sensitive surfaces (new OAuth scopes, new tool permissions, sandbox relaxations), unsoaked experimental code where a regression would be hard to diagnose, or flags depending on unguaranteed external state (a specific CLI version, etc.). When in doubt, default `true` and call it out explicitly so it can be flipped back.

### Auth Constraint — Max Subscription Only, No API Key

The IDE authenticates exclusively via Claude Max/Pro OAuth tokens managed by the Claude CLI (`~/.claude/.credentials.json`) — there is no Anthropic API key. Implications for any AI-calling feature:

- Direct Anthropic SDK calls using the OAuth token are not officially supported and are intermittently rejected by Anthropic — route AI calls through the Claude CLI (the `spawnClaude` pattern, e.g. `src/main/claudeMdGenerator.ts`, `src/main/flowTracer/`) instead of a direct `createAnthropicClient()` SDK path.
- Prompt caching and the `countTokens` endpoint require an API key and are NOT available under OAuth.
- The credential store's token refresh manager cannot refresh CLI-managed OAuth tokens (no `client_id`).

## Known Issues / Tech Debt

Diagnosed recurring problems with verified fixes live in [`.claude/known-issues.md`](.claude/known-issues.md) (signature / fix / pointer / assert format) — check there before re-diagnosing a symptom from scratch.

- Background job queue concurrency cap and queue length cap (50) are hardcoded — expose as settings when the feature matures.
- `refs/ouroboros/checkpoints/<threadId>` refs accumulate over time — GC policy (keep last 50) runs lazily on next checkpoint capture, not on a schedule.
- `ecosystem.rulesAndSkillsInstallEnabled` defaults false — the rules-and-skills install path is not yet wired end-to-end. Remove flag and default to true when wired.
- `tokenStorage` localStorage-on-web (MED) — elevate to HIGH only when web mode is exposed beyond trusted networks.
- `AnyOverrides = Record<string, any>` in Wave 26 profile code — one-line type escape hatch; fix when the surrounding code is next refactored.
- **Standalone MCP absolute-path install** — `.mcp.json` entries use machine-local absolute paths to `dist/index.js`. Not portable. `npm publish` of `@hesnotsoharry/codebase-graph-mcp` (Wave 22 Decision 7, Phase 8 attempt) enables `npx` invocation and removes the hard path dependency.
- **Asar packaging for internalMcp** — packaged Electron builds need `extraResources`/`asarUnpack` wiring for `C:\Web App\codebase-graph-mcp\dist\` and native modules. Historical detail remains in `roadmap/follow-ups/2026-05-27-internalmcp-asar-packaging.md`; current priority belongs in `roadmap/HANDOFF.md`.
- **Capability regression (Wave 22)** — terminal Claude Code sessions launched inside the IDE no longer receive auto-injected graph context. Deliberate per Wave 22 Decision 4 (Path A — stay scoped). Plain `mcp__ouroboros__*` tool calls still work in any fresh session via `.mcp.json`.
- **`projectName` normalization was broken before commit `78173b64`** — `serverBootstrap.ts` and `IndexingPipeline` derived the project name differently, causing all filtered queries to return empty on projects with uppercase directory names (`AgentIDE`, `ContractorApp`). Fixed in Wave 22 Phase 6 smoke. If filtered queries ever return empty unexpectedly, check whether the normalization in `buildContext()` matches what the DB rows were indexed under.

## Further Reading

- `roadmap/docs/architecture.md` — Full architecture, component tree, state management, ownership rules, security model
- `roadmap/docs/api-contract.md` — Complete IPC channel reference, file operations, PTY API
- `roadmap/docs/data-model.md` — Config schema, state types, event types
- `roadmap/docs/build.md` — Build tooling, Vite config, Monaco workers, path aliases, bundle analysis
- `roadmap/docs/chat-shell.md` — Chat-only shell (Wave 42+), workbench variant (Wave 46), material theming (Wave 45)
- `roadmap/docs/codemode-internalmcp-routing.md` — CodeMode routing for internalMcp, configuration, telemetry, rollback (Wave 51)
- `roadmap/docs/claude-md-lifecycle.md` — CLAUDE.md generation, grooming, and organic growth
- `roadmap/docs/hook-migration.md` — rule-to-hook conversion, rollback, and escalation
- `roadmap/docs/telemetry-parity.md` — telemetry parity architecture and migration recipe
- `roadmap/docs/context-ranker.md` — context ranker, weight modes, hit-rate telemetry
- `roadmap/docs/standalone-mcp.md` — Standalone codebase-graph MCP server: tools, install, storage, debugging
- `ai/vision.md` — Product vision, design north stars
- `ai/deferred.md` — Remaining unimplemented features, prioritized by area

## Working process

Start at `roadmap/HANDOFF.md`. Work directly from the request and existing code;
historical wave indexes and follow-up files are reference material, not an active
pipeline. Run focused verification for touched behavior and `npm run validate`
when the change is broad. Smoke rendered UI when it changes, without creating a
mandatory report artifact. Specialist agents are optional.

## Vendor Gotchas

Load relevant vendor lessons before touching that vendor's API surface; verify version-sensitive claims against current documentation.

| File | Vendor | Key lesson |
|---|---|---|
| `.claude/vendor-gotchas/xterm.md` | `@xterm/xterm` + addons | v6 WebGL load order (AFTER `term.open()`), context-loss flash fix, unicode-graphemes version string `'15-graphemes'`, no public cell-size API, open ghost-cursor conflict |
| `.claude/vendor-gotchas/stryker.md` | `@stryker-mutator/core` + vitest-runner | CI dual-frequency triggers, `--force` vs `--incremental`, `.stryker-tmp/` gitignore, `break:` floor discipline |
| `.claude/vendor-gotchas/stryker-electron.md` | Stryker + Electron native modules | 4-module no-touch list (`better-sqlite3`, `node-pty`, `@parcel/watcher`, `@node-rs/xxhash`), two load-bearing config options (`vitest.configFile`, `testFiles`), subsystem-boundary exclusion pattern |
| `.claude/vendor-gotchas/node-pty.md` | `node-pty` | Native module — Stryker exclusion only (see `stryker-electron.md`); no behavioral gotchas captured yet |
| `.claude/vendor-gotchas/wsl2-lockgen.md` | WSL2 + npm lockfile | Cross-platform lockfile generation via WSL2; `lockfile:sync` wrapper; pre-push guard |
| `.claude/vendor-gotchas/electron.md` | Electron | Electron-specific build and IPC gotchas |
| `.claude/vendor-gotchas/tree-sitter.md` | `web-tree-sitter` | WASM ABI drift (`@vscode/tree-sitter-wasm` ABI vs `web-tree-sitter` ABI) |
| `.claude/vendor-gotchas/claude-code.md` | Claude Code SDK | Claude Code integration gotchas |
