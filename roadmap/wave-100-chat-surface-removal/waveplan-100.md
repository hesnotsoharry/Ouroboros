---
status: PAUSED
created: 2026-05-19
updated: 2026-05-19
wave: 100
slug: chat-surface-removal
tag: v2.20.0
paused: Sequenced behind wave-99-agent-completion-rail-indicators (it de-couples the live workbench shell from the retired chat-thread-status path — a prerequisite). Also requires re-scope per the SCOPE CORRECTION below before resuming.
---

# Wave 100 — Chat Surface Removal: De-Chat the Codebase

## ⚠️ SCOPE CORRECTION (2026-05-19) — read before executing any phase

Two corrections landed after Phase 0 / Phase A, from a working-tree check:

1. **`src/renderer/components/Layout/ChatOnlyShell/` is NOT chat UI — DO NOT DELETE IT.** It is the live "chat workbench shell" (Wave 89+ terminal-first); `App.helpers.tsx:255` mounts it for chat-windows, the immersive flag, **and all mobile web** (`isMobileWeb` is locked to it), passing `terminal={hooks.terminal}` — it hosts terminal sessions. The "ChatOnlyShell" name is a historical artifact (Wave 42 "chat-only shell" → Wave 89 terminal workbench). **Phase B must NOT delete `ChatOnlyShell/` and must NOT strip the App.helpers immersive branch.** The renderer cut shrinks to the genuinely-dead `AgentChat/` *conversation* components only, and only those `ChatOnlyShell` no longer imports once the rail wave finishes its de-coupling.
2. **Sequenced behind wave-99-agent-completion-rail-indicators.** That wave rewires `useWorkbenchAttention` off `AgentChatThreadRecord.status` (retired chat thread) onto the live `AgentSession` signal — severing the workbench's dependency on the chat backend. Deleting the `agentChat` thread store (Phase D) before that lands would break their in-flight work. Resume only after wave-99 (rail) is merged.

Phase A (helper relocation) is complete but its commit is HELD pending re-scope. The phase tables below still reflect the pre-correction scope for ChatOnlyShell/Phase B — they MUST be re-grounded before resuming.

## Status

PAUSED · target v2.20.0 · drafted 2026-05-19. Blocked behind wave-99-rail + needs Phase B re-scope (see SCOPE CORRECTION above).

## Context — why this wave exists

The in-IDE chat surface was retired when the product pivoted to a terminal-only design (interactive PTY Claude Code / Codex sessions, covered by the Max subscription; the chat surface invoked `claude -p` which is moving to API pricing). Prior commits (`45988746`, `66021908`) bypassed chat startup but left the code in the tree as intact dead weight. This wave removes it for real, behind the pre-removal snapshot tag `archive/chat-surface-2026-05-19` (commit `71d4b813`).

The triage (`roadmap/discovery/2026-05-19-de-chat-triage.md`) found the removal is larger and cleaner than "delete the chat UI." Its master finding: **nothing post-chat calls `buildContextPacket`** (the owner declined to port context injection). That single fact converts an entire context-intelligence subsystem — the context-packet builder, ranker, classifier, graph-summary builder, decision/outcome JSONL writers, the `train-context.py` pipeline, and the auto-router — from "wired and live-looking" to dead code. Several of its hook taps (`hooksContextOutcome`, `hooksRankerReadTap`) fire on every PTY event and early-return as structural no-ops because the session was never registered by the chat bridge.

What must survive is precise and proven by importers outside the chat dirs: the PTY agent bridge (`streamJsonTypes`, `claudeStreamJsonRunner`), Codex *terminal* sessions (`codexExecRunner` via `codexSessionProvider`), subagent lineage tracking used by the hooks pipeline (`subagentTracker`, `subagentLinkTrace`, `subagentLinkResolver`), the repo indexer, edit provenance, the telemetry SQLite store, and the codebase-memory MCP graph. Wave 98 already relocated orchestration types to `@shared`, so the type-barrel split the triage flagged is already done; this wave only checks which `@shared/types/orchestration*` exports go orphaned.

## Goal

