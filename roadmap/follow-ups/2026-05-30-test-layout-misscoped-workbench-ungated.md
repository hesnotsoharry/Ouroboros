---
status: OPEN
created: 2026-05-30
updated: 2026-05-30
priority: MEDIUM
---

# `test:layout` is mis-scoped — Workbench suite is ungated (+ 2 stale Wave-3 tests)

## Problem
`npm run test:layout` runs `vitest run src/renderer/components/Layout`, but the canon Workbench lives in the **sibling** dir `src/renderer/components/Workbench/`. So the entire Workbench test suite (48 files, ~400 tests) is covered by **no scoped script** and never runs in the standard implementation gate. The root `CLAUDE.md` scoped-script table wrongly lists `test:layout` as covering "workbench."

**Real cost (2026-05-30):** a subagent cited "test:layout 819 passed" as proof a Workbench refactor was safe, but 72 Workbench tests were actually red, and 2 had rotted unnoticed since Wave 13. Caught only by running the Workbench path directly.

## Fix
1. Add a `test:workbench` script: `vitest run src/renderer/components/Workbench`. Correct the root `CLAUDE.md` scoped-script table (the `test:layout` row should not claim "workbench"; add a `test:workbench` row).
2. Fix the 2 stale assertions in `src/renderer/components/Workbench/useWorkbenchAgentData.sessions.acceptance.test.ts` ("marks exactly the primary session active" + "derives contextStats from the primary session"). They are a **Wave 3** test asserting the OLD primary-selection ("most-recently-active running" with no paneId), which **Wave 13 D4 superseded** (`resolvePrimary` returns null when no paneId is passed). The test is marked orchestrator-owned ("MAY NOT modify") — update it to the D4 contract (pass a paneId-matched session, or assert the empty/null-primary D4 behavior). Confirmed pre-existing on master (fails with all 2026-05-30 changes reverted).

## Source
Both surfaced during the WorkbenchTabsProvider fix (commit `d4fc7318`). Also recorded as a session memory (`test-layout-script-misscoped`).
