---
status: COMPLETE
timestamp: 2026-05-22T00:00:00Z
wave: wave-4-workbench-agent-sidebar-live
auditor: haiku-followup-auditor
---

# Follow-Up Audit — wave-4-workbench-agent-sidebar-live

## Summary

**23 OPEN follow-up items audited.** Wave 4 shipped agent-sidebar live panels with live data sources (NOW, Context, Files Touched, Latest Hunk, Hook Timeline) — a renderer-only wave scoped to the workbench subsystem. Two new follow-ups were authored DURING the wave as intentionally-deferred items (workbench-diff-subscription-latest-ref, workbench-files-touched-truncated-path-badges) per the Phase 3 phase-reviewer report; per user instruction, these remain OPEN and were NOT closed by this audit. No wave-context artifacts (wave-result.md content words, touched files from wave diff) matched resolution criteria for any of the remaining 21 OPEN items. One item (`2026-05-06-file-heat-map-still-broken.md`) requires human attention: it asks for instrumented debugging (runtime log.info calls) to diagnose a heat-map subscription issue, which was not in scope for the sidebar work. The remaining 20 items are pre-existing or cross-wave concerns unrelated to the sidebar panels' live wiring.

**Status:** No items RESOLVED this wave. 1 flagged NEEDS-REVIEW. 20 ACTIVE (unchanged).

## RESOLVED

None detected in this audit.

## LIKELY-RESOLVED

None detected in this audit.

## NEEDS-REVIEW

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-06-file-heat-map-still-broken.md` | Follow-up requires instrumented debugging at runtime; wave scope (sidebar live panels) does not address it. Requests `log.info('[heat-map] ...')` instrumentation before proposing a fix per debug-before-fix.md discipline. | File-heat-map subscription is orthogonal to workbench sidebar; no touched files in this wave's diff touch the heat-map logic (useFileHeatMap.ts). Human should triage whether heat-map investigation belongs in a separate bug wave or bundled with future renderer work. |

## ACTIVE

20 items left untouched (recent or out-of-scope for this wave):

| File | Created | Reason |
|------|---------|--------|
| `2026-05-22-workbench-diff-subscription-latest-ref.md` | 2026-05-22 | Authored during Phase 3 phase-reviewer as a refinement follow-up (convert diff-event subscription to latest-ref pattern). Intentionally OPEN per user directive. |
| `2026-05-22-workbench-files-touched-truncated-path-badges.md` | 2026-05-22 | Authored during Phase 3 implementer + reviewer as a graceful-degrade refinement (ellipsis-tolerant badge matching for >80-char paths). Intentionally OPEN per user directive. |
| `2026-05-21-workbench-live-git-diff-stats.md` | 2026-05-21 | Status-bar git +adds/−dels + per-project dirty count. Deferred from Wave 3; needs new main-process git op. Out of scope for sidebar renderer work. |
| `2026-05-21-remove-xterm-webgl-dependency.md` | 2026-05-21 | Cleanup: remove dead @xterm/addon-webgl and patch files. Cross-cutting cleanup, not sidebar-scoped. |
| `2026-05-19-wave-95-manual-smoke.md` | 2026-05-19 | Wave 95 deferred smoke walks for Phases G/H (multi-project diff + artifact-pane removal). Unrelated to Wave 4. |
| `2026-05-18-claude-cli-color-rendering-in-terminal.md` | 2026-05-18 | Claude CLI color mismatch in in-app terminal. Terminal rendering issue, not sidebar. |
| `2026-05-16-wave-89-tool-bridge-runtime-smoke.md` | 2026-05-16 | Wave 89 phase-reviewer deferred smoke. Unrelated to sidebar. |
| `2026-05-16-threadstoresearch-perf-test-flaky-windows-ci.md` | 2026-05-16 | CI perf test flakiness on Windows runners. Unrelated to sidebar. |
| `2026-05-16-mobile-android-release-workflow-broken.md` | 2026-05-16 | Mobile Android release workflow YAML parse error. Unrelated to sidebar. |
| `2026-05-16-stryker-mutate-scope-expansion.md` | 2026-05-16 | Stryker mutate glob expansion candidates per Wave 92. Unrelated to sidebar. |
| `2026-05-17-move-generateRepoMap-to-worker-plan.md` | 2026-05-17 | Architect plan for offloading generateRepoMap to worker thread (context layer perf). Unrelated to sidebar. |
| `2026-05-17-classifier-test-tier-weak-matcher.md` | 2026-05-17 | Test-discipline framework follow-up: tighten classifier.test.ts assertions. Unrelated to sidebar. |
| `2026-05-11-heatmap-full-rescan-jank.md` | 2026-05-11 | Heat-map full-rescan jank during parallel edits. Related to file tree, not sidebar. |
| `2026-05-08-flow-tracer-symbol-body-via-graph-snippet.md` | 2026-05-08 | Flow tracer narration should use graph's get_code_snippet. Unrelated to sidebar. |
| `2026-05-08-flow-tracer-diagram-rudimentary.md` | 2026-05-08 | Flow tracer rendering is visually placeholder. Unrelated to sidebar. |
| `2026-05-05-pre-existing-lint-debt-21-errors.md` | 2026-05-05 | Pre-existing ESLint violations (21 errors, 4 warnings at pristine master). Predates this wave; lint clean per wave gates. |
| `2026-05-05-electron-renderer-browser-mcp-wiring.md` | 2026-05-05 | Renderer browser-MCP wiring for B0 bug repro (Stage 1 Profile B feature). Unrelated to sidebar. |
| `follow-ups.md` | 2026-05-01 | Centralized index/digest of outstanding follow-ups. Meta-artifact, not a work item. |
| `2026-05-11-heatmap-full-rescan-jank.md` | 2026-05-11 | Heat-map state-management inefficiency. File tree / state, not sidebar. |
| `outstanding-2026-05-03.md` | 2026-05-03 | Outstanding digest index (pre-Wave 82). Meta-artifact. |
| `cypher-engine-feature-additions.md` | (no status date) | Cypher engine feature roadmap (Wave A/B/C tiers). Graph subsystem, not sidebar. |

---

## Audit method note

Wave diff included 18 touched files, all scoped to `src/renderer/components/Workbench/` (sidebar panels) or test/config files. No touched files matched ANY of the follow-up items' specific code references (e.g., `useFileHeatMap.ts`, `generateRepoMap`, `classifier.test.ts`, etc.), and the wave-result.md content words (sidebar, context, files touched, hook timeline, workbench, renderer, adapter, live, panel, diff, derivation) showed no semantic overlap with the follow-up corpus. The two 2026-05-22 follow-ups were filed DURING the phase-review process as recommendations for future refinement, not as bugs or blocks — they remain ACTIVE per user instruction.

