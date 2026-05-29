---
status: PLANNED
created: 2026-05-29
---

# Wave 101: telemetry-pipeline-removal

## Plan

### Status

PLANNED · drafted 2026-05-29 · stopgap already applied (689MB telemetry.db moved aside; freeze gone) · gated on Track-A git-fix decision being kept separate

### Goal

After this wave, the orphaned telemetry **persistence/analytics** pipeline is deleted from the codebase: the synchronous `better-sqlite3` telemetry store, its 100ms `flushEvents` interval, the queue/drain handlers that fed it, the JSONL cold-tier mirror, the dead hook-tap pipeline (`hooksTapRunner` / `hooksEditTap` / `hooksGraphUsageTap` / `editProvenance`), the dead `src/main/research/` subsystem, the `router-shadow` hook that writes to a consumer-less queue, and the never-mounted `Observability/OrchestrationInspector` panel. The **live** agent-event pipeline (`hooks.ts` named-pipe → renderer push → workbench `AgentSidebar`) is fully preserved. The main process no longer performs synchronous SQLite writes; no `telemetry.db` is created; the `~/.ouroboros/telemetry/` data tree and the self-reinstalling `router-shadow` hook are cleaned up. This permanently eliminates the freeze class fixed by the stopgap.

### Scope

**In scope (DELETE — telemetry persistence/analytics):**

- `src/main/telemetry/` — entire dir (~21 files): `telemetryStore.ts`, `telemetryStoreHelpers.ts`, `telemetryStoreQueries.ts`, `telemetryStoreWriters.ts`, `traceBatcher.ts`, `telemetryDrain.ts`, `telemetryDrainStartup.ts`, `telemetryQueue.ts`, `queueRotation.ts`, `telemetryJsonlMirror.ts`, `hookEventsDrainHandler.ts`, `spawnTraceDrainHandler.ts`, `outcomeObserver.ts`, `hookEventsSchema.ts`, + colocated tests
- `src/main/orchestration/providers/spawnCostDrainHandler.ts`, `src/main/orchestration/providers/mcpSpawnCostTelemetry.ts`
- `src/main/orchestration/editProvenance.ts`, `src/main/hooksEditTap.ts`, `hooksTapRunner.ts`, `hooksGraphUsageTap.ts` (dead tap pipeline — write-only, no live consumer)
- `src/main/research/` — entire dir (40+ files, incl. `researchOutcomeWriter.ts`, `correctionWriter.ts`, `researchSubagent.ts`, cache-purge scheduler) — fed the removed chat; zero active callers
- `src/main/ipc-handlers/telemetry.ts` (`telemetry:queryEvents/Outcomes/Traces/record`, `observability:exportTrace`)
- `src/main/mainTelemetryHandlers.ts` (registers the three drain handlers)
- `src/renderer/components/Observability/` — entire dir (~15 files: `OrchestrationInspector` + tabs + `ResearchDashboard` + `InspectorExport`) — never mounted in the app shell
- `src/renderer/types/electron-telemetry.d.ts` + the `telemetryApi` surface in `src/preload/preloadSupplementalAiApis.ts`
- `src/main/main.ts` init calls: telemetry store init, `outcomeObserver`, `initResearchOutcomeWriter`, `initCorrectionWriter`, `scheduleResearchCachePurge`, telemetry drain-startup
- `assets/hooks/user_prompt_submit_router_shadow.mjs` + its entry in `src/main/hookInstallerSettings.ts` (+ a one-time uninstall pass for already-installed `~/.claude/settings.json`)
- `src/renderer/components/AgentMonitor/ViewModeSelector.tsx:78` — the lone `telemetry.record` call (cosmetic UI instrumentation)
- Data cleanup: `~/.ouroboros/telemetry/` (the `_stopgap-backup-*` dir, `queue/`, `processed/`, `*.jsonl` mirrors)

**Out of scope (each with deferral path):**