After Wave 100, the codebase contains no in-IDE chat surface, no context-packet/ranker/training subsystem, and no auto-router: `src/renderer/components/AgentChat/`, `src/renderer/components/Layout/ChatOnlyShell/`, `src/main/agentChat/` (minus a small must-keep set), the chat-only provider adapters, the context-intelligence modules under `src/main/orchestration/`, and `src/main/router/` are gone. The IDE still launches into the terminal workbench and spawns both Claude and Codex terminal sessions normally; the codebase-memory MCP graph, DiffReview, AgentMonitor, telemetry, and mobile/web access are untouched. Chat-only config keys are removed and purged from existing user configs by a `migrateChatSurface()` migration. The Lexical dependencies are uninstalled.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-100-chat-surface-removal/wave-100-decisions.md`.

These were locked by the owner during the triage session — they are inherited, not open prompts:

1. **Chat surface fully retired**, including the newer Wave 86 `chatStateNewPath` / `DualEmitOrchestrator` path and its `chatCommand:*` / `chatState:*` IPC channels. RESOLVED.
2. **Context injection NOT ported** to terminal mode. Therefore the entire context-packet/ranker/training/graph-summary cluster is CUT. RESOLVED.
3. **Codex terminal sessions KEPT** — only the Codex *chat* path (`codexAdapter*`, `codexAppServer*`, `codexContextBuilder`) is removed; `codexCliSettings`, `codexExecRunner`, `providers.multiProvider`, and `codexSessionProvider` stay. RESOLVED.
4. **Auto-router (`src/main/router/`) CUT entirely**, including its shadow-routing call in `hooks.ts`, `observeDatasetGrowth` in `main.ts`, `routerShadowDrainHandler` in `mainTelemetryHandlers.ts`, and the `routerSettings` config key. RESOLVED.
5. **Codebase-memory MCP graph and mobile/web remote access KEPT** — out of scope; they serve terminal sessions, not chat. RESOLVED.
6. **Archive mechanism: git tag** `archive/chat-surface-2026-05-19` (no in-repo folder copy). RESOLVED.
7. **Semver: minor `v2.20.0`** — removal of a whole (already-dead) feature surface with no external/public API contract break. Per the development-pipeline semver-judgment grant. RESOLVED.

## Scope

**In scope:**

- Remove `src/renderer/components/AgentChat/` and `src/renderer/components/Layout/ChatOnlyShell/`; strip the `isImmersive` / `ChatOnlyShellWrapper` branch from `src/renderer/App.helpers.tsx`; remove `src/renderer/types/electron-agent-chat.d.ts` and its re-export from `electron.d.ts`.
- Remove `src/main/agentChat/` except the must-keep set: `subagentTracker.ts`, `subagentLinkTrace.ts`, `subagentLinkResolver.ts`, plus `utils.ts`/`chatOrchestrationBridgeTypes.ts`/`settingsResolver.ts` *after* their live exports are relocated (Phase A).
- Remove chat IPC handlers (`src/main/ipc-handlers/agentChat*.ts`), the Wave 86 cluster (`chatStateNewPath.ts`, `dualEmitOrchestrator.ts`, `shadowTap.ts`, `chatOrchestrationSingletons.ts`, `chatStateError.ts`, `crashRecovery.ts`), their registrations in `ipc.ts` / `ipc-handlers/index.ts`, and the chat preload surface.
- Remove chat-only provider adapters in `src/main/orchestration/providers/`: `claudeCodeAdapter*`, `codexAdapter*`, `codexAppServer*`, `codexContextBuilder`, `claudeWarmProcessManager*`, `providerAdapter.ts`. Keep `streamJsonTypes.ts`, `claudeStreamJsonRunner.ts`, `codexExecRunner*.ts`, `spawnCostDrainHandler.ts`.
- Remove the context-intelligence subsystem in `src/main/orchestration/`: `contextPacketBuilder*`, `contextSelector*`, `contextSelectorRanker*`, `contextClassifier*`, `contextSignalCollector`, `graphSummaryBuilder`, `contextDecisionWriter`, `contextOutcomeWriter`, `contextOutcomeObserver*`, `contextRetrainStartup`, `contextRetrainTrigger*`, `contextRankerTelemetry`, `contextWorker*`, `events.ts`, and `tools/train-context.py`; remove the hook-tap registrations (`hooksContextOutcome`, `hooksRankerReadTap`) in `hooksTapRunner.ts`; remove startup wiring in `main.ts` (`initDecisionWriter`, `initOutcomeWriter`, `startContextRetrainTriggerIfEnabled`, `loadPersistedContextCache`, `startContextRefreshTimer`) and the matching shutdown calls.
- Remove `src/main/router/` and its cross-references.
- Settings UI: remove the Agent Chat groups in `AgentSection.tsx`, the `agentChat` entry in `ModelSlotsSection.tsx`, and `RouterSettingsGroup`; rehome or remove `AgentContextPacketSection`/context-layer toggle per the Phase 0 contextLayer finding; narrow `layout` and `theming.fonts` schema objects (drop `immersiveChat`, `chatSidebarMode`, `chat`).
- Config: remove chat-only schema keys (`agentChatSettings`, `chat`, `dockPersistence`, `ecosystem.codexAppServerTransport`, `modelSlots.agentChat`, `routerSettings`, and ranker keys confirmed dead in Phase 0); author `migrateChatSurface()` in `configMigrations.ts`.
- Dependencies: `npm uninstall lexical @lexical/react lexical-beautiful-mentions`; drop `test:lexical` and `test:agentchat` scripts; regenerate the lockfile via `npm run lockfile:sync`.
- CHANGELOG `[2.20.0]`, version bump, local tag `v2.20.0` (no push per bulletin).

**Out of scope:**

- The codebase-memory MCP graph (`src/main/codebaseGraph/`) — KEEP. Verdict locked; not touched.
- Mobile (`mobileAccess`, `sessionDispatch`) and web (`webAccess*`) remote access — KEEP; they dispatch terminal sessions. Deferral path: separate decision if ever retired.
- Codex *terminal* sessions and `codexCliSettings` — KEEP. Only the Codex chat path is removed.
- DiffReview (`review.enhanced`), AgentMonitor, edit provenance, telemetry SQLite store — KEEP.
- ~~`contextLayer.autoSummarize` deferral~~ — RESOLVED by Phase 0: no CLAUDE.md-generation consumer exists (the generator shares only the `spawnClaude` utility, no data path). Per ADR Decision 8, the whole `contextLayer/` is CUT in Phase F — moved INTO scope.
- Any rename/redesign of surviving code — pure removal, no opportunistic refactors.
- Push — held until 2026-06-01 per the GH Actions bulletin. Local commit + tag only.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR lock + removal-boundary verification | `orchestrator` | Confirm the must-keep set still holds at HEAD via `trace_call_path`/grep for importers OUTSIDE the chat dirs. Resolve three open checks: (a) does `contextLayer` (repo-map) have any consumer surviving the packet's death, or does it join the CUT set; (b) do `electron-orchestration.d.ts` + `@shared/types/orchestration*` have a terminal-mode consumer (DiffReview/AgentMonitor) or are they orphaned by chat IPC removal; (c) exact router cross-ref sites in `hooks.ts`/`main.ts`/`mainTelemetryHandlers.ts`. Materialize the final CUT/KEEP file lists + per-phase cross-ref edits in the ADR. **No code.** |
| A | Relocate live helpers off chat modules | `sonnet-implementer` | Move `getErrorMessage` from `agentChat/utils.ts` → `src/main/utils.ts` (10+ live IPC handlers import it); relocate `ActiveStreamContext` type out of `agentChat/chatOrchestrationBridgeTypes.ts` (only `hooksSkillExecutionTap.ts` consumes it); relocate `resolveClaudeCliSettings`/`resolveCodexCliSettings` out of `agentChat/settingsResolver.ts`. Update all importers. Behavior-preserving. Gate: `tsc.node` + `tsc.web` + `test:main`/`test:ipc` scoped. |
| B | Remove renderer chat surface | `sonnet-implementer` | Delete `AgentChat/` + `Layout/ChatOnlyShell/`; strip the immersive branch in `App.helpers.tsx` so it always renders `InnerAppLayout`; remove `electron-agent-chat.d.ts` + its `electron.d.ts` re-export. UI-bearing (`Layout/**`) → smoke gate fires; `sonnet-phase-reviewer` pass (renderer shell boot path). Gate: `tsc.web` + `test:renderer`/`test:layout` scoped + app boots. |
| C | Remove chat IPC + preload + Wave 86 wiring | `sonnet-implementer` | Delete `ipc-handlers/agentChat*.ts`; remove `registerAgentChatHandlers`/`cleanupAgentChatHandlers` and `registerChatStateNewPathHandlers` from `ipc.ts` + `ipc-handlers/index.ts`; remove chat methods from the preload bridge; remove cache-invalidation calls in `filesHelpers.ts`/`gitOperations.ts` if Phase 0 cut the context cache. Boundary (IPC) → `sonnet-phase-reviewer` pass. Gate: `tsc.node` + `test:ipc`/`test:preload` scoped + Claude terminal session spawns. |
| D | Remove agentChat main module + Wave 86 files + config/shutdown fixes | `sonnet-implementer` | Delete `src/main/agentChat/` except the must-keep set; delete the 6 Wave 86 files; fix `mainShutdown.ts` (`closeThreadStore`), `configSchemaTail.ts`/`configAppTypes.ts` (chat settings constants/types). Boundary (startup/config) → `sonnet-phase-reviewer` pass. Gate: `tsc.node` + `test:main` scoped + IDE relaunches clean + terminal session spawns. |
| E | Remove chat-only provider adapters | `sonnet-implementer` | Delete `claudeCodeAdapter*`, `codexAdapter*`/`codexAppServer*`/`codexContextBuilder`, `claudeWarmProcessManager*`, `providerAdapter.ts`; remove `killAllWarm` (`main.ts`) and `shutdownCodexAppServerProcesses` (`mainShutdown.ts`). KEEP `streamJsonTypes`, `claudeStreamJsonRunner`, `codexExecRunner*`, `spawnCostDrainHandler`. Boundary (provider layer; Codex split) → `sonnet-phase-reviewer` pass. Gate: `tsc.node` + `test:main`/`test:orchestration` scoped + BOTH Claude and Codex terminal sessions spawn. |
| F | Remove context-intelligence subsystem + contextLayer + startup/hook wiring | `sonnet-implementer` | Delete the packet/selector/ranker/classifier/signal/graph-summary/writers/observer/retrain/worker/telemetry modules + `tools/train-context.py`; remove hook taps in `hooksTapRunner.ts`; remove `initDecisionWriter`/`initOutcomeWriter`/`startContextRetrainTriggerIfEnabled`/`loadPersistedContextCache`/`startContextRefreshTimer` from `main.ts` + matching shutdown calls. **Per ADR Decision 8 (full cut):** delete the whole `src/main/contextLayer/` dir (58 files), `repoIndexer*` + `lspDiagnosticsProvider` (now orphaned — CUT), and `registerOrchestrationStubHandlers` + the `orchestration:previewContext`/`buildContextPacket` channels (`ipc.ts:184-219`); unwire the 9 contextLayer hook call sites + `initContextLayer` in `main.ts` (exact sites in ADR Decision 8). Remove orphaned `@shared/types/orchestration*` + `electron-orchestration.d.ts` + the `orchestration` prop on `ElectronAPI` (Phase 0 Check b: no terminal consumer). **Largest phase — split mid-flight** (contextLayer dir / repoIndexer cluster / orchestration-types as sub-commits). Boundary/risky → `sonnet-phase-reviewer` pass. Gate: `tsc` both + `test:main`/`test:hooks`/`test:codebasegraph` scoped + terminal-edit + subagent-tracking smoke + a Claude session start (exercises the unwired `onSessionStart` hook). |
| G | Remove auto-router subsystem | `sonnet-implementer` | Delete `src/main/router/`; remove `shadowRouteHookEvent` call in `hooks.ts`, `observeDatasetGrowth` in `main.ts`, `routerShadowDrainHandler` in `mainTelemetryHandlers.ts`, `routerSettings`/`routerLastRetrainCount` config keys, `train-router.py` if present. Boundary (hook/startup) → `sonnet-phase-reviewer` pass. Gate: `tsc.node` + `test:main`/`test:hooks` scoped + terminal prompt submit works, no router errors in log. |
| H | Settings UI cut + rehome + schema narrowing | `sonnet-implementer` | Remove Agent Chat groups in `AgentSection.tsx`, the `agentChat` slot in `ModelSlotsSection.tsx`, and `RouterSettingsGroup`; rehome or remove `AgentContextPacketSection`/context-layer toggle per Phase 0; narrow `layout` (drop `immersiveChat`/`chatSidebarMode`), `theming.fonts` (drop `chat`), remove `agentChatSettings`/`chat`/`dockPersistence`/`ecosystem.codexAppServerTransport` schema keys. UI-bearing (Settings) → smoke + `sonnet-phase-reviewer` pass. Gate: `tsc` both + `test:renderer` scoped + Settings renders with sections gone. |
| I | Dependency + script cleanup + config migration | `sonnet-implementer` | `npm uninstall lexical @lexical/react lexical-beautiful-mentions` (confirm no non-chat importer via grep/knip first); drop `test:lexical`/`test:agentchat` scripts; `npm run lockfile:sync`; author `migrateChatSurface()` in `configMigrations.ts` purging the removed keys (mirror `migrateChatPrimary()`); document orphaned keys. Gate: `tsc.node` + `test:main` scoped + IDE launches against a legacy config without schema errors. |
| J | Wave wrap — ship | `orchestrator` | Per `~/.claude/notes/wave-process.md` § Wave's final phase: full lint + full tsc (both) + full vitest + `/review` mechanical gap-check + CHANGELOG `[2.20.0]` + version bump + local tag `v2.20.0` (no push). Run `/promote-vendor-lessons 100` and `/audit-followups wave-100-chat-surface-removal`; update `HANDOFF.md` + temperature log. Confirm the archive tag is intact. |

### Phase ordering

```
Phase 0 (ADR + boundary verification) — gates the wave
   │
   ▼
Phase A (relocate live helpers off chat modules)  ← unblocks all later deletions
   │
   ▼
Phase B (renderer chat removal)
   │
   ▼
Phase C (chat IPC + preload + Wave 86 wiring)     ← remove consumers before producers
   │
   ▼
Phase D (agentChat main module + config/shutdown)
   │
   ▼
Phase E (chat-only provider adapters)
   │
   ▼
Phase F (context-intelligence subsystem + wiring)  ← largest; may split
   │
   ▼
Phase G (auto-router subsystem)
   │
   ▼
Phase H (settings UI + schema narrowing)
   │
   ▼
Phase I (deps + scripts + migration)
   │
   ▼
Phase J (wrap)
```

Strictly sequential — each phase must leave `tsc` green, and the ordering removes consumers before the producers they import (renderer → IPC → main module → adapters → orchestration core). **Phase 0 gates the wave**: if the boundary verification surfaces a must-keep file with a chat-only importer the triage missed, or a terminal-mode consumer of a type slated for deletion, the orchestrator surfaces it as a user-judgment moment before Phase A. Phase A must precede every deletion because it severs the live non-chat dependencies on chat modules.

## Risks

| Risk | Mitigation |
|---|---|
| A must-keep file (`subagentTracker`, `streamJsonTypes`, `codexExecRunner`, repo indexer) is deleted, breaking terminal sessions or the hooks pipeline. | Phase 0 materializes the must-keep list with the proving importer for each; every deletion phase ends with `tsc.node` clean (catches dangling imports) plus a terminal-session smoke. |
| `contextLayer` (repo-map) is cut but a surviving terminal feature still consumes it, or is kept but is actually dead. | Phase 0 check (a) traces consumers explicitly before Phase F decides; the verdict is recorded in the ADR with the proving/absent importer. |
| `electron-orchestration.d.ts` / `@shared/types/orchestration*` are deleted as orphaned but DiffReview or AgentMonitor still reference them. | Phase 0 check (b) traces terminal-mode consumers; Phase F's `tsc.web` gate surfaces any unresolved reference before commit. |
| Over-aggressive provider removal severs the Codex *terminal* path while removing the Codex *chat* adapter. | Decision 3 keep-list is explicit (`codexExecRunner`, `codexSessionProvider`, `codexCliSettings`); Phase E smoke spawns a real Codex terminal session, not just `tsc`. |
| Removing chat-only config keys breaks electron-store schema validation on launch for users with existing configs. | Phase I authors `migrateChatSurface()` mirroring the proven `migrateChatPrimary()` pattern; Phase I smoke launches against a legacy config carrying `agentChatSettings`. |
| Removing the hook taps (`hooksContextOutcome`, `hooksRankerReadTap`) accidentally removes a live tap and breaks subagent lineage or edit provenance. | Those are distinct taps kept in Phase F; `test:hooks` scoped + a terminal-session edit smoke (subagent tracking still records) gate the phase. |
| `npm uninstall lexical*` breaks a non-chat importer. | Phase I greps/`knip` for Lexical importers outside `AgentChat/` before uninstalling; `tsc` + `test:renderer` confirm. |
| A deletion reveals an unexpected live consumer mid-phase (rabbit hole). | Per development-pipeline escape hatch: commit partial work or revert, file a Tier 3 follow-up with the diagnosis, continue planned phases — do not expand the phase. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR + boundary verification only. No code. Coverage = `trace_call_path`/grep importer audit recorded in ADR. |
| A | n/a | n/a | Helper relocation, behavior-preserving. Coverage = `tsc.node` + `tsc.web` + `test:main`/`test:ipc` scoped. |
| B | n/a | smoke | Deletion + shell-boot. Coverage = `tsc.web` + `test:renderer`/`test:layout` scoped + UI smoke (app boots into terminal workbench). |
| C | n/a | smoke | Coverage = `tsc.node` + `test:ipc`/`test:preload` scoped + Claude terminal-session spawn smoke. |
| D | n/a | smoke | Coverage = `tsc.node` + `test:main` scoped + relaunch + terminal-spawn smoke. |
| E | n/a | smoke | Coverage = `tsc.node` + `test:main`/`test:orchestration` scoped + Claude AND Codex terminal-spawn smoke. |
| F | n/a | smoke | Coverage = `tsc` both + `test:main`/`test:hooks`/`test:codebasegraph` scoped + terminal-edit + subagent-tracking smoke. |
| G | n/a | smoke | Coverage = `tsc.node` + `test:main`/`test:hooks` scoped + terminal prompt-submit smoke. |
| H | n/a | smoke | Coverage = `tsc` both + `test:renderer` scoped + Settings-render UI smoke. |
| I | n/a | smoke | Coverage = `tsc.node` + `test:main` scoped + legacy-config launch smoke. |
| J | full | full | Standard wave wrap: full vitest + lint + tsc + `/review`. |

Test shape: **trophy** — the static type checker (`tsc` on both projects) is the dominant safety net for a deletion wave (it catches every dangling import), backed by per-phase integration smokes that exercise the one boundary that must survive (terminal sessions still spawn and stream). No new unit logic is introduced, so unit coverage is n/a; the walking-skeleton rule does not fire (no new architectural surface — this is removal of an existing, already-dead one).

## Acceptance criteria

- [ ] `src/renderer/components/AgentChat/` and `src/renderer/components/Layout/ChatOnlyShell/` do not exist.
- [ ] `src/main/agentChat/` contains only the must-keep set (`subagentTracker.ts`, `subagentLinkTrace.ts`, `subagentLinkResolver.ts`, and any helper file emptied in Phase A); `grep -rn "from '.*agentChat/" src/main src/renderer` returns matches only for the must-keep modules.
- [ ] `src/main/router/` does not exist; `grep -rn "src/main/router\|shadowRouteHookEvent\|routerSettings" src tsconfig*.json` returns 0 matches in live code.
- [ ] The context-intelligence modules (`contextPacketBuilder*`, `contextSelector*`, `contextClassifier*`, `graphSummaryBuilder`, `contextDecisionWriter`, `contextOutcomeWriter`, `contextOutcomeObserver*`, `contextRetrain*`, `contextWorker*`, `contextRankerTelemetry`) and `tools/train-context.py` do not exist.
- [ ] Chat-only provider adapters (`claudeCodeAdapter*`, `codexAdapter*`, `codexAppServer*`, `codexContextBuilder`, `claudeWarmProcessManager*`, `providerAdapter.ts`) do not exist; `codexExecRunner*`, `claudeStreamJsonRunner`, `streamJsonTypes`, `spawnCostDrainHandler` DO exist.
- [ ] `npx tsc --noEmit -p tsconfig.web.json` and `npx tsc --noEmit -p tsconfig.node.json` both exit 0 at wave wrap.
- [ ] `npm run lint` exits 0 at wave wrap.
- [ ] `npm test` (full vitest) exits 0 at wave wrap.
- [ ] `npm ls lexical` reports the package absent; `test:lexical` and `test:agentchat` scripts are gone from `package.json`.
- [ ] `package-lock.json` carries a valid `.lockfile-sync.marker` (regenerated via `npm run lockfile:sync`).
- [ ] `migrateChatSurface()` exists in `configMigrations.ts` and removes `agentChatSettings`, `chat`, `dockPersistence`, `ecosystem.codexAppServerTransport`, `modelSlots.agentChat`, `routerSettings`, and the Phase-0-confirmed dead ranker keys.
- [ ] Launching the built app against a config containing legacy `agentChatSettings` produces no schema-validation error in the main-process log.
- [ ] A Claude Code terminal session AND a Codex terminal session each spawn and stream output in the Terminal panel.
- [ ] `CHANGELOG.md` has a `[2.20.0]` entry; `package.json` version is `2.20.0`; local tag `v2.20.0` exists at the wave tip.
- [ ] `/review` returns PASS (or FLAG with all flags addressed) for the wave's aggregate diff.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR materializes the CUT/KEEP file lists, the contextLayer + orchestration-types consumer verdicts, and the router cross-ref sites. No runtime impact. |
| A | Internal — no observation point | n/a | Helper relocation only; covered by `tsc` + scoped tests. No user-facing surface changes. |
| B | IDE main window renders the terminal workbench shell | strip `ChatOnlyShellWrapper` branch in `App.helpers.tsx` → `App` renders `InnerAppLayout` unconditionally → renderer mounts the workbench layout → Electron `BrowserWindow` paints the shell | App window opens directly into the terminal workbench; no chat panel or immersive shell appears; devtools console shows no missing-module or render errors. |
| C | A Claude Code terminal session's output in the Terminal panel | command palette "new terminal session" → terminal spawn IPC handler (chat handlers removed, terminal handlers intact) → `pty.ts` spawns `claude` → `pty:data:*` IPC streams → xterm renders in the Terminal panel | The Terminal panel streams Claude's interactive output normally; the session starts with no error despite the `chatCommand:*`/`agentChat:*` channels being gone. |
| D | The IDE relaunching and a Claude terminal session starting | app launch → `main.ts` startup (agentChat init removed) → `config` loads (chat schema keys removed) → window renders → start terminal session → pty streams to Terminal panel | The IDE relaunches with no startup error; config loads without the removed chat keys; a Claude terminal session spawns and streams. |
| E | Both a Claude and a Codex terminal session streaming in their Terminal panels | start Codex session → `codexSessionProvider` → `codexExecRunner` (kept) → pty stream → Terminal panel; start Claude session → `ptyClaude` → pty stream → Terminal panel | Both sessions spawn and stream output; removing the Codex chat adapter left the Codex terminal path intact. |
| F | A terminal session performing file edits, visible in the Terminal panel and the Diff Review panel | start session → agent issues an Edit tool call → hooks pipeline fires (subagent tracking + edit provenance kept; context taps removed) → pty stream → Terminal panel; diff surfaces in the Diff Review panel | Agent edits stream in the terminal and appear in Diff Review; no error from the removed context-packet/ranker pipeline; subagent lineage is still tracked. |
| G | A terminal session prompt submission in the Terminal panel | submit prompt in terminal → pty → `claude` processes → `user_prompt_submit` hook fires (router shadow call removed) → pty stream → Terminal panel | Prompt submission and response stream normally; the main-process log shows no router-related error now that `src/main/router/` and its hook call are gone. |
| H | The Settings panel | command palette "open Settings" → Settings renderer mounts → `AgentSection` (chat groups removed) + `ModelSlotsSection` (agentChat slot removed) + Router section (removed) render → panel paints | Settings opens with the Agent Chat groups, the agent-chat model slot, and the Router section gone; remaining controls render and persist on change; no blank or broken sections. |
| I | The IDE launching against a pre-existing config that still contains `agentChatSettings` | launch with legacy `config.json` → electron-store load → `configMigrations` runs `migrateChatSurface()` → orphaned chat keys purged → window renders | The IDE launches cleanly from a config carrying legacy chat keys; the migration strips them; the log shows no schema-validation error. |
| J | Internal — no observation point | n/a | Wave wrap: all gates green; HANDOFF reflects new state; result brief at `roadmap/wave-100-chat-surface-removal/wave-100-result.md`. |

### Data-shape probes

```bash
# Removed renderer dirs
test ! -d src/renderer/components/AgentChat && test ! -d src/renderer/components/Layout/ChatOnlyShell && echo "RENDERER-CHAT-GONE"

# Router subsystem gone, no live cross-refs
test ! -d src/main/router && echo "ROUTER-DIR-GONE"
grep -rn "shadowRouteHookEvent\|routerSettings\|observeDatasetGrowth" src/main || echo "ROUTER-REFS-GONE"

# Must-keep files still present
for f in src/main/agentChat/subagentTracker.ts src/main/orchestration/providers/streamJsonTypes.ts src/main/orchestration/providers/codexExecRunner.ts; do test -f "$f" && echo "KEEP-OK $f"; done

# Context-intelligence subsystem gone
ls src/main/orchestration/contextPacketBuilder*.ts src/main/orchestration/contextClassifier*.ts 2>/dev/null && echo "STILL-PRESENT (FAIL)" || echo "CONTEXT-INTEL-GONE"

# Lexical uninstalled
npm ls lexical >/dev/null 2>&1 && echo "LEXICAL-STILL-PRESENT (FAIL)" || echo "LEXICAL-GONE"

# Migration authored
grep -n "migrateChatSurface" src/main/configMigrations.ts && echo "MIGRATION-OK"

# Both tsc projects clean
npx tsc --noEmit -p tsconfig.web.json && echo "WEB-OK"
npx tsc --noEmit -p tsconfig.node.json && echo "NODE-OK"
```

## Files the next agent should read first

1. `roadmap/discovery/2026-05-19-de-chat-triage.md` — the triage with locked decisions, CUT/KEEP buckets, cross-ref cleanup list, and sequenced removal steps. Primary grounding.
2. `roadmap/wave-100-chat-surface-removal/wave-100-decisions.md` — this wave's ADR; Phase 0 materializes the final file lists + consumer verdicts here.
3. `src/renderer/App.helpers.tsx` — the immersive-chat branch to strip (Phase B); the live entry is `InnerAppLayout`.
4. `src/main/main.ts` and `src/main/mainShutdown.ts` — startup/shutdown wiring to unwire (writers, retrain trigger, context cache, `killAllWarm`, `shutdownCodexAppServerProcesses`, `observeDatasetGrowth`).
5. `src/main/ipc.ts` and `src/main/ipc-handlers/index.ts` — chat handler registrations to remove (Phase C).
6. `src/main/agentChat/utils.ts`, `chatOrchestrationBridgeTypes.ts`, `settingsResolver.ts` — Phase A relocation sources (live exports `getErrorMessage`, `ActiveStreamContext`, the CLI-settings resolvers).
7. `src/main/orchestration/providers/` — the keep/cut split for adapters (Phase E); `codexExecRunner`/`claudeStreamJsonRunner`/`streamJsonTypes` stay.
8. `src/main/hooksTapRunner.ts` — hook-tap registrations; remove `hooksContextOutcome` + `hooksRankerReadTap`, keep subagent/edit-provenance taps (Phase F).
9. `src/main/configMigrations.ts` — `migrateChatPrimary()` is the pattern for `migrateChatSurface()` (Phase I).
10. `roadmap/wave-98-orchestration-types-relocation/wave-98-result.md` — confirms the `@shared/types/orchestration*` layout and that the type-barrel split is already done.
11. `~/.claude/notes/wave-process.md` — wave structure + per-phase gate discipline.

## Note to the implementer

This wave deletes a retired, already-dead chat surface and the context-intelligence subsystem that existed only to feed it. The spirit is "remove cleanly, break nothing terminal." The single load-bearing constraint: at every phase boundary, `tsc` on both projects must be green and a real terminal session (Claude in earlier phases, plus Codex from Phase E on) must still spawn and stream. Type-green is necessary but not sufficient — a deletion can compile and still have unwired the running app.

Temptations to resist: do not "tidy" surviving code adjacent to a deletion (the must-keep modules stay byte-for-byte unless an import path must change); do not remove a must-keep file because it "looks chat-related" — the ADR's keep-list is proven by external importers, trust it over the filename; do not collapse phases to save commits (the bisect surface across a 300-file removal is the safety net); do not port any chat capability "while you're here" — the owner declined context injection deliberately. If a deletion reveals an unexpected live consumer of something slated for removal, STOP, commit or revert the partial work, file a Tier 3 follow-up with the diagnosis, and continue the planned phases — do not expand the phase to chase it.

The contextLayer and orchestration-types verdicts are Phase 0's job; do not guess them mid-deletion. If Phase 0 left either as "cut pending check" and the check wasn't done, raise it before Phase F.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

> A green gate with nothing Tier 3 means the orchestrator dispatches the next phase in the same turn. The turn ends between phases ONLY for: a Tier 3 discovery that needs a user call, a genuine user-judgment decision the plan doesn't determine, or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** at `roadmap/wave-100-chat-surface-removal/wave-100-decisions.md` with Decisions 1–7 RESOLVED. If the CUT/KEEP file lists are stub placeholders, Phase 0 runs to populate them.
2. **Phase 0** — `orchestrator` (may dispatch `haiku-explorer` for the importer audits): confirm the must-keep set, resolve contextLayer / orchestration-types / router cross-ref checks, materialize the final file lists in the ADR. **Gate:** ADR file lists materialized AND the three checks have recorded verdicts. If a must-keep file shows a chat-only importer the triage missed, or a deletion target shows a terminal consumer, end the turn for user judgment.
3. **Phase A** — dispatch `sonnet-implementer`: relocate `getErrorMessage`, `ActiveStreamContext`, the CLI-settings resolvers; update all importers. **Gate:** `tsc.node` + `tsc.web` + `test:main`/`test:ipc` scoped exit 0 + orchestrator diff review.
4. **Phase B** — dispatch `sonnet-implementer`: remove renderer chat surface + immersive branch + `electron-agent-chat.d.ts`. **Gate:** `tsc.web` + `test:renderer`/`test:layout` scoped + `sonnet-phase-reviewer` pass (shell boot path) + UI smoke (app boots into terminal workbench).
5. **Phase C** — dispatch `sonnet-implementer`: remove chat IPC handlers + preload surface + Wave 86 registrations. **Gate:** `tsc.node` + `test:ipc`/`test:preload` scoped + `sonnet-phase-reviewer` pass (IPC boundary) + Claude terminal-session smoke.
6. **Phase D** — dispatch `sonnet-implementer`: remove agentChat main module (minus must-keep) + Wave 86 files + config/shutdown fixes. **Gate:** `tsc.node` + `test:main` scoped + `sonnet-phase-reviewer` pass (startup/config) + relaunch + terminal-spawn smoke.
7. **Phase E** — dispatch `sonnet-implementer`: remove chat-only provider adapters; keep the terminal runners. **Gate:** `tsc.node` + `test:main`/`test:orchestration` scoped + `sonnet-phase-reviewer` pass (provider/Codex split) + Claude AND Codex terminal-spawn smoke.
8. **Phase F** — dispatch `sonnet-implementer`: remove the context-intelligence subsystem + hook taps + startup wiring; resolve contextLayer + orphaned orchestration types per Phase 0. **Gate:** `tsc` both + `test:main`/`test:hooks`/`test:codebasegraph` scoped + `sonnet-phase-reviewer` pass (risky/large) + terminal-edit + subagent-tracking smoke. If the phase exceeds a clean commit, split it (file lists from ADR) and gate each split.
9. **Phase G** — dispatch `sonnet-implementer`: remove `src/main/router/` + cross-refs + `routerSettings`. **Gate:** `tsc.node` + `test:main`/`test:hooks` scoped + `sonnet-phase-reviewer` pass (hook/startup) + terminal prompt-submit smoke.
10. **Phase H** — dispatch `sonnet-implementer`: settings UI cut + rehome + schema narrowing. **Gate:** `tsc` both + `test:renderer` scoped + `sonnet-phase-reviewer` pass + Settings-render UI smoke.
11. **Phase I** — dispatch `sonnet-implementer`: uninstall Lexical (after grep/knip), drop dead scripts, `lockfile:sync`, author `migrateChatSurface()`. **Gate:** `tsc.node` + `test:main` scoped + legacy-config launch smoke.
12. **Phase J (wrap)** — orchestrator runs: `npm run lint` (full); `tsc` both; `npm test` (full vitest, background — ~17 min Windows-local); `/review` mechanical gap-check (PASS or FLAG-addressed); write `wave-100-result.md`; CHANGELOG `[2.20.0]`; bump `package.json` to `2.20.0`; commit wrap; `git tag v2.20.0`; `/promote-vendor-lessons 100`; `/audit-followups wave-100-chat-surface-removal`; update `HANDOFF.md` + temperature-log row; confirm `archive/chat-surface-2026-05-19` intact. **Do NOT push** (bulletin: GH Actions minutes held until 2026-06-01). **Gate to close:** all gates green AND HANDOFF current.

UI smoke gate fires for Phases B and H (`src/renderer/components/Layout/**` and Settings) — run `/ui-smoke 100` at wave end per the smoke-config; manual fallback if MCP can't launch.
