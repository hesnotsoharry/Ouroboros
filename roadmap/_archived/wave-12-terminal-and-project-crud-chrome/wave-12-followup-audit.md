---
status: COMPLETE
timestamp: 2026-05-24T00:00:00Z
wave: wave-12-terminal-and-project-crud-chrome
auditor: haiku-followup-auditor
---

# Follow-Up Audit — Wave 12

## Summary

Audited 32 OPEN follow-ups from `roadmap/follow-ups/` against Wave 12's diff (4 commits: Phase 1 `files.pathExists` IPC, Phase 2 project CRUD, Phase 3 tab state machine, Phase 4 terminal UI wiring). Wave 12 context: path-touch analysis only (no wave result brief available at audit time; evaluated against waveplan, ADR decisions, and explicit commit scope). **Result: 1 RESOLVED, 0 LIKELY-RESOLVED, 0 NEEDS-REVIEW, 31 ACTIVE.** One follow-up auto-closed and moved to archive; the remainder left OPEN per wave ADR (D8, D9) or because they address unrelated subsystems or future waves.

## RESOLVED

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-24-workbench-project-crud-manual-and-auto-detect.md` | PRIMARY criterion: explicit resolution marker + path-touch confirmation. Follow-up explicitly `scheduled-for: wave-12-terminal-and-project-crud-chrome` in frontmatter. Waveplan Scope Phase 2 names end-to-end closure: "Add inline remove (X) button to all three render surfaces (ProjectRail.tsx, TitleBarProjectDropdown.tsx, InnerRailProjectDropdown.tsx). Wire X to removeProjectRoot(path). Stale chips/rows render at 0.5 opacity." Phase 2 commit 2489f165 touches all three surfaces + ProjectContext + useWorkbenchProjects + acceptance tests. ADR D2 finalizes stale-detection UX. Gap 1 (auto-detect) closed by Phase 1 files.pathExists IPC + Phase 2 useWorkbenchProjects derivation; Gap 2 (manual remove) closed by wired X buttons on all three surfaces. Cole's verbatim complaint ("no way to remove projects currently") resolved by inline X affordance. | **Path-touch strong signal:** Phase 2 commit 2489f165 explicitly touches `ProjectRail.tsx`, `TitleBarProjectDropdown.tsx`, `InnerRailProjectDropdown.tsx`, `useWorkbenchProjects.ts`, `ProjectContext.tsx`. **Explicit scheduling marker:** frontmatter `scheduled-for: wave-12-terminal-and-project-crud-chrome`. **ADR confirmation:** wave-12-decisions.md D2 finalized auto-detect UX (inline dim + always-visible X). **Acceptance criterion:** Waveplan Phase 2 acceptance line states "ALL three project-switcher surfaces... render an X remove button" and "Stale chips/rows render at opacity: 0.5". Wave 12 plan unambiguously states this follow-up's closure as an acceptance criterion. |

## LIKELY-RESOLVED

None detected in this audit.

## NEEDS-REVIEW

None detected in this audit.

## ACTIVE

31 items left untouched (no resolution signal, or explicitly deferred per wave ADR). Key items per briefing:

**Explicitly deferred to future waves per ADR:**
- `2026-05-22-workbench-claudeSessionId-binding-precision.md` (HIGH/OPEN) — Wave 13 territory (ADR D10: main-process pane-ID injection). Waveplan Scope explicitly states "NOT addressed in Wave 12".
- `2026-05-22-workbench-forceunified-no-autoclear.md` (LOW/OPEN) — ADR D8 deferred (orthogonal surface). "NOT project/terminal CRUD; tangentially related but orthogonal."
- `2026-05-21-workbench-live-git-diff-stats.md` (LOW/OPEN) — own body defers to Wave 6+. No Wave 12 touch.
- `2026-05-24-workbench-fileviewer-modal-blocks-tree-swap.md` (LOW/OPEN) — ADR D9 deferred pending Cole's UX call. Waveplan Scope "not a Wave 12 prerequisite".

**Unrelated subsystems / cross-project items (28 remaining):**
Lint debt, flow tracer, heat map, mobile release, electron MCP wiring, agentmonitor, permission card, command palette, diff subscription, file badges, classifier tests, stryker config, perf tests, Wave 89 context, CLI color rendering, xterm WebGL, cypher engine, and archival index files. None have path-touch or keyword signal in Wave 12 scope.

