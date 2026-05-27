---
status: SHIPPED
created: 2026-05-27
updated: 2026-05-27
---

# Wave 14 — Rails UI Fix-Sweep

## Context — why this wave exists

Wave 100 (`v2.35.0`, SHIPPED 2026-05-27) removed the in-IDE chat surface and the entire downstream chat-orchestration chain. The canon Workbench shell (terminal-first, ChatOnlyShell-as-name-only) survived and is now the production surface. Cole's first post-Wave-100 walkthrough surfaced 4 distinct UI defects on the rails + dock surfaces that together make the workbench partially unusable for multi-project workflows:

1. **Inline X for project remove (UX revision).** Wave 12 (`v2.33.0`) shipped per-row X buttons on the three project-switcher surfaces (outer rail chip, title-bar dropdown, inner-rail dropdown) per ADR D2. Cole's verbatim 2026-05-27: *"projects on the outer rail have a tiny X on them to remove, it should be a right click drop down to remove."* The X works — it's a UX revision, not a defect. Tracked at `roadmap/follow-ups/2026-05-27-project-remove-right-click-context-menu.md`.
2. **Inner rail shows the same fake/placeholder sessions across every project (HIGH).** UUID-keyed sessions (`5dcef7f1`, `46851144`, `948cfbab`, `798ce35a`, `23bbb093`, more) populate the inner rail on every project identically. Switching active project does not change the list. Distinct from `roadmap/bugs/2026-05-20-session-list-empty-on-relaunch.md` (opposite symptom) and `roadmap/follow-ups/2026-05-20-claude-session-restore-fidelity.md` (Claude-restore fidelity). Likely sources: mock data leak, missing `projectId` filter in `useWorkbenchAgentData`, or `sessionCrud:list` returning all-projects. Tracked at `roadmap/bugs/2026-05-27-inner-rail-fake-sessions-across-projects.md`.
3. **Top dock terminal auto-spawns Claude in AgentIDE cwd regardless of active project (HIGH).** Cole's verbatim: *"the bottom shell populates the correct cwd for whichever project I am in, but the top terminal auto spawns claude into agentide, which makes no sense."* Bottom slot follows active project correctly; top slot is pinned to `C:\Web App\AgentIDE`. Most likely root: missing `cwd: lowerCwd ?? projectRootRef.current ?? undefined` fallback chain in the upper-slot spawn path of `useWorkbenchTerminals.ts`; when undefined, `pty.ts` resolves to `process.cwd()` = IDE root. Tracked at `roadmap/bugs/2026-05-27-top-terminal-cwd-defaults-to-agentide.md`.
4. **Inner rail compact/unified mode non-functional (MED).** When window narrows below the breakpoint (per `useWorkbenchBreakpoint.ts`: <1760 compact, <1440 unified), the smaller-format rail (a) does NOT respond to project collapse/expand clicks and (b) renders placeholder file trees instead of real project files. The full-mode rail (>1760) works correctly. Workbench `CLAUDE.md` already flags `UnifiedRail.parts` file-tree body still references `MOCK_FILE_TREE` — Wave 11 fixed the full-mode tree but left compact/unified on mock data. Tracked at `roadmap/bugs/2026-05-27-inner-rail-compact-mode-non-functional.md`.

All four bundle naturally — they share the rails / dock surfaces and the same Workbench subsystem (`src/renderer/components/Workbench/`) — and are individually small enough to fall under the fix-sweep wave shape (per `~/.claude/rules/development-pipeline.md`: 5–20 small items, mixed bugs + UI tweaks + polish, fitting under one bundled wave).

**Grounding (from prior haiku-explorer pass 2026-05-27, plus Wave 12 result brief):**

