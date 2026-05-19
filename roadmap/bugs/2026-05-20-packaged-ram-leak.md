---
status: TRIAGED
created: 2026-05-20
severity: high
---

# Packaged build: unbounded RAM climb to 100% (leak), dev mode unaffected

## Symptom

Launching the packaged `v2.19.3` build slowly drives system RAM from ~70% to 100% over several minutes and never settles (stays bad / worsens). Confirmed by Cole watching system memory. `npm run dev` does NOT exhibit this — the dev-vs-packaged split is the key discriminator.

## Log evidence (packaged main.log)

- Active handles grew within a single session: `MessagePort 27→50`, `Socket 60→107`, `ChildProcess` 2–26.
- One catastrophic `[jank] event loop blocked for ~14607ms` (14.6s sync stall).
- `[system2] catalog hash mismatch, triggering full rebuild` on EVERY launch.
- `[router-shadow-drain] liveSessions: 38`, `[spawn-cost-drain] 3446 existing spawnIds`.
- contextWorker now RUNS (`context worker ready`) — it crashed (`exited code 1`) in all prior packaged builds; its indexing workload is NEW as of the v2.19.3 worker-electron-safety fixes this session.

## Ranked hypotheses (sonnet-diagnostician, 2026-05-20, code-read only)

| Rank | Hypothesis | Confidence | Anchor |
|---|---|---|---|
| H1 | Catalog hash always mismatches → full reindex every launch + dual-graph spike | HIGH | `mainStartup.ts:247-253`, `graphDatabaseSession.ts:117-127`. Stale hash in userData DB from pre-Wave-53k worker-DB-path divergence; reindex retains old graph while building new. |
| H2 | Dedup Sets (3446 spawn-cost, 38 router-shadow) large but STATIC | MED-HIGH | `routerShadowDrainHandler.ts:118-136`, `spawnCostDrainHandler.ts:70-85`. One-time boot read, no eviction — large allocation, not continuous leak. |
| H3 | AutoSyncWatcher / @parcel/watcher native Socket handles accumulating | MED | `autoSync.ts:157-167`, `systemTwoRegistry.ts:103-146`. Socket 60→107 matches watcher handle model; ref-count release may miss on window close. |
| H4 | usage-poller PTY (powershell) handles not released on timeout | MED | `claudeUsagePoller.ts:253-279`. conpty cleanup Windows-fragile; ChildProcess count fluctuates. |
| H5 | No-TTL file-snapshot cache grows monotonically | MED-LOW | `contextSelectionSupport.ts` (CLAUDE.md gotcha: snapshot cache has no TTL). Newly-running contextWorker repopulates it every 30s. |
| H6 | `ipcMain.on` listeners per window without removeListener | LOWER | `ipc.ts`, `windowManager.ts` (not code-verified). MessagePort 27→50 consistent with per-window listener leak. |

## Next step (instrumentation-first per debug-before-fix)

Add a single `[mem-probe]` 30s timer in main logging: `process.memoryUsage()` (rss/heapUsed), active handle counts, systemTwoRegistry `listActive().length` (H3), file-snapshot cache size (H5), dedup Set sizes (H2), `BrowserWindow.getAllWindows().length` (H6), and at startup the stored-vs-recomputed catalog hash (H1). One instrumented build, run a few minutes, observe which counter grows monotonically → confirms the cause before any fix.

Do NOT fix-guess. The dev-vs-packaged split means the true cause must explain why dev is fine.