- **Track A — git-status subprocess-storm fix** (uncached `git:status`/`git:statusDetailed`, undebounced `useGitStatusDetailed`, listener fan-out). This is the residual micro-lag, a *different subsystem*. → separate Lane B fix / `roadmap/bugs/` entry; do NOT merge into this wave.
- **The live agent-event pipeline** (`hooks.ts` → renderer push → `AgentSidebar`). → PRESERVE; it is the wave's load-bearing constraint, not a target.
- **The standalone codebase-graph MCP server + `codebase-graph.db`** (513MB, in `AppData/Roaming/ouroboros/`). → separate process, still live; untouched.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Boundary safety pin | sonnet-diagnostician → orchestrator | honeycomb · cross-boundary · **READ-ONLY.** Map `hooks.ts` precisely: separate the **live renderer-emission** calls (KEEP — these drive AgentSidebar) from the **persistence** calls (`store.record`, `tapEditProvenance`, `tapGraphUsage` — REMOVE). Produce the exact seam list + a guard test asserting AgentSidebar's feed does not transit the SQLite store. No deletion this phase. | Launch IDE, run an inner session: AgentSidebar NOW/timeline/files/context still update live. This is the canary for every later phase. |
| 2 | Renderer teardown | sonnet-implementer | trophy · cross-boundary · Delete `Observability/` dir + `ResearchDashboard`; remove `ViewModeSelector.tsx:78` `telemetry.record`; delete `electron-telemetry.d.ts` + `telemetryApi` preload surface. Renderer no longer references telemetry. | App renders; no console errors; AgentSidebar still live (Phase-1 canary). |
| 3 | Main IPC teardown | sonnet-implementer | pyramid · cross-boundary · Delete `ipc-handlers/telemetry.ts` + `mainTelemetryHandlers.ts` registrations. Safe after Phase 2 (no renderer callers remain). | `tsc` clean; app boots; no `telemetry:*` channel registration logs. |
| 4 | Store + writer + tap severance | sonnet-migration-executor | pyramid · cross-boundary · **The crux.** Apply the Phase-1 seam: remove persistence calls from `hooks.ts` while keeping live emission; delete `src/main/telemetry/`, `traceBatcher`, `outcomeObserver`, drain handlers, the tap pipeline, `editProvenance`, and the `main.ts` init calls. Buildable after each deletion. | No `[telemetry] store initialised` / `[*-drain]` / `flushEvents` in logs; AgentSidebar still live; no `telemetry.db` created. |
| 5 | Research subsystem removal | sonnet-implementer | pyramid · internal · Delete `src/main/research/` + `researchOutcomeWriter`/`correctionWriter` + `scheduleResearchCachePurge` call in `main.ts`. | Internal — no observation point (verify `tsc` + dead-export audit clean). |
| 6 | Hook + data cleanup | haiku-implementer (orchestrator runs git/fs) | internal · Delete `router_shadow` hook asset + `hookInstallerSettings` entry; add one-time uninstall pass removing the stale entry from `~/.claude/settings.json`. Orchestrator clears `~/.ouroboros/telemetry/`. | Relaunch: no `no handler for surface: router-shadow` lines; `~/.claude/settings.json` no longer re-registers the hook. |
| 7 | Gates + observation | orchestrator | Full `tsc --noEmit`, lint, `test:main` + `test:renderer` + `test:preload`, dead-export audit, `git grep` for dangling refs to deleted modules. | Clean launch; AgentSidebar fully live during an active session; startup `services-ready` unchanged-or-better; zero telemetry residue. |

### Acceptance criteria

- [ ] App launches clean; no `telemetry.db` is created in `AppData/Roaming/ouroboros/telemetry/`.
- [ ] Workbench `AgentSidebar` (NOW / timeline / files-touched / context ring) updates **live** during an active inner Claude Code session.
- [ ] No `[telemetry] store initialised`, `[*-drain]`, `flushEvents`, or `no handler for surface: router-shadow` lines in the main-process log.
- [ ] `~/.claude/settings.json` does not contain the `router-shadow` UserPromptSubmit hook after a relaunch.
- [ ] `git grep` finds zero live references to deleted modules (`telemetryStore`, `traceBatcher`, `editProvenance`, `research/`, `Observability/`, `telemetryApi`).
- [ ] `tsc --noEmit` clean; lint clean; `test:main` + `test:renderer` + `test:preload` green.
- [ ] No synchronous SQLite write remains on the main-process event loop (the freeze class is structurally gone).

