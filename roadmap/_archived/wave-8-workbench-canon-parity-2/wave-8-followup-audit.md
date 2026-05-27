---
status: COMPLETE
timestamp: 2026-05-22T00:00:00Z
wave: wave-8-workbench-canon-parity-2
auditor: haiku-followup-auditor
---

# Follow-Up Audit — Wave 8 Workbench Canon Parity 2

## Summary

Audited 32 OPEN follow-up items from `roadmap/follow-ups/` against Wave 8's phase execution and code changes (52a4ed45..HEAD, 14 files touched in the Workbench subsystem + ADR + deferred schedule). Used phase summaries (session-scoped agent sidebar Phase 1, live FileTree Phase 2, file quick-open + FileViewer Phase 3, session-restore deferred) as context in lieu of a formal wave result brief.

Wave 8 shipped three HIGH-priority parity gaps that were blocking Wave 8 cutover:

**RESOLVED:** 3 items (moved to `_archived/follow-ups/`):
- Session-scoped agent sidebar (Phase 1) — `useWorkbenchAgentData(claudeSessionId?)` now binds the sidebar to the active terminal's Claude session via a threaded id, filtering agents by project root in the fallback case.
- Live FileTree in InnerRail (Phase 2) — replaced `MOCK_FILE_TREE` with `WorkbenchFileTree` + `useWorkbenchFileTree` wired to live `useFileWatcher` + `window.electronAPI.files` data.
- Three canon product decisions (Phase 1–3) — Cole's decision captured and executed: FilePicker folded into Ctrl-K palette with modal, SymbolSearch dropped (canvas-dependent, incompatible with terminal-first), session-restore deferred to separate wave.

**LIKELY-RESOLVED:** 0 items (no path-touch or keyword-overlap signals without explicit markers).

**NEEDS-REVIEW:** 0 items (all line references verified or not present).

**ACTIVE:** 29 items left untouched (recent, no resolution signal within Wave 8's scope). No waves touch the heatmap, flow-tracer, mobile, Stryker, e2e, claude-cli, or other non-Workbench subsystems.

## RESOLVED

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-22-workbench-sidebar-session-scoping.md` | Session-scoping contract implemented in Phase 1 | `useWorkbenchAgentData(claudeSessionId?)` + `resolvePrimary()` two-tier logic (bound path: direct find; fallback: project-filtered selectPrimarySession). Id threaded through `CenterPane → Workbench → AgentSidebar`. Both call sites pass same id. `isCwdInProject()` applies project-root filter in fallback case (lines 391–415 of useWorkbenchAgentData.ts). Resolves HIGH-priority cutover blocker. |
| `2026-05-22-workbench-live-filetree.md` | Live FileTree wired in Phase 2 | `InnerRail.tsx:55` mounts `<FilesSection />` → `<WorkbenchFileTree rootPath={projectRoot} />`. New files: `WorkbenchFileTree.tsx`, `useWorkbenchFileTree.ts` implement lazy expansion over `useFileWatcher` + `window.electronAPI.files.readDir`. Canon §07 styling: indent depth×12px+6, dir icon `--accent-hi`, file `--ink-3`. M/A badges deferred per scope. Resolves HIGH-priority cutover blocker. |
| `2026-05-22-workbench-canon-product-decisions.md` | Cole's three product decisions executed in Phases 1–3 | (1) **FilePicker** shipped: `Overlays/WorkbenchFilePicker.tsx` + `Overlays/WorkbenchFileViewerModal.tsx` wire rail button + `file:open-file` command to shared picker → lazy FileViewer modal (Phase 3, verified in diff). (2) **SymbolSearch** dropped: no-op teardown, verified in `2026-05-22-wave8-teardown-prep-discoveries.md`. (3) **Session-restore** deferred: `roadmap/deferred/2026-05-22-canon-workbench-session-restore.md` filed and scheduled separately (Phase 4 split). Decision captured and acted on; two shipped, one properly deferred. |

## LIKELY-RESOLVED

None detected in this audit.

## NEEDS-REVIEW

None detected in this audit.

## ACTIVE

29 items left untouched (recent, no Wave 8 resolution signal):

- Flow-tracer items (`2026-05-08-flow-tracer-*.md` ×3)
- Heatmap items (`2026-05-06-file-heat-map-still-broken.md`, `2026-05-11-heatmap-full-rescan-jank.md`)
- Stryker / mutation testing (`2026-05-16-stryker-mutate-scope-expansion.md`)
- Mobile / Android workflow (`2026-05-16-mobile-android-release-workflow-broken.md`)
- Thread/perf items (`2026-05-16-threadstoresearch-perf-test-flaky-windows-ci.md`)
- Wave-89 tool-bridge smoke (`2026-05-16-wave-89-tool-bridge-runtime-smoke.md`)
- Electron/MCP items (`2026-05-05-electron-renderer-browser-mcp-wiring.md`, `2026-05-13-electron-e2e-spec-drift.md`)
- Code-gen / repo-map work (`2026-05-17-move-generateRepoMap-to-worker-plan.md`)
- Classifier precision (`2026-05-17-classifier-test-tier-weak-matcher.md`)
- Claude CLI rendering (`2026-05-18-claude-cli-color-rendering-in-terminal.md`)
- Lint debt (`2026-05-05-pre-existing-lint-debt-21-errors.md`)
- Wave-95 smoke (`2026-05-19-wave-95-manual-smoke.md`)
- xterm dependency (`2026-05-21-remove-xterm-webgl-dependency.md`)
- Workbench non-parity items:
  - `2026-05-22-workbench-diff-subscription-latest-ref.md` (diff-panel refinement)
  - `2026-05-22-workbench-files-touched-truncated-path-badges.md` (>80-char path ellipsis tolerance, LOW priority)
  - `2026-05-22-orphaned-agentmonitor-approvaldialog.md` (AgentMonitor cleanup)
  - `2026-05-22-permission-card-elapsed-no-ticker.md` (permission UI polish)
  - `2026-05-22-workbench-forceunified-no-autoclear.md` (collapse-handle state, Wave 6 degrade)
  - `2026-05-22-workbench-command-palette-canon-polish.md` (Ctrl-K keybind + command curation, LOW priority)
  - `2026-05-22-wave8-teardown-prep-discoveries.md` (AgentChat retirement + chat-popout cleanup, adjacent to Wave 8 but separate scope)
  - `2026-05-22-workbench-claudeSessionId-binding-precision.md` (binding heuristic precision, accepted debt, Wave-9+ follow-up)
- Pre-existing items (`outstanding-2026-05-03.md`, `cypher-engine-feature-additions.md`, `follow-ups.md`)

All of the above are untouched by Wave 8's Workbench parity focus and have no explicit resolution signals. The `wave8-teardown-prep-discoveries.md` item is OPEN and relevant to cutover, but the discoveries are deferred (AgentChat retirement is a separate wave; chat-popout retirement is adjacent). No high-risk misses detected.

---

**Actions taken:** Edited frontmatter (`status: RESOLVED`, `resolved-during: wave-8-workbench-canon-parity-2`, `updated: 2026-05-22`) and appended Resolution sections to all three RESOLVED items. Moved files to `roadmap/_archived/follow-ups/`.
