---
status: PLANNED
created: 2026-05-19
updated: 2026-05-27
wave: 100
slug: chat-surface-removal
---

# Wave 100 — Architecture Decision Record

Decisions locked by the owner during the triage session (`roadmap/discovery/2026-05-19-de-chat-triage.md`). Most are scope-boundary calls, not best-practice-spectrum decisions, so they use the abbreviated `Context / Pick / Rationale` form.

> **2026-05-27 re-verification:** `wave-100-phase0-reverify-2026-05-27.md` re-grounds every line-number cite and adds material divergences (contextLayer shrank 58 → 34 files; `mainStartupContextLayerTrigger.ts` already removed; Phase A grew to 7 items; new unlisted CUT targets `contextRankerDashboardHandlers.ts` + `routerStats.ts`; Phase D ordering risk for `contextOutcomeObserverResearch.ts`; implicit `hooksShadowTap.ts` cut). The re-verify doc supersedes specific line citations in this ADR's Phase 0 findings section below. Decisions 1-8 remain locked unchanged. **Decision 9 (new)** added below covers the `thread://` deep-link removal surfaced during re-verification.

## Decision 1: Retire the entire chat surface, including Wave 86

**Context:** Two chat paths exist — the original `agentChat:*` path and the newer Wave 86 `chatStateNewPath` / `DualEmitOrchestrator` (still IPC-registered).

**Pick:** Remove both, plus the `chatCommand:*` / `chatState:*` channels.

**Rationale:** Wave 86 is chat infrastructure with no surviving UI consumer once the chat surface is gone; keeping it would leave dead wiring. Frees the largest chunk of `agentChat/` for deletion.

## Decision 2: Do not port context injection; cut the context-intelligence subsystem

**Context:** The context-packet pipeline (builder, ranker, classifier, graph-summary, decision/outcome writers, training trigger) existed solely to build/rank the chat context packet.

**Pick:** CUT the entire cluster. Nothing post-chat calls `buildContextPacket`.

**Rationale:** Interactive Claude Code is agentic — it retrieves its own context. Pre-stuffing a packet fights that model and the owner declined to port it. With no packet consumer, the producers and the no-op hook taps are dead.

**Consequences:** Resolves the `contextLayer` repo-map verdict toward CUT pending the Phase 0 consumer check; commits to a `migrateChatSurface()` purge of ranker config keys.

## Decision 3: Keep Codex terminal sessions; cut only the Codex chat path

**Context:** "Terminal-only" — does it include Codex-in-terminal?

**Pick:** KEEP `codexCliSettings`, `codexExecRunner*`, `codexSessionProvider`, `providers.multiProvider`. CUT `codexAdapter*`, `codexAppServer*`, `codexContextBuilder`.

**Rationale:** Codex-in-terminal is a terminal session type, covered by the pivot. Only its chat-orchestration adapter is dead.

## Decision 4: Cut the auto-router subsystem entirely

**Context:** The router shadow-logs every terminal prompt (logging-only; retraining disabled since Wave 61) but no longer changes any model selection (that died with chat sends).

**Pick:** Remove `src/main/router/` + its `hooks.ts` / `main.ts` / `mainTelemetryHandlers.ts` cross-refs + `routerSettings`.

**Rationale:** Active routing died with chat; the shadow log produces half-empty data once chat quality signals are gone. No actionable consumer remains.

## Decision 5: Keep the codebase-memory MCP graph and mobile/web remote access

**Context:** Both could be swept up as "infrastructure," but neither is chat-specific.

**Pick:** KEEP. Out of scope.

**Rationale:** The MCP graph is general code intelligence (powers symbol queries); mobile/web dispatch terminal sessions, not chat.

## Decision 6: Archive mechanism — git tag

**Context:** How to preserve the chat surface in case of future API-pathway revival.

**Pick:** Annotated git tag `archive/chat-surface-2026-05-19` (commit `71d4b813`); no in-repo folder copy.

**Rationale:** Git history is the complete, zero-cost safety net; an in-repo folder would keep failing build gates. Revive via `git checkout archive/chat-surface-2026-05-19 -- <path>`.

## Decision 7: Semver — minor v2.35.0 (re-versioned 2026-05-27)

**Context:** Removing a whole feature surface. Original target was `v2.20.0` (drafted 2026-05-19) but 180 commits / multiple waves have shipped since then; master is at `v2.34.0`.

**Pick:** Minor bump `v2.35.0` (next free slot above current `v2.34.0`).

**Rationale:** Feature-surface removal of an already-dead surface with no external/public API break is a minor bump per the development-pipeline semver-judgment grant. The version increment is mechanical re-numbering against current master; the rationale for "minor" is unchanged.

---

## Decision 9: Remove `thread://` deep-link handling (added 2026-05-27)

