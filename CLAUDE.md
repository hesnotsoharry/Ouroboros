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

The full suite consistently exceeds agent timeouts (~1000s / ~17 min on Windows-local; CI Windows is ~25–30 min). After touching files in a subsystem, run the matching scoped script — each finishes in 30-120s. Composition: scoped runs are NOT mutually exhaustive (e.g. `test:agentchat` is a subset of `test:renderer`), pick the smallest one that covers your change.

| Script | Path scope | Use when you touched |
|---|---|---|
| `test:main` | `src/main` | Electron main process, IPC handlers, native deps |
| `test:renderer` | `src/renderer` | React UI (large — prefer narrower) |
| `test:agentchat` | `src/renderer/components/AgentChat` | Chat composer, conversation, mentions, slash menu |
| `test:lexical` | `…/AgentChat/lexicalComposer` | Lexical composer plugins / bridge |
| `test:layout` | `src/renderer/components/Layout` | App shell, panes, title bar, workbench |
| `test:filetree` | `src/renderer/components/FileTree` | File tree |
| `test:codebase-graph-mcp` | `packages/codebase-graph-mcp` | Standalone graph MCP package (tool surface, smoke) |
| `test:orchestration` | `src/main/orchestration` | Orchestration runtime |
| `test:ipc` | `src/main/ipc-handlers` | IPC handler implementations |
| `test:hooks` | `src/main/hookInstaller`, `src/main/hooks` | Hook installer / named pipe server |
| `test:preload` | `src/preload` | contextBridge surface |
| `test:web` | `src/web` | Web stub layer (mobile / capacitor) |
| `test:shared` | `src/shared` | Shared types / pure helpers |
| `test:tools` | `tools`, `scripts` | Build / analysis tooling |

Full suite + lint + typecheck still runs at commit/wave-end. Scoped runs are for the implementation loop.

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
| `packages/codebase-graph-mcp/`| Standalone MCP server (npm package) — 14 graph tools + ping, stdio transport, SQLite + tree-sitter |
| `src/main/`                   | Node.js main process — IPC, PTY, hooks server, config                                           |
| `src/preload/`                | contextBridge — typed API surface                                                               |
| `src/renderer/components/`    | Feature folders: Layout, Terminal, FileTree, FileViewer, AgentMonitor, CommandPalette, Settings |
| `src/renderer/hooks/`         | Shared hooks: useConfig, useTheme, usePty, useAgentEvents, useFileWatcher                       |
| `src/renderer/contexts/`      | React contexts: ProjectContext                                                                  |
| `src/renderer/themes/`        | Theme definitions (retro, modern, warp, cursor, kiro, material, light, high-contrast)           |
| `src/renderer/types/`         | `electron.d.ts` — full IPC type contract                                                        |

Each subdirectory has its own `CLAUDE.md` with a subsystem-specific file map.

## Codebase Graph — use it FIRST

The codebase-graph MCP server is a standalone Node process configured in `.mcp.json` at the repo root
(gitignored — present on each machine after Wave 22 install). Tools surface as `mcp__ouroboros__*` in
fresh Claude Code sessions (restart Claude Code after any `.mcp.json` edit to pick up the config).

**Default behavior for symbol queries: graph tools FIRST, Grep is the fallback.** When the question is
"who calls X", "where is X defined", "what's the body of X", "what depends on X" — use
`mcp__ouroboros__trace_call_path`, `mcp__ouroboros__search_graph`, `mcp__ouroboros__get_code_snippet`,
`mcp__ouroboros__detect_changes`, or `mcp__ouroboros__query_graph` BEFORE reaching for Grep. Grep
returns text matches including comments and same-name unrelated occurrences; the graph returns actual
structural edges.

If you find yourself running a Grep for an identifier and following it with three Reads to disambiguate,
you skipped the graph. See `~/.claude/rules-deferred/graph-tool-routing.md` for the full routing table.

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

## Known Issues / Tech Debt

