---
status: COMPLETE
timestamp: 2026-05-21T00:00:00Z
wave: wave-2-workbench-terminal-integration
auditor: haiku-followup-auditor
---

# Follow-Up Audit — Wave 2 Workbench Terminal Integration

## Summary

Audited 21 OPEN follow-up files against Wave 2's result brief and diff. Wave 2 delivered workbench terminal integration (live xterm in both frames, draggable+persisted divider, config schema support). The wave's surface is narrow: `src/renderer/components/Workbench/Terminals/`, config types, and one xterm enhancement.

All 21 items predate Wave 2 and target unrelated surfaces:
- Graph / Cypher engine (4 items)
- Flow Tracer quality + rendering (4 items)
- Chat UI + heat-map (5 items)
- Telemetry + MCP (5 items)
- Linting + e2e tests (2 items)
- Miscellaneous (3 items) — includes the just-filed Wave 2 dead-terminal-line-mocks item, which is explicitly OPEN and deferred to Wave 3, not resolved by this wave.

**Result:** No path-touch matches. No keyword-overlap signals (the brief's core words — terminal, xterm, pty, session, draggable, divider, persist, split, workbench, config, glass, tinted — appear in none of the pre-existing follow-ups). No explicit resolution markers. All 21 items remain ACTIVE.

## RESOLVED

None detected in this audit.

## LIKELY-RESOLVED

None detected in this audit.

## NEEDS-REVIEW

None detected in this audit.

## ACTIVE

21 items left untouched:

| File | Created | Reason |
|------|---------|--------|
| `cypher-engine-feature-additions.md` | 2026-05-01 | Graph engine feature additions (Cypher `WITH`, `OPTIONAL MATCH`, `UNWIND`). Untouched by Wave 2. |
| `2026-05-08-flow-tracer-trace-engine-quality.md` | 2026-05-08 | Flow tracer output quality (bridge resolution, keyword filtering, truncation). Untouched by Wave 2. |
| `2026-05-13-electron-e2e-spec-drift.md` | 2026-05-13 | 11 failing Electron e2e tests (IPC contract drift). Untouched by Wave 2. |
| `2026-05-08-flow-tracer-diagram-rudimentary.md` | 2026-05-08 | Flow tracer swimlane rendering (placeholder → design-spec). Untouched by Wave 2. |
| `2026-05-08-flow-tracer-symbol-body-via-graph-snippet.md` | 2026-05-08 | Narration cache should use graph's `get_code_snippet`. Untouched by Wave 2. |
| `outstanding-2026-05-03.md` | 2026-05-03 | Digest of 140+ open items across chat, telemetry, MCP, graph, performance. Untouched by Wave 2. |
| `2026-05-16-stryker-mutate-scope-expansion.md` | 2026-05-16 | Expand Stryker mutation testing globs (Wave 92 follow-up). Untouched by Wave 2. |
| `2026-05-16-mobile-android-release-workflow-broken.md` | 2026-05-16 | GitHub Actions workflow parse failure (mobile release). Untouched by Wave 2. |
| `2026-05-16-threadstoresearch-perf-test-flaky-windows-ci.md` | 2026-05-16 | Flaky perf test on Windows CI (SQLite + native bindings). Untouched by Wave 2. |
| `2026-05-16-wave-89-tool-bridge-runtime-smoke.md` | 2026-05-16 | Wave 89 Phase 1 tool-bridge routing runtime smoke. Untouched by Wave 2. |
| `2026-05-05-electron-renderer-browser-mcp-wiring.md` | 2026-05-05 | Electron renderer → interactive MCP for B0 bug reproduction. Untouched by Wave 2. |
| `2026-05-17-move-generateRepoMap-to-worker-plan.md` | 2026-05-17 | Architecture plan for moving `generateRepoMap` to worker thread. Untouched by Wave 2. |
| `2026-05-17-classifier-test-tier-weak-matcher.md` | 2026-05-17 | Weak test matcher in `classifier.test.ts` (test-discipline framework). Untouched by Wave 2. |
| `2026-05-18-claude-cli-color-rendering-in-terminal.md` | 2026-05-18 | Claude CLI color rendering off in in-app terminal (OSC / theme colors). Untouched by Wave 2. |
| `follow-ups.md` | 2026-05-01 | Centralized index of wave follow-ups + deferrals. Untouched by Wave 2. |
| `2026-05-05-pre-existing-lint-debt-21-errors.md` | 2026-05-05 | Pre-existing lint errors (21 errors, 4 warnings). Untouched by Wave 2. |
| `2026-05-19-wave-95-manual-smoke.md` | 2026-05-19 | Wave 95 manual smoke walk (diff review, artifact pane, canvas opacity). Untouched by Wave 2. |
| `2026-05-06-file-heat-map-still-broken.md` | 2026-05-06 | File-tree heat map does not light up after agent edits. Untouched by Wave 2. |
| `2026-05-11-heatmap-full-rescan-jank.md` | 2026-05-11 | Heat-map full-rescan causes jank during parallel edits. Untouched by Wave 2. |
| `2026-05-21-remove-xterm-webgl-dependency.md` | 2026-05-21 | Remove `@xterm/addon-webgl` dead dependency. Untouched by Wave 2 (Wave 2 does not remove deps). |
| `2026-05-21-wave-2-dead-terminal-line-mocks.md` | 2026-05-21 | **OPEN, deferred to Wave 3.** Dead terminal-line mock constants after Wave 2 teardown. Filed during Wave 2 wrap; explicitly deferred to Wave 3 mock rework. Not resolved by Wave 2. |

---

**Note:** The 2026-05-21-wave-2-dead-terminal-line-mocks item was filed DURING this wave's wrap phase as a **deferral TO Wave 3**, not as a resolved follow-up. It remains OPEN by design. The audit confirms: no Wave 2 work resolves any of the 21 items.
