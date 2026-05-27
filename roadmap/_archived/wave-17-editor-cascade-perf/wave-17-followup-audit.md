---
status: COMPLETE
timestamp: 2026-05-26T14:32:00Z
wave: wave-17-editor-cascade-perf
auditor: haiku-followup-auditor
---

# Follow-Up Audit — Wave 17

## Summary

Audited 4 pre-flagged OPEN items against Wave 17's diff, result brief, and phase diagnostics. All 4 items fell into closure categories: 2 RESOLVED (direct + transitive), 1 WONTFIX (working-as-intended), and 1 RESOLVED (already shipped before this wave). All four items were moved to `roadmap/_archived/follow-ups/` and their frontmatter updated with resolution details and trace back to the diagnostic evidence.

**Wave context:** Wave 17 was a perf investigation wave (Lane B B1-B3 diagnosis and fix) scoped to the 9–13s editor jank that surfaced after Wave 16. The wave's Phase 2 fix (eliminating the O(N) catalog scan in `filterChangedFiles()` via early-exit fast-path + watcher-hint paths through the worker protocol) directly addresses Root Cause A. Root Cause B (worker-to-worker WAL contention) is eliminated as a transitive effect. Phase 3 diagnostic confirmed `config:set` slow-handler reports are timer artifacts, not real handler issues.

## RESOLVED

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-25-config-set-slow-handler.md` | Timer-artifact victim; Phase 2 fix eliminates jank source | Phase 3 diagnostic: all 4 hypotheses REFUTED by direct measurement. Real handler cost ~8-15ms; inflated 1.1-4.0s times are `patchIpcMainHandle` artifact from event-loop stall caused by indexing worker O(N) scan. Phase 2 fix eliminates the stall. |
| `2026-05-25-repomap-worker-3927ms.md` | Root Cause B (WAL contention); eliminated indirectly by Phase 2 fix | Phase 1 diagnostic Section H5: confirmed worker-to-worker WAL lock contention between indexing worker (write) and repoMap worker (read-only). This is secondary effect of Root Cause A's long-running write transactions. Phase 2 eliminates the write pressure via O(N) scan elimination. |
| `2026-05-17-move-generateRepoMap-to-worker-plan.md` | Architect plan already shipped in prior wave | Phase 1 diagnostic Section 7: `repoMapWorker.ts`, `repoMapWorkerClient.ts`, `repoMapWorkerQueryClient.ts`, `repoMapGeneratorQuerySource.ts`, and `main.ts:188` wiring all exist and are fully operational. Option A (worker opens read-only SQLite) is complete. |

## WONTFIX

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-25-indexing-worker-not-disposed-on-window-close.md` | Singleton design is working-as-intended | Phase 1 diagnostic Section 6: `IndexingWorkerClient` is module-scoped singleton (lines 221-228: `let _client` with lazy `??=`), created once and shared across all windows. `disposeIndexingWorkerClient()` correctly fires only at app-quit via `app.before-quit`. Per-window dispose would incorrectly terminate shared resource mid-flight. No action required. |

## LIKELY-RESOLVED

None detected in this audit.

## NEEDS-REVIEW

None detected in this audit.

## ACTIVE

2 new follow-ups were filed BY this wave at wrap (both OPEN, ACTIVE):
- `2026-05-25-resolve-incremental-files-delete-race.md` (LOW) — Phase 2 refactor seam; Phase 1 reviewer FLAG 4 (fast-path skips `pruneDeleted`, creating narrow race for deleted-file stale hash records). Deferred to follow-up.
- `2026-05-25-config-set-double-disk-io.md` (LOW) — Phase 3 secondary finding; `config:set` does ~4ms write + ~4ms readback per call due to cache invalidation forcing immediate re-read. Deferred to follow-up for future optimization.

These items are correctly left as OPEN/ACTIVE — the wave did not address them and they describe deferred work explicitly noted in Phase 3 and the reviewer feedback.

---

## Audit Methodology

1. **Pre-flagged candidates validation** — Cross-checked result brief's "Follow-ups closed by this wave" list against phase diagnostic evidence in `wave-17-diagnostic-save-cascade.md` and `wave-17-diagnostic-config-set.md`. All citations verified against specific sections and line numbers.

2. **Wave diff path-touch** — Wave 17 touched 13 files across codebase-graph and contextLayer subsystems, all directly relevant to the 4 pre-flagged items (O(N) scan elimination, WAL contention, worker architecture, singleton lifecycle).

3. **Evidence standard** — Each closure backs to either (a) explicit diagnostic verdict with quoted reasoning, (b) code inspection confirming existing state, or (c) direct causation via phase diff (O(N) scan was removed; fast-path was added).

4. **Movement discipline** — All 4 closed items edited in-place (frontmatter status + updated date + resolved-during field + Resolution section appended) before moving to `roadmap/_archived/follow-ups/`. Archive contents reflect final state.

---

## Notes for handoff

- **Two items still filed** as new LOW follow-ups by the wave itself. These are correctly documented in the wave result brief and do not require auditor action.
- **No ACTIVE items require intervention** — all pre-flagged candidates were either direct fixes, transitive fixes, or deliberate non-fixes with evidence.
- **Wave status remains SHIPPED-PENDING-SMOKE** — the follow-up audit is independent of smoke verification. Cole's live smoke trace is the remaining gate before final merge.