- Background job queue concurrency cap and queue length cap (50) are hardcoded — expose as settings when the feature matures.
- `refs/ouroboros/checkpoints/<threadId>` refs accumulate over time — GC policy (keep last 50) runs lazily on next checkpoint capture, not on a schedule.
- `ecosystem.rulesAndSkillsInstallEnabled` defaults false — the rules-and-skills install path is not yet wired end-to-end. Remove flag and default to true when wired.
- `tokenStorage` localStorage-on-web (MED) — elevate to HIGH only when web mode is exposed beyond trusted networks.
- `AnyOverrides = Record<string, any>` in Wave 26 profile code — one-line type escape hatch; fix when the surrounding code is next refactored.
- **Standalone MCP absolute-path install** — `.mcp.json` entries use machine-local absolute paths to `dist/index.js`. Not portable. `npm publish` of `@hesnotsoharry/codebase-graph-mcp` (Wave 22 Decision 7, Phase 8 attempt) enables `npx` invocation and removes the hard path dependency.
- **Asar packaging for internalMcp** — packaged Electron builds need `extraResources`/`asarUnpack` wiring for `packages/codebase-graph-mcp/dist/` and native modules. Filed: `roadmap/follow-ups/2026-05-27-internalmcp-asar-packaging.md`.
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

## Rules, Hooks, and Commands

Context-specific rules are in `.claude/rules/` (injected automatically by glob match). Hooks enforce constraints deterministically via `.claude/settings.json`. Slash commands are in `.claude/commands/` (project) and `~/.claude/commands/` (global).

**UI-bearing changes require a signed manual smoke entry** — any wave touching `src/renderer/components/Layout/**` must include a completed smoke checklist in its result brief before push. See `~/.claude/rules-deferred/manual-smoke-gate.md` for the rule and `roadmap/docs/manual-smoke-gate-checklist.md` for the checklist template.

**Session pickup:** start at `roadmap/HANDOFF.md` (evergreen orientation — next action / in-flight / blockers / critical context). Wave history index at `roadmap/_index-history.md`; archived waves at `roadmap/_archived/index.md`; decisions at `roadmap/decisions/index.md`.

**Global pipeline rule:** `~/.claude/rules/development-pipeline.md` — three-lane (Build/Fix/Orient) pipeline. This repo's `roadmap/` aligns with its taxonomy (`follow-ups/`, `deferred/`, `bugs/`, `decisions/`).

**Dispatch reflex** (added 2026-05-12): before 3+ exploration calls (Read/Grep/Glob) on the same question or continuing debug past one failed fix, DISPATCH from the catalog (`haiku-explorer`, `sonnet-explorer`, `sonnet-diagnostician`, `haiku-implementer`, etc. — see `~/.claude/rules/agent-catalog.md`). Hooks `~/.claude/hooks/dispatch_reflex_nudge.mjs` and `~/.claude/hooks/fresh_session_reminder.mjs` provide nudges. Fresh-session suggestions below 60% context utilization are usually wrong — hard work below threshold = dispatch a subagent, not session reset.

**UI smoke gate** (added Wave M-7, 2026-05-18): UI-bearing waves run `/ui-smoke {wave}` at wave-end. The slash command dispatches `sonnet-smoke-runner` (catalog agent), which reads `.claude/smoke-config.json` and uses `mcp__Claude_Preview__*` to navigate routes in the running dev server, capture screenshots + console + network state, and write a structured report to `roadmap/wave-{N}-{slug}/wave-{N}-smoke-report.md`. Manual fallback fires automatically if MCP can't launch — see `~/.claude/rules-deferred/manual-smoke-gate.md`.

**Follow-up closure audit** (added Wave M-8, 2026-05-19): At wave-end (Phase 6 step), run `/audit-followups wave-{N}-{slug}` to dispatch `haiku-followup-auditor` (catalog agent, cross-project). The agent reads the wave's diff + result brief, classifies each OPEN follow-up (RESOLVED | LIKELY-RESOLVED | NEEDS-REVIEW | ACTIVE), auto-closes RESOLVED items (frontmatter + move to `_archived/follow-ups/`), and writes an audit report at `roadmap/wave-{N}-{slug}/wave-{N}-followup-audit.md`. Also wired as the first step of `/triage-sweep` (run `/audit-followups all` to gather evidence before manual triage). See `~/.claude/rules/agent-catalog.md` for the agent's full description.

## Vendor Gotchas

Per-vendor lessons captured from wave work — load before touching a vendor's API surface for the second time. Written during waves; promoted via `/promote-vendor-lessons`.

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
