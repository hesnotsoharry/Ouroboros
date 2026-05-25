---
status: COMPLETE
timestamp: 2026-05-24T19:00:00Z
wave: wave-13-agentsidebar-pane-id-binding
auditor: haiku-followup-auditor
---

# Follow-Up Audit — Wave 13

## Summary

Audited 27 OPEN follow-ups against Wave 13's diff + result brief. Wave 13 replaced the heuristic `useWorkbenchClaudeCapture` with deterministic `OUROBOROS_PANE_ID` round-trip binding (pty env injection → hook payload forward → AgentSession.paneId stamping → sidebar filter by paneId). **1 follow-up RESOLVED and archived** (`2026-05-22-workbench-claudeSessionId-binding-precision.md` HIGH) — the central issue the wave directly addressed. The related `2026-05-22-workbench-sidebar-session-scoping.md` (MED) was already archived prior to this audit. **26 follow-ups remain ACTIVE** — they are unrelated to Wave 13's scope (mostly Wave 8x-9x backlog: heat-map jank, flow-tracer quality, linting debt, e2e spec drift, mobile workflows, etc.).

| Category | Count |
|---|---|
| RESOLVED (auto-archived) | 1 |
| LIKELY-RESOLVED | 0 |
| NEEDS-REVIEW | 0 |
| ACTIVE (preserved) | 26 |

## RESOLVED

| File | Reason | Evidence |
|---|---|---|
| `2026-05-22-workbench-claudeSessionId-binding-precision.md` | Wave 13 Phase 2 deleted `useWorkbenchClaudeCapture` heuristic and replaced with deterministic OUROBOROS_PANE_ID binding | **Path-touch signal** (strong): Wave 13 diff includes deletion of `useWorkbenchClaudeCapture` function + its call site in `useWorkbenchTerminals.ts`, and implements paneId binding throughout the chain (`pty.ts` → `hooks.ts` → `AgentSidebar.tsx` → `useWorkbenchAgentData.ts`). **Keywords** (strong): "deterministic binding," "OUROBOROS_PANE_ID," "hijack closed by construction," "heuristic deletion" all appear in result brief (lines 13–82). The follow-up's core concern (IDE-in-itself hijack + external session hijack via weak binding) is explicitly solved by the architecture (result brief section "Wave 13 architecture (the deterministic chain)" lines 40–82). |

## LIKELY-RESOLVED

None detected in this audit.

## NEEDS-REVIEW

None detected in this audit.

## ACTIVE

26 items left untouched (recent, no Wave 13 resolution signal):

| File | Severity | Context |
|---|---|---|
| `2026-05-05-electron-renderer-browser-mcp-wiring.md` | medium | Browser-MCP for UI smoke + bug repro. Unrelated to Wave 13's IPC/binding work. |
| `2026-05-05-pre-existing-lint-debt-21-errors.md` | low | Pre-existing lint errors (Wave 11 debt). Wave 13 did not touch linting. |
| `2026-05-06-file-heat-map-still-broken.md` | — | Heat-map toggle not displaying colored borders on edited files. Wave 13 focused on sidebar binding, not heat-map subsystem. |
| `2026-05-08-flow-tracer-diagram-rudimentary.md` | — | Flow Tracer visual polish. Unrelated. |
| `2026-05-08-flow-tracer-symbol-body-via-graph-snippet.md` | — | Flow Tracer body fetch optimization. Unrelated. |
| `2026-05-08-flow-tracer-trace-engine-quality.md` | — | Flow Tracer engine quality. Unrelated. |
| `2026-05-11-heatmap-full-rescan-jank.md` | — | Heat-map perf during bursty edits. Unrelated. |
| `2026-05-13-electron-e2e-spec-drift.md` | medium | Playwright e2e test failures (11 failing specs across 6 files). Wave 13 did not run e2e tests. |
| `2026-05-16-mobile-android-release-workflow-broken.md` | — | Android workflow CI failure. Unrelated to Electron workbench binding. |
| `2026-05-16-stryker-mutate-scope-expansion.md` | — | Expand Stryker mutate globs. Unrelated. |
| `2026-05-16-threadstoresearch-perf-test-flaky-windows-ci.md` | — | Flaky perf test on Windows runners. Unrelated. |
| `2026-05-16-wave-89-tool-bridge-runtime-smoke.md` | — | Wave 89 smoke deferred. Unrelated. |
| `2026-05-17-classifier-test-tier-weak-matcher.md` | — | Test-quality weak matcher. Unrelated. |
| `2026-05-17-move-generateRepoMap-to-worker-plan.md` | — | Perf: move generateRepoMap to worker thread (status: PLANNED, not OPEN). Skipped (not OPEN). |
| `2026-05-18-claude-cli-color-rendering-in-terminal.md` | low | Claude CLI theme color rendering in terminal. Unrelated. |
| `2026-05-19-wave-95-manual-smoke.md` | medium | Wave 95 smoke walk deferred. Unrelated. |
| `2026-05-20-claude-session-restore-fidelity.md` | — | Session restore fidelity. Wave 13 touched session flow but does not address restore behavior. |
| `2026-05-21-remove-xterm-webgl-dependency.md` | — | Remove xterm WebGL addon. Unrelated to sidebar binding. |
| `2026-05-21-workbench-live-git-diff-stats.md` | — | Live git diff stats in sidebar. Wave 13 focused on binding; sidebar data changes are a different scope. |
| `2026-05-22-orphaned-agentmonitor-approvaldialog.md` | — | Dead code cleanup (ApprovalDialog). Unrelated. |
| `2026-05-22-permission-card-elapsed-no-ticker.md` | — | Permission card timer ticker. Unrelated. |
| `2026-05-22-wave8-teardown-prep-discoveries.md` | — | Wave 8 teardown discoveries. Not addressed by Wave 13. |
| `2026-05-22-workbench-command-palette-canon-polish.md` | — | Command palette polish. Unrelated. |
| `2026-05-22-workbench-diff-subscription-latest-ref.md` | — | Diff subscription refactoring. Unrelated. |
| `2026-05-22-workbench-files-touched-truncated-path-badges.md` | — | File path badge truncation. Unrelated. |
| `2026-05-22-workbench-forceunified-no-autoclear.md` | — | Force unified diff autoclear behavior. Unrelated. |
| `2026-05-24-workbench-fileviewer-modal-blocks-tree-swap.md` | — | File viewer modal blocking tree swap. Unrelated. |
| `2026-05-24-workbench-project-crud-manual-and-auto-detect.md` | — | Project CRUD / auto-detect stale paths. Wave 12 scope; Wave 13 did not touch. |

---

## Audit notes

- **Related follow-up already archived:** `2026-05-22-workbench-sidebar-session-scoping.md` (mentioned in Wave 13 result brief line 36 as also closed) was not found in follow-ups/; it is already in `_archived/follow-ups/`. Confirmed via grep of result brief.
- **No LIKELY-RESOLVED items detected.** Wave 13 was a narrow scope (binding precision only) with clean commit boundaries. No partial-signal matches found across the 26 ACTIVE items.
- **No NEEDS-REVIEW items detected.** All ACTIVE follow-ups are well-scoped to other waves/subsystems with no ambiguous line-references or staleness concerns.

