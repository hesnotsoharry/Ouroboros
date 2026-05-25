---
status: DRAFT
created: 2026-05-19
updated: 2026-05-19
owner: Cole
purpose: Triage what to keep vs. cut when removing the in-IDE chat surface and its supporting infrastructure, ahead of a terminal-only removal wave.
---

# De-Chat Triage — Chat surface removal + purpose-dead infrastructure

Pre-removal snapshot tag: **`archive/chat-surface-2026-05-19`** (commit `71d4b813`). Everything below is recoverable via `git checkout archive/chat-surface-2026-05-19 -- <path>`.

## Decisions locked (owner)

- **Chat surface fully retired** (AgentChat renderer, agentChat main module, chat adapters).
- **Wave 86 `chatStateNewPath` / `DualEmitOrchestrator` also retired** — its 8 agentChat dependencies + `chatCommand:*` / `chatState:*` IPC channels go.
- **Context injection NOT ported** to terminal mode ("I don't want any of it"). → see Master Finding.
- **Codebase-memory graph (MCP, ~18.3K nodes) KEPT** — general code intelligence, not chat-specific.
- **Archive mechanism: git tag** (no in-repo folder copy).
- **Codex terminal sessions KEPT** — cut only the Codex *chat* path (codexAdapter*, codexAppServer*, codexContextBuilder). `codexCliSettings`, `codexExecRunner`, `providers.multiProvider`, Codex PTY provider stay.
- **Router subsystem CUT entirely** (`src/main/router/`) — see Bucket 3.

## Master finding — one question resolved almost everything

Both triage passes independently surfaced the same hinge: *does any surviving design call `buildContextPacket`?*

The owner already answered it by declining to port context injection. **No terminal-mode feature builds a context packet.** That single fact converts the entire "wired but purpose-dead" cluster from DECIDE to **CUT**:

- The packet builder is the *only* consumer of the ranker, the classifier, the graph summary, and the context-layer repo map.
- The decision/outcome JSONL writers only fire when a packet is built with a chat `sessionId`. No chat = no writes.
- The hooks-pipeline taps that *look* live for terminal sessions (`contextOutcomeObserver`, `contextRankerTelemetry`, `hooksRankerReadTap`) are **structural no-ops** for every PTY session — they early-return on any `sessionId` not registered by the chat bridge. They fire on every terminal hook event and do nothing.

So the cleanup is far larger and far cleaner than "remove the chat UI."

## Bucket 1 — Chat code: dead & safe to remove

Per the removal blueprint (separate artifact). Headline:

- `src/renderer/components/AgentChat/` + `src/renderer/components/Layout/ChatOnlyShell/` — entire dirs.
- `src/main/agentChat/` — all except the must-keep files in Bucket 2.
- `src/main/ipc-handlers/agentChat*.ts` — all registrars; remove wiring in `ipc.ts` / `ipc-handlers/index.ts`.
- Chat-only adapters in `src/main/orchestration/providers/` (claudeCodeAdapter*, codexAdapter* / codexAppServer*, claudeWarmProcessManager*, providerAdapter).
- Wave 86 cluster: `chatStateNewPath.ts`, `dualEmitOrchestrator.ts`, `shadowTap.ts`, `chatOrchestrationSingletons.ts`, `chatStateError.ts`, `crashRecovery.ts`.

**Prereqs before deletion:**
- Extract `getErrorMessage` from `agentChat/utils.ts` → `src/main/utils.ts` (10+ live IPC handlers import it).
- Extract `ActiveStreamContext` type from `agentChat/chatOrchestrationBridgeTypes.ts` (only `hooksSkillExecutionTap.ts` uses it).
- Relocate `resolveClaudeCliSettings` / `resolveCodexCliSettings` out of `agentChat/settingsResolver.ts` (still useful for terminal spawn normalization).

## Bucket 2 — KEEP (load-bearing for terminal mode)

Inside the candidate dirs but proven live by non-chat importers:

- `agentChat/subagentTracker.ts`, `subagentLinkTrace.ts`, `subagentLinkResolver.ts` — hooks pipeline (PTY subagent lineage).
- `orchestration/providers/streamJsonTypes.ts`, `claudeStreamJsonRunner.ts` — PTY agent bridge, background jobs, `ai:stream`.
- `orchestration/providers/codexExecRunner.ts` (+ Helpers) — Codex *terminal* sessions (gated on Decision A below).
- `orchestration/providers/spawnCostDrainHandler.ts` — startup telemetry drain.
- `orchestration/repoIndexer*.ts` — backbone of the live contextLayer / repo facts (gated on Decision B below).
- `orchestration/editProvenance.ts`, `jsonlRetention.ts`, `pinnedContextStore.ts`, `workspaceReadList.ts` — live startup / IPC.
- Telemetry SQLite store, edit provenance — general session telemetry, not chat.

## Bucket 3 — Wired but purpose-dead → CUT (resolved by Master Finding)