**Context:** `src/main/protocolHandler.ts:15` imports `parsePermalink` from `agentChat/permalinks.ts` to route `thread://` deep-links into the chat surface. After Wave 100, there is no chat surface and no chat-thread target. The 2026-05-27 Phase 0 re-verification surfaced this as a new Phase A item (A5) requiring an explicit decision: relocate the parser (preserving the protocol shell) or remove the protocol entirely.

**Options considered:**
- *Relocate `parsePermalink`/`buildPermalink`* to `src/main/protocolHandler.ts` or `src/main/deepLink.ts` and keep `thread://` URL parsing working as a no-op route.
- *Remove `thread://` handling entirely* from `protocolHandler.ts`; let any `thread://` URL fall through to the default no-op path.

**Pick:** Remove `thread://` handling entirely.

**Rationale:** A protocol that parses URLs targeting a non-existent surface is dead UX. The deep-link's only consumer was the chat surface; preserving the parser would leave a feature flag with no behind-the-flag feature. Cleaner end-state: the protocol shell honors only routes that point at live surfaces.

**Consequences:** If a future wave re-introduces a chat surface (e.g., via API pathway), `thread://` deep-links would need to be re-implemented from scratch. The chat-surface archive tag `archive/chat-surface-2026-05-19` preserves the original parser source if needed. Phase A item A5 changes from "relocate" to "remove."

---

## Phase 0 — findings (materialized 2026-05-19)

### Must-keep set — CONFIRMED (live non-chat importers)

