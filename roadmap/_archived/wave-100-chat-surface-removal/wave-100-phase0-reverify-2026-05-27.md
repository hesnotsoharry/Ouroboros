---
status: RESOLVED
created: 2026-05-27
updated: 2026-05-27
wave: 100
slug: chat-surface-removal
---

> Status RESOLVED 2026-05-27 — Wave 100 shipped at v2.35.0 (merge commit `ea775ee9`).
> This re-verify guided the executed wave; retained as historical record.

# Wave 100 — Phase 0 Re-verification (2026-05-27)

Re-verified against master HEAD `1d676d7a` after ~180 commits (Waves 19–22 + post-wrap, Wave 99).
Original Phase 0 was materialized 2026-05-19. This document replaces line numbers and adds
new findings where the codebase diverged from the original ADR.

---

## 1. Must-Keep Set — Confirmed at HEAD

All 12 files still exist. Importer line numbers updated; substantive changes flagged.

| File | Exists | Key importer changes vs 2026-05-19 |
|---|---|---|
| `agentChat/subagentTracker.ts` | YES | `hooks.ts:6`, `hooksSubagentTap.ts:9`, `ipc-handlers/subagent.ts:24` — MATCHES |
| `agentChat/subagentLinkTrace.ts` | YES | `hooks.ts:5`, `hooksSubagentTap.ts:8`, `hooksAgentStartEnrich.ts:12` — MATCHES |
| `agentChat/subagentLinkResolver.ts` | YES | `hooksAgentStartEnrich.ts:11` — MATCHES |
| `orchestration/providers/streamJsonTypes.ts` | YES | Terminal importers unchanged. Claude-adapter importers (`claudeCodeContextBuilder.ts:12`, `claudeCodeEventHandler.ts:23`, `claudeCodeHelpers.ts:28`, `claudeCodeLaunchInputs.ts:17`, `claudeCodeState.ts:10`, `claudeCodeSubagentHandler.ts:14`, `claudeWarmStreamJsonRunner.ts:23`) are all in Phase E CUT set — no survivor concern |
| `orchestration/providers/claudeStreamJsonRunner.ts` | YES | Terminal importer `ipc-handlers/aiStreamHandler.ts:23` intact. Chat importers (`chatStateNewPath.ts:43`, `claudeCodeHelpers.ts:25`, `claudeWarmStreamJsonRunner.ts:17`) are CUT |
| `orchestration/providers/codexExecRunner.ts` | YES | `providers/codexSessionProvider.ts:33-34` (terminal KEEP) intact. Chat adapter importers all in Phase E CUT |
| `orchestration/providers/spawnCostDrainHandler.ts` | YES | `mainTelemetryHandlers.ts:10` — MATCHES |
| `orchestration/repoIndexer.ts` | YES | Per Decision 8: CUT verdict still holds. No surviving non-cut importer. `main.ts` no longer imports it directly (Wave 22 cleanup). Only importers: `ipc.ts:188,204` (stub handlers, CUT Phase F), chat files, contextLayer (all CUT) |
| `orchestration/editProvenance.ts` | YES | Live importers intact. `contextSelectorScoring.ts:24` (Phase F CUT) and `codexEventHandler.ts:10` (Phase E CUT) are in removal set |
| `orchestration/pinnedContextStore.ts` | YES | `ipc-handlers/pinnedContext.ts:17`, `session/sessionStartup.ts:19`, `orchestration/workspaceReadList.ts:13` intact. `contextPacketBuilderPins.ts:16` is Phase F CUT |
| `orchestration/workspaceReadList.ts` | YES | `ipc-handlers/index.ts:66`, `ipc-handlers/sessionCrud.ts:22`, `ipc-handlers/workspaceReadList.ts:15` — MATCHES |
| `orchestration/jsonlRetention.ts` | YES | `mainStartupHelpers.ts:10` — MATCHES |

---

## 2. ContextLayer Cascade — Decision 8 at HEAD

### 2a. File count: 58 → 34

Original: 58 files. **At HEAD: 33 `.ts` files + 1 `CLAUDE.md` = 34 total.**

