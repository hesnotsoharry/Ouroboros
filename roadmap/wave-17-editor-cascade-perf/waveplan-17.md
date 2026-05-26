---
status: SHIPPED-PENDING-SMOKE
created: 2026-05-25
updated: 2026-05-25
type: perf-investigation
predecessor: wave-16-ipc-handler-perf-fix-sweep
---

# Wave 17 — Editor / Indexer Cascade Perf

## Status

IN-PROGRESS. Phase 1 diagnostic complete (`wave-17-diagnostic-save-cascade.md`):
- Root Cause A (dominant, ~9s): O(N_all_files) scan in `filterChangedFiles()`
  on every incremental reindex — including no-op saves.
- Root Cause B (secondary, ~3-4s): worker-to-worker WAL contention; fixed
  indirectly by Root Cause A's fix.
- `files:saveFile` 12.9s slow-handler line is a **`patchIpcMainHandle` timer
  artifact** from event-loop stall delaying the `finally` block — the handler
  itself does <5ms of work.
- `IndexingWorkerClient` is a singleton (cross-window correct); closes
  `2026-05-25-indexing-worker-not-disposed-on-window-close.md` as WONTFIX.
- `generateRepoMap`-to-worker architect plan IS ALREADY SHIPPED (`main.ts:188`,
  `repoMapWorker.ts`, etc. all exist); closes
  `2026-05-17-move-generateRepoMap-to-worker-plan.md` as RESOLVED.

Phase 5 collapses into Phase 2 (the autoSync no-op fast-path IS the Phase 2 fix).

Surfaced by Wave 16's final verification trace (2026-05-25
21:21–21:23). Wave 16 fixed boot lag + window-close lag; this wave
addresses the *active editing* lag that's now the dominant user-visible
friction.

## Context

After Wave 16 shipped P1–P10, the post-fix boot trace verified all the
caches and the window-close path. But during the user's normal editing
work, a different perf class surfaced — concentrated around file saves
and config writes triggering cascading work that blocks the main process
event loop for many seconds.

### Evidence from the 21:21–21:23 trace

| Symptom | Measured cost |
|---|---|
| `files:saveFile` × 2 concurrent | **~12,924 ms each** |
| Single jank during the saves | **~12,389 ms** event loop block |
| `[trace:autoSync.reindex] done` (files=0 changed) | **9,075 ms** for a NO-OP reindex |
| `config:set` × 3 | 1,027 ms / 1,976 ms / 2,290 ms |
| `repoMap-worker` (earlier trace) | 3,927 ms once |

The 12.4s jank coincides with the two concurrent saveFiles completing —
not with the window-close path. The window close itself came 1.3s
*after* the unblock, and was fast (no slow-handler line).

### Why these are related

The likely chain (to verify in B1 diagnosis):

```
renderer save → files:saveFile IPC → main writes file → @parcel/watcher
event fires → autoSync detects change → contextLayer invalidation →
repoMap-worker spawn → graph indexer re-walks → SQLite write →
graph-support state update
```

Multiple steps in that chain are synchronous-by-effect on the main
thread. The visible IPC-handler latency (`files:saveFile` 12.9s) is
likely the renderer waiting on the WHOLE cascade rather than the disk
write alone, because something in the chain holds the event loop.

Four open follow-ups fold into this wave's surface:

- `roadmap/follow-ups/2026-05-25-config-set-slow-handler.md` (MED) —
  `config:set` 1–4s. Still showing in this trace. **Folds into Phase 3-4
  verbatim** — its four hypotheses become Phase 3's diagnostic brief.
- `roadmap/follow-ups/2026-05-25-repomap-worker-3927ms.md` (MED) —
  worker's `crossModuleDeps` phase regressed mid-session (412ms → 3866ms).
  **Folds into Phase 1's diagnostic brief**; overlaps Hypothesis 6 (lock
  contention) and Hypothesis 2 (better-sqlite3 write contention).
- `roadmap/follow-ups/2026-05-25-indexing-worker-not-disposed-on-window-close.md`
  (LOW) filed by Wave 16 P10 — IndexingWorkerClient.dispose() not called
  on per-window release. **Phase 1's diagnostician should answer
  "singleton or per-window?" as a secondary observation** while reading
  `graphControllerCompatRegistry` anyway. Closes inline if singleton
  (just document the lifecycle); folds into Phase 2 if per-window leak.