### Files the next agent should read first

1. `src/main/hooks.ts` — **the seam.** Live renderer-emission (keep) vs persistence calls (remove) coexist here.
2. `src/main/telemetry/telemetryStore.ts` — the deleted store; 100ms `flushEvents` interval; `purgeRetainedRows` (note: ms/days unit bug, moot on delete).
3. `src/main/mainTelemetryHandlers.ts` — drain-handler registration map.
4. `src/renderer/components/.../AgentSidebar` + `useAgentEvents` / `AgentEventsContext` — the live consumer to PROTECT (confirm it reads the live stream, not `telemetry:query*`).
5. `src/main/hookInstallerSettings.ts` — append-only hook installer; needs an uninstall pass.
6. `src/preload/preloadSupplementalAiApis.ts` — `telemetryApi` surface to remove.

### Note to the implementer

The spirit: this is a **deletion of a dead persistence layer**, not a refactor. Everything in scope feeds something that no longer exists (router, chat, the never-mounted Observability panel). The one thing that will hurt if you get it wrong is the **live agent-event feed** — `hooks.ts` calls BOTH the live renderer emission (which powers the AgentSidebar the user relies on) AND the dead persistence writes, on the same code path. Phase 1 exists solely to draw that line before you cut. Resist the temptation to `rm -rf src/main/telemetry` and chase compile errors — the seam in `hooks.ts` is surgical, do it deliberately.

First step: verify the `## Locked decisions` section below has its three decisions intact. Before declaring any phase complete, restate that phase's Observation point in your own words and describe what you actually saw — for the AgentSidebar canary, that means a *launched IDE with a live inner session*, not "tests pass." If you cannot observe it live, say so explicitly.

## Locked decisions

## Decision 1: Remove the telemetry persistence pipeline rather than fix it
**Context:** A 100ms synchronous SQLite write against a 689MB `telemetry.db` blocked the main thread for 193s (full machine freeze); the pipeline feeds only removed consumers (router, chat, unmounted Observability panel).
**Pick:** Wholesale removal of the persistence/analytics layer.
**Rationale:** Orphaned post-Wave-100 (chat removed) + graph-went-standalone-MCP (Wave 22) + auto-injection removed (Wave 22). Optimizing a system with no live reader is waste; removal eliminates the freeze class permanently.
**Consequences:** Loses accumulated spawn-trace/outcome history; the `OrchestrationInspector` panel cannot be re-mounted without a rebuild.
`durable: candidate`

## Decision 2: Preserve the live agent-event pipeline
**Context:** The workbench `AgentSidebar` (the user's primary live panel) consumes the live `hooks.ts` → renderer event stream, NOT the SQLite telemetry store.
**Pick:** Keep `hooks.ts` live emission + renderer event push intact; remove only the persistence calls that share that code path.
**Rationale:** The live feed is independent of the dead persistence layer; conflating them is the one high-risk mistake.
**Consequences:** Phase 4 must apply a surgical seam in `hooks.ts` rather than deleting the whole module.

## Decision 3: Git-status caching fix is out of scope (Track A)
**Context:** Residual sub-2s micro-lag traces to uncached `git:status`/`git:statusDetailed` + undebounced `useGitStatusDetailed` + `onFileChange` listener fan-out across 3 roots — a distinct subsystem from telemetry.
**Pick:** Handle as a separate Lane B fix; do not merge into this wave.
**Rationale:** Different subsystem, different root cause; scope discipline keeps the removal wave clean and reviewable.
**Consequences:** The daily micro-lag persists until Track A lands; tracked separately.

## Status

<per-phase rows added as work progresses: Phase | Dispatched | Completed | Commit SHA | Observation point hit>

## Follow-up candidates

<empty — Track A (git-status caching) is pre-identified Out-of-scope work with its own deferral path, not a mid-wave Tier-3 discovery>

## Result

<filled at ship by wrap team: what the wave delivered, links to promoted artifacts, mechanical-review verdict>
