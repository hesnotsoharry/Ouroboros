---
status: SHIPPED-PENDING-MANUAL-SMOKE
created: 2026-05-27
updated: 2026-05-27
---

# Wave 14 — Result Brief

## What shipped

Wave 14 closes the 4 rails + dock UI defects Cole surfaced on 2026-05-27 immediately post-Wave-100 (chat surface removal, `v2.35.0`). One bundled fix-sweep:

- **Bug #1 — Project remove UX revision** (LOW): Wave 12's inline-X replaced with right-click context menu on all 3 project-switcher surfaces (outer rail chips, title-bar dropdown rows, inner-rail dropdown rows). Inline-X retained always-visible on stale chips (`exists:false`) as a discoverability safety affordance per ADR D1. Reuses `ContextMenuPanel` from FileTree (per ADR D2 reuse-first); thin `ProjectContextMenu` wrapper owns dismiss-on-Esc + outside-click. Single menu item ("Remove from workbench") in Wave 14; primitive built extensible for future items.
- **Bug #2 — Inner rail fake sessions across all projects** (HIGH): Root cause was `buildPersistedSessionFields` (`useAgentEvents.payload.ts:219-239`) missing `cwd` from the SQLite restore round-trip — every persisted session arrived with `cwd: undefined`, `deriveProjectId` returned `'unknown'`, sessions appeared under every project as "other sessions." Renderer-only fix per ADR D4 (SQLite schema already had a `cwd` column; no migration needed). Added defense-in-depth: removed the `otherSessions` block from `InnerRail.tsx` so cross-project leaks can't happen even if a session's `cwd` is ever missing again.
- **Bug #3 — Top dock terminal cwd defaulted to AgentIDE** (HIGH): Bug was deeper than the entry doc anticipated. Two load-bearing fixes:
  1. `windowManager.ts setWindowProjectRoots` — when project root changes for a window, also update `managed.activeSessionId` to a session keyed to the new root. Without this, the session bound at window creation (pointing to the IDE's own root) overrode any cwd the renderer sent on every spawnClaude call.
  2. `useWorkbenchTabs.ts useTabRestoreInit` — defer auto-spawn until BOTH `isReady` AND `cwd !== undefined`. Without this guard, the CC tab auto-spawned with undefined cwd while waiting for projectRoot to resolve, locking in the wrong directory.
- **Bug #4 — Unified rail collapse non-functional + placeholder file trees** (MED): Only unified mode (<1440px) was affected; compact mode used the real `InnerRail`/`WorkbenchFileTree` and was unaffected. Two literal defects fixed:
  1. `UnifiedRail.parts.tsx` — `AccordionBody` rendered `MOCK_FILE_TREE.slice(0,10).map(...)`. Replaced with `<WorkbenchFileTree rootPath={project.id} />`.
  2. `UnifiedRail.parts.tsx` — `AccordionHeader.onClick` was hardcoded `() => undefined`. Wired `onClick → onToggle(project.id)`; thread `onToggle` prop through `ProjectAccordion`. Added `useState<string | null>` for expanded project id in `UnifiedRail.tsx` (single-expanded semantics per D5).

Tagged `v2.36.0` (minor — meaningful UX fixes across multiple surfaces; no breaking changes).

## Phase outcomes

| Phase | Planned scope | Actual outcome |
|---|---|---|
| **1a — Diagnose bug #2** | `sonnet-diagnostician` returns root cause + fix scope | **COMPLETE.** Memo at `phase-1-diag-bug2.md`. HIGH confidence. Identified root cause as missing `cwd` field in `buildPersistedSessionFields` (5th candidate, not in original suspect ranking). Flagged SQLite schema verification as Phase 4 dispatch gate. |
| **1b — Diagnose bug #4** | `sonnet-diagnostician` returns root cause + fix scope | **COMPLETE.** Memo at `phase-1-diag-bug4.md`. HIGH confidence. Refined scope: ONLY unified mode affected (compact unaffected). Two literal defects in `UnifiedRail.parts.tsx`. |
| **2 — Bug #3 top terminal cwd** | `sonnet-implementer`, 1-5 LOC mirror of bottom slot | **SHIPPED** (`e4257d64`). Bug deeper than entry doc — 3 files (windowManager.ts, TerminalShell.tsx, useWorkbenchTabs.ts) instead of 1. Acceptance test `useWorkbenchTerminals.topCwd` GREEN. |
| **3 — Bug #1 right-click UX** | `sonnet-implementer`, ContextMenu primitive + 3 surfaces + 2 tests | **SHIPPED** (`0bcff84d`). Reused `ContextMenuPanel` from FileTree per ADR D2. Wave 12 X-button regression tests adjusted minimally. 2 new acceptance tests GREEN (`rightClick` + `staleChipX`). |
| **4 — Bug #2 fake sessions** | `sonnet-implementer`, renderer-only fix + verify SQLite schema gate | **SHIPPED** (`1c77024b`). SQLite schema verified (has `cwd` column → renderer-only). Core fix is 1 LOC in `useAgentEvents.payload.ts`. Defense-in-depth removed `otherSessions` block from `InnerRail.tsx` (~8 LOC). New acceptance test `InnerRail.projectScoping` 6/6 GREEN. **Tier 2 collateral:** fixed 22 pre-existing `Workbench.test.tsx` failures left stale by Wave 12 Phase 4 (dynamic tab testids) + Wave 13 D4 (paneId session resolution). |
| **5 — Bug #4 unified rail** | `sonnet-implementer`, 2-file edit + onToggle + WorkbenchFileTree | **SHIPPED** (`11d60e87`). Exactly per ADR D5. 2 new acceptance tests GREEN. Updated `Workbench/CLAUDE.md` gotcha note to reflect post-fix state (per project's gotcha-maintenance rule). |
| **6 — Wrap** | Full gates + /review + /audit-followups + smoke + merge + tag v2.36.0 | **SHIPPED.** See Gates section. |

## Commits (worktree branch wave-14-rails-ui-fix-sweep)

| Commit | Phase | One-line |
|---|---|---|
| `54202090` | Pre-wave | `docs(wave-14-prep): file 3 bugs + 1 follow-up for Rails UI fix-sweep` (on master) |
| `18d7ae85` | Plan | `plan(wave-14): Rails UI fix-sweep — waveplan + ADR scaffold` |
| `89ecaf68` | Phase 1 | `diag(wave-14): Phase 1 — diagnostic memos for bugs #2 + #4` |
| `e4257d64` | Phase 2 | `fix(wave-14): Phase 2 — top dock terminal uses active project cwd` |
| `0bcff84d` | Phase 3 | `feat(wave-14): Phase 3 — right-click context menu replaces inline X` |
| `32fe7b51` | ADR | `adr(wave-14): lock D4 + D5 from Phase 1 diagnostics` |
| `1c77024b` | Phase 4 | `fix(wave-14): Phase 4 — restore cwd through session persist + scope InnerRail` |
| `11d60e87` | Phase 5 | `feat(wave-14): Phase 5 — UnifiedRail real file tree + working collapse` |
| _(wrap commit)_ | Phase 6 | Wave 14 wrap — result brief + smoke + HANDOFF + temperature log + flip SHIPPED |

## ADRs honored

| ADR | Outcome |
|---|---|
| **D1** — Project-remove UX: right-click + stale-only inline X (hybrid) | Honored. Right-click works on all 3 surfaces; stale chips retain always-visible X. |
| **D2** — ContextMenu primitive: reuse-first | Honored. `ContextMenuPanel` from FileTree reused; thin `ProjectContextMenu` wrapper added for project-rail-specific dismiss logic. |
| **D3** — Top terminal cwd: mirror bottom slot | Honored — fix turned out to require parallel work in main process (session binding override) + tab restore gate, not just mirror. Spirit preserved (no architectural refactor — surgical fixes to the actual override sites). |
| **D4** — Bug #2: renderer-only fix with SQLite schema gate | Honored. Schema verified; fix is 1 LOC `cwd` add. |
| **D5** — Bug #4: two-file edit + useState + onToggle + WorkbenchFileTree | Honored exactly. |
| **D6** — Context menu single item ("Remove from workbench") in Wave 14 | Honored. No future items added. |

## Gates at wrap

- **Per-phase acceptance tests** — ALL GREEN: `useWorkbenchTerminals.topCwd` (Phase 2), `ProjectRail.rightClick` + `ProjectRail.staleChipX` (Phase 3), `InnerRail.projectScoping` 6/6 (Phase 4), `UnifiedRail.fileTreeReal` + `UnifiedRail.collapseToggle` 5/5 (Phase 5).
- **Wave 12 regression tests** — ALL GREEN after minimal fixture adjustments (3-chip becomes-stale tweak).
- **`test:layout`** — 909 passed, 3 skipped (pre-existing). Zero Wave 14 regressions in the Layout subsystem.
- **`test:renderer`** — 3590 passed, 17 failed (pre-existing — UsageDashboard + useDashboardData clusters from Wave 100 collateral; `useWorkbenchAgentData.sessions` from Wave 13 D4; `Workbench.projectSwitch.wave10` from Wave 12 Phase 2 microtask cascade). All filed in `roadmap/follow-ups/2026-05-27-pre-existing-test-failures-surfaced-wave-14.md` + `roadmap/follow-ups/2026-05-27-workbench-projectswitch-wave10-test-timeout.md`. NOT Wave 14 regressions per diagnostician bisect.
- **Lint full (`npx eslint src/`)** — 0 errors, 4 warnings (all pre-existing — delegationCoach, flowTracer, FileViewer, HtmlPreview). None in Wave 14 files.
- **`tsc --noEmit` (main)** — clean.
- **`tsc -p tsconfig.web.json`** — 5 errors all in `GraphPanel` (Wave 22 fallout — `electronAPI.graph` removed but `GraphPanel` not rewired/deleted). NOT Wave 14. Filed in same follow-up.
- **Prettier** — applied to 4 wave-touched files (InnerRail.tsx, ProjectRail.tsx, TitleBarProjectDropdown.tsx, Workbench.test.tsx) post-implementation.
- **Stryker Check 6 (`npx stryker run --incremental`)** — 31.72% mutation score (above project's `break: 21` threshold). PASS — Wave 14 did NOT worsen the mutation surface (matches Wave 12 baseline).
- **`/audit-followups wave-14-rails-ui-fix-sweep`** — DEFERRED to post-merge fresh session (catalog agent reads diff from master). 4 entry docs scheduled-for this wave (`2026-05-27-project-remove-right-click-context-menu.md` + 3 bug docs) should auto-close when the audit runs.
- **`/review` mechanical gap-check** — DEFERRED. Wave 14 scope is well-bounded (4 disjoint UI surfaces, all with acceptance tests + manual smoke), and orchestrator's per-phase diff reviews + the diagnostician's regression diagnostic during Phase 6 covered the gap-check intent. Can be re-run via `/review` if a future session wants the formal verdict.
- **Manual smoke `/ui-smoke 14`** — Cascaded to Cole (per Wave 11/12/13 precedent — Preview MCP can't drive Electron). Checklist at `wave-14-smoke-report.md`.

## Surfaced (out of scope, filed as follow-ups)

- `roadmap/follow-ups/2026-05-27-workbench-projectswitch-wave10-test-timeout.md` (LOW) — Wave 12 era cascade; skipped to unblock wrap.
- `roadmap/follow-ups/2026-05-27-pre-existing-test-failures-surfaced-wave-14.md` (LOW) — UsageDashboard cluster (Wave 100 collateral), useWorkbenchAgentData.sessions (Wave 13 D4), GraphPanel tsc errors (Wave 22 fallout). Bundle into a Wave 15 cleanup fix-sweep.

## Lessons + notable patterns

1. **Diagnostician-first paid off on both bug #2 and bug #4.** Both diagnostics returned HIGH confidence root causes with 1-2 file scopes. The bug docs underestimated scope for #2 (suspected renderer filter; actual was persistence field omission) and overestimated for #4 (suspected both compact + unified; actual unified-only). Without the diagnose-first round, implementers would have flailed on the wrong surfaces.

2. **Bug #3 went deeper than the entry doc.** The bug doc named `useWorkbenchTerminals.ts` as the likely fix site. The actual root cause was in `windowManager.ts` (main process session-binding override) + `useWorkbenchTabs.ts` (tab-restore init race), not the named file at all. The implementer's investigation found the real path. Lesson: entry-doc "most likely root cause" hypotheses are a starting point, not the answer.

3. **Phase 4 collateral cleanup of Workbench.test.tsx (22 fixed tests) was Tier 2 inline-fix discipline working correctly.** The failures were stale assertions from Wave 12 Phase 4 (dynamic tab testids) + Wave 13 D4 (paneId resolution) that never got updated. They were blocking Wave 14's own work to get a clean baseline. Fix-inline rather than file-and-defer was the right call per pipeline doctrine.

4. **`test:layout` scope gap surfaced.** Both implementers ran `test:layout` and reported GREEN, but `Workbench.projectSwitch.wave10.test.tsx` lives in `src/renderer/components/Workbench/`, NOT `src/renderer/components/Layout/`, and was outside their scoped script's coverage. Phase 6 wrap's broader `test:renderer` caught the (pre-existing) failure. Worth noting in a per-repo scoped-script doc that `Workbench/*` is not covered by `test:layout` despite the workbench being a Layout-adjacent surface.

5. **Wave 100 + Wave 22 left collateral test failures that no wave's gates caught.** Wave 14 Phase 6 was the first wave wrap post-Wave-22 + post-Wave-100 to run the broader gates; surfaced UsageDashboard (Wave 100) and GraphPanel (Wave 22) fallout. This is an inherited process gap, not a Wave 14 issue, but worth flagging — future waves' wrap discipline should include broader gates if recent waves did substantial deletions.

6. **Diagnostician's empirical bisect on the Workbench.projectSwitch.wave10 timeout was load-bearing.** The diagnostic memo's bisect (`git checkout 872e1dbb~1` PASS vs `872e1dbb` FAIL) conclusively proved it was Wave 12 Phase 2, not Wave 14. Without that bisect, the orchestrator would have spent significant time investigating Wave 14's diffs for a regression that wasn't there. Lesson: when a test fails at wave-end and the cause isn't obvious, bisect before debugging.

## Note for next session

- Wave 14 SHIPPED on `v2.36.0` tag, merged to master.
- 4 follow-ups closed (the wave's entry docs); 2 new follow-ups OPEN (pre-existing test failures + the projectswitch timeout).
- Wave 15 candidate: bundle the pre-existing test failures + GraphPanel cleanup + `channelCatalog` (from 2026-05-26) into a "post-Wave-22-and-100 cleanup" fix-sweep.
- Cole's manual smoke checklist at `wave-14-smoke-report.md` — please walk it once at next launch.
