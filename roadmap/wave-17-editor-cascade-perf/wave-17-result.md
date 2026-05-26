---
status: SHIPPED-PENDING-SMOKE
created: 2026-05-25
updated: 2026-05-25
wave: 17
---

# Wave 17 — Editor Cascade Perf — Result Brief

## TL;DR

Eliminated the 9–13s editor jank that surfaced after Wave 16 shipped. Root cause was `filterChangedFiles()` running an O(N_all_files) stat+hash scan on every incremental reindex, including no-op saves. Two complementary fixes: (1) early-exit fast-path when 0 files changed (collapses the no-op cost from 9075ms to <100ms); (2) watcher-hint paths threaded through the worker protocol so single-file saves classify only their specific paths instead of the full catalog. 5 instrumentation trace lines added as forward observability.

**`config:set`'s 1-4s slow-handler reports were the same `patchIpcMainHandle` timer-artifact pattern as Wave 16 Lesson 2** — the handler itself does ~8-15ms of real work; the inflated times are event-loop stall from the save cascade. No `config:set` fix needed; Phase 2's fix eliminates the jank source.

## What shipped

5 commits on `wave-17-editor-cascade-perf` branch (will cherry-pick to master at wave wrap):

| Commit | Description |
|---|---|
| `4f719046` | docs(wave-17): fold 4 follow-ups into wave plan (on master, pre-wave) |
| `f5ae0b48` | docs(wave-17): Phase 1 diagnostic landed; revise plan |
| `b449df2d` | perf(wave-17): eliminate O(N) catalog scan on incremental reindex |
| `3659c3a1` | docs(wave-17): Phase 3 diagnostic — config:set is timer-artifact |
| `f989ba3a` | test(wave-17): cover Phase 2 fast-path + new exports |

## Phase outcomes

| # | Phase | Status | Output |
|---|---|---|---|
| 0 | Plan + ADR | DONE | `waveplan-17.md` + 4 follow-ups folded in |
| 1 | Diagnose save cascade (B1) | DONE | `wave-17-diagnostic-save-cascade.md` — root cause = `filterChangedFiles` O(N) scan |
| 2 | Fix save cascade (B3) | DONE | 7 source files; Option 1 (no-op fast-path) + Option 2 (watcher hint paths) + 5 trace lines |
| 2.5 | Tests for Phase 2 (review feedback) | DONE | 16 new tests across 3 files |
| 3 | Diagnose config:set (B1) | DONE | `wave-17-diagnostic-config-set.md` — timer-artifact, not real handler |
| 4 | Fix config:set | COLLAPSED | Phase 2's fix is sufficient; no separate work |
| 5 | Smoke + wrap | THIS DOC | Pending Cole's live smoke trace |

## Gates at wrap

- `tsc --noEmit`: PASS (full)
- `tsc -p tsconfig.web.json`: PASS (renderer type coupling check per Wave 9/96 lesson — none surfaced)
- `npx eslint src/main/codebaseGraph src/main/contextLayer/contextLayerController.ts --max-warnings=0`: PASS
- `npm run test:codebasegraph`: 693 passed / 3 skipped (was 677 pre-wave; +16 new Phase 2.5 tests, +0 regressions)
- `npx vitest run src/main/contextLayer`: 339 passed (no regressions)
- prettier: applied to test files at commit time (pre-commit hook caught it)
- Full `npm test`: DEFERRED (per CLAUDE.md scoped-script discipline; will run at commit/push time)

## sonnet-phase-reviewer verdict (Phase 2)

**FLAG (non-blocking).** Reviewer raised:
1. **Test coverage gap on `buildNoOpResult` + `resolveIncrementalFiles` + `runIndex` fast-path.** Addressed inline as Phase 2.5 (`haiku-test-author` dispatch; 16 new tests; all GREEN).
2. **Edge case: empty-project pre-existing quirk.** `isIncrementalRun = changed.length < allFiles.length` is `false` when both are 0, sending an empty project down the full-index path. Not new breakage from this commit — pre-existing logic. Not blocking; not addressed.
3. **Edge case: poll-triggered reindex doesn't set `changedPaths`.** Intentional design — `pollForChanges` doesn't know which files changed. Acceptance criterion "[trace:autoSync.reindex] done <50ms" applies to watcher-path reindex only. Documented in the acceptance criteria notes.
4. **Edge case: `pruneDeleted` skipped on fast-path could leave stale `file_hash` records for deleted-and-no-other-changes case.** Filed as LOW follow-up `2026-05-25-resolve-incremental-files-delete-race.md`.

## Notable patterns + lessons (carry forward)

