---
status: IN-PROGRESS
created: 2026-05-23
updated: 2026-05-23
---

# Wave 10 — Project-Scoped State Foundation + Project-Switching Wiring

## Context

Wave 9 (`v2.30.0`, shipped 2026-05-23) closed canon session-restore and was framed as the green-light for cutover. Immediately after ship, Cole ran a live smoke and surfaced extensive functional gaps across the canon Workbench — most acutely a **complete absence of project-switching wiring**: the outer rail's project chips, the title bar's project + branch dropdowns, the inner rail's (non-existent) project dropdown, the outer rail's layout + profile buttons, and both rails' "+" project buttons are all visually present but inert. Compounding that, the `canonWorkbenchSessions` schema (Wave 9) is flat — one set of `{ upper, lower }` for the whole IDE, not per-project — and there is no "active workbench frame" state to drive the per-terminal binding the right panel will eventually need (Wave 13).

The cutover plan (now `roadmap/wave-15-workbench-cutover-teardown/`) is deferred. Waves 10–14 land the wiring set first.

**Grounding (confirmed via haiku-explorer pass 2026-05-23):**
- `src/main/windowManager.ts:45-58` — `ManagedWindow` carries `projectRoots: string[]` per-window; **no "active project among the roots"** concept exists. IPC `window.setProjectRoots()` writes.
- `src/renderer/contexts/ProjectContext.tsx:1-156` — exposes `projectRoots`, `projectRoot` (first-of-array as active), `projectName`, `setProjectRoot`, `addProjectRoot`, `removeProjectRoot`, `clearProject`. Mounted innermost in `App.tsx` → `ConfiguredApp`. `useProject()` throws; `useProjectOptional()` returns null. **`setProjectRoot` semantics need verification before Phase 2** (may rearrange `projectRoots` to put the picked path at [0], may replace, may append — Phase 2's plumbing depends on it).
- `src/renderer/components/Workbench/useWorkbenchProjects.ts:62-92` — already returns `WorkbenchProject[]` with `active: boolean`. **The list is correct; only click handlers are missing.**
- `src/renderer/components/Workbench/Rails/ProjectRail.tsx:43-64` — chips render via `useWorkbenchProjects()`; `CollapseHandle` chevron has stub `onCollapse`; `AddProjectButton`, `FooterButton` (Layout icon), `UserAvatar` all rendered with **no handlers wired**.
- `src/renderer/components/Workbench/Rails/InnerRail.tsx:1-80` — sessions filtered client-side by `projectId`; branch footer live via `useGitBranch()`. **No project dropdown header exists** — Wave 10 adds it.
- `src/renderer/components/Workbench/TitleBar/TitleBar.tsx:1-100+` — `ProjectChip` + `BranchChip` render live values from `useWorkbenchProjects()` and `useGitBranch(projectRoot)`. **No dropdown logic on click.**
- `src/renderer/hooks/useGitBranch.ts:246-260` — already project-aware (`useGitBranch(projectRoot)`); will react correctly to a `projectRoot` change.
- `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts` — calls `useProject()` to get `projectRoot`; threads to `pty.spawn({ cwd: projectRoot })`. **Currently spawns once on mount and does NOT react to `projectRoot` change.** Wave 9 added `hasSpawnedRef` to disambiguate StrictMode remount vs `isReady` flip — that pattern must survive Wave 10's reactivity addition.
- `canonWorkbenchSessions` (Wave 9) — `configSchemaMiddle.ts`, `configTypes.ts` (`CanonWorkbenchSessions`), `electron-foundation.d.ts` mirror. Shape `{ upper: {…} | null, lower: {…} | null }`. **Wave 10 reshapes to `Record<projectRoot, CanonWorkbenchSessions>`.**
- `src/renderer/App.helpers.tsx` (lines TBD by Phase 1 read) — the `layout.canonWorkbench` flag-gate branch that selects canon vs legacy. Wave 10 does NOT touch the flag; Wave 15 deletes it.
- `useTerminalSessions.ts` carries an `activeSessionId` for legacy. `useWorkbenchTerminals` does NOT currently track which of upper/lower is active. **Wave 10 adds active-frame state** in a new `useActiveWorkbenchFrame` hook for Wave 12 (tab focus) + Wave 13 (right-panel binding) consumption.

**Companion item:** `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md` (HIGH/OPEN) remains untouched by Wave 10 — main-process scope, handed to Wave 13.

## Goal

After this wave, clicking any project chip (outer rail, title bar dropdown, inner rail dropdown) switches the active project for the current window. Both terminal frames teardown their old project's PTYs and respawn (or restore via Wave 9's hooks) under the new project's persisted state. The `canonWorkbenchSessions` electron-store key is keyed by `projectRoot` (`Record<projectRoot, { upper, lower }>`) so each project remembers its own pair of terminals. The "+" buttons in outer + inner rails open a directory picker and add the chosen project to the window's roots. The outer rail's Layout button toggles workbench layout density (placeholder if not yet defined; documented stub). The outer rail's profile button opens a stub menu (TBD shape — minimum: a visible menu with "Sign out" placeholder). The title bar's project chip becomes a dropdown of all `projectRoots`; the branch chip becomes a dropdown of available git branches for the active project. A new `useActiveWorkbenchFrame` hook exposes `{ activeFrame: 'upper' | 'lower', setActiveFrame }` for downstream waves. The `layout.canonWorkbench` flag still gates canon vs legacy (Wave 15 deletes); Wave 9's auto-restore + auto-resume still works inside the canon path, now per-project.

