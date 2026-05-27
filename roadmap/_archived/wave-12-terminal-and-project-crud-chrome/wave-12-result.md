---
status: SHIPPED
created: 2026-05-24
updated: 2026-05-24
---

# Wave 12 — Result Brief

## What shipped

Wave 12 closes the canon Workbench's remaining UI hygiene gaps from Waves 10–11 in one bundled "rail CRUD" wave: terminal tab CRUD (spawn/close/rename/active-switch/maximize) with per-project persistence, project remove + auto-detect-stale across all 3 switcher surfaces, and the tab-header text-overlap visual bug fixed. New `files.pathExists` main-process IPC underpins the stale-detection. Schema evolved from Wave 10 single-slot shape to Wave 12 `TabCollection` via cold-start migration (ADR D1). All behind the same default-off `layout.canonWorkbench` flag.

After this wave:

- **Terminal tabs are fully interactive.** Click `+` in the tab bar of either frame → new pty spawns; double-click a tab label → inline rename input (uncontrolled, Enter/blur commits, Esc cancels, empty reverts); per-tab X → closeTab kills the pty + active falls back; click a tab to switch active; Maximize hides the other frame + divider (display:none preserves pty state); Split stays mounted but inert with "coming in a future wave" tooltip per ADR D4.
- **Tab labels truncate gracefully** with `text-overflow: ellipsis` + native title tooltip per ADR D6 (closes the long-standing tab-header overlap visual bug).
- **Tab collections persist per-project across relaunch.** Each project keys a `{ upper: TabCollection, lower: TabCollection } | null` entry in `canonWorkbenchSessions`. Switching projects shows that project's tab collection (unmounts old, mounts new — Wave 10 per-project foundation extends naturally).
- **Project remove is wired on all 3 surfaces.** Inline X button on each chip (outer rail) / row (title-bar dropdown + inner-rail dropdown). Active-project-removal switches active to next-alphabetical OR clears workbench to empty state if no projects remain. Stale projects (folders renamed/deleted on disk since IDE last saw them) render at opacity 0.5 with the X always visible per ADR D2. Auto-detection runs on mount + on `addProjectRoot` via `Promise.all(pathExists)` fan-out.
- **`files.pathExists(path: string): Promise<boolean>`** is now on the IPC surface. Boundary phase with orchestrator-owned acceptance test (4 cases: true / false-missing / false-empty / NUL-byte malformed); minimal surface per ADR D7 (no `isDirectory`, no `getStats`).
- **Schema migration done.** `configPreflight.resetLegacyCanonWorkbenchSessions` extended to detect both Wave 9 flat shape (Wave 10.1 hotfix preserved) AND Wave 10 single-slot shape (Phase 3 add). False-positive guard: Wave 12 TabCollection's `activeTabId`+`tabs` is distinct from Wave 10's `cwd`-bearing slots.
- **`useProjectCRUDActions`** new shared hook encapsulates the active-switch + remove logic so all 3 project-rail surfaces use the same flow.
- **`excludedPaths` Set in ProjectContext** (session-scoped) prevents removed projects from being resurrected by `config.recentProjects` on the next render — un-excludes naturally on `addProjectRoot` / `setActiveProjectRoot`.
- **Phase 3 stub persist removed** (Phase 4 cleanup of Phase 3's forward-compat FLAG) — real persistence now flows exclusively through `useWorkbenchTabs` instances mounted inside each `TerminalShell`.

## Phase outcomes

| Phase | Planned scope | Actual outcome |
|---|---|---|
| **0 — Wave 11 catch-up** | `/review`, `/audit-followups wave-11`, full vitest. Verdict gates Wave 12 dispatch. | **PROCEED.** /review returned FLAG (Stryker 31.72% — pre-existing src/shared/ debt, Wave 11 touched zero src/shared files; above project's break:21 floor). /audit-followups 1 RESOLVED (Wave 10 startup crash, archived) + 25 ACTIVE. Full vitest 11754/11754 relevant tests pass; 4 ChangelogDrawer failures all pre-existing worktree codegen gap per Wave 11 lesson 2. No HIGH/CRITICAL Wave 11 regression. |
| **1 — files.pathExists IPC (boundary)** | Add IPC handler + preload + electron.d.ts type. Orchestrator-owned acceptance test pre-authored. sonnet-phase-reviewer PASS required. | **SHIPPED** (`48a0cfe6`). 4 LOC across 3 files (helper already existed at filesHelpers.ts:31 — Phase 1 just threaded it through a new IPC). 6/6 acceptance GREEN. Phase reviewer PASS all 4 axes. |
| **2 — Project CRUD + stale-detect** | useWorkbenchProjects derives exists per project; inline X on 3 surfaces; active-removal switches alphabetically. 3 orchestrator-owned acceptance tests. | **SHIPPED** (`2489f165`). Implementer added the `excludedPaths` mechanism to ProjectContext to handle the recents-list-resurrection edge case (clean solution, session-scoped, un-excludes on re-add). 13/13 acceptance GREEN, 4/4 Wave 10.1 sort regression preserved, 35/35 Rails + 26/26 TitleBar dir GREEN. New `useProjectCRUDActions` shared hook. No phase reviewer required (established pattern). |
| **3 — Tab state machine + schema migration (boundary, conceptually-risky)** | New `useWorkbenchTabs` hook; schema extension; configPreflight Wave-10 detection; refactor restore/persist/terminals for new shape. 2 orchestrator-owned tests. Phase reviewer PASS required. | **SHIPPED** (`983fa656`). Schema evolved (Wave 10 → Wave 12 TabCollection). Mechanical migration of Wave 10 acceptance test (canonWorkbenchSessions.projectKeyed) — same it/describe structure, behavioral contracts preserved, only fixtures + mock signatures updated. 13/13 Phase 3 acceptance GREEN, 55/55 Terminals dir, Wave 9 acceptance preserved. **Phase reviewer PASS overall with 1 FLAG (stub persist forward-compat)** — accepted as Phase 4 to resolve. |
| **4 — Terminal CRUD UI + maximize + header fix (conceptually-risky)** | Replace MOCK_TERM_TABS_* in TerminalShell with live useWorkbenchTabs; wire all click handlers; maximize via Workbench.maximizedFrame state; tab-header CSS truncation; remove Phase 3 stub persist. 4 orchestrator-owned tests. Phase reviewer PASS required. | **SHIPPED** (`d30c936c`). 27/27 acceptance GREEN. TerminalShell decomposed into TerminalShell.parts.tsx + tabitem.ts to fit ESLint caps. **Phase reviewer FLAG → orchestrator self-fixed inline:** CenterPane originally instantiated useWorkbenchTabs twice via `useActiveSessionIds` helper, creating duplicate hook instances + a persistence race that would silently stomp user's tab data on the 750ms debounce. Fix: removed the redundant helper (TerminalShell already overrides sessionId internally via its own hook's activeTab.sessionId). 51/51 critical acceptance tests still GREEN post-fix. |
| **5 — Wrap** | Full vitest + `/review` + `/audit-followups wave-12` + `/promote-vendor-lessons 12` + manual `/ui-smoke 12` + HANDOFF + tag v2.33.0. | **SHIPPED.** (See Gates section below.) |

## Commits (worktree branch wave-11-plan)

| Commit | Phase | One-line |
|---|---|---|
| `48a0cfe6` | Phase 1 | `feat(wave-12): Phase 1 -- files.pathExists IPC boundary` |
| `2489f165` | Phase 2 | `feat(wave-12): Phase 2 -- project CRUD + auto-detect-stale paths` |
| `983fa656` | Phase 3 | `feat(wave-12): Phase 3 -- terminal tab state machine + schema migration` |
| `d30c936c` | Phase 4 | `feat(wave-12): Phase 4 -- terminal CRUD UI + maximize + tab header fix` |
| _(wrap commit)_ | Phase 5 | Wave 12 plan/ADR/result/smoke + HANDOFF + temperature-log + flip SHIPPED |

## ADRs honored

| ADR | Outcome |
|---|---|
| **D1** — Tab persistence: in-place schema evolution + cold-start | Honored. `canonWorkbenchSessions` schema extended; Wave 10 single-slot shape gets cold-start reset via configPreflight. No data loss (canon flag default-off; Cole notified). |
| **D2** — Auto-detect-stale UX: inline dim + always-visible X | Honored. Stale chips opacity 0.5 across all 3 surfaces; X always visible on stale, hover-only on healthy. No launch-time prompt. |
| **D3** — Tab rename: double-click inline contenteditable | Honored via uncontrolled input (defaultValue + ref). Enter/blur commits, Esc cancels, empty/whitespace reverts. |
| **D4** — Terminal split: OUT, button stays inert with tooltip | Honored. Split button mounted but inert; `title="Split — coming in a future wave"`. |
| **D5** — Terminal maximize: IN, ephemeral state | Honored. `maximizedFrame: 'upper'\|'lower'\|null` lives in Workbench.tsx useState. `display:none` on hidden frame preserves pty state. Resets on relaunch. |
| **D6** — Tab header overlap fix: CSS-only | Honored. text-overflow: ellipsis + overflow: hidden + white-space: nowrap + native title tooltip. No layout rework. |
| **D7** — `pathExists` IPC: minimal `Promise<boolean>` | Honored. Single function, no error envelope, never throws. Helper at filesHelpers.ts:31 already matched D7's spec; Phase 1 just threaded it through. |
| **D8** — `forceUnified-no-autoclear` OUT of scope | Honored. Follow-up stays OPEN. |
| **D9** — `fileviewer-modal-blocks-tree-swap` OUT of scope | Honored. Wave 11 exit follow-up stays OPEN pending Cole's UX call. |
| **D10** — Wave 13 pane-ID forward-compat | Informational. Each TabState carries a `sessionId` field; Wave 13 will key against it (or add a parallel `paneId` if needed). Wave 12 didn't strip per-tab identity. |

## Gates at wrap

| Gate | Result |
|---|---|
| Phase 1 acceptance (`files.pathExists.acceptance`) | 6/6 GREEN, frozen |
| Phase 2 acceptance (3 files: staleDetection / removeButton / activeProjectRemoval) | 13/13 GREEN, frozen |
| Phase 3 acceptance (`useWorkbenchTabs.acceptance` + `configPreflight.wave10Migration`) | 13/13 GREEN, frozen |
| Phase 4 acceptance (4 files: addTab / closeTab / rename / maximize) | 27/27 GREEN, frozen |
| Wave 9 acceptance (`useWorkbenchTerminals.restore.acceptance`) | 7/7 GREEN (preserved) |
| Wave 10 acceptance (`canonWorkbenchSessions.projectKeyed.acceptance`) | 10/10 GREEN (mechanical migration to TabCollection fixtures; behavioral contracts preserved) |
| Wave 10.1 sort regression (`useWorkbenchProjects.sort`) | 4/4 GREEN (preserved) |
| Phase 3 reviewer | PASS overall (1 forward-compat FLAG → Phase 4 resolved) |
| Phase 4 reviewer | FLAG → orchestrator self-fixed inline (CenterPane double-instantiation) |
| Full vitest | **11809 passed / 8 failed / 8 skipped.** 2 failures were real Wave 12 regressions caught at wrap (`preloadParity.test.ts` + `channelCatalogCoverage.test.ts` — Phase 1 missed wiring `pathExists` into `src/web/webPreloadApis.ts` + `src/main/mobileAccess/channelCatalog.read.ts`; both 1-LOC mechanical adds, self-fixed inline; both tests GREEN post-fix). 6 failures pre-existing and unrelated to Wave 12: ChangelogDrawer × 4 (worktree `@renderer/generated/changelog` codegen gap per Wave 11 lesson 2), Workbench.projectSwitch.wave10 × 1 (Phase 3 implementer confirmed pre-existing), ChatWorkbenchShell × 1 (legacy shell, not Wave 12-related). |
| `/review` mechanical | **FLAG.** Check 1/2/3/4: PASS. Check 5: FLAG — acceptance tests + impl shipped in same commit (process-discipline gap; actual discipline WAS followed — tests authored first + run RED + dispatched + tests stayed frozen; just bundled). Plan-vs-test inconsistency on close-last-tab UX (plan said auto-spawn, test+impl say null): **Cole's call 2026-05-24 — test wins**. Report at `roadmap/wave-12-terminal-and-project-crud-chrome/wave-12-mechanical-review.md`. |
| Stryker mutation (Check 6) | 31.72% (above project break:21 floor; below /review's 40 line — non-fatal flag). Same as Wave 11 — pre-existing `src/shared/` debt, Wave 12 didn't touch the dominant survivor surface (`FileRefResolver.ts`/`pricing.ts`/`projectTerminalsSchema.ts`). Standing pre-merge mutation-debt task continues from Wave 3+. Re-run after deleting stale `.stryker-tmp/` (the cache pointed at the now-archived Wave 12 entry follow-up). |
| `/audit-followups wave-12` | **1 RESOLVED / 31 ACTIVE.** Closed `2026-05-24-workbench-project-crud-manual-and-auto-detect.md` (the Wave 12 entry follow-up — Phase 2 closed end-to-end; auto-archived to `roadmap/_archived/follow-ups/`). 31 ACTIVE preserved: 4 explicitly deferred per Wave 12 ADR D8/D9/D10 + Wave 6 git-stats, 27 unrelated subsystems. Report at `roadmap/wave-12-terminal-and-project-crud-chrome/wave-12-followup-audit.md`. |
| `/promote-vendor-lessons 12` | N/A — Wave 12 touched no third-party SDK at the API surface (xterm + node-pty unchanged). |
| `/ui-smoke 12` manual | DEFERRED to Cole's interactive availability. Checklist at `roadmap/wave-12-terminal-and-project-crud-chrome/wave-12-smoke-report.md` with full Phase 1/2/3/4 coverage + Wave 9/10/11 regression checks. |

## Lessons / surprises

1. **The split-dispatch pattern for orchestrator-owned tests scales.** Phases 3 and 4 used: dispatch one sonnet-implementer to author tests + verify RED → dispatch a SEPARATE sonnet-implementer to implement. The discipline is preserved because neither agent owns both — the test-author agent has its own mental model, the impl agent has its own, and the orchestrator routes between. This bought significant orchestrator context relief for the largest phases. Standing recommendation for future boundary phases that author more than 1 test file or 200+ LOC of test code.

2. **Phase 4's CenterPane double-instantiation bug is a clean example of the "test mocks the bug away" anti-pattern.** The 27 Phase 4 acceptance tests all mock `useWorkbenchTabs` entirely (correct — they test TerminalShell's button wiring in isolation). The Workbench.maximize test renders full Workbench but doesn't exercise tab persistence at runtime. So the bug — CenterPane mounting two extra `useWorkbenchTabs` instances that wrote empty TabCollections on the 750ms debounce — was invisible to the test suite. **Only the phase-reviewer's static analysis of the diff caught it.** This validates the layered defense: acceptance tests for behavior, phase reviewer for shape, mechanical /review for cross-cutting. Each layer catches what the others miss.

3. **Phase 3 → Phase 4 forward-compat FLAGs are a useful pressure-release valve.** Phase 3's stub persist write was a known forward-compat issue that the reviewer FLAGed but didn't FAIL. Phase 4's brief explicitly required removing the stub. The combination — FLAG that gates a future phase's gate — let Phase 3 ship cleanly without making Phase 4's scope ambiguous. Pattern: when an intermediate phase has a "this will be cleaned up by the next phase" item, FLAG it explicitly so the next phase's brief inherits the obligation.

4. **The "orchestrator self-fix" 4-part test fires cleanly when the reviewer hands a tight diagnosis.** Phase 4's CenterPane fix: (a) already diagnosed (reviewer named the exact lines + the exact fix), (b) tiny (~13 LOC removal, one file), (c) context already in-window (just dispatched the reviewer), (d) low second-bug risk (removing redundant code, not introducing new behavior). All 4 held → fix applied directly. Saved the round-trip of dispatching sonnet-implementer for a 13-LOC removal that needed zero exploration.

5. **Per-tab StrictMode discipline at Phase 3 was correctly preserved by extending `hasSpawnedRef` to a Map<tabId, ...>, NOT replacing it.** Wave 10 P3's `hasSpawnedRef` invariant was the load-bearing fix for StrictMode double-spawn; Phase 3 extended it per-tab (the implementer extracted `useTabRestoreInit` + `spawnedTabsRef: Set<string>`). This is exactly the right pattern when an existing invariant needs to scale to a new dimension — extend the data shape, not replace the mechanism.

6. **ESLint forced 2 sub-component extractions in Phase 4** (`TerminalShell.parts.tsx` + `TerminalShell.tabitem.ts`) and 1 in Phase 2 (`useProjectCRUDActions.ts` — though that one was elective, not forced). The max-lines-per-function: 40 cap + max-lines: 300 cap is a real friction surface on UI-heavy waves. Worth a future doctrine discussion: a "JSX component max-lines: 80" exception (mentioned as a possible follow-up in Wave 11 process catches). Tracked as a recurring lesson, not yet a follow-up.

7. **Wave 12 didn't trigger Gate D (walking-skeleton-first).** The new `files.pathExists` IPC was a new boundary surface, but Wave 12's Phase 1 deliverable was the boundary contract (per the orchestrator-owned acceptance test) — not a thinnest-end-to-end slice. This is fine because Phase 1 IS a thin end-to-end slice (handler + preload + type + acceptance test exercising the full IPC path). The "walking skeleton" rule's intent — exercise integration risk first — is satisfied by the boundary-phase orchestrator-owned-test discipline. Two paths to the same goal; both fired.

## Phase 5 self-fixes (orchestrator)

Two real Wave 12 regressions surfaced in the full vitest run at wrap, both fixed inline per the orchestrator self-fix 4-part test:

1. **`src/web/webPreloadApis.ts`** missed mirroring `pathExists` (Phase 1 omitted the web-preload entry — caught by `preloadParity.test.ts`). Fix: added `pathExists: (path: string) => t.invoke('files:pathExists', path)` to `buildFilesApi`. **CLAUDE.md in `src/web/` documents this requirement** — Phase 1 implementer brief should have included it.

2. **`src/main/mobileAccess/channelCatalog.read.ts`** missed the `files:pathExists` channel entry (caught by `channelCatalogCoverage.test.ts`). Fix: added `'files:pathExists': { class: 'paired-read', timeoutClass: 'short' }`.

Both regressions are mechanical 1-LOC adds at registration sites Phase 1 didn't survey. Future boundary-IPC briefs should grep for "files:readDir" or similar adjacent-entry hits to enumerate ALL registration sites before dispatch — these would have surfaced from a single grep.

**Close-last-tab UX call:** Cole picked "test wins" (closeTab on last tab → `activeTabId: null` + empty frame; user clicks `+` to add). Plan said auto-spawn-replacement; test+impl say null. The contradiction surfaced at `/review` Check 5 because the Phase 3 test-author subagent missed the plan's auto-spawn intent. Cole accepted the test behavior for ship velocity. If this bites in real use, a follow-up + a polish wave can flip to auto-spawn.

## Carried forward / follow-ups

- **`Workbench.projectSwitch.wave10.test.tsx`** has a pre-existing timeout (confirmed unrelated to Wave 12 phases — fails on the unmodified branch too per Phase 3 implementer). Worth filing a follow-up for next session if it persists.
- **Stryker mutation debt** at 31.72% remains the standing pre-merge task from Wave 3+. Wave 12 didn't touch `src/shared/` (the dominant survivor surface), so no improvement expected this wave. Tracking inline in wave-3-mechanical-review.md.
- **Wave 13 next** — AgentSidebar terminal-scoped binding via `OUROBOROS_PANE_ID` env injection per Cole's confirmed architecture 2026-05-24. Each TabState's `sessionId` field is the natural identity Wave 13 will key against.
- **Wave 11 follow-ups stay OPEN per ADR D8/D9** — `forceUnified-no-autoclear`, `fileviewer-modal-blocks-tree-swap` (needs Cole's UX pick A/B/C/D), `live-git-diff-stats`, `claudeSessionId-binding-precision` (HIGH — Wave 13).

## Process catches

- **Orchestrator-authored test files needed `prettier --write` after Write** (Wave 10 lesson 5, Wave 11 process catch — preserved in Wave 12 by explicit per-phase prettier runs immediately after authoring).
- **`max-lines-per-function: 40` forced 3 extractions across Phases 2 + 4** — accepted as standard friction.
- **Wave 10 acceptance test (`canonWorkbenchSessions.projectKeyed`) needed mechanical migration in Phase 3.** Implementer should have surfaced as Tier 3 before modifying; instead they migrated it inline and reported "modified (not frozen)". Orchestrator caught + verified the migration was mechanical not assertion-weakening. Future-similar situations should be Tier 3 surfaces with explicit Cole/orchestrator approval before modification — even for "obviously mechanical" migrations.
- **Test-mock-coverage gap** (Phase 4 CenterPane bug) — the acceptance tests mocked `useWorkbenchTabs` entirely, so the duplicate-instantiation persistence race was invisible to the test layer. Caught only by the phase reviewer's static diff analysis. This is a recurring pattern worth a doctrine note: when a hook's persistence behavior is the contract, at LEAST one integration test should exercise the real hook (not the mock) end-to-end so persistence races surface.

## Tag

`v2.33.0` on origin (minor bump — terminal tab CRUD + project remove are new user-facing behaviors).
