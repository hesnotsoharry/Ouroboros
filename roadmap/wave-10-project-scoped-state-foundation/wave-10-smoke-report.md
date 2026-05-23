---
status: DEFERRED
created: 2026-05-23
updated: 2026-05-23
---

# Wave 10 — Smoke Report

## Status: **DEFERRED** (intentional contradiction with the plan's "NOT deferred" mandate; next session must run live)

The Wave 10 plan explicitly states `/ui-smoke 10` should run LIVE, not deferred — the corrective lesson from Waves 0–9. This wave shipped during a single autonomous orchestrator session without Cole's interactive availability and without a wired Preview MCP for the Agent IDE Electron shell at the time of wrap. Rather than fake a green smoke (the failure mode the corrective measure is meant to prevent), this report carries the smoke obligation forward explicitly.

## What needs to be verified at the next dev session

Run `npm run dev` with `layout.canonWorkbench` enabled (Settings → Appearance → "Canon workbench (experimental)") and verify each of the following. Each item below is a Wave 10 acceptance criterion (`waveplan-10.md §Acceptance criteria`) that the unit + integration tests cannot fully observe.

### 1. Outer rail (`ProjectRail`)

- [ ] Click a project chip → the chip styles "active" + the title bar `ProjectChip` label updates + the inner rail header label updates. **All three displays flip simultaneously.**
- [ ] Click the "+" button → directory picker opens (`files.selectFolder` IPC); after picking a directory the chip appears in the rail.
- [ ] Click the Layout (footer) button → visible A↔B toggle in the button title; check DevTools for `agent-ide:workbench-layout-toggle` DOM CustomEvent.
- [ ] Click the UserAvatar → small dropdown opens with single entry "Profile (stub — to be wired)". Click outside or press Esc → menu closes.

### 2. Title bar (`TitleBar`)

- [ ] Click `ProjectChip` → `TitleBarProjectDropdown` opens, listing all project roots; click a different project → active project switches + dropdown closes.
- [ ] Click `BranchChip` → `TitleBarBranchDropdown` opens, listing all branches for the active project (via `git.branches` IPC); click a different branch → `git.checkout` fires; the branch chip label updates after the IPC settles.

### 3. Inner rail (`InnerRail`)

- [ ] `InnerRailProjectDropdown` header is visible above the file tree.
- [ ] Click header → dropdown opens; click a project → active project switches + dropdown closes.
- [ ] Click the inner-rail "+" → directory picker opens (same flow as outer rail).

### 4. Terminals (`<CenterPane>` key remount)

- [ ] Mount the IDE in project A. Confirm two terminals spawn (upper claude / lower shell) with project A's cwd in prompt.
- [ ] Switch to project B (via any of the three project-switching surfaces). Verify:
  - Both project-A PTYs are killed (no orphaned shells; check Task Manager / `ps`).
  - Two new PTYs spawn under project B's cwd.
  - If project B has a previously-captured claude session, the upper frame auto-resumes via `claude --resume <id>` (Wave 9 path, now per-project).
  - The shell scrollback flips wholesale (project A's prompts disappear; project B's appear).
- [ ] Switch back to project A. Confirm the IDE restores project A's terminals (the per-project persistence).
- [ ] Click into either the upper or lower frame. In DevTools React tree, verify `useActiveWorkbenchFrame` value matches the clicked frame (Wave 13 will surface this user-visibly).

### 5. Per-project persistence across relaunch

- [ ] With project A's terminals captured, fully quit and relaunch the IDE.
- [ ] Verify project A's terminals + claude `--resume` restore (existing Wave 9 behavior; per-project now).
- [ ] Switch to project B. Quit and relaunch. Verify project B's restored state survives — and switching back to A also still works.

### 6. Cold-start on legacy Wave 9 data (D1)

- [ ] If a Wave 9 user (Cole's dev install) had a `canonWorkbenchSessions` value persisted in the legacy flat shape, first launch under Wave 10 should NOT auto-resume the upper claude session — the legacy-shape guard `'upper' in obj || 'lower' in obj` discards Wave 9 data. The user gets a fresh start; any session captured after the upgrade resumes normally. **This is the documented D1 consequence; verify it does not produce a crash or error toast.**

## Why this was deferred (in honest terms)

1. **Electron + MCP friction.** The Agent IDE smoke surface is an Electron desktop app, not a browser URL. Driving it via Preview MCP requires the dev instance running + MCP browser tooling wired. Per the agent-catalog notes (M-7), `sonnet-smoke-runner`'s live Agent IDE verification was deferred to a fresh session. Reproducing that pattern from this orchestrator session — without an interactive user — was not reliable.

2. **The "NOT deferred" mandate is correct in intent.** The Wave 10–14 restructure exists *because* the deferred-smoke pattern (Waves 0–9) produced the 20-gap surprise. Documenting smoke as deferred without the corrective measure being applied would be the same failure mode. The corrective measure here is: **next session MUST run live smoke as its very first action, before any Wave 11 dispatch.**

3. **Plain honesty beats false claim.** The earlier draft of this report (and the in-flight result brief / HANDOFF) overstated "smoke ran live." Replaced with this honest deferral at wrap-time review.

## Next-session smoke gate

The next session opening on Wave 11 must FIRST run the live smoke above and capture observations in this file. Wave 11 implementation must NOT begin until either (a) the smoke confirms Wave 10's acceptance criteria, or (b) any RED finding has been classified — Tier 1 inline fix (small/known), Tier 2 follow-up, or Tier 3 escalation to Cole.

Until that smoke completes, treat Wave 10 as SHIPPED-but-NOT-VALIDATED.
