---
status: PENDING-MANUAL
created: 2026-05-24
updated: 2026-05-24
mode: manual
reason: Preview/Chrome MCP cannot drive Electron — agent-driven smoke is structurally unavailable for the canon Workbench surface; manual fallback per ~/.claude/rules-deferred/manual-smoke-gate.md and Wave 11 precedent
---

# Wave 12 — Smoke Report (manual)

## Status

`PENDING-MANUAL` until Cole completes the checklist below; then orchestrator flips frontmatter to `PASS-MANUAL` / `FLAGGED` / `FAIL` per outcome.

## Scope

Wave 12 Phase 1 (`files.pathExists` IPC) + Phase 2 (project CRUD + auto-detect-stale) + Phase 3 (tab state machine + schema migration) + Phase 4 (terminal CRUD UI + maximize + tab header fix). All behind `layout.canonWorkbench` flag.

## Environment

- Electron dev (`npm run dev`) on Windows 11 Pro
- `layout.canonWorkbench` flag: **enabled** (Settings → Appearance → "Canon workbench (experimental)")
- Projects: multi-project workbench (Gamify + at least 2 others; ideally include one non-git directory and one stale path you can break by renaming the folder on disk)

## Phase 4 — Terminal tab CRUD + maximize + header overlap fix

**Upper terminal (CC frame):**
- [ ] Click `+` in upper tab bar → new pty spawns, new tab appears, becomes active
- [ ] Click between tabs → active terminal switches (the active tab indicator moves; the terminal content swaps)
- [ ] Double-click a tab label → inline input replaces label; type "build" → press Enter → label updates to "build" and persists across the next click
- [ ] Press Esc during rename → input reverts to original label, no update
- [ ] Type empty/whitespace then Enter → reverts to original label
- [ ] Click per-tab X → tab closes, pty dies, active falls back to next remaining tab
- [ ] Close the LAST tab in a frame → auto-spawns replacement (per Phase 3 design)
- [ ] Long tab labels (try renaming to "this-is-a-very-long-tab-label-with-many-words") → truncate with `…`; native browser tooltip on hover shows full label

**Lower terminal (shell frame):**
- [ ] Same checks as upper but for `kind: 'shell'` (plain shell, no Claude)

**Maximize:**
- [ ] Click Maximize on upper frame's TabBarControls → lower frame + divider disappear; upper takes full center pane
- [ ] Click Maximize again → dual-frame restored
- [ ] Same for lower frame Maximize
- [ ] During maximize, click Maximize on the OTHER frame's button → expected: that other frame takes over (single Maximize state, toggle via either frame)
- [ ] Relaunch the IDE while maximized → restarts in dual-frame view (ephemeral state per ADR D5)

**Split button:**
- [ ] Hover over Split button → tooltip reads "Split — coming in a future wave"
- [ ] Click Split button → no-op (inert per ADR D4)

## Phase 3 — Tab state per-project + persistence

- [ ] Add 2 tabs in upper, 1 in lower for project A
- [ ] Switch to project B (click chip in outer rail OR title bar dropdown) → upper + lower tab bars show project B's collection (NOT project A's). Default may be 1 tab per frame if first visit.
- [ ] Add 1 tab in upper for project B
- [ ] Switch back to project A → upper tab bar shows the 2 tabs from before; the rename "build" survives
- [ ] Relaunch IDE → project A's tab collection is restored from `canonWorkbenchSessions`

## Phase 3 — Schema migration (no live verification possible without rolled-back data)

- [ ] App starts cleanly on first launch with Phase 4 code (no Conf schema validation crash on Wave 10-shape data — `configPreflight` clears legacy data automatically)
- [ ] No console errors mentioning `canonWorkbenchSessions` schema mismatch

If you previously had Wave 10 data in your electron-store and the IDE launched cleanly, the cold-start migration worked.

## Phase 2 — Project CRUD: stale detection + manual remove

**Setup:** ensure you have at least 2 active projects. To test stale detection, rename one project's folder on disk (e.g., `Gamify` → `GamifyTemp`) so the stored path no longer exists.

- [ ] **Outer rail chips:** stale project chip appears at opacity 0.5; healthy chips at full opacity
- [ ] **Hover healthy chip:** X remove button appears (hover-only visibility)
- [ ] **Stale chip:** X is always visible (no hover required)
- [ ] Click X on a stale chip → chip removed from outer rail + title bar dropdown + inner rail dropdown simultaneously
- [ ] Click X on the currently-ACTIVE project chip → active switches to next-alphabetical remaining project; the workbench's file tree + terminal collections swap to that project
- [ ] Click X on the last remaining project → workbench enters "no project" empty state
- [ ] Re-add the renamed folder (rename back, then click `+` to add) → chip restored, exists flag updates to true after `pathExists` re-derivation

**Title bar dropdown:**
- [ ] Open title bar project dropdown → stale rows render dimmed with always-visible X
- [ ] Click X on a row → project removed; dropdown updates

**Inner rail dropdown:**
- [ ] Same checks as title bar dropdown

## Phase 1 — `files.pathExists` IPC (indirect verification via Phase 2)

- [ ] Phase 2's stale detection working = Phase 1 IPC working end-to-end (no separate manual surface for the IPC itself)

## Wave 9/10/11 regression check (must still work)

- [ ] Claude auto-resume: relaunch IDE with a project that has a running `claude` session in upper → on relaunch, `claude --resume <id>` auto-fires (NOT a fresh `claude` invocation)
- [ ] File tree click → modal opens (Wave 11 Phase 1 wiring preserved)
- [ ] Per-project terminal isolation (Wave 10) still works
- [ ] Project switch (Wave 10) still works on all 3 surfaces

## Known scope-deferred (NOT bugs — confirm visible, don't fix)

- [ ] UnifiedRail (<1440px window) still uses `MOCK_FILE_TREE` — Wave 12 didn't address (still Wave 12+ scope; UnifiedRail isn't the canon dual-rail surface)
- [ ] Split button inert with tooltip — per ADR D4
- [ ] AgentSidebar binding still uses Wave 8 heuristic (claudeSessionId-binding-precision follow-up) — Wave 13 territory

## Expected findings (acceptable / known)

- `Workbench.projectSwitch.wave10.test.tsx` pre-existing timeout in test suite (NOT a smoke surface issue — only manifests in unit-test environment)
- Stryker mutation score 31.72% (carries forward from Wave 3+; pre-existing src/shared/ debt, NOT Wave 12-introduced)

## Cole's findings

_(Cole fills this section after walking the checklist)_

| Section | Status | Notes |
|---|---|---|
| Phase 4 — terminal CRUD upper | TBD | |
| Phase 4 — terminal CRUD lower | TBD | |
| Phase 4 — maximize | TBD | |
| Phase 4 — Split inert | TBD | |
| Phase 3 — per-project tab persistence | TBD | |
| Phase 3 — schema migration clean launch | TBD | |
| Phase 2 — project CRUD all surfaces | TBD | |
| Wave 9/10/11 regression | TBD | |

## Verdict

_(Orchestrator fills after Cole reports)_