Wave 22 removed the codebase-graph integration from contextLayer. The directory still exists
and must be deleted in Phase F — the count is just smaller. Missing files are not an issue;
they were already removed by prior waves.

### 2b. Nine unwire sites — updated line numbers

| Original cite | HEAD location | Status |
|---|---|---|
| `hooksSessionHandlers.ts:103` | `hooksSessionHandlers.ts:102` | SHIFTED (onSessionStart call) |
| `hooksSessionHandlers.ts:116` | `hooksSessionHandlers.ts:114` | SHIFTED (onGitCommit call) |
| `hooksLifecycleHandlers.ts:107` (whole fn) | `hooksLifecycleHandlers.ts:106` (onCwdChanged call inside `handleCwdChanged` fn starting ~line 98) | SHIFTED |
| `hooksLifecycleHandlers.ts:120` | `hooksLifecycleHandlers.ts:119` | SHIFTED |
| `filesHelpers.ts:182` | **`ipc-handlers/filesHelpers.ts:181`** | PATH CHANGED — file moved to ipc-handlers subdirectory |
| `gitOperations.ts:226` | **`ipc-handlers/gitOperations.ts:227`** | PATH CHANGED — file moved to ipc-handlers subdirectory |
| `config.ts:133` (whole branch) | **`ipc-handlers/config.ts:131-143`** | PATH CHANGED — dynamic import block at lines 131-143 |
| `main.ts:182,185` | **Already partially removed in Wave 22.** `main.ts:173-180` contains `startContextLayerAsync()` with comment "Graph and contextLayer/repoMap removed in Wave 22." It does NOT call `initContextLayer` — that call is gone. The function body calls `loadPersistedContextCache()` and `startContextRefreshTimer()` (chat functions, removed in Phase C/D). Phase F still needs to delete the stub function and its call at `main.ts:235`. | PARTIALLY RESOLVED |
| `mainStartupContextLayerTrigger.ts:22` (whole fn) | **FILE DOES NOT EXIST** at HEAD | ALREADY REMOVED — skip in Phase F |

### 2c. repoIndexer cascade — CUT verdict holds

All importers of `repoIndexer.ts` at HEAD are in the CUT set:
- `ipc-handlers/agentChatContext.ts:14` (Phase C)
- `orchestration/contextPacketBuilder.ts:16`, `contextWorker.ts:16`, `contextWorkerTypes.ts:6`, `repoIndexerHelpers.ts:11`, `repoIndexerSupport.ts:1` (Phase F)
- `ipc.ts:188,204` (inside `registerOrchestrationStubHandlers`, Phase F)
- `contextLayer/*` (Phase F)
- `main.ts` — no longer imports directly (Wave 22 cleaned)

Decision 8 CUT for `repoIndexer` **CONFIRMED**.

### 2d. lspDiagnosticsProvider cascade — CUT verdict holds

`src/main/orchestration/lspDiagnosticsProvider.ts` exists. Only callers: `ipc.ts:189` and `ipc.ts:205`
(dynamic imports inside `registerOrchestrationStubHandlers`). CUT verdict **CONFIRMED**.

### 2e. registerOrchestrationStubHandlers at HEAD

`ipc.ts:184-219` — **MATCHES** original lines exactly. Called from `ipc.ts:287`. CUT in Phase F.

---

## 3. Auto-Router Cross-Refs — Decision 4 at HEAD

| Original cite | HEAD | Status |
|---|---|---|
| `shadowRouteHookEvent` call `hooks.ts:256` | `hooks.ts:261` | SHIFTED |
| `observeDatasetGrowth` import `main.ts:43` | `main.ts:40` | SHIFTED |
| `observeDatasetGrowth` call `main.ts:262` | `main.ts:238` | SHIFTED |
| `registerRouterShadowHandler` in `mainTelemetryHandlers.ts:11` | `mainTelemetryHandlers.ts:11` | MATCHES |
| `qualitySignalCollector` in `hooksSessionHandlers.ts:26` | `hooksSessionHandlers.ts:25` | SHIFTED |
| `qualitySignalCollector` in `telemetry/hookEventsDrainHandler.ts:33` | `:33` | MATCHES |
| `qualitySignalCollector` in `mainShutdown.ts:25-26` | `mainShutdown.ts:26` | SHIFTED |
| `routerSettings` schema `configAppTypes.ts:151,153` | `:151,153` | MATCHES |
| `routerSettings` schema `configSchemaTail.ts:198,224` | `:198,224` | MATCHES |

