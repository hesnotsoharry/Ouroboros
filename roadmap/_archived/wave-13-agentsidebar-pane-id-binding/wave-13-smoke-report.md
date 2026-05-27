---
status: PENDING-MANUAL
created: 2026-05-24
updated: 2026-05-24
wave: 13
bundled-with: wave-12-terminal-and-project-crud-chrome
---

# Wave 12 + 13 Combined Manual Smoke Checklist

**Why combined.** Wave 12 deferred `/ui-smoke 12` to Cole's manual walkthrough at Wave 13 wrap (per Cole's 2026-05-24 directive). Wave 13 also deferred its formal `/ui-smoke 13` to Cole. One bundled walkthrough covers both wave surfaces.

**Why manual.** Preview MCP cannot drive Electron processes; the canon Workbench requires the live Electron dev shell. Sonnet-smoke-runner agent + Preview MCP both return CANNOT-LAUNCH for Electron renderer surface. Manual is the sanctioned fallback per `~/.claude/rules-deferred/manual-smoke-gate.md`.

**Posture.** Wave 13 is SHIPPED locally pending this smoke. Cole walks through; orchestrator updates result brief + flips status to SHIPPED-VERIFIED or FLAGGED depending on outcome.

---

## Setup

1. From master (or wave-11-plan branch after cherry-pick): `npm run dev`
2. Open Settings → Appearance → enable "Canon workbench (experimental)" → restart Electron
3. Confirm canon shell is the active layout (six-region grid; title bar with Agent Globe; project rail; inner rail with file tree; centre two-frame terminal; agent sidebar; status bar)

---

## Wave 12 surfaces (deferred from Wave 12 wrap)

### Project CRUD (Wave 12 Phase 2)

| # | Scenario | Expected behavior | Result (PASS/FLAG + notes) |
|---|---|---|---|
| 12.1 | Open canon workbench with multiple recent projects loaded | All projects appear as chips in the outer project rail, alphabetically sorted | |
| 12.2 | Rename a project directory on disk (e.g. `Gamify` → `GamifyRenamed`) while IDE is open, then reload | The stale-path project chip appears dimmed; X button to remove is visible | |
| 12.3 | Click the X button on a stale chip | Chip removed from all three switcher surfaces (outer rail, TitleBar dropdown, InnerRail dropdown) | |
| 12.4 | Click X on the currently-ACTIVE project chip | Removed; next-alphabetical project becomes active; file tree + terminals re-mount cleanly | |
| 12.5 | Add a new project via the "+" button (outer rail or inner rail) | OS folder picker opens; selected folder added; becomes active project | |

### Terminal tab CRUD (Wave 12 Phase 3 + 4)

| # | Scenario | Expected behavior | Result |
|---|---|---|---|
| 12.6 | Open canon workbench → upper frame shows default `claude` tab spawned | Tab labeled `claude` (or similar) appears; terminal is live | |
| 12.7 | Click "+" in upper-frame tab bar | New tab spawned; pty live; previous tab still alive but not visible | |
| 12.8 | Click "+" in lower-frame tab bar | New shell pty spawned in lower; both frames independently CRUD'd | |
| 12.9 | Double-click a tab label to rename | Inline rename input; Enter commits; tab label updates; persists across restart | |
| 12.10 | Per-tab X button | Tab closed; pty killed; next-alphabetical tab becomes active OR null if last | |
| 12.11 | Maximize button on upper frame | Lower frame collapses; upper frame fills the centre region; divider absent | |
| 12.12 | Maximize button on lower frame (after un-maximizing upper) | Same shape for lower | |
| 12.13 | Restart Electron mid-session | Tabs (including renamed ones) restored to both frames; claude tabs auto-resume via `--resume` | |
| 12.14 | Tab label overflow (very long name) | Truncates with `…` and shows full tooltip on hover | |

### Wave 9-11 regressions (verify no Wave 12/13 broke them)

| # | Scenario | Expected behavior | Result |
|---|---|---|---|
| R.1 | Wave 9 session restore: `claude --resume <id>` auto-spawn on relaunch | Upper-frame tabs reconnect to prior claude sessions | |
| R.2 | Wave 10 project switch via title-bar dropdown | All project-scoped state re-mounts cleanly | |
| R.3 | Wave 11 file-tree click → modal | Click any file in inner rail → modal opens with Monaco-rendered content | |