## Locked decisions (Phase 0 — ADR)

See `roadmap/wave-10-project-scoped-state-foundation/wave-10-decisions.md` for the full ADR:

1. **D1 — `canonWorkbenchSessions` schema reshape: cold-start, no migration.** `Record<projectRoot, { upper, lower }>` replaces flat `{ upper, lower }`. Old persisted data on user disks is dropped silently on first read (type-guard returns empty record). *(locked 2026-05-23, per Cole's call)*
2. **D2 — Project-switch React strategy: `key={projectRoot}` on the Terminals subtree.** When `projectRoot` changes, React unmounts the old Terminals subtree (firing `useWorkbenchTerminals` cleanup → kill old PTYs) and mounts a fresh subtree (firing spawn under the new project's restored state). Simpler than explicit teardown effects; idiomatic React; lets Wave 9's `hasSpawnedRef` lifecycle stay unchanged. *(locked 2026-05-23)*
3. **D3 — Active frame state in a new sibling hook `useActiveWorkbenchFrame`, NOT inside `useWorkbenchTerminals`.** Single responsibility: `useWorkbenchTerminals` handles spawn/restore lifecycle; `useActiveWorkbenchFrame` handles UI focus state. The two are independent. *(locked 2026-05-23)*
4. **D4 — InnerRail project dropdown is a NEW component**, not an extension of an existing one. There is no existing dropdown primitive in the canon Workbench that matches the shape needed (a project list with active + click-to-switch). Lives at `Rails/InnerRailProjectDropdown.tsx`. *(locked 2026-05-23)*
5. **D5 — Wave 10 reads (does NOT write) `setProjectRoot` semantics first.** Phase 1's grounding read of `ProjectContext.tsx` confirms what `setProjectRoot` does today (move to [0]? replace? append?). If existing semantics support "switch active among roots," wire to it. If not, Phase 1 extends `ProjectContext` with `setActiveProjectRoot(path)` (a thin add; non-breaking). The ADR ratifies whichever fits the existing surface, captured at Phase 1 dispatch time. *(locked 2026-05-23, conditional on Phase 1 read)*

## Scope

**In scope:**
- Reshape `canonWorkbenchSessions` schema: `Record<string, { upper: {…} | null, lower: {…} | null }>` — keys are absolute project root paths. Update `configSchemaMiddle.ts` + `configTypes.ts` + `electron-foundation.d.ts`. Update `useWorkbenchRestore` to accept the active `projectRoot` and read `[projectRoot]` of the record (with empty fallback). Update `useWorkbenchSessionPersist` to write under `[projectRoot]` (read-modify-write the record).
- Verify or extend `ProjectContext.setProjectRoot` to support "switch active among `projectRoots`" semantics (D5). Add `setActiveProjectRoot(path: string)` only if existing API doesn't fit.
- Wire `ProjectRail` (outer rail) click handlers: chip click → `setActiveProjectRoot`; `AddProjectButton` → `window.electronAPI.dialog.openDirectory()` → `addProjectRoot()`; `FooterButton` Layout → toggle a canon layout-density state (stub: log + console-message OK if no density toggle exists yet — Wave 12 owns the actual density logic); `UserAvatar` click → open a placeholder profile menu (minimum: a visible menu with one entry, e.g., "Profile (coming soon)" — the menu shape is fine, the contents can be a stub).
- Wire `TitleBar` `ProjectChip` to open a project dropdown (dropdown component lives next to it as `TitleBarProjectDropdown.tsx`); wire `BranchChip` to open a branch dropdown that calls a new (or existing) `git.listBranches(projectRoot)` IPC.
- Add new `Rails/InnerRailProjectDropdown.tsx` (D4) — rendered as the InnerRail's header above the Running section. Same shape as the title bar dropdown for consistency.
- Add new `Rails/InnerRailAddProjectButton.tsx` — same handler as outer-rail `AddProjectButton`.
- Wrap the Terminals subtree with `key={projectRoot}` so project switch unmounts + remounts (D2).
- Add new `Workbench/useActiveWorkbenchFrame.ts` — exports `{ activeFrame: 'upper' | 'lower', setActiveFrame }` via a small React context. Initial state: `'upper'`. Persists to a new ephemeral hook-local state (not electron-store; lost on relaunch — acceptable for Wave 10).
- Surface `useActiveWorkbenchFrame` via context provider mounted inside `Workbench.tsx`, below `ProjectProvider`. Both terminal frames consume `setActiveFrame` on focus events (xterm `onFocus` or container `onMouseDown` — pick the more reliable one).
- New IPC `git.listBranches(projectRoot): Promise<{ branches: string[], current: string }>` if it doesn't exist (likely doesn't — `useGitBranch` only reads the current branch). Phase 2's title-bar branch dropdown depends on this.

**Out of scope:**
- AgentSidebar binding to `activeFrame` → Wave 13. Wave 10 only EXPOSES the active-frame state; Wave 13 consumes it for right-panel scoping.
- Terminal CRUD (spawn/delete/rename/+/split/maximize) → Wave 12. Wave 10's terminal frames stay as Wave 9's auto-spawn pair; new project switch just re-spawns the pair.
- File viewer modal → Wave 11. File tree clicks remain inert in Wave 10 (file tree itself becomes project-scoped via the project switch, but click-to-open is Wave 11).
- Status bar real values → Wave 14.
- `claudeSessionId` binding-precision fix → Wave 13 (main-process scope).
- `canonWorkbenchSessions` data migration from Wave 9's flat shape — explicit cold-start per D1; existing data is dropped.
- The outer rail's Layout button — Wave 10 wires the *click* but doesn't define what density-toggle does. Stub it; Wave 12 owns the layout/density mechanic.
- The profile button — Wave 10 opens a placeholder menu; actual profile/settings entries are out of scope (Settings cog already exists in title bar from Wave 7).
- Wave 15 (cutover) — still deferred until Waves 10–14 ship + smoke confirms.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 1 | `canonWorkbenchSessions` schema reshape + restore/persist hook update | `sonnet-implementer` | **BOUNDARY — persistent storage schema change.** Orchestrator authors a FAILING acceptance test pre-dispatch: `canonWorkbenchSessions.projectKeyed.acceptance.test.ts` — given the record `{ '/proj/a': { upper: {…}, lower: {…} }, '/proj/b': null }`, `useWorkbenchRestore('/proj/a')` returns `/proj/a`'s state; `useWorkbenchRestore('/proj/b')` returns `{ isReady: true, upperCwd: undefined, lowerCwd: undefined, resumeSessionId: undefined }`; `useWorkbenchSessionPersist('/proj/a', …)` debounce-writes ONLY the `/proj/a` slot of the record (preserves `/proj/b`'s data). Schema reshape in `configSchemaMiddle.ts` + `configTypes.ts` + `electron-foundation.d.ts`. Type-guard on read for the old flat shape: if first call returns a non-record (the Wave 9 flat object), discard + return empty record (cold-start per D1). Update `useWorkbenchRestore` signature to `useWorkbenchRestore(projectRoot: string | null)` (null short-circuits like the existing `persistTerminalSessions: false` path). Update `useWorkbenchSessionPersist` similarly. **Also in Phase 1:** read `ProjectContext.tsx`'s `setProjectRoot` implementation; if it supports switch-active semantics, document in the result brief and SKIP the `setActiveProjectRoot` add. If it doesn't, add it (D5 conditional). `sonnet-phase-reviewer` PASS required (boundary phase — schema-removal/migration considerations, Check 4 of `/review`). Test shape: **honeycomb** (storage boundary — integration tests dominate). |
| 2 | Wire all project-switching UI surfaces | `sonnet-implementer` | **No new boundaries.** Pure renderer wiring + one new IPC (`git.listBranches`). All five surfaces, batched: (a) `ProjectRail` chip onClick → `setActiveProjectRoot`; AddProjectButton → `window.electronAPI.dialog.openDirectory()` → `addProjectRoot`; Layout button → stub toggle (call new `useLayoutDensity()` stub hook or just log + dispatch a placeholder DOM CustomEvent for Wave 12 to consume later); UserAvatar → toggle a placeholder dropdown menu next to it. (b) New `TitleBar/TitleBarProjectDropdown.tsx` — rendered alongside `ProjectChip`; toggles on chip click; list from `useWorkbenchProjects`; click → `setActiveProjectRoot`. (c) New `TitleBar/TitleBarBranchDropdown.tsx` — toggles on `BranchChip` click; list from new `useGitBranches(projectRoot)` hook over new IPC `git.listBranches`; click → existing branch-switch IPC (verify exists; if not, add `git.checkoutBranch`). (d) New `Rails/InnerRailProjectDropdown.tsx` (D4) — same shape as title-bar variant; rendered as `InnerRail` header. (e) New `Rails/InnerRailAddProjectButton.tsx` — mirrors outer-rail one. **All five share the same `setActiveProjectRoot` / `addProjectRoot` calls** — extract `useProjectSwitching` if helpful (a small wrapper over `useProject` that bundles the two), but don't over-abstract for a single-file dedupe. Test shape: **trophy** (UI-heavy; type checker + per-surface render tests + manual smoke at wave-end). |
| 3 | Project-switch reactivity in Terminals + active-frame state | `sonnet-implementer` | **CONCEPTUALLY-RISKY (StrictMode + spawn lifecycle, Wave 9's `hasSpawnedRef` invariant).** Orchestrator authors a FAILING acceptance test pre-dispatch: `Workbench.projectSwitch.acceptance.test.ts` — mount `Workbench` with `projectRoot='/a'`; assert two pty spawns fire under `/a`. Change `useProject().projectRoot` to `/b`; assert: (1) old PTYs receive kill (two kill calls), (2) two NEW spawns fire under `/b`'s cwd, (3) StrictMode-remount of `Workbench` does NOT double-spawn (the `hasSpawnedRef` pattern from Wave 9 P2 must still bite). Wrap the Terminals subtree with `<React.Fragment key={projectRoot}>` (D2) — the inner `<CenterPane>` / `<Terminals>` component remounts on project change. Add new `Workbench/useActiveWorkbenchFrame.ts` + a small React context provider (`ActiveFrameProvider`) mounted in `Workbench.tsx` below `ProjectProvider`. Hook return: `{ activeFrame: 'upper' | 'lower', setActiveFrame: (frame: 'upper' | 'lower') => void }`. Initial state `'upper'`. Wire each `TerminalShell` (upper + lower) to call `setActiveFrame` on container `onMouseDown` (more reliable than xterm `onFocus` per the explorer's notes; verify by manual smoke). `sonnet-phase-reviewer` PASS required (conceptually-risky, StrictMode lifecycle + new state surface). Test shape: **honeycomb** (lifecycle boundary; integration test carries the contract). |
| 4 | Wave wrap | `orchestrator` | Full `npx vitest run` green; full `eslint src/` 0 errors; `tsc --noEmit` + `tsc -p tsconfig.web.json` BOTH clean (Wave 9's friction pattern — run BOTH explicitly, not "tsc" alone); prettier clean; `/review` mechanical gap-check; `/audit-followups wave-10-project-scoped-state-foundation` (no follow-ups expected to close — Wave 10 doesn't address `claudeSessionId-binding-precision` or `agentmonitor-approvaldialog`); `/promote-vendor-lessons 10` (no-op expected); `/ui-smoke 10` agent-driven — **run live, not deferred** (the deferred-smoke pattern is what caused the Wave 9 wake-up call); smoke targets: switch projects in outer rail / title bar / inner rail; observe terminal frames teardown + respawn under new project; observe restored cwd + auto-resume claude under previously-active project; click "+" project, pick a directory, see it appear; click Layout button + Profile button, confirm stub responses; click around the title bar + inner rail dropdowns, confirm they open + close + commit selection; update `roadmap/HANDOFF.md` next-action to Wave 11; append entry to `roadmap/wave-temperature-log.md`; flip plan + ADR status to SHIPPED; commit + push to `origin/master`; tag `v2.31.0` on origin (minor bump for new state foundation + UI behavior). |

## Phase ordering

```
Phase 1 (schema reshape) ──► Phase 2 (UI wiring) ──► Phase 3 (terminals reactivity + active-frame) ──► Phase 4 (wrap)
```

Strictly linear. Phase 2's UI surfaces call `setActiveProjectRoot`; Phase 3's terminal reactivity reacts to the resulting `projectRoot` change. Without Phase 1's schema reshape, Phase 3 has nothing per-project to restore. No parallelization opportunity at 3 implementation phases.

## Risks

| Risk | Mitigation |
|---|---|
| **`ProjectContext.setProjectRoot` doesn't have switch-active semantics** — Wave 10's wiring assumes "click chip → it becomes active." If `setProjectRoot` instead appends or replaces, every wired click site is wrong. | D5 explicit: Phase 1 READS `ProjectContext` first, documents semantics, conditionally adds `setActiveProjectRoot` if missing. Phase 2's brief states which API to call based on Phase 1's documented finding. No second-guessing at Phase 2. |
| **`useWorkbenchTerminals` re-mount on project switch double-spawns under StrictMode.** Wave 9 P2's `hasSpawnedRef` was carefully designed; Wave 10's `key={projectRoot}` re-mount creates a new component instance every time, with a fresh ref. Risk: StrictMode mounts that fresh instance twice → two spawns where there should be one. | Phase 3's orchestrator-owned acceptance test covers exactly this case: project switch under StrictMode → assert exactly 2 spawns under `/b`'s cwd (one per frame, NOT four). `sonnet-phase-reviewer` PASS required. The cleanup-of-old-instance kills the old PTYs; the new instance's `hasSpawnedRef` correctly fires once. |
| **`canonWorkbenchSessions` flat-shape data on disk crashes the read.** Wave 9 wrote `{ upper, lower }`; Wave 10 expects `Record<projectRoot, { upper, lower }>`. If existing data hits Wave 10's typed reader, it can throw. | Phase 1 type-guards on read: if `typeof value !== 'object' || isNull || hasUpperOrLowerKey(value)` → treat as legacy, return empty record. Cold-start per D1. Acceptance test covers the legacy-shape-on-disk case explicitly. |
| **The new `git.listBranches(projectRoot)` IPC isn't there, or is named differently.** Phase 2's title-bar branch dropdown depends on it. | Phase 2 brief states: "If `window.electronAPI.git.listBranches` doesn't exist, add the handler in `src/main/ipc-handlers/git.ts` and the bridge in `preload.ts`. Pattern: existing `git.branch(projectRoot)` for the current branch — extend with `git.listBranches(projectRoot)` returning `{ branches: string[], current: string }` via `git for-each-ref refs/heads/`." Verify before dispatch by reading `src/main/ipc-handlers/git.ts`. |
| **`useWorkbenchSessionPersist` write semantics under the record shape — read-modify-write race.** If two project-switch events fire fast (debounced writes pending for `/a` while user switches to `/b`), the in-flight write could clobber the record state. | Phase 1's hook: read-modify-write inside the debounced flush function. Use the latest record from `config.get('canonWorkbenchSessions')` at flush time, merge the project's slice, then `config.set`. No long-held in-memory record. Acceptance test covers two project switches in quick succession + final-state assertion. |
| **InnerRail's project dropdown changes header height** — `InnerRail` layout might tighten and break the existing sessions/files/branch stacking. | Phase 2 keeps the dropdown's collapsed height matching the existing `ProjectChip` height (single row). Test the InnerRail render after wiring with the dropdown collapsed; verify visual height is unchanged via snapshot/structural test. |
| **Profile button "stub menu" risks looking shipped when it isn't.** Cole's smoke surfaced the UserAvatar as inert; a stub menu that says "Profile (coming soon)" closes the inert-feeling gap but still doesn't do anything. | Document explicitly in the Phase 2 brief + acceptance criteria: the profile menu's contents are a stub. The wave's *real* deliverable for the avatar is "the button responds + opens a menu," not "the profile feature works." Stub label MUST say "(stub — to be wired)" or similar to avoid confusion at smoke. |
| **`useActiveWorkbenchFrame` adds a new context but Wave 13 won't consume it for some time.** Risk: Wave 10 ships an unused state surface that gathers stale-API dust. | Document in the result brief that `useActiveWorkbenchFrame` is intentionally exported now for Wave 13's consumption; mark its file with a `// Wave 13 consumer comes here.` reminder. Per `~/.claude/CLAUDE.md` "default to no comments," this is one of the legitimate cases where a comment names a non-obvious why (cross-wave coordination). |
| **Wave 9's auto-resume on relaunch may regress** — Wave 9's restore reads from `canonWorkbenchSessions` (flat). Wave 10 reshapes to per-project. If the user had a Wave 9 session, on first relaunch under Wave 10 the auto-resume won't fire (cold-start per D1). | Acceptable per D1. Document in result brief: "Wave 9's existing persisted sessions reset on first launch post-Wave-10; users get a fresh start. Auto-resume resumes working for any new session captured after the upgrade." Smoke at Phase 4 includes "switch project, switch back, relaunch — does the original project's terminals + claude session restore" as a critical scenario. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 1 | `useWorkbenchRestore` per-project derivation tests (active key present / missing / legacy flat); `useWorkbenchSessionPersist` per-project write merge tests (preserve other keys' data); legacy-flat-shape type-guard test. | Orchestrator-owned `canonWorkbenchSessions.projectKeyed.acceptance.test.ts` (RED before dispatch) — three scenarios per the brief. | **Honeycomb** — storage boundary, integration carries the contract. |
| 2 | Per-surface render tests: outer rail chip click fires `setActiveProjectRoot`; title bar project dropdown opens on chip click + commits selection; title bar branch dropdown opens + commits + calls checkout IPC; inner rail dropdown same; AddProjectButton calls dialog + addProjectRoot. | A single integration test mounting the full Workbench shell and exercising "click chip in outer rail → assert all three project displays (outer, inner header, title) reflect the new project." | **Trophy** — UI-heavy; static + integration + manual smoke at Phase 4. |
| 3 | None beyond the acceptance test; integration IS the contract. | Orchestrator-owned `Workbench.projectSwitch.acceptance.test.ts` (RED before dispatch) — project switch + StrictMode + active-frame initial-state assertion. | **Honeycomb** — spawn lifecycle boundary. |
| 4 | n/a — wrap | Full `npx vitest run` + `/review` mechanical gap-check + `/ui-smoke 10` agent-driven live (NOT deferred). | **Full wave-end gates.** |

## Acceptance criteria

- [ ] `canonWorkbenchSessions` shape in `configTypes.ts` is `Record<string, { upper: {…} | null, lower: {…} | null }>`; `configSchemaMiddle.ts` matches; `electron-foundation.d.ts` mirror matches.
- [ ] `useWorkbenchRestore` signature is `(projectRoot: string | null)`; returns the per-project state from the record; falls back to empty when key absent.
- [ ] `useWorkbenchSessionPersist` writes only the active project's slice (preserves other projects' data in the record).
- [ ] `useWorkbenchRestore` returns empty (cold-start) on first read encountering Wave 9's flat shape on disk.
- [ ] `canonWorkbenchSessions.projectKeyed.acceptance.test.ts` exists, RED pre-Phase-1, GREEN post-Phase-1, frozen (subagent may not modify).
- [ ] `ProjectContext` exposes a working "switch active project among `projectRoots`" API (verified or extended per D5; documented in result brief).
- [ ] Clicking a project chip in `ProjectRail` (outer rail) switches the active project (verified by re-render of dependent surfaces).
- [ ] `ProjectRail.AddProjectButton` onClick opens the directory picker via `window.electronAPI.dialog.openDirectory`, then calls `addProjectRoot`.
- [ ] `ProjectRail` Layout button onClick fires (logs + dispatches a DOM CustomEvent OR toggles a stub density state — Wave 12 wires the actual mechanic).
- [ ] `ProjectRail.UserAvatar` onClick opens a placeholder menu (single visible entry, e.g., "Profile (stub — to be wired)").
- [ ] `TitleBar.ProjectChip` onClick opens `TitleBarProjectDropdown`; selecting a project switches active project; dropdown closes.
- [ ] `TitleBar.BranchChip` onClick opens `TitleBarBranchDropdown`; the dropdown lists branches from a new `git.listBranches(projectRoot)` IPC; selecting a branch calls checkout (existing IPC verified or new one added).
- [ ] `Rails/InnerRailProjectDropdown.tsx` exists, mounted at `InnerRail` header, same switch behavior as the title bar variant.
- [ ] `Rails/InnerRailAddProjectButton.tsx` exists, mirrors outer-rail behavior.
- [ ] `Workbench` subtree renders `<… key={projectRoot}>` around the Terminals subtree (or equivalent that triggers remount on project change).
- [ ] `Workbench.projectSwitch.acceptance.test.ts` exists, RED pre-Phase-3, GREEN post-Phase-3, frozen — covers project switch + StrictMode + active-frame initial state.
- [ ] Switching project causes both old PTYs to be killed + two new PTYs to spawn under the new project's cwd; StrictMode does not double-spawn.
- [ ] `Workbench/useActiveWorkbenchFrame.ts` exists; exports `{ activeFrame, setActiveFrame }`; mounted via `ActiveFrameProvider` inside `Workbench.tsx`; consumed by both `TerminalShell` instances (upper + lower) on container `onMouseDown`.
- [ ] `/ui-smoke 10` agent-driven smoke runs at wrap (NOT deferred); report at `roadmap/wave-10-project-scoped-state-foundation/wave-10-smoke-report.md` covers: switch project via each of three surfaces; terminal teardown + respawn; auto-resume preserves per-project; "+" project picker; Layout + Profile stub menus open.
- [ ] Full `npx vitest run` green; `tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean; `eslint src/` 0 errors; prettier clean.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 1 | Test-harness render of `useWorkbenchRestore('/proj/a')` against a mocked `config.get('canonWorkbenchSessions')` returning `{ '/proj/a': {…}, '/proj/b': null }` | `config.get` → hook → maps per-key → returns `{ upperCwd, lowerCwd, resumeSessionId, isReady }` for `/proj/a` | `Internal — no end-user observation point.` Hook output only becomes user-visible through Phase 3's terminals re-spawning under the new project's restored state. Phase 1 unit + acceptance tests carry the verification load. |
| 2 | The canon Workbench in a live `npm run dev` instance with two project roots configured | App boots → click outer-rail project chip B → `setActiveProjectRoot('/b')` → `ProjectContext` updates → `useWorkbenchProjects` re-derives `active` → outer rail B chip shows active styling, title bar `ProjectChip` shows B's name, inner rail dropdown header shows B's name, branch chip shows B's branch | The three project displays (outer rail chip highlight, title bar chip name, inner rail dropdown header label) all flip to project B simultaneously. The title-bar `ProjectChip` click opens a dropdown listing both projects; selecting A switches back. The "+" buttons open a directory picker. The Layout button + UserAvatar button each respond (Layout: visible feedback OR Wave-12 placeholder event in DevTools; UserAvatar: small menu opens with the stub entry). |
| 3 | The same live Workbench, switching project with at least one terminal-attached claude session running under the original project | Click chip B → React unmounts the Terminals subtree → `useWorkbenchTerminals` cleanup → both PTYs killed → re-mount fires → `useWorkbenchRestore('/b')` returns B's persisted state (or empty if first switch) → spawn fires → upper/lower terminals show B's cwd in prompt; if B had a captured claude session, it auto-resumes | The two terminal frames switch wholesale: the prior project's prompts/scrollback disappear; B's prompts appear (either fresh-cwd shell, or claude --resume of B's previously captured session per Wave 9 semantics). The user's mouse-click into the upper or lower frame visibly sets that frame as "active" (verifiable in DevTools React tree via `useActiveWorkbenchFrame` value — Wave 13 wires the user-perceivable downstream effect). |
| 4 | The same live Workbench through the full `/ui-smoke 10` checklist | smoke runner navigates the surface, captures screenshots + console + network | All smoke scenarios PASS or document ACCEPTED-AS-IS per the smoke-report template. |

### Data-shape probes

```ts
// Phase 1 — schema reshape contract (orchestrator runs at wrap):
//   npx vitest run src/main/canonWorkbenchSessions.projectKeyed.acceptance.test.ts
// Asserts: read of legacy flat shape → empty record; read of record-shape → per-key slice;
//   write of per-key slice → record preserves other keys.