**NEW cross-ref (Phase G addition):** `ipc-handlers/routerStats.ts` — registers `router:getStats` and
`router:getQualitySignals` channels. Exported from `ipc-handlers/index.ts:52`. Reads
`router-decisions.jsonl` and `router-quality-signals.jsonl`. Must be deleted in Phase G and its
registration removed from `ipc.ts` and `ipc-handlers/index.ts`.

---

## 4. Chat-Surface CUT List at HEAD

### Directories

- `src/renderer/components/AgentChat/` — EXISTS (100+ files) ✓
- `src/renderer/components/Layout/ChatOnlyShell/` — EXISTS (100+ files) ✓
- `src/main/agentChat/` — EXISTS (100+ files) ✓
- `src/main/router/` — EXISTS (33 files) ✓

### IPC handlers (all exist)

`agentChat.ts`, `agentChatCost.ts`, `agentChatEventForwarders.ts`, `agentChatExportImport.ts`,
`agentChatFork.ts`, `agentChatMerge.ts`, `agentChatMidTurn.ts`, `agentChatReactions.ts`,
`agentChatContext.ts`, `agentChatOrchestration.ts`.

**NEW — also CUT:** `ipc-handlers/contextRankerDashboardHandlers.ts` (registers
`context:getRankerDashboard`; imports `contextClassifier.ts` and `contextRetrainStartup.ts`;
wired at `ipc-handlers/index.ts:23-26`). Not in original plan — add to Phase F CUT list.

### Wave 86 files

- `agentChat/chatStateError.ts` — EXISTS ✓
- `agentChat/dualEmitOrchestrator.ts` — EXISTS ✓
- `agentChat/shadowTap.ts` — EXISTS ✓
- `agentChat/chatOrchestrationSingletons.ts` — EXISTS ✓
- `agentChat/crashRecovery.ts` — EXISTS ✓
- `ipc-handlers/chatStateNewPath.ts` — EXISTS ✓ (was incorrectly cited as `agentChat/chatStateNewPath.ts`
  in original; it lives at `ipc-handlers/chatStateNewPath.ts` — Phase C scope covers it correctly)

**NEW — also CUT (Phase D):** `src/main/hooksShadowTap.ts` and `hooksShadowTap.test.ts`. These
non-agentChat files import `getShadowTap` from `agentChat/shadowTap` and are wired into
`hooksTapRunner.ts:15`. Once Phase C removes `chatStateNewPath.ts` (which calls `setShadowTap`),
the tap is never initialized — `hooksShadowTap` becomes a permanent no-op. Delete in Phase D.
Also update `hooksTapRunner.ts` to remove the `tapShadowPath` call.

### Provider adapters

All CUT targets exist at HEAD:
`claudeCodeAdapter.ts`, `codexAdapter*.ts` (6 files), `codexAppServer*.ts` (19 files),
`codexContextBuilder.ts`, `claudeWarmProcessManager.ts`, `providerAdapter.ts`.

KEEP set also intact: `streamJsonTypes.ts`, `claudeStreamJsonRunner.ts`,
`codexExecRunner.ts`, `spawnCostDrainHandler.ts`.

### Context-intelligence cluster

All exist. **Exception: `graphSummaryBuilder.ts` NOT FOUND** — appears to have been deleted in
a prior wave. Not a blocking issue; Phase F simply won't find it. Remove the reference from
Phase F scope.

**main.ts imports for Phase F (still present):** `main.ts:27` imports `initDecisionWriter`,
`:28` imports `initOutcomeWriter`, `:29` imports `startContextRetrainTriggerIfEnabled`,
`:30` imports `killAllWarm`. These are confirmed Phase F/E cut targets — still live.

