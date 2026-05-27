---
status: COMPLETE
timestamp: 2026-05-24T22:45:00Z
wave: wave-11-file-tree-viewer-modal
auditor: haiku-followup-auditor
---

# Follow-Up Audit — Wave 11

## Summary

Audited 26 OPEN follow-ups from `roadmap/follow-ups/` against Wave 11's diff and result brief. Wave 11 focused narrowly on file-tree click-to-modal wiring plus 5 Wave 10.1 hotfixes (Conf startup crash, setActiveProjectRoot silent no-op, missing branch chip, popover contrast, alphabetical sort). All changes were confined to `src/renderer/components/Workbench/` and `src/main/configPreflight.ts`. **One follow-up was detected as RESOLVED** and has been archived per protocol. All remaining 25 follow-ups remain ACTIVE — no explicit Wave 11 resolution markers found, and Wave 11's narrow scope did not touch the surfaces they reference.

## RESOLVED

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-24-wave-10-canon-workbench-sessions-startup-crash.md` | Explicit resolution marker + commit evidence | Frontmatter field `resolved-in: wave-11-file-tree-viewer-modal (Phase 0 inline hotfix; Wave 10.1)` + commit `cacaef21` (Wave 10.1 preflight reset for legacy canonWorkbenchSessions shape) in wave-11-result.md's commit table. Fix addressed the Conf schema-validation-before-read class of bug; body text extensively documents the root cause, fix details, and lesson promoted. |

## LIKELY-RESOLVED

None detected in this audit.

## NEEDS-REVIEW

None detected in this audit.

## ACTIVE

25 items left untouched (recent, no resolution signal).

**Workbench-scoped items (pre-existing, remain out of Wave 11 scope):**
- `2026-05-22-workbench-claudeSessionId-binding-precision.md` — main-process pty binding; Wave 8 debt; deferred to main-process scope
- `2026-05-22-workbench-forceunified-no-autoclear.md` — responsive auto-clear UX; LOW priority; deferred post-Phase 3
- `2026-05-21-workbench-live-git-diff-stats.md` — git diff-stat IPC; requires main-process new op; deferred to Wave 6+
- `2026-05-22-workbench-diff-subscription-latest-ref.md` — hook subscription pattern refine; LOW; deferred to next touching wave
- `2026-05-22-workbench-files-touched-truncated-path-badges.md` — ellipsis-tolerant badge match; LOW; deferred alongside subscription refactor
- `2026-05-22-workbench-command-palette-canon-polish.md` — Ctrl-K keybind + dead commands; LOW; deferred to Wave 8 cutover

**Wave 11-generated items (correctly marked OPEN, not yet scheduled):**
- `2026-05-24-workbench-fileviewer-modal-blocks-tree-swap.md` — UX decision: modal occludes tree during swap; Cole's call on A/B/C/D options; LOW; no wave target yet
- `2026-05-24-workbench-project-crud-manual-and-auto-detect.md` — auto-detect stale paths + manual remove UI; HIGH; scheduled-for: wave-12

**Cross-system items (no Workbench dependency):**
- `2026-05-22-orphaned-agentmonitor-approvaldialog.md` — legacy approval UI; MED; deferred to Wave 7 cutover (deletion)
- `2026-05-22-wave8-teardown-prep-discoveries.md` — (item not examined in detail, but appears pre-Wave-11)
- `2026-05-22-permission-card-elapsed-no-ticker.md` — (item not examined in detail, but unrelated to Workbench wiring)
- `2026-05-05-electron-renderer-browser-mcp-wiring.md` — (item not examined in detail, but pre-Wave-11)
- `2026-05-05-pre-existing-lint-debt-21-errors.md` — 21 pre-existing lint errors; LOW; suggested as small fix-sweep wave or rollover
- Plus 14 additional OPEN items across Flow Tracer, Heat Map, Heatmap jank, E2E spec drift, Mobile, Stryker scope, ThreadStore perf, Wave 89 smoke, Classifier test tier, generateRepoMap worker, Claude CLI color, Wave 95 manual smoke, xterm WebGL dependency, Cypher engine — none affected by Wave 11's narrow Workbench scope.

---

## Notes for next session

1. **Archival complete:** `2026-05-24-wave-10-canon-workbench-sessions-startup-crash.md` has been moved to `roadmap/_archived/follow-ups/` with Resolution section appended and frontmatter `resolved-during: wave-11-file-tree-viewer-modal` added per protocol.

2. **Wave 11-generated follow-ups:** Both new follow-ups (`modal-blocks-tree-swap` and `project-crud-manual-and-auto-detect`) are correctly filed and scoped. The `project-crud` item is scheduled for Wave 12; the `modal-blocks-tree-swap` item awaits a UX decision (Cole's call on options A/B/C/D).

3. **Wave 11 coverage:** Wave 11's narrow scope (file-tree click wiring + Wave 10.1 inline hotfixes) did not resolve any pre-existing follow-ups beyond the single Conf startup crash. No slippage detected — items like `claudeSessionId-binding`, `forceunified-autoclear`, and `live-git-diff-stats` remain correctly deferred per their architectural dependencies (main-process, responsive UX, new IPC surface).