// Phase 3 — project-switch contract (orchestrator runs at wrap):
//   npx vitest run src/renderer/components/Workbench/Workbench.projectSwitch.acceptance.test.ts
// Asserts: mount with '/a' → 2 spawns under '/a'; setProjectRoot('/b') → 2 kills + 2 new spawns under '/b';
//   StrictMode remount does NOT double-spawn; useActiveWorkbenchFrame initial 'upper'.
```

```bash
# After wave wrap — runtime smoke probes (manual, from running IDE DevTools console)
await window.electronAPI.config.get('canonWorkbenchSessions')
// Expected shape: { '/abs/path/to/project': { upper: {...}, lower: {...} }, '/another/abs/path': {...} }

// Toggle a project switch, then re-query — different project's slice should populate.
```

## Files the next agent should read first

1. `roadmap/wave-10-project-scoped-state-foundation/wave-10-decisions.md` — locked ADR (D1–D5).
2. `roadmap/wave-9-canon-workbench-session-restore/wave-9-result.md` — Wave 9 hook patterns + `canonWorkbenchSessions` history (the schema this wave reshapes).
3. `roadmap/wave-9-canon-workbench-session-restore/waveplan-9.md` — exemplar for the canonical wave plan shape (Wave 10 mirrors it).
4. `src/renderer/contexts/ProjectContext.tsx` — `setProjectRoot` semantics (Phase 1 D5 read).
5. `src/main/windowManager.ts:45-58` — `ManagedWindow.projectRoots` per-window store.
6. `src/renderer/components/Workbench/useWorkbenchProjects.ts` — projects list with `active` field.
7. `src/renderer/components/Workbench/Rails/ProjectRail.tsx` — primary Phase 2 edit site (outer rail).
8. `src/renderer/components/Workbench/Rails/InnerRail.tsx` — Phase 2 edit site (new dropdown header).
9. `src/renderer/components/Workbench/TitleBar/TitleBar.tsx` — Phase 2 edit site (new dropdowns).
10. `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts` — Phase 3 edit site (re-mount-via-key consumer).
11. `src/renderer/components/Workbench/Terminals/useWorkbenchRestore.ts` — Phase 1 edit site (per-project signature).
12. `src/renderer/components/Workbench/Terminals/useWorkbenchSessionPersist.ts` — Phase 1 edit site (per-project write).
13. `src/main/configSchemaMiddle.ts` + `src/main/configTypes.ts` + `src/renderer/types/electron-foundation.d.ts` — Phase 1 schema reshape.
14. `src/main/ipc-handlers/git.ts` — Phase 2 may add `git.listBranches`; verify what's there.
15. `src/renderer/components/Workbench/Workbench.tsx` — Phase 3 wraps Terminals subtree with `key={projectRoot}` + mounts `ActiveFrameProvider`.
16. `src/renderer/hooks/useGitBranch.ts:246-260` — existing project-aware branch reader (model for `useGitBranches`).
17. `~/.claude/notes/wave-process.md` — Sites 1/2/3 rules, boundary-test discipline, schema-change Check 4.

## Note to the implementer

This wave is **foundational wiring**. Resist the urge to also fix what you see broken adjacent to your edits — the smoke uncovered ~20 functional gaps; Wave 10 fixes ONE cluster (project scoping + switching). Other clusters are owned by Waves 11–14. A bug fix wave that grows to cover everything you noticed is unreviewable.

Three temptations to resist:

1. **Don't fix file viewer clicks while you're in InnerRail.** That's Wave 11. Phase 2's InnerRail edit adds the project dropdown header; do not add file-click handlers in the same wave.
2. **Don't fix terminal CRUD (spawn/delete/rename/+/split/maximize) while you're in `useWorkbenchTerminals`.** That's Wave 12. Phase 3 wraps with `key={projectRoot}` and adds active-frame state; do NOT add tab CRUD.
3. **Don't bind the right panel to `useActiveWorkbenchFrame`.** That's Wave 13. Phase 3 only EXPOSES the hook + provider; the right panel still binds via Wave 8's `useWorkbenchAgentData(claudeSessionId?)` heuristic until Wave 13 retargets it.

The Phase 1 + Phase 3 acceptance tests are the load-bearing contracts. Schema reshape (Phase 1) preserves other projects' data on a per-project write — the legacy-flat-shape read returns empty. Project-switch (Phase 3) kills old PTYs + spawns new under the new project — StrictMode does not double-spawn (Wave 9's `hasSpawnedRef` pattern survives intact).

`/ui-smoke 10` runs at wrap LIVE — not deferred. The deferred-smoke pattern (Wave 0–9) is what produced the 20-gap surprise on 2026-05-23. Wave 10 corrects course. If the smoke surfaces a real RED, treat it as Tier 3 per the wave-process — file follow-up, escalate to Cole.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

A green per-phase gate with nothing Tier 3 means dispatch the next phase **in the same turn** — the gate is a verification checkpoint, not a stop-and-check-in. End the turn between phases only for a Tier 3 discovery needing Cole's call, a genuine user-judgment decision, or wave-end.

1. **Verify ADR** exists at `roadmap/wave-10-project-scoped-state-foundation/wave-10-decisions.md` with D1–D5 locked. Wave status `IN-PROGRESS` in both this plan's frontmatter and the ADR's.
2. **Phase 1 — Schema reshape + restore/persist hook update.** Author `canonWorkbenchSessions.projectKeyed.acceptance.test.ts` (orchestrator-owned, frozen), run it RED. Read `ProjectContext.tsx` to confirm `setProjectRoot` semantics (D5); document the finding. Dispatch `sonnet-implementer` with the brief + acceptance test path + D5 finding. Gate: acceptance test green + per-hook unit tests green + `tsc --noEmit` + `tsc -p tsconfig.web.json` clean + `eslint src/main src/renderer/components/Workbench/Terminals src/renderer/types` 0 errors + `sonnet-phase-reviewer` PASS on all four axes (boundary phase — schema change with persistent storage; Check 4 of `/review` invariants apply).
3. **Phase 2 — UI wiring across all surfaces.** Dispatch `sonnet-implementer` with the brief. No orchestrator-owned acceptance test (not boundary — UI wiring under existing patterns). Gate: per-surface render tests green + integration test green + `tsc:web` clean + `eslint src/renderer/components/Workbench src/main/ipc-handlers/git.ts src/preload` 0 errors + targeted `test:layout` + `test:renderer` green. No phase-reviewer dispatch (trivial wiring under established patterns).
4. **Phase 3 — Project-switch reactivity + active-frame state.** Author `Workbench.projectSwitch.acceptance.test.ts` (orchestrator-owned, frozen), run it RED. Dispatch `sonnet-implementer` with the brief + acceptance test path + explicit constraint "Wave 9's `hasSpawnedRef` pattern survives — do not touch it; only add the project-keyed remount above it." Gate: acceptance test green + existing Wave 9 acceptance test (`useWorkbenchTerminals.restore.acceptance.test.ts`) still green (Wave 9 regression check) + `test:layout` green + `tsc --noEmit` + `tsc:web` clean + `eslint src/` 0 errors + `sonnet-phase-reviewer` PASS (conceptually-risky — StrictMode + spawn lifecycle).
5. **Phase 4 — Wave wrap.**
   - Full suite (`npx vitest run`) green.
   - Full `eslint src/` 0 errors; `tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean (run EARLY in wrap — Wave 9's friction pattern); prettier clean on all wave-touched files.
   - `/review` mechanical gap-check. Verdict gates: PASS or FLAG-with-flags-addressed. Note: Check 4 (schema-removal/change migration safety) will fire on the reshape — the cold-start justification is documented in this plan's D1.
   - `/audit-followups wave-10-project-scoped-state-foundation` — no follow-ups expected to close (Wave 10 doesn't address `claudeSessionId-binding-precision`, `agentmonitor-approvaldialog`, or the other smoke-surfaced gaps owned by Waves 11–14).
   - `/promote-vendor-lessons 10` — no-op expected.
   - **`/ui-smoke 10` agent-driven, LIVE — NOT deferred.** Covers: outer-rail chip click switches project; title-bar dropdown opens + commits + closes; inner-rail dropdown same; branch dropdown opens + lists + checks out; AddProject opens picker + adds; Layout button responds; Profile button opens placeholder menu; terminals teardown + respawn on project switch; per-project restore preserved across relaunch; first launch post-Wave-10 cold-starts cleanly even if Wave 9 data was on disk. Report at `roadmap/wave-10-project-scoped-state-foundation/wave-10-smoke-report.md`.
   - Update `roadmap/HANDOFF.md` next-action: "Wave 11 — file tree + viewer modal."
   - Append entry to `roadmap/wave-temperature-log.md`.
   - Flip this plan's frontmatter to `status: SHIPPED`; flip the ADR's similarly.
   - Commit + push to `origin/master` (bulletin sanctions pushes; CI minutes still exhausted until 2026-06-01 — workflows skip cleanly; PR merge blocked).
   - Tag `v2.31.0` on origin (minor bump — new state foundation + UI behavior change).