- `src/renderer/contexts/ProjectContext.tsx:124-128` — `removeProjectRoot(path)` exists; the shared hook is `useProjectCRUDActions` (Wave 12 introduction).
- `src/renderer/components/Workbench/Rails/ProjectRail.tsx`, `Rails/InnerRailProjectDropdown.tsx`, `TitleBar/TitleBarProjectDropdown.tsx` — the three project-switcher surfaces wired by Wave 12 with inline X.
- `src/renderer/components/Workbench/Rails/InnerRail.tsx` — consumes sessions from `useWorkbenchAgentData()`; filters by `projectId` (per explorer report ~line 42-48). This is bug #2's primary suspect surface.
- `src/renderer/hooks/useWorkbenchAgentData.ts` — adapter sourcing the sessions list.
- `src/main/ipc-handlers/sessionCrud.ts` — `handleList()` ~line 66-69; `store.listAll()` return.
- `src/renderer/components/Workbench/workbenchMockData.rails.ts` — `MOCK_SESSIONS` (style `'s-ai-1'`), `MOCK_FILE_TREE` exports. The UUID-style IDs Cole sees do NOT match `MOCK_SESSIONS` style, so #2 is more likely a filter / store-leak.
- `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts` — bottom-slot spawn `cwd: lowerCwd` (~line 78); top-slot spawn needs the symmetric path (bug #3).
- `src/renderer/components/Workbench/useWorkbenchBreakpoint.ts` — full / compact / unified breakpoint detection.
- `src/renderer/components/Workbench/Rails/UnifiedRail.tsx` (and `.parts.tsx`) — unified-mode rail; documented in Workbench `CLAUDE.md` to still reference `MOCK_FILE_TREE` (bug #4).

**No version-sensitive external surface.** Pure renderer-side UI fixes + one renderer→main path inspection for #3. Skip the external-specs research per `wave-plan-lite` Phase 2 rules.

## Goal

After Wave 14, the canon Workbench's rails + dock surfaces are functionally consistent across all window widths and active-project switches:

- Right-clicking a project on any of the three switcher surfaces opens a context menu with "Remove from workbench" (calls `useProjectCRUDActions.remove`); inline X remains visible **only on stale chips** as a safety affordance. Right-click works on both stale and healthy.
- The inner rail's session list shows ONLY the active project's sessions; switching projects updates the list; the UUID-keyed placeholder/leaked entries are gone.
- The top dock terminal honors the active project's root as cwd, matching the bottom slot's behavior; switching projects causes the next-spawned top terminal to use the new root.
- The compact and unified rails (below 1760 / 1440 breakpoints) render real file trees (not `MOCK_FILE_TREE`) and respond to project collapse/expand clicks; behavior matches the full-mode rail.

The `layout.canonWorkbench` flag is no longer relevant post-Wave-100 (canon IS the production surface). Wave 14 ships behind no new flags.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-14-rails-ui-fix-sweep/wave-14-decisions.md` (scaffolded alongside this plan).

Decisions D1–D3 are locked from the bug-doc grounding + prior Wave 12 precedent. D4–D6 are PENDING diagnostician output (Phase 1) and will be locked into the ADR before the implementer phases dispatch.

1. **D1 — Project-remove UX: right-click context menu on all 3 surfaces + keep inline X visible on stale chips only (Option A from the follow-up).** Right-click opens a `ContextMenu` with "Remove from workbench". For healthy chips, the inline-X is removed (relying on right-click + the hover-X CSS removal). For stale chips (per Wave 12's `exists: false` derivation), the inline-X stays always-visible as a safety affordance — the user needs an obvious "this is broken, click here to fix" cue for stale entries. *(industry standard — VS Code workspace items, JetBrains. The hybrid avoids losing the stale-chip discoverability Wave 12 D2 prioritized.)*
2. **D2 — `ContextMenu` primitive: reuse if one already exists in `src/renderer/components/` (e.g., from FileTree right-click); build a thin one if not.** Phase 3 implementer checks first via `Grep "ContextMenu|onContextMenu"` and either imports the existing primitive or writes a minimal one (position fixed, dismiss on outside-click / Esc, single menu-item per row for now — extensible later for "Reveal in Explorer", "Copy path", etc.). *(industry standard pattern.)*
3. **D3 — Top terminal cwd resolution: mirror the bottom-slot fallback chain exactly.** Whatever the bottom slot does — `cwd: lowerCwd ?? projectRootRef.current ?? undefined` or equivalent — the top slot does the same with `upperCwd`. NOT a redesign; the bottom slot is the reference implementation. The diagnostician's Phase 1 brief asks for the exact bottom-slot path so the implementer can apply it symmetrically. *(industry standard — matches the established working pattern in the same file.)*
4. **D4 — PENDING (Phase 1 diagnostician output for bug #2 fake sessions).** Locked after diagnosis: surface-level filter fix in `InnerRail.tsx` / `useWorkbenchAgentData.ts`, vs deeper fix in `sessionCrud:list` IPC, vs mock-data deletion. Default disposition: smallest fix that closes the symptom + makes the data flow correct.
5. **D5 — PENDING (Phase 1 diagnostician output for bug #4 compact mode).** Locked after diagnosis: which breakpoint mode triggers (compact 1440-1760, unified <1440, or both); whether the collapse-broken cause is a missing handler vs a state-source issue vs a click-swallow z-index; whether `MOCK_FILE_TREE` replacement uses `useFileTree(activeProjectRoot)` directly or via a new compact-rail adapter.
6. **D6 — Scope boundary on extensibility.** D2's context menu carries exactly one item ("Remove from workbench") in Wave 14. Future menu items (Reveal, Copy path, Rename label, Open in new window) are explicitly out of scope. The primitive is built extensible; the wave doesn't ship the extensions. *(scope-boundary call.)*

## Scope

**In scope:**

- **Phase 1 — Parallel diagnosis:** two `sonnet-diagnostician` dispatches (bugs #2 and #4). Each returns a one-page diagnostic memo naming root cause + exact files/lines + proposed fix scope. Output written to `roadmap/wave-14-rails-ui-fix-sweep/phase-1-diag-{bug2,bug4}.md`. ADR D4 and D5 locked from the memos before Phase 2+ dispatch.
- **Phase 2 — Bug #3: top terminal cwd fix.** Mirror bottom-slot cwd resolution into top-slot spawn path in `useWorkbenchTerminals.ts`. Acceptance test asserts: switching active project causes the next top-terminal spawn to use the new root. Likely 1–5 LOC.
- **Phase 3 — Bug #1: right-click context menu UX revision.** ContextMenu primitive (reuse or new thin one per D2); wire right-click on three surfaces (`ProjectRail.tsx`, `TitleBarProjectDropdown.tsx`, `InnerRailProjectDropdown.tsx`); remove inline X from healthy chips; preserve inline X on stale chips (always-visible). Two orchestrator-owned tests: context-menu open-close + remove-action; stale-chip retains visible X.
- **Phase 4 — Bug #2: fake sessions fix.** Implements ADR D4 (locked from Phase 1 diagnosis). Touches `Rails/InnerRail.tsx` + `useWorkbenchAgentData.ts` (renderer-only fix) OR `sessionCrud:list` IPC (boundary phase — orchestrator-owned acceptance test required). One orchestrator-owned test asserts: with N projects each having M distinct sessions, inner rail shows ONLY active project's M sessions; switching projects updates the list.
- **Phase 5 — Bug #4: compact mode rail fix.** Implements ADR D5 (locked from Phase 1 diagnosis). Wires real file-tree data into compact/unified rail + fixes collapse/expand handler(s). Two orchestrator-owned tests: file-tree renders real project files at compact + unified breakpoints; collapse toggle changes state at compact + unified breakpoints.
- **Phase 6 — Wrap.** Full vitest + lint + tsc both variants + prettier; `/review` mechanical gap-check; `/audit-followups wave-14-rails-ui-fix-sweep` (expected: closes all 4 entry docs); `/promote-vendor-lessons 14` (likely no-op); `/ui-smoke 14` manual fallback per Wave 11/12 precedent; HANDOFF update; wave-temperature-log entry; flip SHIPPED; merge worktree to master; push; tag `v2.36.0`. Remove worktree per `worktree-merge-and-close-discipline.md`.

**Out of scope:**

- **Future context-menu items** (Reveal in Explorer, Copy path, Rename label, Open in new window) → D6. ContextMenu primitive built extensible; items not added in Wave 14.
- **Real-time fs watcher for project-root paths** → still out per Wave 12 precedent. Stale detection runs on mount + after `addProjectRoot`; mid-session deletions degrade to empty file-tree (Wave 11 behavior preserved).
- **Sessions persistence / restore-fidelity fixes** → covered by existing OPEN follow-ups (`2026-05-20-claude-session-restore-fidelity.md`, `2026-05-25-window-close-leaks-session-entry.md`). Wave 14's #2 fix closes the visible leak; deeper restore behavior is separate work.
- **Mock data removal sweep across other Workbench surfaces** → Wave 14 only touches `MOCK_FILE_TREE` if the compact/unified rail consumes it. A full mock-data audit is a separate fix-sweep.
- **`ChatOnlyShell` rename or further cleanup** → out. Cole noted the name is a Wave-42 artifact; renaming has its own coordination cost and is independent of these bugs.
- **Active-tab cwd-follows-project** → out. Active terminal sessions keep their cwd at spawn time; only NEW terminals after a project switch get the new cwd. (Killing live sessions on project switch is a separate UX decision.)

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 1a | Diagnose bug #2 (fake sessions across all projects) | `sonnet-diagnostician` | **Read-only diagnostic.** Brief: reproduce the symptom (UUID sessions on every project), trace `useWorkbenchAgentData → sessionCrud:list → store` path, identify whether the cause is (a) missing `projectId` filter, (b) `sessionCrud:list` returning all-projects, (c) leaked mock fixture, or (d) something else. Output: `roadmap/wave-14-rails-ui-fix-sweep/phase-1-diag-bug2.md` — root cause + exact files/lines + proposed fix scope (renderer-only vs IPC-side). Used to lock ADR D4. Test shape: n/a (read-only). |
| 1b | Diagnose bug #4 (compact mode collapse + file tree) | `sonnet-diagnostician` | **Read-only diagnostic.** Brief: reproduce by resizing window <1760 and <1440; confirm which breakpoint mode(s) are broken; identify (a) source of placeholder file trees (`MOCK_FILE_TREE` import path), (b) collapse-handler state — exists-but-broken vs never-wired vs click-swallow, (c) the symmetric "what does full-mode use" reference for real-data wiring. Output: `roadmap/wave-14-rails-ui-fix-sweep/phase-1-diag-bug4.md` — same shape as 1a. Used to lock ADR D5. Test shape: n/a (read-only). Dispatches in parallel with 1a. |
| 2 | Bug #3: top-terminal cwd fix | `sonnet-implementer` | **Small, isolated.** Touches `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts`. Spec: read the bottom-slot spawn site; identify its cwd resolution (likely `lowerCwd ?? projectRootRef.current ?? undefined`); apply the symmetric pattern to the upper-slot spawn. If `claudeAutoLaunch` (or equivalent) bypasses workbench cwd resolution entirely, plumb the active project root through that path. Orchestrator-owned acceptance test: `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.topCwd.acceptance.test.ts` — mock `pty.spawnClaudePty` and verify `cwd` argument equals active `projectRoot` (not `process.cwd()` / not `'C:\\Web App\\AgentIDE'`). Test shape: **honeycomb** — boundary on the renderer→main pty IPC, integration is the contract. Dispatches in parallel with Phase 1 (independent surface). |
| 3 | Bug #1: right-click context menu UX revision | `sonnet-implementer` | **3 surfaces + 1 primitive.** First, grep for an existing `ContextMenu` / `onContextMenu` primitive (Wave 11's FileTree right-click is the likely candidate); reuse if found, else build a minimal one (`src/renderer/components/common/ContextMenu.tsx` or similar — position-fixed, dismiss on Esc/outside-click, single menu-item slot). Wire `onContextMenu` on `ProjectRail.tsx`, `TitleBarProjectDropdown.tsx`, `InnerRailProjectDropdown.tsx`. The menu item "Remove from workbench" calls `useProjectCRUDActions.remove(path)` (existing Wave 12 hook). Remove the inline-X from healthy chips on all 3 surfaces; preserve inline-X always-visible on stale chips (`exists: false`). Two orchestrator-owned tests: `ProjectRail.rightClick.acceptance.test.tsx` (right-click opens menu, click item calls remove, Esc dismisses, outside-click dismisses) + `ProjectRail.staleChipX.acceptance.test.tsx` (stale chip retains visible X — Wave 12 regression preserve). Test shape: **trophy** — UI + state. Dispatches in parallel with Phase 2 (independent surface). |
| 4 | Bug #2: fake sessions fix | `sonnet-implementer` | **DEPENDS ON Phase 1a diagnostic + ADR D4 lock.** Implementer's brief is authored after D4 locks. Likely shape: renderer-only filter fix in `useWorkbenchAgentData.ts` or `Rails/InnerRail.tsx`; possibly mock-data import removal; possibly `sessionCrud:list` IPC scoping (which would make this a BOUNDARY PHASE — orchestrator-owned acceptance test pre-authored, `sonnet-phase-reviewer` PASS required). Orchestrator-owned acceptance test (shape pre-authorable regardless of D4): `Rails/InnerRail.projectScoping.acceptance.test.tsx` — given store seeded with 3 projects × 2 sessions each (6 total), inner rail for project A shows ONLY project A's 2 sessions; switching active to project B shows ONLY project B's 2 sessions; UUID-shaped session ids do NOT appear if not in store. Test shape: **honeycomb** if D4 → IPC fix; **trophy** if renderer-only. |
| 5 | Bug #4: compact mode rail fix | `sonnet-implementer` | **DEPENDS ON Phase 1b diagnostic + ADR D5 lock.** Implementer's brief is authored after D5 locks. Likely shape: replace `MOCK_FILE_TREE` consumer in `UnifiedRail.parts.tsx` (and / or `InnerRail.tsx`'s compact branch) with the live `useFileTree(activeProjectRoot)` hook (or whichever hook full-mode uses); wire (or fix) collapse/expand handler keyed by `Record<projectRoot, boolean>` (likely useState + optional config persistence). Two orchestrator-owned tests: `UnifiedRail.fileTreeReal.acceptance.test.tsx` (at unified breakpoint, file tree shows project's actual files, not MOCK_FILE_TREE entries) + `UnifiedRail.collapseToggle.acceptance.test.tsx` (click chevron toggles collapsed state, file tree visibility flips). Test shape: **trophy** — UI + breakpoint-conditional rendering. |
| 6 | Wrap | `orchestrator` | Full `npx vitest run` green; `eslint src/` 0 errors; `tsc --noEmit` clean + `tsc -p tsconfig.web.json` clean (per Wave 9/10/11/12 friction pattern); prettier on wave-touched files INCLUDING orchestrator-authored test files (Wave 10/11 lesson — Write tool bypasses prettier); `/review` mechanical gap-check on Wave 14 diff (PASS or FLAG-with-flags-addressed gates merge); Stryker Check 6 if `stryker.config.*` exists at root (run via `Bash run_in_background: true` starting at Phase 2 dispatch to overlap with implementation, gates Phase 6 close, not Phase 2 start); `/audit-followups wave-14-rails-ui-fix-sweep` (expected: closes all 4 entry docs — `2026-05-27-project-remove-right-click-context-menu.md`, `2026-05-27-inner-rail-fake-sessions-across-projects.md`, `2026-05-27-top-terminal-cwd-defaults-to-agentide.md`, `2026-05-27-inner-rail-compact-mode-non-functional.md`); `/promote-vendor-lessons 14` (likely no-op — Wave 14 touches no third-party SDK); `/ui-smoke 14` MANUAL FALLBACK per Wave 11/12 precedent (Preview MCP can't drive Electron); manual smoke checklist Cole runs: right-click on each switcher surface opens menu + "Remove from workbench" works; stale chip retains visible X; top terminal cwd matches active project after switch; inner rail sessions update on project switch + no UUID placeholders; compact + unified rails show real file trees + collapse works. Update `roadmap/HANDOFF.md` next-action; append `roadmap/wave-temperature-log.md`; flip plan + ADR `status: SHIPPED`; commit wrap; **merge worktree to master per `memory/worktree-merge-and-close-discipline.md`**; push; tag `v2.36.0` (minor — meaningful UX fixes across multiple surfaces); **remove worktree**. |

### Phase ordering

```
Phase 1a (diag bug #2) ──┐
                          ├─► ADR D4+D5 lock ──► Phase 4 (bug #2 fix) ──┐
Phase 1b (diag bug #4) ──┘                  └─► Phase 5 (bug #4 fix) ──┤
                                                                         ├──► Phase 6 (wrap)
Phase 2 (bug #3 cwd) ───────────────────────────────────────────────────┤
                                                                         │
Phase 3 (bug #1 UX) ────────────────────────────────────────────────────┘
```

Phases 1a, 1b, 2, and 3 dispatch in parallel — they're independent surfaces. 1a and 1b are read-only diagnosis; 2 and 3 are implementation. Phase 4 depends on 1a's output (locks D4 first). Phase 5 depends on 1b's output (locks D5 first). Phase 6 wraps all.

If Phase 1a or 1b surfaces a Tier 3 finding (e.g., bug #2's root cause is in a vastly larger subsystem than the bug doc suggests, requiring an architectural decision), pause Phase 4/5 and surface to Cole before proceeding. Phase 2 and 3 continue regardless.

### Risks

| Risk | Mitigation |
|---|---|
| **Bug #2's root cause is deeper than a renderer filter (e.g., a stale persisted store with leaked test data).** Renderer-side filter fix masks the symptom without removing the leak source. | Phase 1a diagnostician explicitly asked to identify the leak SOURCE (mock import, IPC return, persisted store), not just where it surfaces. ADR D4 lock requires the diagnostic to identify source; if source ≠ symptom site, fix at source. |
| **Bug #3's fix in `useWorkbenchTerminals.ts` doesn't cover `claudeAutoLaunch` path.** Top terminal spawn might bypass the workbench cwd resolution via a separate auto-launch hook; fixing only `useWorkbenchTerminals` leaves the bug. | Phase 2 implementer brief explicitly asks to grep for `claudeAutoLaunch`, `cwd:` references in spawn-adjacent files, and confirm whether the top-slot spawn flows through workbench cwd resolution. Acceptance test mocks `pty.spawnClaudePty` and verifies the cwd argument — catches the path regardless of which call site fired. |
| **ContextMenu primitive collision** — there might be an existing ContextMenu used elsewhere with a different API contract; building a new one creates two competing primitives. | Phase 3 implementer's FIRST step is `Grep "ContextMenu|onContextMenu" src/renderer/components/`. Reuse if found. Only build new if grep returns no matches. Phase reviewer (added if reuse decision is ambiguous) verifies. |
| **Stale-chip X removal regression — Wave 12 acceptance test for X-on-stale-chip breaks.** D1 keeps the X visible on stale, removes from healthy. If implementer removes ALL inline X, Wave 12's stale-chip test breaks. | Phase 3 spec explicit: keep `exists === false ? always-visible : null` for inline X (instead of Wave 12's `exists === false ? always-visible : hover-only`). Phase 3 test (`ProjectRail.staleChipX.acceptance.test.tsx`) explicitly verifies stale chip still has visible X. Wave 12's existing tests stay green as regression gate. |
| **Compact-mode fix breaks full-mode rail.** `InnerRail.tsx` may share render logic between full and compact branches; replacing `MOCK_FILE_TREE` with live data in the wrong branch breaks full-mode. | Phase 1b diagnostic explicitly asked to identify which file/branch consumes `MOCK_FILE_TREE`. Phase 5 implementer's acceptance test asserts both `(1) compact rail at appropriate breakpoint shows real data` AND `(2) full-mode rail at >1760 still works` (regression preserve). |
| **Active-tab cwd-doesn't-follow-project surprise.** D-not-locked: live top-terminal sessions don't change cwd on project switch. User may expect the live session to cd into the new project. | Out per Scope. If Cole flags this in manual smoke, file as new bug — separate from Wave 14. The wave fixes "next spawn" behavior; "live session follows" is a UX expansion. |
| **Right-click on Windows triggers browser context menu in dev mode.** Electron's BrowserWindow may show the OS context menu in addition to / instead of the in-app menu. | Phase 3 implementer's `onContextMenu` handler calls `event.preventDefault()` before opening the in-app menu. Standard pattern; acceptance test mocks the event correctly. Manual smoke verifies in actual Electron. |
| **Stryker mutation testing (Check 6 of /review) takes 5-60 min** — could block Phase 6 wrap. | Phase 6 dispatches Stryker via `Bash run_in_background: true` at the START of Phase 6 (or earlier — at Phase 2 dispatch overlap). Result blocks final push, not phase work. If Stryker breaks the project's `break: 21` floor, Phase 6 wrap pauses for tightening per standing pre-merge mutation task. |
| **Orchestrator-authored test files fail prettier at wrap** (Wave 10/11/12 lesson). | Phases 2, 3, 4, 5 each explicitly run `npx prettier --write` on orchestrator-authored test files immediately after authoring, before dispatching the implementer. Phase 6 prettier sweep is then a no-op verifier. |
| **Worktree orphan after wrap** (recurring Cole-burned pattern per `memory/worktree-merge-and-close-discipline.md`). | Phase 6 wrap explicitly merges worktree to master FIRST, then runs `git worktree remove .worktrees/wave-14-rails-ui-fix-sweep` as a non-optional step. Wave is NOT marked SHIPPED until worktree removed. |
| **`/ui-smoke 14` agent-driven unavailable** (Preview MCP can't drive Electron — Wave 11/12 precedent). | Manual fallback per `~/.claude/rules-deferred/manual-smoke-gate.md`. Phase 6 plans manual smoke checklist explicitly. No expectation of agent-driven smoke; not a regression. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 1a | n/a — read-only diagnostic | n/a | **Pyramid** (n/a). Diagnostic memo, not code. |
| 1b | n/a — read-only diagnostic | n/a | **Pyramid** (n/a). Diagnostic memo, not code. |
| 2 | n/a (renderer→main IPC integration) | `useWorkbenchTerminals.topCwd.acceptance.test.ts` — mock `pty.spawnClaudePty`, assert cwd argument equals active projectRoot. | **Honeycomb.** Renderer→main pty IPC boundary; integration is the contract. Orchestrator-owned, frozen, authored RED pre-dispatch. |
| 3 | n/a (UI interaction-heavy — covered by integration). | `ProjectRail.rightClick.acceptance.test.tsx`; `ProjectRail.staleChipX.acceptance.test.tsx`. | **Trophy.** UI + state + interaction. Both orchestrator-owned, frozen, authored RED pre-dispatch. Wave 12 acceptance tests for X-button stay green as regression gates. |
| 4 | (Per D4 — if renderer-only fix: maybe a unit test on the filter function.) | `Rails/InnerRail.projectScoping.acceptance.test.tsx` — 3-project × 2-session seed, assert per-project isolation + switching behavior. | **Honeycomb** if D4 → IPC fix; **trophy** if renderer-only. Acceptance test orchestrator-owned, frozen, authored RED pre-dispatch. |
| 5 | (Per D5 — if collapse state hook is unit-testable, possibly a unit test.) | `UnifiedRail.fileTreeReal.acceptance.test.tsx`; `UnifiedRail.collapseToggle.acceptance.test.tsx`. | **Trophy.** UI + breakpoint-conditional rendering. Both orchestrator-owned, frozen, authored RED pre-dispatch. Full-mode tree regression check included in fileTreeReal test. |
| 6 | n/a — wrap | Full `npx vitest run` + `/review` mechanical gap-check + manual `/ui-smoke 14`. | **Full wave-end gates.** |

## Acceptance criteria

- [ ] Phase 1a: `roadmap/wave-14-rails-ui-fix-sweep/phase-1-diag-bug2.md` exists; identifies root cause + files/lines + proposed fix scope; ADR D4 locked.
- [ ] Phase 1b: `roadmap/wave-14-rails-ui-fix-sweep/phase-1-diag-bug4.md` exists; identifies which breakpoint mode(s), MOCK_FILE_TREE consumer location, collapse-handler state; ADR D5 locked.
- [ ] Phase 2: Top-slot spawn in `useWorkbenchTerminals.ts` reads cwd from active project root (mirror of bottom slot's resolution); next-spawned top terminal in a non-AgentIDE project has correct cwd.
- [ ] Phase 2: `useWorkbenchTerminals.topCwd.acceptance.test.ts` exists; mocks `pty.spawnClaudePty`; passes for cwd === active projectRoot; test is frozen.
- [ ] Phase 3: A `ContextMenu` primitive exists (reused or new); `onContextMenu` handlers wired on `ProjectRail.tsx`, `TitleBarProjectDropdown.tsx`, `InnerRailProjectDropdown.tsx`; menu item "Remove from workbench" calls `useProjectCRUDActions.remove(path)`.
- [ ] Phase 3: Inline X removed from healthy chips on all 3 surfaces; inline X retained always-visible on stale chips (`exists: false`).
- [ ] Phase 3: `ProjectRail.rightClick.acceptance.test.tsx` passes (open / menu-item-calls-remove / Esc-dismisses / outside-click-dismisses); `ProjectRail.staleChipX.acceptance.test.tsx` passes; Wave 12 X-button regression tests stay green.
- [ ] Phase 4: Inner rail sessions show ONLY active project's sessions; switching projects updates the list; no UUID-shaped placeholder entries appear unless seeded.
- [ ] Phase 4: `Rails/InnerRail.projectScoping.acceptance.test.tsx` passes; if D4 → IPC fix, `sonnet-phase-reviewer` PASS on Phase 4 diff (boundary phase).
- [ ] Phase 5: Compact rail (at appropriate breakpoint) and unified rail (<1440) render real project file trees (not `MOCK_FILE_TREE`); collapse/expand chevrons toggle visibility correctly.
- [ ] Phase 5: `UnifiedRail.fileTreeReal.acceptance.test.tsx` + `UnifiedRail.collapseToggle.acceptance.test.tsx` pass; full-mode rail still works (regression gate).
- [ ] Phase 6: Manual `/ui-smoke 14` (cascaded to manual per Wave 11/12 precedent) covers all 4 bug surfaces live; report at `roadmap/wave-14-rails-ui-fix-sweep/wave-14-smoke-report.md`.
- [ ] Phase 6: Full `npx vitest run` green; `tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean; `eslint src/` 0 errors; prettier clean on all wave-touched files.
- [ ] Phase 6: `/review` mechanical gap-check returns PASS or FLAG-with-flags-addressed; Stryker Check 6 (if config exists) honors `break: 21` floor.
- [ ] Phase 6: `/audit-followups wave-14-rails-ui-fix-sweep` closes all 4 entry docs.
- [ ] Phase 6: Worktree merged to master; worktree removed; tagged `v2.36.0`; pushed to origin.
- [ ] Phase 6: `roadmap/HANDOFF.md` next-action updated; `roadmap/wave-temperature-log.md` appended; plan + ADR flipped to `status: SHIPPED`.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 1a | `Internal — no observation point` | n/a | Read-only diagnostic memo; no user-facing surface in Phase 1a. Phase 4 is the visible consumer. |
| 1b | `Internal — no observation point` | n/a | Read-only diagnostic memo; no user-facing surface in Phase 1b. Phase 5 is the visible consumer. |
| 2 | Running `npm run dev` Electron instance, top dock terminal with a non-AgentIDE project active | App boots → Cole selects project Gamify → top terminal slot's auto-spawn fires → `useWorkbenchTerminals` resolves cwd via `(upperCwd ?? projectRootRef.current ?? undefined)` symmetric to bottom slot → `pty.spawnClaudePty({cwd: 'C:\\Web App\\Gamify', ...})` → main-process node-pty spawns Claude with that cwd → Claude's first prompt reads project files from Gamify, not AgentIDE | Top terminal Claude prompt shows files from the active project (Gamify), not from `C:\Web App\AgentIDE`. Switching to a different project + spawning a new top terminal uses the new project's root. Bottom terminal continues to work as before (Wave 12 behavior preserved). |
| 3 | Running Workbench with `layout.canonWorkbench` enabled, projects visible on outer rail / title-bar dropdown / inner-rail dropdown | Cole right-clicks a project chip on the outer rail → `event.preventDefault()` → `setContextMenu({x, y, projectPath})` state → `<ContextMenu>` renders at click position with single item "Remove from workbench" → Cole clicks item → `useProjectCRUDActions.remove(path)` → `removeProjectRoot` → `setProjectRoots` IPC → all three rail surfaces re-render without the entry. Cole right-clicks on title-bar dropdown row → same flow. Cole hovers a stale chip → inline X visible (always); Cole clicks it → same remove path. Cole hovers a healthy chip → NO inline X (only right-click works). | Right-clicking any project surface opens a context menu; selecting "Remove from workbench" removes the project from all 3 surfaces. Stale chips retain a discoverable always-visible X (Wave 12 safety affordance preserved). Healthy chips show no X — discoverability is via right-click. Cole's verbatim ("it should be a right click drop down to remove") is end-to-end satisfied. |
| 4 | Running Workbench with 2+ projects, each having distinct sessions, inner rail visible | Cole opens project A → inner rail's session list shows ONLY project A's sessions (specifically: NOT the UUID-keyed leaked entries he saw pre-Wave-14) → Cole switches to project B via outer rail → inner rail re-renders with ONLY project B's sessions → no overlap, no leakage. The fix path varies per D4: renderer-only filter in `useWorkbenchAgentData.ts` (filter map adds `where session.projectId === activeProjectRoot`) OR IPC-side scoping (`sessionCrud:list` accepts a `projectId` arg). Either way: from change site → IPC → renderer hook → `Rails/InnerRail.tsx` rendering. | Inner rail accurately reflects "what's running in THIS project, right now." No UUID-shaped placeholder entries. Switching projects updates the rail. Cole's verbatim ("sessions are randomly populating the inner rail on all projects (all the same sessions...)") is end-to-end satisfied. |
| 5 | Running Workbench resized to <1760px wide (compact) AND <1440px wide (unified), with a project active | Cole resizes window to 1500px wide → `useWorkbenchBreakpoint` returns `'compact'` → compact rail renders with `useFileTree(activeProjectRoot)` data instead of `MOCK_FILE_TREE` → file tree shows actual project files. Cole resizes to 1300px → returns `'unified'` → `UnifiedRail.parts` file tree renders real data. Cole clicks a project collapse chevron in either mode → `setCollapsed(prev => ({...prev, [projectId]: !prev[projectId]}))` → file tree visibility flips → chevron icon rotates. | Compact and unified rails show real file content (not `MOCK_FILE_TREE` placeholder folders). Project collapse/expand works in both modes — Cole can click a chevron and see the tree toggle. Full-mode rail (>1760) continues to work as before (Wave 11 behavior preserved). |
| 6 | Running Workbench through the manual `/ui-smoke 14` checklist | Orchestrator generates manual smoke checklist at wave wrap → Cole launches `npm run dev` → walks each Wave 14 surface live (right-click on each of 3 project surfaces opens menu; stale chip retains X; top terminal cwd matches active project; inner rail sessions update on project switch + no UUID leak; compact + unified rails real file trees + collapse works) → captures findings inline → writes verdict into `roadmap/wave-14-rails-ui-fix-sweep/wave-14-smoke-report.md` | All Wave 14 surfaces verified live in the Electron shell; Cole sees right-click menus work, top terminal in correct cwd, inner rail sessions correct, compact/unified rails functional; report status `PASS-MANUAL` or `FLAGGED` with each flag triaged before push. |

### Data-shape probes

```ts
// Phase 2 — orchestrator runs at wrap:
//   npx vitest run src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.topCwd.acceptance.test.ts
// Asserts: pty.spawnClaudePty called with cwd === activeProjectRoot (not undefined, not process.cwd()).

// Phase 3 — orchestrator runs at wrap:
//   npx vitest run src/renderer/components/Workbench/Rails/ProjectRail.rightClick.acceptance.test.tsx
//   npx vitest run src/renderer/components/Workbench/Rails/ProjectRail.staleChipX.acceptance.test.tsx
// Wave 12 regression check:
//   npx vitest run src/renderer/components/Workbench/Rails/ProjectRail.removeButton.acceptance.test.tsx
//   npx vitest run src/renderer/components/Workbench/Workbench.activeProjectRemoval.acceptance.test.tsx

// Phase 4 — orchestrator runs at wrap:
//   npx vitest run src/renderer/components/Workbench/Rails/InnerRail.projectScoping.acceptance.test.tsx

// Phase 5 — orchestrator runs at wrap:
//   npx vitest run src/renderer/components/Workbench/Rails/UnifiedRail.fileTreeReal.acceptance.test.tsx
//   npx vitest run src/renderer/components/Workbench/Rails/UnifiedRail.collapseToggle.acceptance.test.tsx
```

```bash
# After wave wrap — runtime DevTools-console probes (manual, from running IDE):

# Verify ContextMenu primitive is wired (open menu via right-click manually):
document.querySelectorAll('[data-context-menu]').length
// Expected: 0 when no menu open; >=1 when right-click has been performed

# Verify inner rail session count matches store for active project:
const projectRoot = await window.electronAPI.window.getActiveProjectRoot()
const sessionsInStore = await window.electronAPI.sessionCrud.list({projectId: projectRoot})
const sessionsInRail = document.querySelectorAll('[data-inner-rail-session]').length
// Expected: sessionsInRail === sessionsInStore.length

# Verify top terminal cwd matches active project:
// 1. Switch to a non-AgentIDE project via outer rail
// 2. Click "+" on top terminal frame, wait for spawn
// 3. In the new top terminal: `pwd` (Linux/Mac) or `cd` (Windows)
// Expected: outputs active project root, NOT C:\Web App\AgentIDE
```

## Files the next agent should read first

1. `roadmap/wave-14-rails-ui-fix-sweep/wave-14-decisions.md` — locked ADR (D1–D6); D4 and D5 lock after Phase 1 diagnostics.
2. `roadmap/follow-ups/2026-05-27-project-remove-right-click-context-menu.md` — bug #1 source + UX revision rationale (revises Wave 12 ADR D2).
3. `roadmap/bugs/2026-05-27-inner-rail-fake-sessions-across-projects.md` — bug #2 source; suspect ranking for Phase 1a diagnostician.
4. `roadmap/bugs/2026-05-27-top-terminal-cwd-defaults-to-agentide.md` — bug #3 source; isolated fix in `useWorkbenchTerminals.ts`.
5. `roadmap/bugs/2026-05-27-inner-rail-compact-mode-non-functional.md` — bug #4 source; breakpoint refresh for Phase 1b diagnostician.
6. `roadmap/wave-12-terminal-and-project-crud-chrome/wave-12-result.md` — Wave 12 brief; ADR D2 (inline X) being revised by D1 of this wave; the `useProjectCRUDActions` shared hook is Wave 12's introduction.
7. `roadmap/wave-100-chat-surface-removal/wave-100-result.md` — most recent wave; confirms what survived the chat removal vs what's now production canon.
8. `src/renderer/components/Workbench/Rails/ProjectRail.tsx`, `Rails/InnerRail.tsx`, `Rails/UnifiedRail.tsx`, `TitleBar/TitleBarProjectDropdown.tsx`, `Rails/InnerRailProjectDropdown.tsx` — the rail surfaces Phases 3, 4, 5 touch.
9. `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts` — bottom-slot cwd resolution (reference for Phase 2); top-slot spawn site.
10. `src/renderer/components/Workbench/useWorkbenchBreakpoint.ts` — breakpoint thresholds; Phase 5 must respect.
11. `src/renderer/contexts/ProjectContext.tsx` — `removeProjectRoot` + `useProjectCRUDActions` (Wave 12); Phase 3 wires right-click → the hook.
12. `src/renderer/components/Workbench/workbenchMockData.rails.ts` — `MOCK_SESSIONS`, `MOCK_FILE_TREE`; Phase 1a + 1b confirm which leak source applies.
13. `src/renderer/components/Workbench/Workbench/CLAUDE.md` — current `UnifiedRail.parts file-tree body uses MOCK_FILE_TREE` gotcha note; Wave 14 removes it.

## Note to the implementer

The spirit of Wave 14 is **rails + dock UI hygiene post-Wave-100**, not architectural work. Wave 100 finished a deep deletion sweep; this wave closes the small functional regressions that surfaced when Cole started using the post-Wave-100 IDE for real multi-project work. Resist the temptation to bundle additional cleanups (mock-data audit beyond compact rail, sessions-restore-fidelity deep dive, `ChatOnlyShell` rename, status-bar real-values) — they're explicitly OUT per Scope, and they each have their own follow-up paths.

The 4 bugs are largely independent surfaces; Phases 2 and 3 can dispatch in parallel with the diagnostician phases. Phases 4 and 5 require their diagnostic memos first. The wave plan's parallelism is deliberate — you get 4 implementer dispatches into 2 parallel rounds, not 4 sequential rounds. Use it.

The Wave 12 inline-X is being revised, not deleted entirely. D1 keeps inline X on stale chips as a discoverability safety affordance — removing ALL inline X (including stale) would regress Wave 12 acceptance tests AND remove the only "this is broken" UX signal stale chips have. The hybrid (right-click everywhere + inline X on stale only) is the call.

> Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

For Wave 14 specifically: Phase 2's observation requires a live `npm run dev` Electron instance with a non-AgentIDE project active. Phase 3's observation requires right-clicking actual project surfaces. Phase 4's observation requires having distinct sessions in 2+ projects and switching between them. Phase 5's observation requires resizing the window across both breakpoints (<1760 and <1440). Manual smoke at Phase 6 covers all four; per-phase diff review during implementation catches the testable surfaces. If you ship without observing, mark the phase explicitly with "tests pass, runtime observation deferred to manual smoke."

## Orchestrator dispatch checklist

A green per-phase gate with nothing Tier 3 surfaced means the orchestrator dispatches the next phase in the same turn — phase boundaries are internal steps of a longer turn, not stopping points. The turn ends between phases only for: a Tier 3 discovery needing a user call, a genuine user-judgment decision the plan doesn't determine, or wave-end (Phase 6 wrap). See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR.** Confirm `roadmap/wave-14-rails-ui-fix-sweep/wave-14-decisions.md` exists; D1, D2, D3 locked from grounding; D4, D5 stubbed (locked after Phase 1); D6 locked (scope boundary).
2. **Phase 1 — parallel diagnose.** Dispatch `sonnet-diagnostician` × 2 in a single message (`Bug #2 brief`, `Bug #4 brief`). Each writes `phase-1-diag-bug{2,4}.md`. Gate to advance: both memos exist with named root cause + files/lines + proposed fix scope. On return, lock ADR D4 + D5.
3. **Phase 2 — bug #3 top-terminal cwd.** In the same parallel round as Phase 1: dispatch `sonnet-implementer` with brief naming `useWorkbenchTerminals.ts` + bottom-slot reference + acceptance test pre-authored (orchestrator writes the test RED before dispatch). Gate to advance: acceptance test GREEN; no scope-3 fires; orchestrator diff review clean. Trivial phase — no `sonnet-phase-reviewer`.
4. **Phase 3 — bug #1 right-click UX.** In the same parallel round as Phases 1 + 2: dispatch `sonnet-implementer` with brief naming the 3 surfaces + ContextMenu primitive search-first + D1 hybrid stale-X rule + 2 acceptance tests pre-authored. Gate to advance: both acceptance tests GREEN; Wave 12 X-button regression tests stay green; orchestrator diff review clean. Trivial-medium phase — no `sonnet-phase-reviewer` unless ContextMenu primitive build introduces a new shared primitive (then dispatch reviewer on that file).
5. **Phase 4 — bug #2 sessions fix.** Dispatch ONLY after Phase 1a's memo + ADR D4 locked. Brief authored from D4 + memo. If D4 → IPC scoping (boundary phase): orchestrator pre-authors acceptance test RED, dispatches `sonnet-implementer` with frozen test, dispatches `sonnet-phase-reviewer` on diff. If D4 → renderer-only: dispatch `sonnet-implementer` with pre-authored acceptance test; no reviewer dispatch unless ambiguous. Gate to advance: acceptance test GREEN; reviewer PASS (if dispatched); diff review clean.
6. **Phase 5 — bug #4 compact mode.** Dispatch ONLY after Phase 1b's memo + ADR D5 locked. Brief authored from D5 + memo. Dispatch `sonnet-implementer` with 2 acceptance tests pre-authored. Gate to advance: both acceptance tests GREEN; full-mode regression test stays green; diff review clean. Conceptually-risky? Likely no — dispatch reviewer only if the wire-up touches a new state-management surface.
7. **Phase 6 — wrap.** Orchestrator: full `npx vitest run`; `eslint src/`; `tsc --noEmit` + `tsc -p tsconfig.web.json`; `npx prettier --write` on wave-touched + orchestrator-authored test files; `/review` mechanical (verdict gates merge); Stryker Check 6 if configured (background); `/audit-followups wave-14-rails-ui-fix-sweep`; `/promote-vendor-lessons 14`; manual `/ui-smoke 14` (cascade to Cole); HANDOFF update; wave-temperature-log append; flip plan + ADR `status: SHIPPED`; commit wrap. **Then: merge worktree → master, push, tag `v2.36.0`, `git worktree remove .worktrees/wave-14-rails-ui-fix-sweep`** per `memory/worktree-merge-and-close-discipline.md`. Wave is NOT marked SHIPPED until the worktree is removed.