| Component | Why CUT |
|---|---|
| `contextPacketBuilder*.ts`, `contextSelector*.ts`, `contextSelectorRanker*.ts` | Packet is a chat artifact; nothing else builds one. |
| `contextClassifier.ts` (+ defaults), `contextSignalCollector.ts` | Only scores files for the packet. |
| `graphSummaryBuilder.ts` | Only consumer was the chat packet (graph data source survives; this formatter does not). |
| `contextDecisionWriter.ts`, `contextOutcomeWriter.ts`, `contextOutcomeObserver*.ts` | Producers only fire on chat packet builds / chat-registered sessions. |
| `contextRetrainStartup.ts`, `contextRetrainTrigger*.ts`, `tools/train-context.py` | Watches JSONLs that will never grow; trained weights consumed only by the dead classifier. |
| `contextRankerTelemetry.ts` | Selection record is chat-path-only; PTY read-hit correlation no-ops without it. |
| `contextWorker*.ts` + `loadPersistedContextCache` / `startContextRefreshTimer` (`main.ts`) | Background packet warming — warms a cache only chat consumed. |
| `hooksContextOutcome.ts` tap + `hooksRankerReadTap.ts` registration | Fire on every PTY event, no-op for all of them. Remove tap registration in `hooksTapRunner.ts`. |
| **`src/main/router/` (entire subsystem)** | Owner decision: CUT. Active routing died with chat sends; shadow logging is logging-only with retrain disabled since Wave 61. **Live cross-refs to clean:** `shadowRouteHookEvent` call in `hooks.ts` (~L256), `observeDatasetGrowth` in `main.ts` (~L262), `routerShadowDrainHandler` in `mainTelemetryHandlers.ts`, `routerSettings` + `routerLastRetrainCount` config keys, `RouterSettingsGroup` in `AgentSection.tsx`, `tools/train-router.py` if present. |

**Startup cleanup:** `main.ts::initTelemetryAndWriters` (initDecisionWriter / initOutcomeWriter / startContextRetrainTriggerIfEnabled) becomes dead wiring — remove with the modules.

**contextLayer caveat:** `contextLayer.*` (repo-map + autoSummarize) feeds `contextInjector` → packet builder. If the packet dies, verify contextLayer has no independent consumer; if not, it joins this bucket. (One sub-feature — `autoSummarize` calling Haiku to describe modules — could be repurposed for CLAUDE.md generation; flag, don't auto-cut.)

## Settings / config — CUT list

Chat-only electron-store keys (purge via a new `migrateChatSurface()` in `configMigrations.ts`, mirroring `migrateChatPrimary()`):

- `agentChatSettings` (whole object), `chat` (whole object), `dockPersistence`, `ecosystem.codexAppServerTransport`.
- `modelSlots.agentChat` (one slot only — keep `terminal`/`claudeMdGeneration`/`inlineCompletion`).
- `layout.immersiveChat`, `layout.chatSidebarMode` (surgical — rest of `layout` stays).
- `theming.fonts.chat` (surgical — keep `editor`/`terminal`).
- Ranker/training keys IF Bucket 3 confirmed: `contextRanker`, `routerLastRetrainCount`, parts of `context.*` (learnedRanker, rerankerEnabled, decisionLogging), `contextLayer.*` (pending caveat above).

**Settings UI:** remove `AgentSection.tsx` chat groups (`AgentChatSettingsGroup`, provider/view selects, toggles) and the `agentChat` entry in `ModelSlotsSection.tsx::SLOT_CONFIGS`. **Rehome, don't delete:** `AgentContextPacketSection.tsx` (`context.packetMode`) and the context-layer toggle currently live under the Agent tab — but if Bucket 3 cuts the packet entirely, these go too.

## Owner decisions — RESOLVED

- **Decision A — Codex terminal sessions → KEEP.** Cut only the Codex chat path; Codex PTY sessions, `codexCliSettings`, `codexExecRunner`, `providers.multiProvider` stay.
- **Decision B — context packet death → CONFIRMED.** Bucket 3 confirmed in full. Resolves the contextLayer caveat toward CUT (verify no independent consumer of the repo-map; preserve `autoSummarize` only if CLAUDE.md generation reuses it).
- **Decision C — router subsystem → CUT entirely.** See Bucket 3 cross-ref list.
- **Out of scope (KEEP):** `mobileAccess`, `sessionDispatch`, `webAccess*` — dispatch *terminal* sessions, not chat.

## Removal sequencing (build green at each step)

0. Confirm Decisions A–C. Tag already created.
1. Extract shared helpers (`getErrorMessage`, `ActiveStreamContext`, settings resolvers).
2. Remove renderer chat (`AgentChat/`, `ChatOnlyShell/`); fix `App.helpers.tsx`; drop `electron-agent-chat.d.ts`.
3. Remove `agentChat/` (except Bucket 2); fix `mainShutdown.ts`, `configSchemaTail.ts`, `configAppTypes.ts`.
4. Remove chat IPC handlers + Wave 86 cluster; fix `ipc.ts` / `index.ts`.
5. Remove chat-only adapters in `providers/`.
6. Remove Bucket 3 (context packet/ranker/training/observer) + startup wiring; remove hook taps.
7. Settings UI cut + rehome; config schema narrowing.
8. `npm uninstall lexical @lexical/react lexical-beautiful-mentions`; drop `test:lexical`/`test:agentchat` scripts; `npm run lockfile:sync`.
9. Author `migrateChatSurface()`; document orphaned keys.

Gate after each: `npm run build` + `tsc --noEmit` + matching scoped vitest (`test:layout`, `test:main`, `test:ipc`, `test:codebasegraph`).

## Sizing

This is multi-wave (≥300 files chat code + orchestration cut + settings + deps + migration). Recommend: this triage → `/wave-plan` for the removal → execute behind the tag.