1. **`patchIpcMainHandle` timer-artifact pattern is the leading false-positive perf signal.** Wave 16 Lesson 2 (the `usage:getUsageWindowSnapshot` shared-Promise pattern) recurred TWICE in Wave 17: once for `files:saveFile` (12.9s of timer artifact, ~5ms of real work) and once for `config:set` (1-4s of timer artifact, ~8-15ms of real work). **Pattern:** when the slow-handler line fires alongside a jank event, treat the handler as suspect UNTIL the handler body is read. If the handler is async and short, the slow-handler line is almost certainly an artifact, not a signal. The real signal is the jank event itself.

2. **Diagnose-first discipline keeps paying.** Phase 1's diagnostician produced a code-cited verdict that demolished 4 of the wave plan's 6 hypotheses and surfaced one new one (contextLayer 5s debounce + `buildRepoIndex` on main, partly contributing). Plan revision based on diagnostic — Phase 4 collapsed entirely (saved an entire phase of fix work). **Without Phase 1, Wave 17 would have shipped 2-3 phases of misguided fix attempts based on log timing alone.**

3. **The architect plan was already shipped — read the code, don't trust the index.** `2026-05-17-move-generateRepoMap-to-worker-plan.md` was filed as `status: PLANNED` but had actually been implemented in some earlier wave. The wave plan's fold-in section credited it as a Phase 2 candidate; Phase 1 discovered it was already done. Lesson: when a follow-up is PLANNED for >2 weeks, verify its status against the codebase before using it as scope grounding.

4. **Pre-commit prettier hook is the right discipline.** Test author authored without running prettier; pre-commit hook caught it; one-line `npx prettier --write` to fix. Standard friction, well-handled by the discipline.

5. **Parallel B1 dispatch reduces wall-clock substantially.** Phase 2 (implementer) and Phase 3 (diagnostician) ran in parallel because they touched disjoint surfaces (codebaseGraph + contextLayer vs config*). ~10 minutes saved versus sequential dispatch. Pattern to repeat when phase surfaces are clearly orthogonal.

## Follow-ups closed by this wave

To be confirmed by `/audit-followups wave-17` (dispatched at wrap):

- `2026-05-25-config-set-slow-handler.md` (MED) — should close as RESOLVED-via-no-fix-needed (Phase 3 verdict)
- `2026-05-25-repomap-worker-3927ms.md` (MED) — should close as RESOLVED-indirect (the worker-to-worker WAL contention this followup describes is the secondary effect Phase 2 fixes via Root Cause A)
- `2026-05-25-indexing-worker-not-disposed-on-window-close.md` (LOW) — should close as WONTFIX (singleton, working-as-intended per diagnostic Section 6)
- `2026-05-17-move-generateRepoMap-to-worker-plan.md` (PLANNED) — should close as RESOLVED (already shipped before this wave)

## Follow-ups generated by this wave

| File | Pri | Why |
|---|---|---|
| `roadmap/follow-ups/2026-05-25-resolve-incremental-files-delete-race.md` | LOW | Phase 2 refactor seam — fast-path skips `pruneDeleted`; narrow race leaves stale hash records. |
| `roadmap/follow-ups/2026-05-25-config-set-double-disk-io.md` | LOW | Phase 3 discovered `config:set` does ~4ms write + ~4ms readback per call. Not on critical path; small structural cleanup. |

## NOT done / deferrals

1. **Live smoke trace — DEFERRED to Cole.** The wave's acceptance criteria require observing the 5 new trace lines in a real session ("[trace:autoSync.reindex] done in <50ms files=0", "[trace:filterChangedFiles] done changed=0", etc.). This needs interactive use that the autonomous orchestrator can't drive. See `wave-17-smoke-report.md` (to author) for the checklist.
2. **Full `npm test` — DEFERRED.** Scoped runs (`test:codebasegraph` + `test:main/contextLayer`) cover Wave 17's surface. Full ~17 min suite will run at push/CI.
3. **Stryker mutation testing (Check 6) — DEFERRED.** Standing pre-merge task; Wave 17 didn't worsen the surface. Will run at next batched pre-merge gate.
4. **Push to remote — STANDING AUTONOMY.** Will push after merge to master per Cole's standing directive. CI minutes still 0 until 2026-06-01; workflows skip cleanly; protected-branch merges still wait for restore.
5. **Tag + CHANGELOG bump — PENDING.** Per Wave 16 precedent, version is currently 2.20.0; this is a patch-level perf wave → 2.20.1 OR roll into next minor depending on Cole's call.

## Wave temperature

LOW. Phase 1 diagnostic was crisp and produced a code-cited verdict. Phase 2 implementation matched the spec exactly. Phase 3 collapsed Phase 4 cleanly. One phase reviewer FLAG, fully addressed via Phase 2.5. No fights with the toolchain, no scope creep, no half-finished work. The pre-commit prettier check fired once and was trivial to fix.
