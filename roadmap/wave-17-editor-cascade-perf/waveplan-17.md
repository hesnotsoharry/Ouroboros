---
status: PLANNED
created: 2026-05-25
updated: 2026-05-25
type: perf-investigation
predecessor: wave-16-ipc-handler-perf-fix-sweep
---

# Wave 17 — Editor / Indexer Cascade Perf

## Status

PLANNED. Surfaced by Wave 16's final verification trace (2026-05-25
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

Two other open follow-ups appear to fold into the same investigation:

- `roadmap/follow-ups/2026-05-25-config-set-slow-handler.md` (MED) —
  `config:set` 1–4s. Still showing in this trace.
- `roadmap/follow-ups/2026-05-25-repomap-worker-3927ms.md` (MED) —
  worker's `crossModuleDeps` phase regressed mid-session.

The `2026-05-25-indexing-worker-not-disposed-on-window-close.md` (LOW)
filed by Wave 16 P10 may also be relevant — if the IndexingWorkerClient
is a singleton with cross-window lifetime, that's the central indexer
this wave needs to understand.

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

## Phase plan (provisional — replan in Stage 3)

| # | Phase | Shape | Notes |
|---|---|---|---|
| 0 | Wave-plan + ADR | Planning | Resolve hypotheses below; lock decisions; set acceptance criteria for the work |
| 1 | Diagnose save cascade | Lane B B1 | Dispatch `sonnet-diagnostician`. Instrument the save → watcher → reindex chain; identify the dominant blocker. **Do not start B3 until B1 names the cause with evidence.** |
| 2 | Fix save cascade | Lane B B3 | Implement the diagnosed fix. Likely involves async-ifying some step or breaking it into yielding chunks. Honeycomb test at the boundary. |
| 3 | Diagnose config:set | Lane B B1 | Separate diagnostician dispatch — config:set's cost is likely in JSON serialization or electron-store write path, not the indexer. |
| 4 | Fix config:set | Lane B B3 | Per diagnosis. Possible fixes: smaller config blobs, async write, debounce. |
| 5 | autoSync no-op fast-path | Possibly inline | If diagnostician shows the 9075ms reindex with `files=0` has no work to do, add an early-exit. Trivial fix once diagnosed. |
| 6 | Smoke + wrap | Verification | Boot trace + active-editing trace; assert acceptance criteria met. |

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

## Acceptance criteria

After this wave ships, a boot trace + 5 minutes of normal editing
(opening files, saving, switching tabs) should show:

| Surface | Acceptance |
|---|---|
| `files:saveFile` slow-handler count | 0 |
| `config:set` slow-handler count | 0 |
| Event-loop jank events > 500ms during editing | <2 over 5 minutes |
| `autoSync.reindex` no-op cost (files=0) | <50ms |
| Concurrent saves still feel snappy | No visible UI freeze |

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
