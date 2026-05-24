---
status: PASS-MANUAL
created: 2026-05-24
updated: 2026-05-24
mode: manual
reason: Preview/Chrome MCP cannot drive Electron — agent-driven smoke is structurally unavailable for this surface; manual fallback per ~/.claude/rules-deferred/manual-smoke-gate.md
operator: Cole Stacey
---

# Wave 11 — Smoke Report (manual)

## Scope

Wave 11 Phase 1 (file-tree click → modal) + Wave 10.1 hotfix batch (5 bugs) + Wave 8 P3 DiffReview crash fix carryover.

## Environment

- Electron dev (`npm run dev`) on Windows 11 Pro
- `layout.canonWorkbench` flag: **enabled**
- Projects: multi-project workbench (Gamify + others including at least one non-git surface for branch-chip check)

## Findings

### Phase 1 — file-tree click → modal — PASS

| Check | Result |
|---|---|
| Click file row in canon file tree → `WorkbenchFileViewerModal` opens with Monaco | PASS |
| Folders expand/collapse | PASS |
| Click-outside modal closes it | PASS |
| No console errors (`useDiffReview must be used within DiffReviewProvider` absent) | PASS |
| Swap to second file while modal open via tree click | **FLAG (low)** — modal covers the file tree, so clicking another tree row isn't reachable while modal is open. Ctrl-K → search → click is the working path. See follow-up below. |

### Wave 10.1 hotfix batch — PASS

| Check | Result |
|---|---|
| App starts cleanly, no `canonWorkbenchSessions` Conf crash on launch (preflight fix) | PASS |
| Outer-rail recents-only project chip click → switches projects (no silent no-op) | PASS |
| Title bar branch chip displays correctly across projects | PASS |
| 4 dropdown popovers (outer-rail project, inner-rail project, title-bar project, title-bar branch) backgrounds readable (92% opacity) | PASS |
| Project list sorted alphabetically across all switcher surfaces | PASS |

### Wave 8 P3 carryover — PASS (verified via Phase 1)

| Check | Result |
|---|---|
| First file-click in a fresh session opens modal cleanly (was the `useDiffReview` crash) | PASS — verified via Phase 1's first-click check |

### Known Wave 12 scope (NOT bugs — visible-but-deferred)

| Check | Result |
|---|---|
| UnifiedRail (<1440px) still renders `MOCK_FILE_TREE` via `ProjectAccordion` | CONFIRMED-DEFERRED — Wave 12 scope |
| Terminal tab `+` / split / rename / delete / maximize buttons inert | CONFIRMED-DEFERRED — Wave 12 scope |
| Stale-path projects show empty file trees | CONFIRMED-DEFERRED — Wave 12 auto-detect-stale scope (follow-up `2026-05-24-workbench-project-crud-manual-and-auto-detect.md`) |

## Verdict

**PASS-MANUAL.** All Wave 11-touched surfaces behave as designed. One LOW-priority UX follow-up filed for the modal-blocks-tree-click ergonomics (it's a modal-overlay design consequence, not a Wave 11 wiring defect).

## Follow-ups filed this smoke

- `roadmap/follow-ups/2026-05-24-workbench-fileviewer-modal-blocks-tree-swap.md` (LOW/OPEN) — modal covers file tree, so click-another-file-while-modal-open is impractical from the tree; Ctrl-K → search → click is the only working path. Decide between (a) make modal narrower/dockable so tree stays visible, (b) accept Ctrl-K as the canonical swap path and document it, (c) add a back/forward / file-history in modal header.

## Process notes

- Agent-driven smoke (`sonnet-smoke-runner` via Preview MCP) was **not viable**: Wave 11 lives entirely inside the Electron canon Workbench shell, behind the `layout.canonWorkbench` flag, and depends on Electron-only IPC (`window.electronAPI.files`, ProjectContext). Preview MCP can only drive web URLs and cannot exercise the Workbench surface. Manual fallback per `~/.claude/rules-deferred/manual-smoke-gate.md` applied.
- This is the standing posture for any Workbench-touching wave until the Electron shell is wrapped by a browser-reachable harness (none currently planned).