- `subagentTracker.ts` ← `hooks.ts:6`, `hooksSubagentTap.ts:9`, `ipc-handlers/subagent.ts:24`
- `subagentLinkTrace.ts` ← `hooks.ts:5`, `hooksSubagentTap.ts:8`, `hooksAgentStartEnrich.ts:12`
- `subagentLinkResolver.ts` ← `hooksAgentStartEnrich.ts:11`
- `streamJsonTypes.ts` ← `ptyAgentBridge.ts:12`, `ptyAgent.ts:14`, `providers/claudeSessionProvider.ts:20`, `backgroundJobs/jobRunner.ts:15`, `promptDiffScheduler.ts:13`, `ptyHost/ptyHostProxyAgent.ts:14`, `ipc-handlers/aiStreamHandler.ts:27`
- `claudeStreamJsonRunner.ts` ← `ipc-handlers/aiStreamHandler.ts:23` (the `ai:stream` channel — sole surviving importer; verify it's terminal/non-chat in Phase E)
- `codexExecRunner.ts` ← `providers/codexSessionProvider.ts:34` (terminal Codex). NOTE `providers/codexLaunch.ts:9` also imports it but `codexLaunch.ts` is a chat-path file → CUT.
- `spawnCostDrainHandler.ts` ← `mainTelemetryHandlers.ts:10`
- `repoIndexer.ts` ← `main.ts:33`, `ipc.ts:188,204`, `contextLayer/*` (20+). **Entangled with contextLayer — see Decision 8.**
- `editProvenance.ts` ← `hooksLifecycleHandlers.ts:16`, `hooksEditTap.ts:12`, `mainStartup.ts:16`, `mainStartupHelpers.ts:9`
- `pinnedContextStore.ts` ← `ipc-handlers/pinnedContext.ts:17`, `session/sessionStartup.ts:19`, `workspaceReadList.ts:13`
- `workspaceReadList.ts` ← `ipc-handlers/index.ts:66`, `sessionCrud.ts:22`, `workspaceReadList.ts:15`
- `jsonlRetention.ts` ← `mainStartupHelpers.ts:10`

### Check (b) — orchestration IPC types → CUT (no terminal consumer)

`OrchestrationAPI`, `orchestration:*` channels (`ipc.ts:185,201`; `agentChatOrchestration.ts`), and `electron-orchestration.d.ts` are consumed only by `src/renderer/components/Orchestration/` (the ranker dashboard — itself CUT) and `AgentChat/` hooks (`orchestrationEventSubscriptions.ts`, `orchestrationCommandHelpers.ts`). DiffReview: zero orchestration refs. AgentMonitor: uses its own local `TokenUsage` (`AgentMonitor/types.ts:114`) sourced from hook events, not the shared type. **Scope addition:** Phase B also removes `src/renderer/components/Orchestration/`; Phase F removes `electron-orchestration.d.ts`, the `orchestration` property on `ElectronAPI` (`electron-workspace.d.ts:299`), and its `electron.d.ts:27` re-export.

### Check (c) — router cross-refs → exact sites for Phase G

- `shadowRouteHookEvent` call: `hooks.ts:256`
- `observeDatasetGrowth`: import `main.ts:43`, call `main.ts:262`
- `registerRouterShadowHandler` (routerShadowDrainHandler): `mainTelemetryHandlers.ts:11`
- **`qualitySignalCollector` imported by LIVE files** (unwire these): `hooksSessionHandlers.ts:26`, `telemetry/hookEventsDrainHandler.ts:33`, `mainShutdown.ts:25-26`
- `routerSettings`/`routerLastRetrainCount` schema: `configAppTypes.ts:151,153`, `configSchemaTail.ts:198,224`

### Check (a) — contextLayer → SPLIT (gates Decision 8 below)

- **Output path (`contextInjector.injectContextLayer` → `enrichPacket` → `contextPacketBuilder`) → CUT.** Only caller of `enrichPacket` is `contextPacketBuilder.ts:168`; that builder's only callers are `agentChatOrchestration.ts:121` (chat), `contextWorker.ts:39` (warm cache for chat), and `orchestration:previewContext`/`buildContextPacket` (Orchestration panel — cut). Orphaned.
- **`autoSummarize` (moduleSummarizer/summarizationQueue) → output dead.** Confirmed it does NOT feed CLAUDE.md generation (`claudeMdGenerator.ts` shares only the `spawnClaude` utility, no data path). The Haiku module-summary calls write to `.ouroboros/module-summaries.json`, read back only via `contextInjector` → dead packet. **These are paid Haiku calls producing data nothing reads.**
- **Controller lifecycle (`getContextLayerController`, `onSessionStart`, `onFileChange`, `onGitCommit`, `forceRebuild`, `initContextLayer`) → wired into 9 LIVE terminal-session hook sites:** `hooksSessionHandlers.ts:103,116`, `hooksLifecycleHandlers.ts:107,120`, `filesHelpers.ts:182`, `gitOperations.ts:226`, `config.ts:133`, `main.ts:182`, `mainStartupContextLayerTrigger.ts:22`.

## Decision 8: contextLayer controller fate — FULL CUT (locked by Cole, 2026-05-19)

**Context:** The contextLayer output path is unambiguously dead. The controller is wired into 9 live terminal-session hook sites and makes paid Haiku `autoSummarize` calls nobody reads (cost waste against the no-API-cost philosophy).

**Pick:** **Full cut now.** Remove the entire `src/main/contextLayer/` directory (58 files), unwire all 9 live hook call sites, and resolve `repoIndexer` (see cascade below).

**Rationale:** Stops the paid Haiku waste immediately and leaves no dead-but-running infra in the hot hook paths. Cole accepted the larger/riskier Phase F (touches terminal-session lifecycle hooks) for the clean end state.

**Consequences (cascade — verified at HEAD):**
- **`src/main/contextLayer/` → CUT entirely.** 58 files (confirmed via absolute-path Glob; the directory exists — an earlier dispatched agent's "doesn't exist" was a wrong-cwd artifact).
- **`repoIndexer.ts` + `repoIndexerHelpers/Support/SupportGit` → CUT.** After contextLayer + chat + the orchestration stub handlers are gone, `repoIndexer` has ZERO surviving importer. Confirmed importers (all in the removal set): `ipc-handlers/agentChatContext.ts:19` (chat), `ipc.ts:188,204` (stub handlers, cut), `main.ts:33,185` (feeds `initContextLayer`, cut), `contextPacketBuilder.ts:16`/`contextWorker*.ts` (cut), `contextLayer/*` (cut). **This reverses the plan's earlier KEEP for `repoIndexer`.**
- **`lspDiagnosticsProvider.ts` → CUT.** Its sole consumer is the `orchestration:previewContext`/`buildContextPacket` stub handlers (`ipc.ts:189,205`), which are cut.
- **`registerOrchestrationStubHandlers` (`ipc.ts:184-219`) + the `orchestration:previewContext`/`orchestration:buildContextPacket` channels → CUT.**
- **9 unwire sites** (6 are one-line calls inside larger live handlers — remove the line; 3 are the whole purpose of their function — remove/simplify the function): `hooksSessionHandlers.ts:103,116`, `hooksLifecycleHandlers.ts:107` (whole fn), `:120`, `filesHelpers.ts:182`, `gitOperations.ts:226`, `config.ts:133` (whole branch), `main.ts:182,185`, `mainStartupContextLayerTrigger.ts:22` (whole fn — file may be deletable).
- **`main.ts` `initContextLayer` import + call → removed.**

### Process note
A dispatched `haiku-explorer` returned a self-contradictory result (claimed `contextLayer/` was deleted, citing the unrelated `memProbe.ts` git status) because its Glob ran from the wrong cwd. Lesson: dispatched briefs touching the filesystem must specify absolute paths, and the orchestrator's Bash cwd is `roadmap/` post-`mv` — re-verify haiku filesystem claims that look surprising.
