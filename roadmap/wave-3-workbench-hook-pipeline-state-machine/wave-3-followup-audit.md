---
status: COMPLETE
timestamp: 2026-05-21T21:00:00Z
wave: wave-3-workbench-hook-pipeline-state-machine
auditor: haiku-followup-auditor
---

# Follow-Up Audit — Wave 3 (Workbench Hook Pipeline + Live Agent State)

## Summary

Audited 22 OPEN follow-up items against Wave 3's diff and result brief. Wave 3 touched only `src/renderer/components/Workbench/**` (canon workbench rewired from mock to live agent data). One follow-up was **RESOLVED** by Phase 4's dead-mock sweep: the Wave-2-orphaned terminal-line mock constants (`MOCK_CC_TUI_LINES`, `MOCK_SHELL_LINES`, `MOCK_CC_STATUS_LINE`, `MOCK_CC_PROMPT_PLACEHOLDER`, `TermLineTone`, `MockTerminalLine`) were deleted from `workbenchMockData.sidebar.ts` and barrel re-exports. One follow-up (`2026-05-21-workbench-live-git-diff-stats.md`) was **created during this wave** as a deliberate deferral of git-stat UI work (needs main-process IPC); left OPEN. All remaining 20 items are **ACTIVE** (pre-existing follow-ups unrelated to Workbench chrome, no path-touch matches, no content-word overlap with the wave's core logic). None required human review.

## RESOLVED

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-21-wave-2-dead-terminal-line-mocks.md` | Wave 3 Phase 4 deleted the six orphaned mock symbols and barrel re-exports | Phase-4 sweep deleted `TermLineTone`, `MockTerminalLine`, `MOCK_CC_STATUS_LINE`, `MOCK_CC_PROMPT_PLACEHOLDER`, `MOCK_CC_TUI_LINES`, `MOCK_SHELL_LINES` from `src/renderer/components/Workbench/workbenchMockData.sidebar.ts` and their re-exports. Grep confirms zero references in the Workbench tree. Moved to `_archived/follow-ups/`. |

## LIKELY-RESOLVED

None detected in this audit.

## NEEDS-REVIEW

None detected in this audit.

## ACTIVE

20 items left untouched (pre-existing, unrelated to Workbench chrome changes):

- `cypher-engine-feature-additions.md` (2026-05-01; Cypher engine feature expansion)
- `2026-05-05-electron-renderer-browser-mcp-wiring.md` (E2E UI smoke support)
- `2026-05-05-pre-existing-lint-debt-21-errors.md` (Lint cleanup)
- `2026-05-06-file-heat-map-still-broken.md` (Code-indexing UI)
- `2026-05-08-flow-tracer-diagram-rudimentary.md` (Flow-tracer feature)
- `2026-05-08-flow-tracer-symbol-body-via-graph-snippet.md` (Flow-tracer feature)
- `2026-05-08-flow-tracer-trace-engine-quality.md` (Flow-tracer feature)
- `2026-05-11-heatmap-full-rescan-jank.md` (Code-indexing perf)
- `2026-05-13-electron-e2e-spec-drift.md` (E2E test suite drift)
- `2026-05-16-mobile-android-release-workflow-broken.md` (Mobile CI/CD)
- `2026-05-16-stryker-mutate-scope-expansion.md` (Mutation-testing scope)
- `2026-05-16-threadstoresearch-perf-test-flaky-windows-ci.md` (Test stability)
- `2026-05-16-wave-89-tool-bridge-runtime-smoke.md` (Wave 89 deferred smoke)
- `2026-05-17-classifier-test-tier-weak-matcher.md` (Test classification)
- `2026-05-17-move-generateRepoMap-to-worker-plan.md` (Perf architecture)
- `2026-05-18-claude-cli-color-rendering-in-terminal.md` (CLI rendering)
- `2026-05-19-wave-95-manual-smoke.md` (Wave 95 deferred smoke)
- `2026-05-21-remove-xterm-webgl-dependency.md` (Terminal dependency cleanup)
- `2026-05-21-workbench-live-git-diff-stats.md` (Wave 3 deliberate deferral — git stats IPC)
- `outstanding-2026-05-03.md` (Multi-subsystem digest)