---

## 5. SCOPE CORRECTION Verification — ChatOnlyShell

`src/renderer/components/Layout/ChatOnlyShell/` EXISTS (100+ files). It is the live workbench shell.

`App.helpers.tsx:263` (shifted from original :255):
```typescript
if (isImmersive) return <ChatOnlyShellWrapper terminal={hooks.terminal} />;
```
`isImmersive` is derived at line 256: `isChatWindow || immersiveFlag || isMobileWeb`.

**Wave 99 blocker CLEARED:** `wave-99-result.md` status is SHIPPED. `useWorkbenchAttention`
gained an `agentStatusBySessionRecordId` input derived from `AgentSession.status` (not
`AgentChatThreadRecord.status`). The live terminal session attention signal now works without
chat threads. **Wave 100 is unblocked.**

**Open (Phase B re-scope required):** Which files inside `ChatOnlyShell/` import from `AgentChat/`?
`useWorkbenchAttention.ts:4` imports `AgentChatThreadRecord` (legacy chat fallback path — could be
removed once the agentSource path is the sole input). Full audit of `ChatOnlyShell/` imports from
`AgentChat/` must happen as Phase B pre-work.

---

## 6. Phase A Helper Relocation Status

**Phase A is NOT committed to master HEAD.** The waveplan note says the Phase A commit is "HELD
pending re-scope." At `1d676d7a`, all three relocations are incomplete:

### getErrorMessage
13 IPC handlers still import from `agentChat/utils`: `approvalHandlers.ts:3`, `costHandlers.ts:3`,
`crashHandlers.ts:5`, `extensionStore.ts:7`, `mcpStore.ts:13`, `mcp.ts:14`, `sessions.ts:9`,
`shellHistoryHandlers.ts:3`, `symbolHandlers.ts:3`, `updaterHandlers.ts:3`, `usageHandlers.ts:3`,
`agentChatFork.ts:11` (CUT in Phase C), `agentChatMerge.ts:10` (CUT in Phase C).
`src/main/utils.ts` exists at HEAD (added by "salvage" commit `73e9280e` on 2026-05-25 — recovered
from wave-11-plan worktree) and already defines `getErrorMessage`. Phase A needs to migrate the
11 surviving handlers to import from it.

### ActiveStreamContext
`hooksSkillExecutionTap.ts:15` still imports `ActiveStreamContext` from
`./agentChat/chatOrchestrationBridgeTypes`. `src/main/hooks/types.ts` EXISTS with the relocated
definition (per its Wave 99 Phase A header comment), but `hooksSkillExecutionTap.ts` was not
updated to use the new path. Phase A must update `hooksSkillExecutionTap.ts:15` to import from
`./hooks/types` instead.

### resolveClaudeCliSettings / resolveCodexCliSettings
Both remain in `agentChat/settingsResolver.ts:163,203`. `configSchemaTail.ts:7` still imports
from `agentChat/settingsResolver` rather than from the new `configDefaults.ts`. Phase A must
update `configSchemaTail.ts:7` (use `configDefaults.ts` for the fallback constants; remove the
settingsResolver import if no other settingsResolver export is needed there).

### NEW Phase A items (not in original plan)

**A4: `captureHeadHash` + `createCheckpointCommit`** from `agentChat/chatOrchestrationBridgeGit.ts`
must be relocated before Phase D. Consumer: `ipc-handlers/checkpoint.ts:23`. Suggested target:
`src/main/gitHelpers.ts` or inline into `checkpoint.ts` itself.

