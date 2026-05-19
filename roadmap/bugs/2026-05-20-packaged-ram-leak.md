---
status: RESOLVED
created: 2026-05-20
updated: 2026-05-20
severity: high
resolution: environmental — Windows Defender real-time scan, not an Ouroboros leak
---

# Packaged build: unbounded RAM climb to 100% (leak), dev mode unaffected

## RESOLUTION 2026-05-20 — root cause is Windows Defender (MsMpEng.exe), NOT a code leak

Resource Monitor disk view showed **MsMpEng.exe (Windows Defender real-time scan engine) in 7 of the top 10 disk consumers**, spiking whenever Ouroboros ran. Not an Ouroboros memory leak.

Why it fit every symptom:
- **Main process clean (mem-probe flat)** — correct; the disk work was Defender, an external process.
- **RAM → 100%** — Defender scan buffers + OS file-system cache from scanned reads (cached reads count as "in use" RAM).
- **NVMe pegged** — Defender scanning files as Ouroboros read/wrote them.
- **dev fine / packaged thrash (the discriminator)** — dev never runs electron-builder. Packaged testing today produced ~15 fresh UNSIGNED 217MB `.exe` installers (~3.4GB in dist/) plus an unsigned install tree; Defender scans freshly-written unsigned executables aggressively and re-scans the 200MB+ app.asar on launch. Dev has none of that.

Fixes applied:
1. Purged the dist/ installer pile (15 → 1, kept current 2.19.3) — removed ~2.2GB of fresh unsigned binaries Defender was re-scanning.
2. User adds Defender exclusions (elevated PowerShell): install dir `%LOCALAPPDATA%\Programs\Ouroboros`, userData `%APPDATA%\Ouroboros`, repo `C:\Web App\Agent IDE`, process `Ouroboros.exe`.

Not a product code bug. NOTE for shipping: unsigned installers also trigger Defender/SmartScreen friction for END users — code signing is the real long-term fix (separate follow-up, not this bug).

The mem-probe instrumentation (commit 01ed6987) found no leak and can be removed — see "Instrumentation cleanup" task. Keep until the user confirms exclusions resolve the thrash.

---

(original investigation below — all code-side hypotheses H1-H6 refuted by mem-probe + DB inspection)

# Packaged build: unbounded RAM climb to 100% (leak), dev mode unaffected — ORIGINAL

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

## UPDATE 2026-05-20 — mem-probe results: main process is CLEAN

Instrumented build run ~3.5 min. `[mem-probe]` (main process) every 30s showed ALL accumulators flat:
- `snapshotCacheSize: 0` throughout → H5 (no-TTL context cache) REFUTED
- `s2Active: 1`, `windows: 1` flat → H3/H6 REFUTED
- `spawnDedupSize: 3450` (+4 over session), `routerShadowDedupSize: 41` flat → H2 REFUTED (large but static, as predicted)
- rss 175–754MB (trends down), heapUsed flat ~50MB → no main-heap leak

Also refuted by direct DB inspection: catalog is CLEAN (3835 files, 0 dist/out/node_modules entries) → H1 stale-dist-catalog REFUTED. autoSync reindex runs ~every 2.5min, files=0, 2.8s — cheap, not the thrash.

**Conclusion: the RAM+NVMe issue is NOT in the main process.** It's in an unmeasured surface: renderer process, a worker thread (contextWorker/repoMapWorker/indexingWorker — separate heaps), GPU process, or OS FS cache from disk reads. The disk-thrash symptom (NVMe pegged) is primary; RAM-to-100% is likely FS cache.

**Next:** runtime disk observation (Resource Monitor → Disk → top files/paths by B/sec + which process) to localize the actual I/O. Three+ code-read theories already refuted — need real I/O evidence before proposing a fix. Mem-probe instrumentation (commit 01ed6987) is still in place; leave it until the disk source is found.