- **`roadmap/follow-ups/2026-05-17-move-generateRepoMap-to-worker-plan.md`
  (PLANNED, architect's verdict already produced)** — sonnet-architect
  produced a full integration plan in May for moving `generateRepoMap`
  off the main thread via Option A (worker opens its own read-only
  SQLite using WAL multi-reader). Directly addresses Hypothesis 1
  (autoSync.reindex synchronous) and Hypothesis 5 (tree-sitter parsing
  on main) — `triggerContextLayerRebuildAfterGraphReady` is explicitly
  named in the architect plan as "the path that produces the 1–2s
  freeze." **If Phase 1's diagnostic confirms the cascade bottoms out
  in `generateRepoMap`, Phase 2's implementation is ~75% pre-designed**
  (new `WorkerQueryClient` ~50 LOC, three-file injection seam,
  4-sub-phase migration). One open architect question to resolve before
  Phase 2: the `forceRebuild` seam (option a — config-injected
  `generateRepoMapFn` vs option b — bypass at trigger site).

## Goal

Reduce active-editing main-thread blocks from 9–13s to sub-500ms for
typical save/edit operations. Specifically:

- `files:saveFile` for a normal source file completes in <200ms regardless
  of indexer state
- `autoSync.reindex` does NOT block the event loop while it runs
- Concurrent saves do not compound — N concurrent saves should not cost
  N × the single-save latency
- `config:set` returns in <100ms regardless of config size or schema
  complexity

## Locked decisions

See `wave-17-decisions.md` (sidecar, currently empty — fill during
Stage 3 planning).

Upfront constraints:
- This is Lane B B1 investigation FIRST, then B3 implementation. Do not
  swing at fixes before instrumentation; the previous wave taught us that
  inference from logs alone is unreliable (P6 / P9 each surfaced surprises
  the orchestrator's first read missed).
- Honeycomb test shape — boundary integration tests where the FS event
  meets the indexer, where the indexer meets the graph DB. Unit tests on
  the indexer's pure functions are necessary but won't catch the lock
  contention or sync-over-async bugs.

## Phase plan (revised post-Phase-1)

| # | Phase | Shape | Status | Notes |
|---|---|---|---|---|
| 0 | Wave-plan + ADR | Planning | DONE | Hypotheses + acceptance + dispatch checklist authored. |
| 1 | Diagnose save cascade | Lane B B1 | DONE | `sonnet-diagnostician` returned `wave-17-diagnostic-save-cascade.md`. Dominant blocker = `filterChangedFiles()` O(N) catalog scan. `IndexingWorkerClient` singleton lifecycle confirmed. |
| 2 | Fix save cascade + autoSync no-op (merged with original Phase 5) | Lane B B3 | DISPATCHED | `sonnet-implementer`. **Option B from the diagnostic** — early-exit in `IndexingPipeline.resolveFilesToProcess()` when `changed.length === 0` (Option 1) PLUS pass `changedPaths` from `autoSync.pendingEvents` through worker protocol (Option 2). Adds 5 instrumentation trace lines (sections 5.A-E of the diagnostic) in the same commit for post-fix verification. |
| 3 | Diagnose config:set | Lane B B1 | DONE | `sonnet-diagnostician` returned `wave-17-diagnostic-config-set.md`. Verdict: `config:set` is a **timer-artifact victim** — same `patchIpcMainHandle` pattern as `files:saveFile`. Real handler cost ~8-15ms; the 3983ms is event-loop stall from the save cascade. All 4 hypotheses (large blob, contention, side effects, validation) REFUTED by direct measurement. Phase 2's fix eliminates the jank source that inflates `config:set` timings. |
| 4 | ~~Fix config:set~~ | — | COLLAPSED | Phase 3 found no fix needed. Phase 2's fix is sufficient. Secondary low-priority finding: `config:set` has double disk I/O per call (cache invalidation + immediate readback). Filing as a separate follow-up at wave wrap. |
| 5 | Smoke + wrap | Verification | PENDING | Boot trace + active-editing trace via the new instrumentation lines; assert revised acceptance criteria met; run `/audit-followups wave-17` (expects 2 RESOLVED + 1 WONTFIX + 2 originally-folded MED follow-ups closed by the wave's fix). File the new LOW follow-up for `config:set` double-I/O. Merge worktree to master + delete branch + remove worktree (per Cole's standing directive). |

## Hypotheses to verify in Phase 1 (B1)

Ordered by perceived likelihood; the diagnostician should refute or
confirm with evidence, not reason from the prompt:

1. **autoSync.reindex synchronous work** — the indexer's main loop runs
   on the main thread (not in the existing repoMap-worker). When a save
   triggers an event, the indexer walks the graph synchronously even if
   `files=0` were actually changed. The 9075ms no-op reindex is the
   smoking gun.

2. **better-sqlite3 write contention** — graph DB writes are synchronous
   (better-sqlite3 has no async API). If the save triggers a graph
   update that writes to `codebase-graph.db`, that write blocks. With
   concurrent saves, two writes serialize and the second waits.

3. **`files:saveFile` does post-write work synchronously** — the handler
   might not just write the file; it may also call `dispatchActivationEvent`,
   invalidate caches, broadcast to web clients, etc. If any step is sync,
   the IPC's measured latency is the WHOLE chain.

4. **`config:set` writes the entire config blob on every call** —
   electron-store's persistence is "write the whole JSON file" per set.
   If the config has grown large (multi-window state, project roots,
   telemetry queue, etc.), JSON.stringify + atomic write of a large file
   can take 1-3 seconds.

5. **Tree-sitter parsing on the main thread** — the indexer uses
   `web-tree-sitter` (WASM). Parsing a large file synchronously on the
   main thread could block. The `repoMap-worker` already exists to do
   parsing in a worker; the question is whether autoSync also uses it,
   or has its own parsing path on main.

6. **Lock contention between the codebase-graph worker and main** — the
   worker has a read-only connection to `codebase-graph.db`. If the main
   thread is doing a write, the worker's reads block, which could
   manifest as `crossModuleDeps` going from 412ms baseline to 3927ms
   (per the `repomap-worker-3927ms.md` follow-up).

## Risks

- **Async-ifying a synchronous indexer is structurally large.** May
  require moving more work into the existing worker, or spawning a new
  one. Could touch many files. Budget for this in Stage 3 planning.
- **better-sqlite3 has no async API.** If the bottleneck is sqlite
  writes, options are: (a) move all writes to a worker thread,
  (b) batch + flush, (c) switch DB layer (very large change). Honest
  ADR'ing required.
- **Don't break the graph indexer.** It powers the codebase-graph MCP
  surface and the contextLayer enrichment. Tests must cover the
  same-files-detected and same-edges-produced invariants.
- **Worktree isolation recommended.** This wave will touch hot code
  paths. Use `superpowers:using-git-worktrees` before Phase 1.

## Scope

**In:**
- `files:saveFile` handler chain
- `autoSync` indexer logic
- `config:set` handler + electron-store usage
- The save → watcher → reindex → graph cascade
- Honeycomb integration tests at the relevant seams

**Out:**
- The IndexingWorkerClient lifecycle question — folds in if diagnosed
  as the cause; otherwise stays as its own follow-up
- General codebase-graph perf (PageRank convergence, etc. — covered by
  separate tech debt in CLAUDE.md)
- IPC handler caching — Wave 16's job; already shipped
- Window-close path — Wave 16's job; already shipped
- GPU crash recovery — separate `2026-05-25-gpu-process-crash-d3d11.md`
  follow-up

## Files the next agent should read first

1. `src/main/ipc-handlers/files.ts` (or wherever `files:saveFile` registers) —
   the handler chain
2. `src/main/contextLayer/autoSync.ts` — the reindexer that took 9075ms for a no-op
3. `src/main/codebaseGraph/CLAUDE.md` — subsystem doc
4. `src/main/codebaseGraph/indexer.ts` / `repoIndexer.ts` — the indexer
5. `src/main/codebaseGraph/graphDatabase.ts` — the sqlite layer
6. `src/main/config.ts` + `src/main/configSchema*.ts` — config:set chain
7. `src/main/ipc.ts` `patchIpcMainHandle` wrapper — how slow-handler logs work

## Acceptance criteria (revised post-Phase-1)

After this wave ships, a boot trace + 5 minutes of normal editing
(opening files, saving, switching tabs) should show:

| Surface | Acceptance |
|---|---|
| Event-loop jank events > 500ms during editing | 0 over 5 minutes (was: <2; tightened now that cause is known) |
| `[trace:autoSync.reindex] done` no-op cost (files=0) | <50ms |
| `[trace:filterChangedFiles] done` (new trace line, Phase 2) | Not invoked OR <50ms when `changedPaths` is empty |
| `[trace:pipeline.resolve] changed=0` log frequency | Common — fast-path fires on every no-op save |
| `config:set` slow-handler count | 0 (real, not artifact — config:set has no IPC-handler-timer-artifact path; verified in Phase 3) |
| Concurrent saves | No visible UI freeze |

**Note on `files:saveFile` slow-handler count:** the Phase 1 diagnostic
established this line is a **`patchIpcMainHandle` timer artifact** — the
handler does <5ms of real work; the `finally` block reports false latency
when the event loop is stalled by concurrent work. It is therefore NOT a
reliable signal. "No jank events >500ms" is the real bar; the slow-handler
line should disappear naturally once Root Cause A is fixed.

## Verification — per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like |
|---|---|---|---|
| 1 | Diagnostic report at `wave-17-diagnostic-save-cascade.md` | Diagnostician traces save → watcher → reindex with concrete cost per step | Report names the dominant blocker with code citation, not inference from logs alone |
| 2 | Active-editing trace post-fix | User saves 5 files rapidly in the IDE | No `files:saveFile` slow-handler lines; no jank >500ms during the saves |
| 3 | Diagnostic report at `wave-17-diagnostic-config-set.md` | Diagnostician identifies what makes `config:set` 1-3s | Report names the cause |
| 4 | Settings-panel save trace | User changes a setting, saves | `config:set` <100ms, no slow-handler line |
| 5 | autoSync trace post-fix | User triggers a save with no actual code change | `[trace:autoSync.reindex] done in <50ms` for files=0 |
| 6 | Full boot + 5-min editing trace | User uses the IDE normally | All acceptance criteria from the table above |

## Note to the implementer

Before declaring any phase complete, restate the observation point from
the Verification table in your own words and describe what you actually
observed there. If you could not observe it directly — no live IDE, no
captured trace — say so explicitly. Do not substitute "tests pass" for
runtime observation.

The Wave 16 P6 / P9 lesson: do not infer causes from logs without
reading the code. The previous diagnostic for releaseGraphController
inferred async-ness from log ordering and was wrong. Cite code, not
log spacing.

## Orchestrator dispatch checklist

- Phase 0 (planning): orchestrator + user, gated on user confirmation
  of scope.
- Phase 1 (B1 diagnose save cascade): dispatch `sonnet-diagnostician`.
  Brief includes: the symptom table above, the hypothesis list, the file
  map, and "do not propose fixes before evidence."
- Phase 2 (B3 fix save cascade): dispatch `sonnet-implementer` with the
  diagnostic verdict baked into the brief.
- Phase 3 (B1 diagnose config:set): separate `sonnet-diagnostician`
  dispatch — different surface from Phase 1.
- Phase 4 (B3 fix config:set): `sonnet-implementer` or inline orchestrator
  fix if diagnosed as trivial.
- Phase 5 (autoSync no-op): inline orchestrator fix if Phase 1 surfaces
  the fast-path opportunity directly; otherwise `haiku-implementer`.
- Phase 6 (smoke + wrap): orchestrator runs scoped tests + reads a fresh
  boot/editing trace from Cole.

## What "do not start" looks like

This wave is PLANNED, not IN-PROGRESS. The next session should:

1. Read this plan + the Wave 16 result brief (`waveplan-16.md`) for
   context on what was already tried and why.
2. Read the three folded-in follow-up files for additional evidence.
3. Confirm scope + acceptance criteria with Cole before dispatching Phase 1.
4. Then dispatch Phase 1's `sonnet-diagnostician`.

If Cole opens a new session and just says "continue" or "next wave",
this plan is the starting point.
