---
status: SHIPPED
created: 2026-05-27
updated: 2026-05-27
---

# Wave 100 — Chat Surface Removal: Result Brief

## What shipped

Wave 100 removed the AgentChat chat surface from the Agent IDE — the entire subsystem built around
the in-app LLM chat panel (Lexical-based composer, agent chat threading, context layer, auto-router).
The product now runs the terminal workbench shell only, with `ChatOnlyShell` remaining as the live
shell variant. v2.35.0.

## Phases committed

| Phase | Commit | Description |
|---|---|---|
| A | (prior wave setup) | Phase A — initial stash + worktree creation |
| B | Pre-G commits | AgentChat/ component tree deletion |
| C | Pre-G commits | agentChat/ main-process deletion |
| D | Pre-G commits | contextLayer/ main-process deletion |
| E | Pre-G commits | autoRouter subsystem deletion |
| F | Multiple (see below) | Orchestration types + IPC surface + dead exports |
| G | `55febaa5` | Auto-router subsystem final cleanup |
| H | `441715ed` | Settings UI cut + schema narrowing |
| I | `c1996dec` | Lexical deps removed + config migration |
| J | `c4604ffe` | CHANGELOG + version bump to v2.35.0 |

Phase F sub-commits:
- `69345aeb` — delete orphaned repoIndexer + lspDiagnosticsProvider
- `837d1a31` — remove orchestration types + preload + ElectronAPI prop
- `ad7bc61b` — fix stale test mocks after context-intelligence cut
- `dd2d2a98` — catalog app:getCrashLogCount + allowlist persist:shared

## Files changed (Phase H + I summary)

**Phase H — Settings UI + schema:**
- `src/main/configAppTypes.ts` — removed `agentChatSettings`, `contextLayer`, `ContextLayerConfig`
- `src/main/configDefaults.ts` — removed all `AGENT_CHAT_*` constants
- `src/main/configSchemaTail.ts` — removed `contextLayer` and `agentChatSettings` schema objects, removed `agentChat` from `modelSlots`
- `src/main/configTypes.ts` — removed `agentChat` from `ModelSlotAssignments`
- `src/main/backgroundJobs/jobRunner.ts` — `buildProviderEnv('agentChat')` → `'terminal'`
- `src/main/ptyAgent.ts` — `buildProviderEnv('agentChat')` → `'terminal'`
- `src/main/session/sessionSpawnAdapter.ts` — `buildProviderEnv('agentChat')` → `'terminal'`
- `src/preload/preloadSupplementalApiKeys.ts` — removed `'contextLayer'` and `'graph'` (dead since Wave 22) from union
- `src/preload/preloadSupplementalApis.ts` — removed `contextLayer` API block
- `src/renderer/components/Settings/AgentSection.tsx` — removed all agent chat groups; now only `AgentFeaturesGroup`
- `src/renderer/components/Settings/AgentSection.test.tsx` — updated to match stripped section
- `src/renderer/components/Settings/ModelSlotsSection.tsx` — removed `agentChat` slot config
- `src/renderer/components/Settings/useProvidersSection.ts` — removed `agentChat: ''` from `DEFAULT_SLOTS`
- `src/renderer/hooks/useProgressSubscriptions.ts` — removed `useContextLayerProgress`
- `src/renderer/types/electron-foundation.d.ts` — removed `agentChatSettings`, `contextLayer`, `agentChat` slot
- `src/renderer/types/electron-observability.d.ts` — removed `ContextLayerProgress`, `ContextLayerAPI`
- `src/renderer/types/electron-workspace.d.ts` — removed `contextLayer: ContextLayerAPI`
- `src/web/webPreload.ts` — removed `contextLayerAPI` from web preload
- `src/web/webPreloadApisSupplemental.ts` — `buildOrchestrationApis` now returns `{ codemodeAPI }` only
- `src/main/ipc-handlers/configHelpers.ts` — removed `'agentChatSettings'`, `'contextLayer'` from `IMPORTABLE_KEYS`

**Phase I — deps + migration:**
- `package.json` — removed `@lexical/react`, `lexical`, `lexical-beautiful-mentions`; removed `test:agentchat`, `test:lexical` scripts; version bumped to `2.35.0`
- `CLAUDE.md` — removed `test:agentchat` and `test:lexical` rows from scoped test table
- `src/main/configMigrations.ts` — added `migrateChatSurface()` one-shot migration
- `src/main/config.ts` — wired `migrateChatSurface()` with idempotency guard
- `src/main/configMigrations.test.ts` — added 6 tests for `migrateChatSurface`

## Key decisions

**Scope correction (critical):** `ChatOnlyShell/` was NOT deleted in this wave — it is the live terminal
workbench shell. As a result, the following config keys were retained and NOT removed:
- `dockPersistence` — used by `useDockSlotHeights.ts`, `useOverlayDrawerWidths.ts`
- `layout.immersiveChat`, `layout.chatSidebarMode` — used by ChatOnlyShell layout
- `theming.fonts.chat` — used in ChatOnlyShell theming
- `ecosystem.codexAppServerTransport` — used in web mode

These removals are deferred to the wave that deletes `ChatOnlyShell/`.

**`buildProviderEnv` slot migration:** All three callers of `buildProviderEnv('agentChat')` were
migrated to `buildProviderEnv('terminal')` — the correct semantic replacement for background job
runners, PTY agents, and session spawn adapters.

**Dead `'graph'` key removal:** `SupplementalApiKey` union had a stale `'graph'` entry from Wave 22's
codebase-graph removal. Removed alongside `'contextLayer'`.

**Lockfile pending:** Lexical packages were removed from `package.json` manually (Windows npm would
regenerate the lockfile in unsupported format). `npm run lockfile:sync` (WSL2) must be run before push.

## Config migration

`migrateChatSurface()` runs once at `getConfig()` call time and purges:
- Top-level: `agentChatSettings`, `contextLayer`, `routerSettings`, `routerLastRetrainCount`
- Sub-key: `modelSlots.agentChat`

Keys intentionally excluded: `dockPersistence`, `layout.*`, `theming.fonts.chat`, `ecosystem.*`
(all have live ChatOnlyShell consumers).

## Test coverage

- `configMigrations.test.ts` — 6 new tests for `migrateChatSurface` (no-op, delete, sub-key remove, idempotency)
- `AgentSection.test.tsx` — rewritten for stripped section (only AgentFeaturesGroup)
- tsc.node and tsc.renderer both green at Phase H and I commit points

## Deferred items

1. **`rankerHitsSchema.ts` orphan** — `src/main/orchestration/rankerHitsSchema.ts` consumer
   (`contextRankerTelemetry.ts`) was deleted in Phase F. Schema file remains. Clean up in a follow-up.

2. **ChatOnlyShell-gated removals** — `dockPersistence`, `layout.immersiveChat`, `layout.chatSidebarMode`,
   `theming.fonts.chat`, `ecosystem.codexAppServerTransport` — all blocked on ChatOnlyShell deletion.

3. **lockfile:sync** — must be run in WSL2 (`npm run lockfile:sync`) before merge + push to regenerate
   `package-lock.json` after the Lexical package removals.

## Wave temperature

HOT — scope correction cascade (ChatOnlyShell discovery mid-wave), two context compaction events
requiring handoff + summary continuations, TypeScript errors requiring diagnostician dispatch.
Core removal is clean and correct; overhead was process friction not implementation complexity.
