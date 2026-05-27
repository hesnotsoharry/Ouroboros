---
status: PENDING-MANUAL
created: 2026-05-27
updated: 2026-05-27
mode: manual (cascade per Wave 11/12/13 precedent — Preview MCP cannot drive Electron)
---

# Wave 14 — Manual Smoke Checklist (cascade to Cole)

## Why manual

Per the Wave 11+12+13 precedent: `/ui-smoke` cascades to manual when the wave touches Electron-only surfaces (Workbench rails + dock terminals) — Preview MCP and Chrome MCP cannot launch the Electron BrowserWindow with main-process IPC backing.

## Setup

1. `git pull` (or be on master post-Wave-14-merge).
2. `npm install` if any deps changed (Wave 14 added none, so this is usually skipable).
3. `npm run dev` — launches Electron with HMR. Wait for `renderer-bundle-loaded` log line + the main window to render.

## Checklist — walk each item, note PASS / FAIL / SKIP + free-form notes

### Bug #1 — Right-click context menu (Phase 3)

- [ ] **Outer rail chip right-click**: right-click on a project chip in the outer rail → context menu opens at cursor with "Remove from workbench". Click the item → project disappears from all 3 surfaces. Verify all 3 surfaces (outer rail + title-bar dropdown + inner-rail dropdown) updated.
- [ ] **Title-bar dropdown right-click**: open the project dropdown in the title bar. Right-click a project row → context menu opens. Click "Remove from workbench" → same outcome.
- [ ] **Inner-rail dropdown right-click**: open the project dropdown in the inner rail. Right-click a project row → context menu opens. Click "Remove from workbench" → same outcome.
- [ ] **Esc dismisses**: open menu, press Esc → menu closes without removing.
- [ ] **Outside click dismisses**: open menu, click anywhere outside the menu → menu closes without removing.
- [ ] **OS context menu suppressed**: verify Electron's native OS context menu does NOT appear (the app's `event.preventDefault()` should suppress it).
- [ ] **Healthy chips have NO inline X**: hover a healthy project chip → no X button appears. (Wave 12 had hover-X; Wave 14 D1 removed it from healthy chips.)
- [ ] **Stale chips retain always-visible inline X**: simulate a stale path (rename a project folder on disk while IDE is running, restart, OR delete a project's folder) → the chip renders at 0.5 opacity with an inline X that's always visible (not hover-only). Click the X → project removed. (Right-click on stale chip should also still work.)

### Bug #2 — Fake sessions across all projects (Phase 4)

- [ ] **No UUID placeholder sessions**: open IDE, switch between 2+ projects. Inner rail's session list should show ONLY sessions you actually spawned in the current project — no `5dcef7f1`, `46851144`, etc. ghost sessions appearing across every project.
- [ ] **Project switch updates inner rail**: spawn a Claude session in project A. Switch to project B → inner rail shows project B's sessions only. Switch back to A → A's sessions visible again.
- [ ] **Old stale entries cleanup**: Phase 4 fix only repairs the persist round-trip for NEW saves. Already-persisted rows from before the fix may still have `cwd: undefined` and show as "unknown." If Cole still sees ghost UUIDs after the fix, that's expected for stale rows — a one-time `sessionsData` SQLite cleanup is an optional next-step.

### Bug #3 — Top dock terminal cwd (Phase 2)

- [ ] **Top terminal honors active project**: switch active project to one that is NOT AgentIDE (e.g., Gamify or ContractorApp). Click `+` in the top dock terminal frame. New tab spawns. In the terminal, run `pwd` (PowerShell: `Get-Location`) — should print the active project's path, NOT `C:\Web App\AgentIDE`.
- [ ] **Bottom terminal unchanged**: bottom slot continues to behave as before — uses active project cwd. (Was already working pre-Wave-14; verify no regression.)
- [ ] **Project switch + new spawn**: with a top terminal already open in project A, switch to project B → existing terminal stays in A's cwd (correct — live sessions don't follow project switch). Click `+` to spawn a new top terminal → new terminal opens in B's cwd.

### Bug #4 — Unified rail (Phase 5)

- [ ] **Resize to unified breakpoint**: resize IDE window to <1440px wide. Layout switches to unified mode (single rail merging outer + inner).
- [ ] **File tree shows real files**: in unified rail, expand a project's accordion. The "Files" section shows ACTUAL files from the project (not `MOCK_FILE_TREE` placeholders like "mock-file-1.ts" etc.). Click a folder → it expands lazily to show children.
- [ ] **Collapse/expand works**: click a project's `AccordionHeader` (the row with the project name). The body collapses. Click again → expands.
- [ ] **Single-expanded semantics**: with project A expanded, click project B's header → A collapses, B expands.
- [ ] **No regression on full + compact modes**: resize back to 1500-1700px (compact mode) → InnerRail renders correctly with real file tree (no MOCK_FILE_TREE). Resize to >1760px (full mode) → InnerRail still works (per Wave 11 behavior).

## Notes section (Cole fills)

_(Add observations, surprises, screenshots, follow-ups, etc.)_

```
PASS / FLAGGED / FAILED:
```

```
Surprises (anything not in the checklist that you noticed):
```

```
Follow-ups to file:
```

## After checklist

- If all PASS: flip this report's `status:` to `PASS-MANUAL`; flip waveplan-14.md + wave-14-decisions.md `status:` to `SHIPPED`; merge to master is already done (orchestrator did this at wrap); next: just enjoy a working IDE.
- If FLAGGED: each flag triaged before re-pushing — likely Tier 1/2 inline fixes or file as follow-up + decide whether to revert any phase.
- If FAILED on a Wave 14 surface: identify which phase introduced; file as bug or revert the phase commit. (Should NOT happen — every Wave 14 phase has acceptance tests + Phase 6 wrap verified no Wave 14 regressions.)