**A5: `parsePermalink` + `buildPermalink`** from `agentChat/permalinks.ts` must be relocated before
Phase D. Consumer: `main/protocolHandler.ts:15`. Suggested target: `src/main/protocolHandler.ts`
(inline — it's a small pure function), or `src/main/deepLink.ts`. The `thread://` deep-link
behavior should be removed from the app unless a future wave re-introduces chat threads.

**A6: `agentChat/types.ts` import in `hooks/types.ts:15`** — `hooks/types.ts` currently imports
from `../agentChat/types`. When `agentChat/types.ts` is deleted in Phase D, this breaks. Phase A
must change `hooks/types.ts:15` to import directly from `@shared/types/agentChat`.

**A7: `AgentChatThreadStore` type** in `session/softDeleteGc.ts:10` and inline `import()` in
`session/sessionStartup.ts:31`. When the thread store is deleted in Phase D, these dangling
references must be cleaned up. Phase D (not Phase A) owns this cleanup, but Phase A
implementer should note the dependency.

---

## 7. Surprises and Risks

**S1 — contextLayer count halved (58 → 34):** Phase F implementer should expect 34 files, not 58.
The directory still exists and must be deleted. No missing files are a concern.

**S2 — main.ts `initContextLayer` call already removed by Wave 22:** `main.ts:173-180`
contains a gutted `startContextLayerAsync` stub (comment: "Graph and contextLayer/repoMap removed
in Wave 22"). Phase F does not need to remove a call that's already gone, but must remove the
stub function itself and the `startContextLayerAsync(defaultRoot)` call at `main.ts:235`.

**S3 — `mainStartupContextLayerTrigger.ts` does not exist:** Original ADR cited it as an unwire
site. File is absent at HEAD — skip in Phase F.

**S4 — ORDERING RISK: `contextOutcomeObserverResearch.ts` → `chatOrchestrationBridgeGit.ts`:**
`orchestration/contextOutcomeObserverResearch.ts:22` imports `registerRevertListener` from
`agentChat/chatOrchestrationBridgeGit.ts`. Phase D deletes most of `agentChat/`; Phase F
deletes `contextOutcomeObserverResearch.ts`. If Phase D removes `chatOrchestrationBridgeGit.ts`
before Phase F removes `contextOutcomeObserverResearch.ts`, there is a window with a dangling
import that breaks `tsc`. **Fix:** either (a) add `contextOutcomeObserverResearch.ts` to Phase D's
deletion scope (acceptable since it's a chat/context-intelligence file), or (b) keep
`chatOrchestrationBridgeGit.ts` in place until Phase F. Option (a) is cleaner.

**S5 — `hooksShadowTap.ts` is a new implicit deletion target:** Non-chat file at
`src/main/hooksShadowTap.ts` imports `getShadowTap` from `agentChat/shadowTap.ts`. Its tap is only
initialized by `chatStateNewPath.ts` (Phase C CUT). After Phase C it's a permanent no-op. Add to
Phase D CUT list. Also remove `tapShadowPath` call from `hooksTapRunner.ts`.

**S6 — `contextRankerDashboardHandlers.ts` is an unlisted CUT target:** Registers live IPC channel
`context:getRankerDashboard`; imports `contextClassifier.ts` and `contextRetrainStartup.ts`. Not
in original Phase 0 list. Add to Phase F CUT list; remove from `ipc-handlers/index.ts:23-26`.

**S7 — `routerStats.ts` is an unlisted CUT target:** Registers `router:getStats` and
`router:getQualitySignals`. Add to Phase G CUT list; remove from `ipc-handlers/index.ts:52`.

**S8 — `protocolHandler.ts` imports `parsePermalink` from chat module:** Surviving terminal
infrastructure depends on `agentChat/permalinks.ts`. Handled by new Phase A item A5 — relocate
`parsePermalink` before Phase D. If `thread://` deep-links are no longer supported, simplest fix
is to remove the permalink handling from `protocolHandler.ts` entirely.

**S9 — Wave 99 SHIPPED, Wave 100 unblocked:** Both sequencing blockers are resolved:
(a) `useWorkbenchAttention` is rewired to `AgentSession` source of truth; (b) the "rail wave"
is shipped. Wave 100 can resume after Phase B re-scope is authored.

**S10 — Phase A commit is HELD and must be re-executed against current HEAD:** None of the Phase A
relocations are present in master. The held commit is stale — re-execute Phase A fresh against
`1d676d7a`, incorporating the four new relocation items (A4–A7) above.