---

## Wave 13 surfaces (the actual binding wave)

### Pane-ID round-trip (Phase 1 + Phase 2 boundary)

| # | Scenario | Expected behavior | Result |
|---|---|---|---|
| 13.1 | Spawn upper-cc claude tab (via "+") in workbench | DevTools console: `[hooks]` event with `paneId: 'wb-upper-cc-...'` field present in payload | |
| 13.2 | Sidebar's NOW panel reflects the upper tab's activity | When claude runs a tool (Edit, Bash, etc.), NOW panel shows the tool name + target | |
| 13.3 | Sidebar's Context panel shows real token count for upper tab's session | Not `0 / 200k` — actual usage from the running claude | |
| 13.4 | Sidebar's Files Touched + Hook Timeline reflect upper tab's session | Files claude has read/written this turn appear; tool events stream | |

### IDE-in-itself hijack scenario (the wave's central correctness gate)

| # | Scenario | Expected behavior | Result |
|---|---|---|---|
| 13.5 | With IDE launched from an outer `claude` terminal session (`claude` → `npm run dev`), AND a workbench-spawned `claude` running in upper tab | Sidebar binds ONLY to upper-tab claude; outer claude's tool activity does NOT appear in sidebar (NOW/Context/Files Touched stay scoped to upper tab) | |
| 13.6 | Stop the upper-tab claude (let it finish) | Sidebar shifts to D4 empty state ("No active claude session in this pane") — outer claude is still running but does NOT take over | |
| 13.7 | Spawn a SECOND `claude` in an external terminal (outside the IDE), in the same project directory | Sidebar still empty; external claude does NOT take over | |
| 13.8 | Spawn a new upper-tab claude (via "+") | Sidebar binds to NEW tab's session immediately; ignores outer and external | |

### Pane switching

| # | Scenario | Expected behavior | Result |
|---|---|---|---|
| 13.9 | Two upper-cc tabs (A, B), each with a running claude. Click tab A | Sidebar reflects A's session | |
| 13.10 | Click tab B | Sidebar swaps to B's session immediately; A's continuing activity does NOT bleed through | |
| 13.11 | Click lower frame (which has a plain shell tab, no claude) | Sidebar shows D4 empty state | |
| 13.12 | Click back to upper tab A | Sidebar swaps back to A | |

### D4 empty-state cases

| # | Scenario | Expected behavior | Result |
|---|---|---|---|
| 13.13 | First launch with `canonWorkbench` flag on, before any claude spawn | Default upper-cc tab exists; sidebar shows D4 empty state until claude runs | |
| 13.14 | Spawn an upper-shell tab (not claude) | Sidebar shows D4 empty state when shell tab is active | |
| 13.15 | Maximize mode with no claude in the maximized frame | D4 empty state | |

### Auto-resume binding (Wave 9 + Wave 13 interplay)

| # | Scenario | Expected behavior | Result |
|---|---|---|---|
| 13.16 | Restart Electron mid-session with active claude in upper tab | Tab restored; claude resumed via `--resume`; sidebar reconnects to the resumed session within seconds | |

---

## Sign-off

After completing the walkthrough:

- [ ] All Wave 12 scenarios PASS or FLAGGED with notes
- [ ] All Wave 13 scenarios PASS or FLAGGED with notes — especially 13.5–13.8 (the hijack closure)
- [ ] If any scenarios FLAG, file a follow-up under `roadmap/follow-ups/2026-05-{date}-{scenario}.md`
- [ ] Cole reports back; orchestrator flips status to **SHIPPED-VERIFIED** in `roadmap/HANDOFF.md` top entry

**If 13.5–13.8 fail (hijack still possible)**: Wave 13's central correctness goal is NOT met. Status remains SHIPPED-PENDING-INVESTIGATION; root cause analysis required before declaring the binding-precision follow-up closed.

---

## Notes for Cole

- DevTools open helps verify `paneId` round-trip (console + network); look for hook event payloads carrying the `paneId` field
- The bundled walkthrough is ~30–45 minutes if scenarios pass first try; longer if any fail
- The wave is SHIPPED in code (4 commits: 63e531dc Phase 0, 81804894 Phase 1, 90eb8dd1 Phase 2, bce32169 Phase 2.5, 359197fe Phase 2.6); this smoke is the verification layer, not a build gate
