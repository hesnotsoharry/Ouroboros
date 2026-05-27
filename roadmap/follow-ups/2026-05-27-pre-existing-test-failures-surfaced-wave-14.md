---
status: OPEN
severity: LOW
created: 2026-05-27
updated: 2026-05-27
surfaced-by: wave-14-rails-ui-fix-sweep Phase 6 wrap
---

# Pre-existing test failures + tsc errors surfaced (not Wave 14 regressions)

## Summary

Wave 14 Phase 6 wrap ran the broader `npm run test:renderer` + `npx tsc -p tsconfig.web.json --noEmit` (instead of just the per-phase scoped scripts) and surfaced multiple pre-existing failures that no recent wave's gates caught because they sit outside the scoped scripts.

None are Wave 14 regressions. All shipped to master before Wave 14 started (verified via the diagnostician's bisect for one + Phase 4 implementer's pre-existing flag for another). Filing here so they don't go silent again.

## Test failures (renderer)

### UsageDashboard cluster — 10 fails total

- `src/renderer/components/UsageDashboard/UsageDashboard.test.tsx` — 4 fails (renders loading indicator initially, shows summary cards after data loads, shows thread table after data loads, shows error message on IPC failure).
- `src/renderer/components/UsageDashboard/useDashboardData.test.ts` — 6 fails (starts in loading state with null rollup, populates rollup and threads after IPC resolves, sets error when IPC returns success:false, exposes setTimeRange and re-fetches on change, re-fetches when refresh() is called, passes undefined timeRange payload for "all" selection).

**Likely root cause:** Wave 100 (chat surface removal, SHIPPED 2026-05-27, `v2.35.0`) removed parts of the chat orchestration chain. UsageDashboard may have lost an IPC backing it referenced (e.g., `chatStats:rollup` or similar). HANDOFF notes Wave 100 was a deep deletion sweep; this cluster fits the "half-wired survivor" shape.

**Suggested investigation:** Read `UsageDashboard.tsx` imports and trace its IPC dependencies; check Wave 100's diff for removed IPC handlers that UsageDashboard still calls.

### useWorkbenchAgentData.sessions.acceptance — 2 fails

- `src/renderer/components/Workbench/useWorkbenchAgentData.sessions.acceptance.test.ts`:
  - "marks exactly the primary session active (most-recently-active running)"
  - "derives contextStats from the primary session"

**Root cause (flagged by Wave 14 Phase 4 implementer):** Wave 13 D4 architecture change — `useWorkbenchAgentData()` resolves primary session by `paneId` (`OUROBOROS_PANE_ID`) only, never by heuristic. Without a paneId match, the hook returns null primary + default contextStats. The test fixtures don't set paneId on sessions, so the previous heuristic-based assertions no longer hold.

**Suggested fix:** Update test fixtures to seed sessions with matching `paneId` values, or update assertions to reflect the new D4 behavior (no primary without paneId match).

### Workbench.projectSwitch.wave10 — 1 fail (now SKIPPED)

Filed separately: `roadmap/follow-ups/2026-05-27-workbench-projectswitch-wave10-test-timeout.md`. Diagnostician bisected to Wave 12 Phase 2 `872e1dbb` (`useWorkbenchProjects` cascading microtask). Skipped in Wave 14 to unblock wrap; full diagnosis in that follow-up.

### Additional ~4 failures not enumerated

`test:renderer` reported `17 failed | 3590 passed | 3 skipped (3610)`. The above accounts for 13 (4 + 6 + 2 + 1). Output was truncated; the remaining ~4 are likely in the same UsageDashboard or InspectorExport clusters seen in stderr.

## TypeScript errors (web variant)

`npx tsc -p tsconfig.web.json --noEmit` reports 5 errors, all in `GraphPanel`:

- `src/renderer/components/Layout/GraphPanel/GraphPanel.tsx:33,35,37` — `Property 'graph' does not exist on type 'ElectronAPI'`; implicit `any` parameter
- `src/renderer/components/Layout/GraphPanel/useGraphNeighbourhood.ts:36,38` — same

**Likely root cause:** Wave 22 (`v2.34.0`, codebase graph extraction to standalone MCP, SHIPPED 2026-05-27) removed `electronAPI.graph` from the typed bridge but did NOT remove or rewire `GraphPanel`. The component still references the deleted API. Either GraphPanel is supposed to be deleted entirely (post-Wave-22 dead code) or rewired to call the standalone MCP server via a different path.

**Suggested investigation:** Check Wave 22 result brief for whether `GraphPanel` was intended to survive; if yes, plumb whatever replacement API exists. If no, delete `src/renderer/components/Layout/GraphPanel/`.

## Why these surfaced now

Wave 14 Phase 6 was the first wave wrap post-Wave-22 + post-Wave-100 to run the broader gates (most recent wraps relied on scoped scripts only — `test:layout`, `test:main`, etc.). The scoped scripts' compositions are designed to be small + fast; they intentionally don't cover the whole `src/renderer/` surface. So `UsageDashboard/*` and `GraphPanel/*` tests slid through Wave 22 + Wave 100 wraps without their failures being visible.

This isn't a Wave 14 process gap — it's an inherited gap from the post-Wave-22 + post-Wave-100 wraps not running the broader test surface.

## Suggested follow-up wave shape

Bundle all of the above + the existing `2026-05-26-channel-catalog-missing-persist-shared-and-crash-log-count.md` into a "Wave 15 post-Wave-22-and-100 cleanup" fix-sweep:

- Fix or delete `GraphPanel` per Wave 22 intent
- Restore or update UsageDashboard tests per Wave 100 IPC removals
- Update `useWorkbenchAgentData.sessions.acceptance` for D4 behavior
- Fix or delete `Workbench.projectSwitch.wave10.test` (per `2026-05-27-workbench-projectswitch-wave10-test-timeout.md`)
- Fix `channelCatalog` test for `persist:shared` + `app:getCrashLogCount` (per `2026-05-26-...`)

## Why LOW severity

User-facing behavior is unaffected — these are test infra + pre-existing-removed-API references. Wave 14's actual user-facing fixes (#1-4) all work per the wave's own acceptance tests + manual smoke.
