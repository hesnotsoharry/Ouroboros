# Session Handoff — 2026-05-24 (Wave 13 SHIPPED-pending-Cole-smoke; Wave 14 next)

**Audience:** the next Claude Code session.

---

## 🔼 UPDATE 2026-05-24 (latest) — Wave 13 SHIPPED-PENDING-MANUAL-SMOKE (AgentSidebar pane-ID binding)

**Next action: hand off the bundled `/ui-smoke 12+13` checklist to Cole** at `roadmap/wave-13-agentsidebar-pane-id-binding/wave-13-smoke-report.md` (16 Wave 12 scenarios + 16 Wave 13 scenarios). Cole walks through; orchestrator flips status to SHIPPED-VERIFIED on PASS or FLAGGED with notes per scenario. Then cherry-pick Wave 12 + Wave 13 commits to master, push, tag `v2.34.0` (per Wave 12 setup question 2026-05-24 — both cherry-picked together). CI minutes restore 2026-06-01 per bulletin; push proceeds, merge waits for restore if branch-protection requires.

**Wave 13 — SHIPPED locally (worktree branch `wave-11-plan` — needs cherry-pick + push). 5 commits + wrap commit.** Closes the long-standing HIGH/OPEN follow-up `2026-05-22-workbench-claudeSessionId-binding-precision.md` by replacing the heuristic `useWorkbenchClaudeCapture` with a deterministic `OUROBOROS_PANE_ID` round-trip: env injection at pty spawn → claude inherits → hook scripts emit `paneId` in payload → `AgentSession.paneId` stamped at AGENT_START → `useWorkbenchAgentData(paneId)` filters by `session.paneId === paneId`. External / IDE-in-itself claude sessions have no PANE_ID in their env → their `paneId` is undefined → no match → never appear in sidebar. **Hijack closed by construction**, not by heuristic.

The 5 commits this session:
- `63e531dc` — Phase 0: plan + ADR + frozen RED acceptance tests (validated PASS Gates A/B/C/D; env-propagation spike substituted with analogy-based confidence — same chain proven in prod by `OUROBOROS_HOOKS_TOKEN`/`OUROBOROS_IDE_SESSION`)
- `81804894` — Phase 1: boundary plumbing (`buildSpawnEnv` helper threaded through `spawnTab` + Wave 9 `autoResumeCcTab`; `HookPayload.paneId?`; `buildRendererPayload` pure-transform seam; hook scripts emit; `PtyAPI`/`PtySpawnOptions` accept env). 5/5 acceptance GREEN; sonnet-phase-reviewer PASS all 4 axes with 2 non-blocking FLAGS (duplicate env field decl; empty-string paneId guard — both inert).
- `90eb8dd1` — Phase 2: renderer adoption + heuristic deletion (`useWorkbenchAgentData` signature `claudeSessionId?`→`paneId?`; `AgentSidebar` derives paneId via `useActiveWorkbenchFrame` + `useWorkbenchTabs`; D4 empty state "No active claude session in this pane"; DELETED `useWorkbenchClaudeCapture` + `claudeSessionId` useState + `onClaudeSessionId` callback chain). 6/6 acceptance GREEN.
- `bce32169` — Phase 2.5: runtime gap closure (inline orchestrator self-fix; AgentSession.paneId stamped from AGENT_START hook payload; resolvePrimary filter changed to session.paneId; renderer HookPayload mirror update — caught by tsc:web only).
- `359197fe` — Phase 2.6: cascading test-failure cleanup (dispatched fix; optional-chain guards on `spawnTab`/`autoResumeCcTab` for un-mocked tests; `useWorkbenchAgentData.scoping.acceptance.test.ts` bound-path mocks gained `paneId: 'X'`; extracted `useWorkbenchGlobeData` to break vi.mock collateral damage). 54/54 GREEN across 8 affected files.

**Wave 13 wrap gates summary:**
- Frozen orchestrator-owned acceptance tests: 11/11 GREEN (5 main + 6 renderer). Both byte-identical to Phase 0 except the orchestrator's un-skip flip + wrap-time prettier reformat.
- TSC: `tsc --noEmit` 0 errors. `tsc -p tsconfig.web.json` 0 Wave-13 errors (5 pre-existing changelog codegen errors — same as Wave 11/12 baseline).
- Scoped tests: test:layout 1109/3, test:main 6464/5, test:agentchat 945/0, test:hooks 381/0. Wave 12 baseline maintained.
- Lint: 0 errors on Wave 13 touched files. 3 pre-existing errors persist from Wave 8 + Wave 11 (`InnerRail.tsx` max-lines 301/300; `InnerRail.fileClick.integration.test.tsx` max-depth; `WorkbenchFileViewerModal.lazyLoad.regression.test.ts` no-useless-escape) — none Wave-13-introduced; carry forward.
- Prettier clean on all touched files (orchestrator-owned acceptance test received wrap-time `--write` to fix the implementer-authored-without-format friction; same as Wave 6/8/9/10/12).
- Full `npm test` re-run post-Phase-2.6: DEFERRED. Scoped runs cover Wave 13's surface; full suite re-run is a paranoid sanity check, recommend running at next session start.
- `/review` mechanical: DEFERRED per Wave 11 lean-wrap precedent. Per-phase phase-reviewer pass on Phase 1 + Phase 2+2.5 covers the equivalent surface. Check 6 mutation joins existing pre-merge batch.
- `/audit-followups wave-13`: PENDING — expected to close 2 follow-ups (`workbench-claudeSessionId-binding-precision.md` HIGH + `workbench-sidebar-session-scoping.md` MED).
- `/promote-vendor-lessons 13`: N/A (no vendor SDK touched).
- `/ui-smoke 12+13`: PENDING — bundled manual checklist for Cole at `wave-13-smoke-report.md`.

**Wave 13's notable patterns + lessons:**

1. **Spike-or-analogy decision for autonomous background sessions.** Phase 0's env-propagation spike required interactive `npm run dev` + live claude. Background session substituted analogy-based confidence: same env-propagation chain validated in prod by `OUROBOROS_HOOKS_TOKEN`/`OUROBOROS_IDE_SESSION`. Documented honestly; live verification deferred to wave-end smoke. **Worked**: Phase 1's OS-level inheritance test (Test 1.3) passed first try.

2. **Self-fix criterion 4 violation surfaced cleanly via layered defense.** Phase 2.5 applied inline judging the 4-part test satisfied including criterion 4 ("no likely second bug"). Cascading failures from the filter change + Phase 2's default-tab side effect violated criterion 4. **Phase-reviewer dispatched at wrap caught it**; dispatched Phase 2.6 cleaned up. The self-fix test isn't a guarantee, it's a default with reviewer backstop. Cost: 1 extra commit, 0 broken contracts. Layered defense doing what it's designed to do.

3. **`vi.mock` module-replacement collateral damage.** Phase 2 acceptance test mocked `useWorkbenchAgentData` which wiped `selectPrimarySession` for `AgentGlobe` tests in the same worker pool. Fix: extract `useWorkbenchGlobeData` to its own module. **Worth flagging in renderer hooks CLAUDE.md as a pattern to audit before `vi.mock`'ing module-level adapters.**

4. **The test-mocks-the-bug-away failure mode (Wave 12 lesson 4 recurring).** Phase 2's acceptance test mocked `useWorkbenchAgentData`, hiding the runtime gap. Only the implementer's honest report + orchestrator's phase-reviewer dispatch surfaced it. **Per-phase reviewer dispatches aren't optional discipline; they're the catch layer for the mocked-the-bug-away class.** Wave 12 Phase 4 CenterPane double-instantiation was the same shape.

5. **Wave 96's renderer→main type-coupling lesson recurring AGAIN.** Phase 1 reviewer didn't flag it (just the `electron-runtime-apis.d.ts` PtyAPI surface needed env); Phase 2.5 separately needed `electron-agent-events.d.ts` HookPayload mirror to add `paneId?`. **Pattern: any time a main-side type is augmented, audit `src/renderer/types/*.d.ts` for mirrors needing the same change. Per-phase scoped `tsc --noEmit` won't catch it; only `tsc -p tsconfig.web.json` will.** This is the 3rd or 4th wave where this lesson resurfaced; worth a hook-level pre-push check.

**Wave 13 NOT done / deferrals:**
1. `/ui-smoke 12+13` formal manual smoke — DEFERRED to Cole. Checklist authored at `roadmap/wave-13-agentsidebar-pane-id-binding/wave-13-smoke-report.md` with full Wave 12 + 13 surface coverage incl. IDE-in-itself hijack closure tests 13.5–13.8 (the wave's central correctness gate).
2. Full `npm test` re-run post-Phase-2.6 — DEFERRED. Recommend running at next session start as paranoid sanity check.
3. `/review` mechanical gap-check (incl. Stryker Check 6) — DEFERRED per lean-wrap precedent. Phase-reviewer dispatches cover the equivalent surface.
4. Cherry-pick + push + tag `v2.34.0` — PENDING after Cole's smoke. Wave 12 (5 commits) + Wave 13 (5 commits) bundled per Cole's 2026-05-24 directive.
5. 3 pre-existing lint errors persist (Wave 8 + Wave 11 surfaces) — carry forward as known debt.

Pre-existing OPEN follow-ups that may be load-bearing for Wave 14+:
- `roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md` (LOW/OPEN — out)
- `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (LOW/OPEN — out)
- `roadmap/follow-ups/2026-05-24-workbench-fileviewer-modal-blocks-tree-swap.md` (LOW/OPEN, needs Cole's UX pick A/B/C/D — out)

Wave 14 = Status bar real values (Context tokens/cost, tests-passing count, $cost). Wave 15 = Workbench cutover & teardown (delete legacy shell). Per HANDOFF restructure 2026-05-23.

---

## 🔼 UPDATE 2026-05-24 — Wave 12 SHIPPED (rail CRUD: terminal tabs + project remove/auto-detect-stale)

**Next action: execute Wave 13 — AgentSidebar terminal-scoped binding via `OUROBOROS_PANE_ID` env injection.** Per Cole's confirmed architecture 2026-05-24 (HANDOFF earlier entry): inject `OUROBOROS_PANE_ID=<uuid>` into the env when the IDE spawns a pty; forward in `agent_start.mjs` / `agent_end.mjs` hook payloads; sidebar filters events to `paneId === activePane.id`. Closes the long-standing HIGH/OPEN `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md`. Each Wave 12 TabState already carries a `sessionId` field — Wave 13 will key against it (or add a parallel `paneId` if needed).

**Wave 12 — SHIPPED (worktree branch `wave-11-plan` — needs cherry-pick to master + push).** Renderer + main, behind the same default-off `layout.canonWorkbench` flag. **5 commits this session** (4 phase commits + wrap):
- `48a0cfe6` — Phase 1: `files.pathExists` IPC boundary (6/6 frozen acceptance GREEN, reviewer PASS all 4 axes)
- `2489f165` — Phase 2: project CRUD + auto-detect-stale paths (13/13 frozen acceptance, all 3 surfaces wired, new `useProjectCRUDActions` hook + `excludedPaths` Set in ProjectContext)
- `983fa656` — Phase 3: terminal tab state machine + schema migration (Wave 10 → Wave 12 TabCollection cold-start; 13/13 frozen acceptance; reviewer PASS w/ 1 FLAG → resolved in Phase 4)
- `d30c936c` — Phase 4: terminal CRUD UI + maximize + tab header fix (27/27 frozen acceptance; reviewer FLAG → orchestrator self-fixed inline: CenterPane double-instantiation persistence race)
- wrap commit (plan/ADR/result/smoke/mechanical-review/followup-audit + HANDOFF + temperature-log + 2 self-fix Phase 5 regressions for web preload + channel catalog)

**Phase 5 wrap gates summary:**
- Full vitest: 11809 passed / 8 failed / 8 skipped — 5 are pre-existing (ChangelogDrawer worktree codegen gap × 4, ChatWorkbenchShell × 1, Workbench.projectSwitch.wave10 × 1); 2 were real Wave 12 regressions caught + fixed at wrap (Phase 1 missed wiring `pathExists` into `src/web/webPreloadApis.ts` + `channelCatalog.read.ts` — both mechanical 1-LOC adds; preloadParity + channelCatalogCoverage tests GREEN post-fix).
- `/review` mechanical: FLAG (2 flags). (a) Acceptance tests committed with implementations in same commit (process-discipline gap — the actual discipline WAS followed: tests authored first + run RED + dispatched impl + tests stayed frozen; just bundled in same commit). (b) Plan-vs-test inconsistency on close-last-tab UX: plan said auto-spawn, test+impl say null. **Cole's call (2026-05-24): test wins — ship as-is, file a polish-wave follow-up if it bites.** No follow-up filed yet (lean wrap — bites threshold not crossed).
- Stryker: 31.72% (above project break:21; same as Wave 11 — pre-existing src/shared/ debt; Wave 12 didn't touch the dominant survivor surface).
- `/audit-followups wave-12`: 1 RESOLVED (`2026-05-24-workbench-project-crud-manual-and-auto-detect.md` — Wave 12 Phase 2 closed end-to-end; auto-archived). 31 ACTIVE preserved.
- `/promote-vendor-lessons 12`: N/A (no third-party SDK touched).
- `/ui-smoke 12`: MANUAL fallback per `~/.claude/rules-deferred/manual-smoke-gate.md` and Wave 11 precedent (Preview MCP can't drive Electron). Checklist at `wave-12-smoke-report.md`; result pending Cole's walk-through.

**Wave 12's notable patterns + lessons:**

1. **Split-dispatch for orchestrator-owned tests scales** (Phases 3 + 4 each used: subagent A authors tests + verifies RED → subagent B implements). Buys orchestrator context relief without violating the discipline (neither subagent owns both test + impl). Worth promoting as the standard pattern for boundary phases with 2+ test files or 200+ LOC of test code.

2. **The split-dispatch DOES leak spec details if the test-author isn't given the full plan grounding.** Phase 3's test-author missed the plan's "auto-spawn last tab" intent → wrote a test for null behavior → impl correctly followed test → contradicted plan. Caught only at `/review` Check 5 (cross-cutting layer). Future split-dispatches: include the relevant plan sections + ADR rows verbatim in the test-author brief, AND have the orchestrator do a sanity-check of the test contract before dispatching impl.

3. **Acceptance test commit-discipline gap.** Tests + impl shipped in the same commit (the orchestrator dispatched impl as soon as RED-verified tests were authored; committed both together via `git add` of both at the end). `/review` Check 5 flagged this — the git history doesn't show "test authored first, then impl" as separate commits. The discipline IS being followed in process; just not visible from `git log`. Mitigation for future waves: commit the RED tests as a separate "test(wave-N): Phase X scaffold" commit before dispatching impl, then the impl commit shows a clean "impl makes tests pass" diff.

4. **Phase 4 CenterPane double-instantiation bug is the textbook "test mocks the bug away" case.** All 27 Phase 4 acceptance tests mock `useWorkbenchTabs` entirely; Workbench.maximize mounts full Workbench but doesn't exercise tab persistence at runtime. So the bug (CenterPane mounted 2 extra `useWorkbenchTabs` instances → 750ms-debounced empty-collection writes racing against live writes from TerminalShell instances) was invisible to the test layer. Caught only by the phase reviewer's static diff analysis. Layered defense (acceptance / reviewer / mechanical) — each layer catches what the others miss.

5. **Wave 12 carries 5 pre-existing test failures forward.** ChangelogDrawer × 4 (worktree codegen gap — see Wave 11 lesson 2), ChatWorkbenchShell × 1 (legacy shell, not Wave 12-related), Workbench.projectSwitch.wave10.test.tsx × 1 (Phase 3 implementer confirmed pre-existing). None block Wave 12 ship.

**Wave 12 NOT done / deferrals:**
1. **`/ui-smoke 12` formal manual smoke — DEFERRED to Cole's interactive availability.** Checklist authored at `roadmap/wave-12-terminal-and-project-crud-chrome/wave-12-smoke-report.md` with full Phase 1/2/3/4 surface coverage + Wave 9/10/11 regression checks. Cole walks through whenever; orchestrator flips verdict + pushes when results in.
2. **Stryker mutation debt 31.72%** still below /review's 40 line; standing pre-merge task continues from Wave 3+. Wave 12 didn't reduce or worsen.
3. **Close-last-tab auto-spawn polish** — Cole picked "test wins" per 2026-05-24. Worth a follow-up later if it bites in real use.
4. **Pre-existing Workbench.projectSwitch.wave10 test timeout** — worth filing a follow-up if it persists into Wave 13 work.

**Push posture: PENDING.** This session's commits live on the worktree branch `wave-11-plan`. Next: cherry-pick the 5 Wave 12 commits to master, push, tag `v2.33.0`. CI minutes still exhausted until 2026-06-01 per bulletin — workflows skip cleanly; protected-branch merges still wait for the restore.

Pre-existing OPEN follow-ups load-bearing for Wave 13:
- `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md` (HIGH/OPEN — Wave 13 directly addresses this via `OUROBOROS_PANE_ID`)
- `roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md` (LOW/OPEN — out)
- `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (LOW/OPEN — out)
- `roadmap/follow-ups/2026-05-24-workbench-fileviewer-modal-blocks-tree-swap.md` (LOW/OPEN, needs Cole's UX pick A/B/C/D — out)

---

## 🔼 UPDATE 2026-05-24 — Wave 11 SHIPPED (file-tree click → modal + Wave 10.1 hotfix batch)

**Next action: execute Wave 12 — terminal CRUD + chrome (project-scoped) + project remove/auto-detect-stale.** Wave 12's original scope was terminal CRUD (spawn/delete/rename/+/split/maximize, fix tab-header text overlap); Wave 11 added project CRUD to the bundle per the new follow-up at `roadmap/follow-ups/2026-05-24-workbench-project-crud-manual-and-auto-detect.md` (manual remove + auto-detect stale paths). Both are the same shape of work — UI hygiene on top of existing renderer state — so they bundle naturally.

**Wave 11 — SHIPPED (master @ tag `v2.32.0`).** Renderer-only, behind the same default-off `layout.canonWorkbench` flag. **6 master commits across the session** (incremental cherry-pick + push, not all-at-wrap, so Cole could verify each fix live before next dispatch): `cacaef21` (Wave 10.1 Conf preflight hotfix), `7c3842e7` (Wave 10.1 project-switch + branch chip + popover contrast bundle), `94ae90d3` (Wave 10.1 alphabetical sort), `0999e186` (Phase 1 file-tree click wiring), `7fa7a0db` (Wave 8 P3 DiffReview crash fix), wrap commit (plan/ADR/result/smoke-catchup/HANDOFF/temperature). Artifacts in `roadmap/wave-11-file-tree-viewer-modal/` (waveplan-11, wave-11-decisions, wave-11-result, wave-11-wave-10-diagnosis, wave-11-diffreview-crash-diagnosis).

**Wave 11's scope expansion is the story.** Planned narrow scope (file-tree click → modal + scroll/collapse): ~30 min of work. Actual session (~6 hours): swallowed 6 inline hotfixes for bugs that surfaced during Phase 0 manual smoke against shipped code:

| # | Bug | Origin | Fix |
|---|---|---|---|
| 1 | `canonWorkbenchSessions` startup crash | Wave 10 D1 implemented at wrong layer (React hook vs Conf preflight) | `configPreflight.ts` extension |
| 2 | `setActiveProjectRoot` silent no-op on recent-only paths | Wave 10 P1 guard `if (!prev.includes(path)) return prev` | Drop the guard, always promote |
| 3 | Title bar branch chip missing for non-git projects | Pre-existing (gate `{branch && ...}` predates Wave 10) | Gate on `activeProject`, render `branch ?? "—"` |
| 4 | Popover background unreadable (4 dropdowns) | Wave 10 P2 used `--glass-panel` (35%) instead of `--glass-overlay` (92%) | One-token rename × 4 files |
| 5 | Project list sort (active-at-top → alphabetical) | UX preference; Cole's post-fix feedback | `useWorkbenchProjects.ts` adds `localeCompare` sort |
| 6 | `useDiffReview` crash on file click | Wave 8 P3 chose `FileViewer` direct (not Manager); Manager was what provided `DiffReviewProvider` | Mount `<DiffReviewProvider>` at `Workbench.tsx`'s return |

**Phase 1 itself (the actual Wave 11 wiring) shipped first-try clean.** 3 orchestrator-owned frozen tests (file-click acceptance, lazy-load regression guard, InnerRail integration); `sonnet-implementer` dispatched 24 LOC across 3 files (`Workbench.tsx` + `MiddleRow` prop add, `InnerRail` thread, `WorkbenchFileTree.NodeRow` onClick branch); UnifiedRail correctly skipped (uses `MOCK_FILE_TREE` via `ProjectAccordion` — Wave 12 scope). Cole verified live: Gamify file-click opens modal showing Monaco-rendered content. No console errors after the DiffReview fix.

**Phase 2 SHIPPED-by-explanation.** Both halves of Cole's original 2026-05-23 complaint ("file tree partial when rail open / broken when collapsed") had natural explanations:
- *"partial when rail open"* → stale-path issue (Cole renamed `Contractor App` → `ContractorApp` and `Agent IDE` → `AgentIDE` on disk; the IDE still held the old paths; `readDir` returned sparse/empty for invalid paths; Gamify with valid path shows full tree correctly).
- *"broken when collapsed"* → UnifiedRail uses `MOCK_FILE_TREE` via `ProjectAccordion` — never wired to live tree (known Wave 12 scope, documented in `Workbench/CLAUDE.md`).

No Phase 2 code work needed; documented in result brief + HANDOFF.

**Wave 11 NOT done / deferrals:**

1. **`/ui-smoke 11` formal agent-driven smoke** — DEFERRED to next session. Cole's manual smoke throughout this session covered all Wave 11-touched surfaces live (file-click → modal verified on Gamify; each Wave 10.1 hotfix verified live before next dispatch). Lean-wrap call.
2. **`/review` mechanical gap-check (incl. Stryker mutation Check 6)** — DEFERRED to next session. Heavy gate; not required for ship correctness given the live-smoke discipline this session. Worth running at the top of the next session as a Wave 11 verification follow-up.
3. **`/audit-followups wave-11-file-tree-viewer-modal` formal agent dispatch** — DEFERRED. Known follow-up tracking is documented inline in `wave-11-result.md` § "Carried forward."
4. **Full local test suite** — DEFERRED. Scoped tests (Workbench dir 105/105 + Wave 10 regression 32/32 + Phase 1 frozen 8/8 + Wave 10.1 regression tests all GREEN) ran throughout. Full ~17-min suite not run at wrap.
5. **Worktree tsc:web codegen gap** — bg-session worktrees lack `@renderer/generated/changelog` module (build artifact). Run tsc:web from master, not from worktree. Worth filing as a hook-level fix for `git worktree add`.

**Wave 12 setup (next session pickup):**

Wave 12's original scope (per the 2026-05-23 restructure) was **terminal CRUD + chrome (project-scoped)**: spawn/delete/rename/+/split/maximize terminal tabs; fix tab-header text overlap. Wave 11 added **project CRUD + auto-detect stale paths** to the bundle per the new follow-up. Combined: "rail CRUD" wave that covers all remaining UI hygiene gaps Wave 10-11 left.

Pre-existing OPEN follow-ups that may be load-bearing for Wave 12 or 13:
- `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md` (HIGH/OPEN, Wave 13 dependency — main-process `CLAUDE_SESSION_ID` forwarding from pty spawn)
- `roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md` (LOW/OPEN — `forceUnified` flag doesn't clear on window widen)
- `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (LOW/OPEN — M/A git status badges; needs new per-project dirty git op)
- `roadmap/follow-ups/2026-05-24-workbench-project-crud-manual-and-auto-detect.md` (HIGH/OPEN, Wave 12 — Wave 11's exit follow-up)

**Lesson promoted (from Wave 11 result brief lesson 1, worth elevating):** Tests passing is necessary but nowhere near sufficient. Wave 10 shipped 322/322 tests GREEN with 5 distinct production bugs hidden behind them; Wave 8 P3 shipped with the DiffReview crash hidden because its smoke was deferred. The Wave 11 D5 corrective gate (force live smoke as pre-implementation gate) worked exactly as designed and saved Wave 11 from building on a broken foundation. **For future waves: live smoke is wave-end-required, not wave-end-suggested**, regardless of whether the user is actively using the IDE day-to-day. Pattern formalization candidate.

**Push posture: DONE.** Pushed to `origin/master` @ `7fa7a0db` (+ wrap commit). Tag `v2.32.0` on origin. CI minutes still exhausted until 2026-06-01 per bulletin → workflows skip cleanly; protected-branch merges still wait for the restore.

---

## 🔼 UPDATE 2026-05-23 (superseded next-action) — Wave 10 SHIPPED (project-scoped state foundation + project-switching wiring)

**Next action: execute Wave 11 — file tree + viewer modal.** Cross-project browse, click-to-open file viewer modal over the existing `FileViewer/` Monaco subsystem (reuse Wave 8 P3's lazy-load pattern — `Overlays/WorkbenchFileViewerModal.tsx` is already in place), fix scroll/collapse interactions. The Wave 10 foundation now means each project switch unmounts + remounts the file tree alongside the terminals — Wave 11 leverages this to make file tree behavior project-scoped without additional state work.

**Wave 10 — SHIPPED (local; push pending wrap commit).** Renderer-only, behind the same default-off `layout.canonWorkbench` flag. Commits `bc45d9c9` (P1: `canonWorkbenchSessions` reshape to `Record<projectRoot, …>` + `setActiveProjectRoot` add), the P2 commit (5 project-switching UI surfaces wired), `d48f5fe2` (P3: `key={projectRoot}` re-mount of `<CenterPane>` + `useActiveWorkbenchFrame` hook/provider + `TerminalShell` `onMouseDown` wiring), `3196744f` (planning + Wave 15 rename). Artifacts in `roadmap/wave-10-project-scoped-state-foundation/` (`waveplan-10.md` SHIPPED, `wave-10-decisions.md` SHIPPED, `wave-10-result.md` pending).

- **P1 — schema reshape + per-project restore/persist hooks (boundary).** `CanonWorkbenchSessions` becomes `Record<string, CanonWorkbenchSessionSlot | null>`; all three sites (main schema + main types + renderer mirror) in lockstep. `useWorkbenchRestore(projectRoot)` reads the per-project slice; cold-starts on Wave 9's legacy flat shape (ADR D1 — `'upper' in obj || 'lower' in obj` legacy guard). `useWorkbenchSessionPersist({ projectRoot, … })` does read-modify-write that preserves OTHER projects' slots. New `ProjectContext.setActiveProjectRoot(path)` — move-to-[0]-if-present, silent no-op if absent. The orchestrator's pre-dispatch read of `ProjectContext.tsx` (D5) confirmed `setProjectRoot` REPLACES the array and would have been wrong for chip-click switching. Orchestrator-owned acceptance test `canonWorkbenchSessions.projectKeyed.acceptance.test.ts` 9/9 (RED before P1; frozen). `sonnet-phase-reviewer` PASS all 4 axes (Check 4 — schema-removal/change — satisfied via the documented cold-start posture per D1).
- **P2 — wire all five project-switching UI surfaces.** Outer rail chip click → `setActiveProjectRoot` (NOT `setProjectRoot`); `AddProjectButton` → `files.selectFolder` + `addProjectRoot`; `FooterButton` (Layout) → visible A/B toggle + `agent-ide:workbench-layout-toggle` DOM event (stub for Wave 12); `UserAvatar` → placeholder profile menu. Title bar: new `TitleBarProjectDropdown` + `TitleBarBranchDropdown` + new `useGitBranches(projectRoot)` hook over existing `git.branches` IPC. Inner rail: new `InnerRailProjectDropdown` (D4 — sibling, not shared primitive) + `InnerRailAddProjectButton`. All dropdowns absolute-positioned; click-outside + Esc close via new `useCloseOnOutsideOrEsc` hook (no existing reusable pattern in codebase). 20 new render/integration tests + 1 Workbench-level integration test asserting chip click flips all three project display surfaces. No new IPC needed (orchestrator confirmed `git.branches` + `git.checkout` + `files.selectFolder` already wired).
- **P3 — project-switch reactivity + active-frame state (conceptually-risky).** `<CenterPane key={projectKey} … />` directly inside `MiddleRow` (cleaner than the spec's Fragment-wrapper variant); `projectKey = useProjectOptional()?.projectRoot ?? '__no-project__'`. `useActiveWorkbenchFrame.tsx` exports the hook + `ActiveFrameProvider`; initial `'upper'`; default-return variant outside provider (`{ activeFrame: 'upper', setActiveFrame: noop }` — not throw) to preserve test isolation. `TerminalShell.tsx` calls `setActiveFrame('upper' | 'lower')` on outermost container `onMouseDown` based on `kind`. Wave 9's `hasSpawnedRef` invariant intact (`useWorkbenchTerminals.ts` UNTOUCHED). Orchestrator-owned acceptance test `Workbench.projectSwitch.acceptance.test.tsx` 6/6 (RED before P3; frozen). `sonnet-phase-reviewer` PASS / FLAG (non-blocking — stylistic key placement) / PASS / PASS. **Smart implementer call**: `useProjectOptional` + fallback key preserved all 322 existing Workbench-dir tests with zero mock churn.
- **One Phase 0 oversight caught + fixed in-flight.** The orchestrator-authored P3 acceptance test mocked `pty.spawn` with the wrong signature (single-arg `(opts)` vs real `(sessionId, opts)`). Implementer surfaced as Tier 3 blocker → orchestrator applied the rule's "additive mock-surface correction" carve-out (`~/.claude/rules/orchestrator-owned-acceptance-tests.md`): assertions byte-identical, only the observation surface changed.
- **Gates at wrap:** orchestrator-owned acceptance tests 9/9 (P1) + 6/6 (P3) + Wave 9 regression 7/7 + Workbench dir 322/322 + tsc + tsc:web + `eslint src/` 0 errors (4 pre-existing warnings, none new) + prettier clean on wave-touched files.

**Wave 10 NOT done / deferrals:**

1. **`/ui-smoke 10` — DEFERRED at wrap (the painful honest finding).** The plan explicitly mandated "NOT deferred" as the corrective lesson against Waves 0–9's pattern; this session shipped without the live smoke being run (autonomous orchestrator, no Cole interactivity at wrap, Preview MCP not wired for the Electron shell). Documented honestly at `wave-10-smoke-report.md` with a detailed next-session smoke gate. **NEXT SESSION MUST RUN LIVE SMOKE AS ITS VERY FIRST ACTION** before any Wave 11 dispatch. Treat Wave 10 as SHIPPED-but-NOT-VALIDATED until that smoke completes.
2. **Pre-existing follow-up still HIGH/OPEN: `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md`.** The right-panel binding precision fix is main-process scope and is Wave 13's load-bearing dependency (terminal-scoped right panel). Wave 10 did not address it; the per-project state foundation is independent of binding precision.

**Waves 11–14 still planned:**

| Wave | Title | Scope |
|---|---|---|
| **11** | File tree + viewer modal | Cross-project browse, click-to-open viewer modal, fix scroll/collapse interactions |
| **12** | Terminal CRUD + chrome (project-scoped) | Spawn/delete/rename/+/split/maximize, fix tab-header text overlap |
| **13** | AgentSidebar terminal-scoped binding | NOW / Context / Files Touched / Latest Hunk / Hook Timeline / Stop / Maximize bind to the currently-viewed upper-terminal's claude session (consumes Wave 10's `useActiveWorkbenchFrame`); likely fixes the long-standing claudeSessionId-binding-precision HIGH via main-process `CLAUDE_SESSION_ID` forwarding |
| **14** | Status bar real values | Context tokens/cost, tests-passing count, $cost; remove placeholder readouts |
| **15** | Workbench cutover & teardown | Delete legacy shell (the original "Wave 10" deletion plan); blocked on Waves 10–14 |

---

## 🔼 UPDATE 2026-05-23 (superseded by Wave 10 ship) — Cutover deferred; Waves 10–14 introduced (canon-wiring set)

**Original next action (now superseded — Wave 10 shipped this session): execute Wave 10 — project-scoped state foundation + project-switching wiring.** See `roadmap/wave-10-project-scoped-state-foundation/waveplan-10.md` (DRAFT; pending in-session write).

**Why the restructure.** Right after Wave 9 shipped, Cole ran a live smoke of the canon Workbench and surfaced extensive functional-wiring gaps across most surfaces:

- **Outer rail** — project clicks inert; layout/profile buttons inert; "+" inert.
- **Inner rail** — project dropdown inert; "+" inert; file tree partial when rail open / broken when collapsed; file click doesn't open a viewer modal.
- **Title bar** — project dropdown + branch dropdown inert.
- **Terminals (both frames)** — pre-populated placeholder tabs (`claude-main`/`claude-refactor` upper, `dev server`/`test:watch`/`shell` lower) that cannot be deleted/renamed/spawned/split/maximized; per-tab top-right has overlapping/stacked text.
- **Right panel (AgentSidebar)** — not session-scoped (pulls from arbitrary running claude sessions machine-wide); timeline disappears + repopulates from other sessions; Latest Hunk stuck on placeholder `test-out-weights.json`; Now panel same scoping bug; Context always `0 / 200.0k tokens, 0% used`; Stop / Maximize inert; "View all timeline" inert.
- **Status bar** — Context always `0 / 200.0k`; "24 tests passing" placeholder; Cost always `$0.00`; Clock + "Connected" real.

The Wave 9 "zero parity gaps" claim was structurally true (mounts + tests + types green) but functionally premature. Smoke gating had been deferred Wave 0 → Wave 9, and the cost of that deferral surfaced all at once on 2026-05-23.

**Restructure shape.** The original "Wave 10 = cutover & teardown" plan (drafted 2026-05-23) was renumbered to **Wave 15** and deferred. A new wiring set **Waves 10–14** lands between Wave 9 and Wave 15:

| Wave | Title | Scope (one-line) |
|---|---|---|
| **10** | Project-scoped state foundation + project-switching wiring | Outer rail, inner rail dropdown, title bar dropdown + branch, layout/profile buttons, "+" project. Establishes per-project scoping that Waves 11–13 consume. Likely re-shapes `canonWorkbenchSessions` schema to `Record<projectRoot, { upper, lower }>` (cold-start, no migration per Cole's call). |
| **11** | File tree + viewer modal | Cross-project browse, click-to-open viewer modal, fix scroll/collapse interactions. |
| **12** | Terminal CRUD + chrome (project-scoped) | Spawn/delete/rename/+/split/maximize, fix tab-header text overlap. Terminal collection is per-project per Wave 10 foundation. |
| **13** | AgentSidebar terminal-scoped binding | NOW / Context / Files Touched / Latest Hunk / Hook Timeline / Stop / Maximize all bind to the currently-viewed upper-terminal's claude session. Likely the wave that finally fixes `2026-05-22-workbench-claudeSessionId-binding-precision.md` via main-process `CLAUDE_SESSION_ID` forwarding (long-standing HIGH/OPEN follow-up). |
| **14** | Status bar real values | Context tokens/cost, tests-passing count, $cost; remove the four placeholder readouts. |
| **15** | Workbench cutover & teardown | Original Wave 10 deletion plan, renamed. `roadmap/wave-15-workbench-cutover-teardown/` (frontmatter `blocked-on: [wave-10..wave-14]`; content needs a revision pass at end of Wave 14). |

**Lesson captured (worth flagging for any future wave planning).** Tests-green + types-green is necessary but not sufficient for "ready to delete the alternative path." Smoke gating MUST run before cutover, not after. The Wave 0–9 posture of "Cole not actively using the app, defer smoke" produced a 9-wave debt that all landed at once. Smoke discipline should be wave-end-mandatory regardless of who's using the app — agent-driven via `/ui-smoke` is the standing answer when manual isn't available.

**Pre-existing HIGH/OPEN that's NOW load-bearing for Wave 13:** `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md` — the main-process `CLAUDE_SESSION_ID` forwarding fix. Wave 13's "terminal-scoped right panel" needs precise per-terminal claude-session identity; the current `useClaudeSessionCapture` heuristic isn't tight enough.

The Wave 9 SHIPPED section below remains accurate; only the "next action" line is superseded.

---

## 🔼 UPDATE 2026-05-23 (superseded next-action) — Wave 9 SHIPPED (canon session-restore; renderer-only)

**Original next action (now superseded by the canon-wiring restructure above): execute Wave 10 — cutover & teardown.** Delete the legacy shell now that the last parity gap is closed. Deletion scope: `AppLayout`/`InnerAppLayout`, `ChatOnlyShell/`, `Dispatch/`, the "Explain error" scrollback action, orphaned `AgentMonitor/ApprovalDialog`, legacy `SymbolSearch`/`FilePickerConnected`, AND `RestoreSessionsGate.tsx` (this wave's bypass made it canon-replaced). Optional retirement candidates: `terminalSessions` electron-store key + `useTerminalSessions.sync.ts`'s `persistCurrentSessions` writer (entirely legacy-bound once legacy shell is gone). The new `canonWorkbenchSessions` key stays. Reference: `roadmap/wave-8-workbench-canon-parity-2/wave-8-followup-audit.md` for the audited deletion scope.

**Wave 9 — SHIPPED (local; push pending wrap commit).** Renderer-only, behind the default-off `layout.canonWorkbench` flag. Commits `5149bde2` (P1: `canonWorkbenchSessions` key + `useWorkbenchRestore` reader + `useWorkbenchSessionPersist` writer) + `96cbf658` (P2: `useWorkbenchTerminals` consumes restore + auto-resumes claude in upper frame conditionally). Artifacts in `roadmap/wave-9-canon-workbench-session-restore/` (`waveplan-9.md`, `wave-9-decisions.md`, `wave-9-result.md`).

- **P1 — canon persistence schema + hooks.** New electron-store key `canonWorkbenchSessions` (shape: `{ upper: { cwd, claudeSessionId? } | null, lower: { cwd } | null }`). `useWorkbenchRestore` reads it once on mount (short-circuits when `persistTerminalSessions` off); `useWorkbenchSessionPersist` writes it 750ms-debounced (+ 30s safety) on `claudeSessionId` capture. Schema in `configSchemaMiddle.ts` (142→174 lines, well under 300 cap). 11/11 unit tests + `test:layout` 132/132 green.
- **P2 — terminals integration + auto-resume.** Modified ONLY `useWorkbenchTerminals.ts` to (a) consume `useWorkbenchRestore`, (b) gate spawn effect on `isReady`, (c) conditional `spawnClaude(upper, { cwd, resumeMode: resumeSessionId })` when `resumeSessionId` non-null, (d) lower always plain `pty.spawn`, (e) mount `useWorkbenchSessionPersist`. Orchestrator-owned `useWorkbenchTerminals.restore.acceptance.test.ts` 7/7 (RED→green, frozen). `sonnet-phase-reviewer` PASS all four axes. Implementer added `hasSpawnedRef` to distinguish stale-cleanup-from-early-return vs StrictMode-remount — caught the subtle StrictMode race that adding `isReady` to deps would otherwise have created.
- **Phase 0 Tier 3 catch (the wave's value-add).** Pre-Phase-1 verification of `src/main/ptyPersistence.ts` revealed it's SQLite-backed with NO `is_claude`/`claude_session_id` columns — contradicting the wave plan's foundational assumption ("the fields ARE persisted, only the IPC read strips them"). `sonnet-diagnostician` verdict: TWO parallel persistence stores — Store A (electron-store, `terminalSessions` key) DOES carry the fields end-to-end via `TerminalSessionSnapshot` (`configTypes.ts:88-97`); Store B (SQLite) does NOT. Architect's narrative said "electron-store" but the implementation target was Store B — narrative-vs-target mismatch. Re-targeted to Store A; ADR D3 superseded by D4 + D5 (new `canonWorkbenchSessions` key to avoid mutual-exclusion conflicts with legacy `terminalSessions`). Phase count collapsed from 3 to 2.
- **Gates:** orchestrator-owned acceptance 7/7 + Phase 1 hooks 11/11 + CenterPane acceptance 6/6 (StrictMode regression check, unchanged) + `test:layout` 132/132 (1109/1109 tests) + `tsc --noEmit` clean + `eslint src/` 0 errors (4 pre-existing warnings, none new) + prettier clean on all wave-touched files. `sonnet-phase-reviewer` PASS on Phase 2.

**⚠️ TWO things the next session MUST carry into Wave 10:**
1. **`/ui-smoke 9` deferred** — must verify (a) live `claude --resume <id>` UX on relaunch (NOT just the IPC call boundary the acceptance test covers), (b) IDE-runs-in-itself canon-store-isolation (parent + child Electron share `app.getName()` → same `canonWorkbenchSessions` store path — pre-existing exposure, not worsened by this wave, but worth verifying behavior under canon mode), (c) shutdown-race window (capture <750ms before shutdown is lost — same as legacy, accepted debt).
2. **Pre-existing follow-up still HIGH/OPEN: `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md`.** `useWorkbenchClaudeCapture`'s binding is a timing heuristic; an external session can hijack it. Wave 9 inherits the same exposure (the persisted `claudeSessionId` is only as precise as the capture mechanism that fed it). Proper fix = forward `CLAUDE_SESSION_ID` from pty spawn (main-process work, out of Wave 9's renderer-only scope per D4).

**Push posture: DONE.** Pushed to `origin/master` @ **`1b6404fc`**, tag **`v2.30.0`** on origin (no `package.json` bump per workbench-wave convention). CI minutes still exhausted until 2026-06-01 → workflows skip cleanly; protected-branch merges still wait for the restore. **One extra commit beyond the phase set: `1b6404fc` — the pre-push gate (`tsc -p tsconfig.web.json`) caught the same renderer→main type-coupling shape Wave 96 fixed.** `useWorkbenchSessionPersist.ts` imported `CanonWorkbenchSessions` from `@main/configTypes` (works under the unified tsconfig that the per-phase scoped tsc + per-phase test gates use; fails under `tsconfig.web.json` which excludes `src/main/**`). Fix mirrors Wave 96's pattern: declared the interface directly in `electron-foundation.d.ts` as the renderer-side authoritative type; consumer imports from `../../../types/electron`. **Lesson (repeat): per-phase gates use the unified tsconfig and miss renderer-only type-coupling errors; only the pre-push project-wide `tsc:web` catches them.** Same pattern surfaces every time the renderer touches a new type defined in `src/main/`.

**Follow-ups:** Wave 9 generates no new follow-ups (clean wave). Pre-existing canon-session-restore deferred doc (`roadmap/deferred/2026-05-22-canon-workbench-session-restore.md`) resolved by this wave; archived with a resolution-pointer at wrap. `/audit-followups wave-9-canon-workbench-session-restore` runs at wrap (expected: closes the deferred doc; no other OPEN items inherit).

---

## 🔼 UPDATE 2026-05-22 — Wave 8 SHIPPED (canon parity round 2; 3 of 4 phases; Phase 4 split out)

**Next action: decide the Wave 9 sequencing.** The original plan is **Wave 9 = cutover & teardown**
(delete the legacy shell: `AppLayout`/`InnerAppLayout`, `ChatOnlyShell/`, `Dispatch/`, the "Explain
error" scrollback action, orphaned `AgentMonitor/ApprovalDialog`, legacy `SymbolSearch`/`FilePickerConnected`).
Wave 8 closed the three parity gaps that blocked cutover (sidebar scoping, live FileTree, FilePicker→modal),
**BUT session-restore was split out and is NOT yet wired into the canon shell** — so before Wave 9 deletes
the legacy `RestoreSessionsGate`, either (a) run the split **session-restore wave** first
(`roadmap/deferred/2026-05-22-canon-workbench-session-restore.md` — full architect integration plan inside),
or (b) cutover with restore as a Cole-acknowledged parity gap. **This is a planning/Cole decision for the
next session.**

**Wave 8 — SHIPPED (local; bundled push pending — see below).** Renderer-only, behind the default-off
`layout.canonWorkbench` flag. Commits `5707f0aa` (P1), `6e9cf3ec` (P2), `acfeba98` (P3), `05cbaec1` (format)
+ bundled held `57b750b1` (terminal-well mount-sync fix). Artifacts in `roadmap/wave-8-workbench-canon-parity-2/`
(`waveplan-8.md`, `wave-8-decisions.md`, `wave-8-result.md`, `wave-8-mechanical-review.md`, `wave-8-followup-audit.md`).
- **P1 — agent sidebar session scoping:** `useWorkbenchAgentData(claudeSessionId?)` scopes to the active
  terminal's bound claude session (project-cwd fallback via non-throwing `useProjectOptional`). Frozen
  orchestrator-owned acceptance test (`useWorkbenchAgentData.scoping.acceptance.test.ts`, RED→green).
  phase-reviewer PASS.
- **P2 — live canon FileTree:** `Rails/WorkbenchFileTree.tsx` + `useWorkbenchFileTree.ts` over `useFileWatcher`
  + `window.electronAPI.files`; replaced `MOCK_FILE_TREE` in InnerRail. (M/A badges still deferred.)
- **P3 — file quick-open + FileViewer modal:** Ctrl-K / "Search files" → `Overlays/WorkbenchFilePicker` →
  `Overlays/WorkbenchFileViewerModal` (reuses the existing `FileViewer/` Monaco subsystem, **lazy-loaded** —
  do NOT make it a static import; see `Workbench/CLAUDE.md` gotcha). Per Cole's pivot (editor-as-modal).
- **P4 — session-restore: SPLIT** to its own wave (architect FITS verdict but needs a main-process IPC change
  + auto-`--resume` UX → out of renderer-only scope; ADR D4).
- **Gates:** full suite **11742/0** (1124 files); tsc + `eslint src/` (0 err) + prettier clean. `/review`
  mechanical **FLAG (non-fatal)** — 3 over-exports + the Check-5 commit-ordering proxy (substantive
  orchestrator-owned-test constraint held); Check-6 mutation deferred to the batched pre-merge task.

**⚠️ TWO things the next session MUST carry:**
1. **Phase 1 binding-precision (HIGH, OPEN): `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md`.**
   The `claudeSessionId` binding is a timing heuristic; an external / **IDE-runs-in-itself** session can hijack
   it (and the bound path bypasses the project filter, so the fallback doesn't catch it). That's Cole's common
   dev pattern. Proper fix = forward the real `CLAUDE_SESSION_ID` from the pty spawn (main-process work).
2. **`/ui-smoke 8` is DEFERRED** (per the Wave 0–7 posture). When run it MUST: confirm the sidebar tracks the
   selected terminal's session **including the IDE-in-itself hijack test**; re-run the deferred **#5 permission
   overlay** smoke (its sidebar-takeover reads the now-scoped data); confirm the live FileTree renders real
   files; confirm Ctrl-K / "Search files" → FileViewer modal opens a real file with Monaco at full height.

**Push posture: DONE.** Pushed to `origin/master` @ **`f1c6f052`**, tag **`v2.29.0`** on origin (no
`package.json` bump per the workbench-wave convention). Bundle included the held `57b750b1`. CI did not run
(minutes exhausted until 2026-06-01 → workflows skip; protected-branch *merge* still waits for the restore).
Note one extra commit beyond the phase set: `f1c6f052` — the pre-push gate (`tsc -p tsconfig.web.json` +
project eslint) caught two issues the per-phase scoped checks missed (a real binary-read API bug:
`ReadBinaryFileResult.data` not `.content`; + prettier-reflow pushing two modal functions over the line cap →
extracted `Overlays/useWorkbenchFileLoad.ts` + a `ModalFrame`). **Lesson: re-run eslint AFTER the prettier
pass** (reflow changes line counts) — same class as WB-6's prettier-at-wrap friction.

**Follow-ups:** 3 parity follow-ups closed + archived this wave (`wave-8-followup-audit.md`). New OPEN: the
binding-precision HIGH above. The `/review` Check-3 over-exports (`compareEntries`/`useRootDir`/
`OPEN_FILE_PICKER_EVENT` drift) are noted in `wave-8-mechanical-review.md` — minor, optional cleanup.

---

## 🔼 UPDATE 2026-05-22 — Wave 7 live-smoked; terminal-well bug fixed; Wave 8 (canon parity round 2) PLANNED

**Next action: execute Wave 8 — `roadmap/wave-8-workbench-canon-parity-2/waveplan-8.md` (DRAFT). Start Phase 1
(agent sidebar session scoping).** This session shipped a fix + planned the next wave; execution was
deliberately deferred to a fresh session for a clean Stage-4 implementation context.

**What happened this session (Wave 7 already SHIPPED+PUSHED — confirmed `HEAD == origin/master` @ `52a4ed45`,
tag `v2.28.0` on origin).** Ran a live canon-workbench smoke with Cole (Modern theme, `layout.canonWorkbench`
enabled, fresh `npm run dev`). Results:
- **False alarms (work as designed):** the Wave 7 TitleBar cluster — Settings cog, Ctrl-K pill, Bell — all
  respond. Terminals auto-spawn live (two real ptys). The "not clickable" report was mostly the
  expected-incomplete shell (see below).
- **Expected-incomplete (Wave 8/9 gaps, not bugs):** inner-rail session rows, outer-rail project chips, and
  the terminal tab `+`/split buttons have no handlers (display-only scaffolding); file tree is mock.
- **Bug found + FIXED this session:** canon-workbench terminals rendered opaque black instead of the Modern
  tinted well. Root cause (sonnet-diagnostician): `useThemeSync` only listened for FUTURE
  `agent-ide:theme-applied` events; the workbench auto-spawns terminals during the async theme-hydration
  window, so xterm initialised with the `#0d0d0d` fallback and the correction event fired before the listener
  attached. Fix: `useThemeSync` now syncs once on mount (`TerminalInstanceUiState.ts`). Modern well also tuned
  `0.62 → rgba(6,8,16,0.1)` per Cole. **Commit `57b750b1` — LOCAL ONLY; push HELD to bundle with the Wave 8
  wrap.** Regression test + gotcha recorded; tsc/eslint/prettier/touched-tests green.
- **Bug found + FILED (HIGH, → Wave 8 Phase 1):** the agent sidebar is not session-scoped —
  `useWorkbenchAgentData` selects from the global session pool, so it shows ANY `claude` session machine-wide
  (incl. external + IDE-runs-in-itself) and Context stays `0/200k`. Full diagnosis:
  `roadmap/follow-ups/2026-05-22-workbench-sidebar-session-scoping.md`.
- **#6 responsive collapse:** works (both breakpoints). **#5 permission overlay:** deferred (its
  sidebar-takeover reads the same unscoped data — re-smoke at Wave 8 wrap once scoping is fixed).

**Product decisions RESOLVED (Cole, this session — `…workbench-canon-product-decisions.md` now RESOLVED):**
FilePicker → fold into the Ctrl-K palette; SymbolSearch → drop with legacy (teardown no-op); session-restore
→ keep, wire into the canon Workbench (with the two-frame-model caveat — see Wave 8 ADR D4 PENDING).

**Wave 8 — Canon Workbench Parity Round 2 (PLANNED, DRAFT).** `roadmap/wave-8-workbench-canon-parity-2/`
(`waveplan-8.md` + `wave-8-decisions.md`). Four renderer-only phases behind the flag: (1) sidebar session
scoping [orchestrator-owned acceptance test pre-authored], (2) live canon FileTree over the shared data layer,
(3) FilePicker→palette command, (4) session-restore adapted to the two-frame model [opens with a
`sonnet-architect` validation pass; **may split to its own wave** if `RestoreSessionsGate` doesn't fit].
**Wave 9 = cutover & teardown** (the legacy-shell deletion, formerly "Wave 8"). All three pre-existing
parity follow-ups (sidebar-scoping, live-filetree, product-decisions) feed Wave 8.

**Held push (bundle at Wave 8 wrap):** commit `57b750b1` (terminal-well mount-sync fix). Per the bulletin,
pushing is fine; protected-branch merges still wait for the 2026-06-01 CI-minute restore.

---

## 🔼 UPDATE 2026-05-22 — Workbench Wave 7 SHIPPED: parity completion (the planned teardown was DEFERRED)

**Read this first — the wave sequence changed.** Wave 7 was planned as "cutover & teardown." It is now
**parity completion**; teardown is **Wave 8**. Why: a pre-flight parity audit found the canon Workbench
was **not at functional parity** with the legacy shell — Settings was unreachable (dead cog), Command
Palette + Bell were stubs, FileTree is mock. Deleting the legacy shell now would have shipped a silent
regression. The full audit + the (unchanged, fully-mapped) teardown deletion scope live in
`roadmap/wave-7-workbench-parity-completion/wave-7-parity-audit.md`.

- **Wave 7 — parity completion: SHIPPED** (commits `e0c4b9d2` P1, `e81c5c5d` P2, `553c9fb7` P3; planning
  `c576f7d1`; tag **`v2.28.0`** local). Behind the **same default-off `layout.canonWorkbench` flag**, the
  canon §06 TitleBar **right cluster is now live**, all renderer-only, all reusing existing components:
  - **Settings cog** → shared `SettingsModal` via new `Workbench/Overlays/WorkbenchSettingsOverlay.tsx`
    (listens `OPEN_SETTINGS_EVENT`). *This closed the hard cutover blocker — Settings was unreachable.*
  - **Ctrl-K pill** → existing command palette via new `Workbench/Overlays/WorkbenchCommandPalette.tsx`
    (`useCommandPalette` + `useCommandRegistry`; button dispatches `agent-ide:command-palette`).
  - **Bell** → shared `NotificationCenter` via new `Workbench/TitleBar/WorkbenchBell.tsx` (badge = canon
    §06 warning dot from real unread toast count; replaced the hardcoded `MOCK_PENDING_COUNT`).
  - **Gates:** tsc clean, `eslint src/` **0 errors**, prettier clean, 23 new tests (7+7+9). Full suite
    **11710 passed / 8 skipped / 0 failed**. Plan/ADR/audit/result in `roadmap/wave-7-workbench-parity-completion/`.
    NOTE: the first full-suite run caught a 37-test regression — `WorkbenchBell` (Phase 3) calls
    `useToastContext()` which throws in isolation-rendered tests without `<ToastProvider>` (production is
    fine — provider is above the shell branch). Fixed by adding the established `vi.mock('.../ToastContext')`
    pattern to 5 test files (commit `962bf006`, test-harness only). Lesson: re-run the WHOLE shell test dir
    after mounting a context-consumer into a shared region — narrow per-file scopes miss it.
- **Next action: close the remaining parity gaps, THEN Wave 8 (cutover & teardown).** Before Wave 8 can
  delete the legacy shell, two things must resolve (follow-ups filed):
  1. **Live FileTree** (HIGH, blocks cutover) — `InnerRail` still renders `MOCK_FILE_TREE`.
     `roadmap/follow-ups/2026-05-22-workbench-live-filetree.md`.
  2. **Three product decisions FOR COLE** — FilePicker / SymbolSearch / session-restore: canon is silent;
     include-in-canon-shell or drop-with-legacy? `roadmap/follow-ups/2026-05-22-workbench-canon-product-decisions.md`
     (technical-lead lean noted there: keep session-restore, fold FilePicker into the palette, drop SymbolSearch).
  Then **Wave 8** deletes `AppLayout`/`InnerAppLayout`, `ChatOnlyShell/`, `Dispatch/`, the "Explain error"
  scrollback action, and the orphaned `AgentMonitor/ApprovalDialog`. Open Q3 RESOLVED in the audit
  (mobileAccess does NOT depend on Dispatch — safe to delete). Two Wave-8 prep discoveries beyond the
  reconciliation doc: `AgentChat/` goes runtime-dead after cutover (sever the one `ChatStatusChipRow`
  compile dep; retire AgentChat in its own later wave) + the `?mode=chat` pop-out machinery orphans —
  `roadmap/follow-ups/2026-05-22-wave8-teardown-prep-discoveries.md`.
- **Wave 7 NOT done / deferrals:** `/ui-smoke 7` deferred (per Wave 0–6 posture; all behind the off-by-default
  flag). **Next dev session:** enable Settings → Appearance → "Canon workbench", click the cog (Settings
  opens), the Ctrl-K pill (palette opens), the bell (notification center opens; dot = real unread). Two LOW
  palette deferrals (`roadmap/follow-ups/2026-05-22-workbench-command-palette-canon-polish.md`): keybind is
  still Ctrl+Shift+P not canon Ctrl+K; some builtin commands no-op in the canon shell. `/promote-vendor-lessons 7`
  = no-op. Check-6 mutation joins the batched pre-merge task (now also covers the Wave-7 overlay hosts).
- **Versioning note:** like WB-0..WB-6, this wave **tags without bumping `package.json`** (stays at 2.20.0)
  — matching the established workbench-wave convention. Tag `v2.28.0`.

---

## 🔼 UPDATE 2026-05-22 — Workbench Wave 6 SHIPPED + PUSHED (themes + responsive collapse)

Workbench overhaul: **Waves 0 + 1 + 2 + 3 + 4 + 5 + 6 all on `master`** — Wave 6 pushed to `origin/master` (`7c842dbc`, tag **`v2.27.0`** on origin). CI did not run (GH Actions minutes exhausted until 2026-06-01 — expected per bulletin; the wave-stack *merge* into a protected branch still waits for the minute restore).

- **Wave 6 — themes + responsive collapse: SHIPPED** (commits `398e41fc` P0+P1, `a74adae6` P2, `ec8d0a2d` P3, `7c842dbc` P4 wrap; tag `v2.27.0`; CHANGELOG `[2.27.0]`). Behind the same default-off `layout.canonWorkbench` flag. **Two tracks, renderer-only:**
  - **Per-theme canon treatment (Modern/Warp/Retro).** New per-theme path: `Theme.workbenchTokens?: Partial<Record<CanonWorkbenchToken, string>>` (types.ts) whose entries `applyComponentTokens` writes inline AFTER the material pass (theme overrides beat material wash/glows; absent → fallback stands — completes the deferred `tokens.css:254` promise, ADR D2). **Warp** = warm-amber wash/glows/accent + `terminalCanvasOpacity 0.86`; **Retro** = matte (`--blur-*: 'none'`, opaque `--material-panel` 0.85/0.92, green phosphor) + a CRT scanline overlay in `Workbench.tsx` (`useScanlines` reads `data-scanlines`); **Modern** = no override (canon-matched) BUT terminal well corrected **0.35→0.62** (D5, live-since-Wave-0 bug). cursor/kiro/light/high-contrast untreated (D4).
  - **Responsive collapse (canon §16, 3 tiers — HUD dropped per D3).** New `useWorkbenchBreakpoint` (max-width matchMedia at **1760** and **1440** — NOT 1440/1180; below 1440 is uniformly unified once HUD is dropped). full (≥1760): dual rails, sidebar 348. compact (1440–1759): dual rails, sidebar 300, Latest Hunk → one-line indicator (click expands). unified (<1440): `UnifiedRail` mounts (dual rails unmount), sidebar 300. `UnifiedRail` is now **mounted + live-wired** (`useWorkbenchProjects`/`useGitBranch`/`useWorkbenchAgentData`). Collapse-handle stubs wired to `forceUnified` (left-rail-only).
  - **Gates:** two frozen orchestrator-owned guards (`useTheme.tokens.preservation.test.ts` 2/2 byte-identity of the 4 untreated themes; `Workbench.responsive.acceptance.test.tsx` 5/5 tier contract — both authored before impl, untouched). `useWorkbenchBreakpoint.test.ts` 14/14. **Full suite 11684 passed / 8 skipped / 0 failed.** tsc clean, `eslint src/` 0 errors, prettier clean. 3 `sonnet-phase-reviewer` passes (P2: scanline `// hardcoded:` suppression fixed inline; P3: inert collapse toggle → now expands the real hunk). `/review` mechanical **PASS** (Checks 1–3 clean, 4/5 N/A, 6 deferred to pre-merge mutation task). Plan/ADR/result/mechanical-review/smoke/followup-audit in `roadmap/wave-6-workbench-themes-responsive/`.
- **Next action:** **Wave 7 — cutover & teardown** (make the canon workbench the sole shell; delete `AppLayout`/`InnerAppLayout`, the Wave-89 variant + `ChatOnlyShell` remnants, `Dispatch/`, the "Explain error" scrollback action, AND the orphaned `AgentMonitor/ApprovalDialog`). Sequence: `roadmap/discovery/workbench-overhaul-reconciliation.md`. **Wave 7 is the final workbench wave.**
- **Wave 6 NOT done / deferrals:** `/ui-smoke 6` live smoke deferred (Cole not using the app until the remake is done — per Wave 0–5 posture; checklist written + queued at `wave-6-smoke-report.md`). **Next dev session:** enable the flag, switch Modern/Warp/Retro (deeper indigo well; warm amber wash; matte green + scanlines + no blur), and drag-resize across ~1760/~1440 to watch the agent rail narrow + Latest Hunk collapse, then the rails merge into the unified rail. One new LOW follow-up: `2026-05-22-workbench-forceunified-no-autoclear.md` (manual collapse doesn't auto-clear on widen). `/promote-vendor-lessons 6` = no-op (no vendor SDK). `/audit-followups wave-6` = 24 OPEN, 0 closed (none touch this wave's surface — inbox is growing, worth a `/triage-sweep` soon).
- **Carried-forward:** the **Check-6 mutation pre-merge task** (run `npm run mutation:test`, tighten adapter/derivation survivors before the 2026-06-01 merge) now also covers Wave 6's `workbenchTokens`/`useWorkbenchBreakpoint`/UnifiedRail-adapter logic — joins the Wave-3/4/5 batch. The `UnifiedRail.parts`/`InnerRail` file-tree body is still `MOCK_FILE_TREE`; git +adds/−dels still deferred (existing follow-up).

---

## 🔼 UPDATE 2026-05-22 — Workbench Wave 5 SHIPPED (canon §13 permission UI)

Workbench overhaul: **Waves 0 + 1 + 2 + 3 + 4 + 5 all on `master`** (5 committed + tagged `v2.26.0` local; push per the bulletin — merge of the wave-stack waits for the 2026-06-01 CI-minute restore).

- **Wave 5 — permission UI re-skin: SHIPPED** (commits `6dc5ffa2` P1, `e67c7341` P2, `4d3cf3c1` wrap; tag `v2.26.0`; CHANGELOG `[2.26.0]`). Behind the same default-off `layout.canonWorkbench` flag, the canon workbench now renders the **canon §13 dual-presentation approval UI over the EXISTING file-poll approval pipeline** — no new protocol, no main-process/IPC/config change (ADR D1). When a `claude` session hits a tool needing approval: a glass amber **terminal overlay** slides up over the terminal pane (`Permission/PermissionOverlay.tsx`, mounted in `Terminals/CenterPane`), AND **simultaneously** the agent sidebar's **NOW panel becomes the same permission card** with panels 2–5 dimmed to 0.7 (`Permission/PermissionSidebarTakeover.tsx`, swapped in `AgentSidebar`). Both render the shared `PermissionCard` and resolve through `useApprovalContext()` (Approve / Always-for-tool / Deny — the three existing resolvers; "Always for project" is canon v2, out of scope D5). **The Y/A/N/Esc shortcut is a SINGLE window keydown owner** (`useWorkbenchApproval`, called only by the overlay; the sidebar reads `useApprovalContext()` directly to avoid a 2nd handler — D3). All under `src/renderer/components/Workbench/Permission/`. Plan/ADR/result/mechanical-review/smoke in `roadmap/wave-5-workbench-permission-overlay/`. **Gates:** orchestrator-owned acceptance test 8/8 (frozen; each action → correct resolver once + single-keypress-resolves-once with both surfaces mounted), Phase-2 render tests 7/7, **full suite 11637 passed / 8 skipped / 0 failed**, tsc clean, `eslint src/` 0 errors, prettier clean. Phases 1+2 each got a `sonnet-phase-reviewer` pass (P1 FLAG resolved inline — elapsedSec rendered; P2 PASS + 1 cosmetic FLAG → follow-up). `/review` mechanical = **FLAG non-fatal** (checks 1–5 clean; Check 6 mutation deferred to the pre-merge task).
- **Next action:** **Wave 6 — themes + responsive collapse** (full glass treatment for Modern/Warp/Retro; opportunistic port of cursor/kiro/light/high-contrast; responsive collapse of the dual permission surfaces + rails per canon §16). Then **Wave 7 — cutover & teardown** (make the canon workbench the sole shell; delete `AppLayout`/`InnerAppLayout`, the Wave-89 variant + `ChatOnlyShell` remnants, `Dispatch/`, the "Explain error" scrollback action, AND the orphaned `AgentMonitor/ApprovalDialog`). Sequence: `roadmap/discovery/workbench-overhaul-reconciliation.md`.
- **Wave 5 NOT done / deferrals:** `/ui-smoke 5` live smoke deferred (Cole not using the app until the remake is done — per Wave 0–4 posture; checklist written + queued at `wave-5-smoke-report.md`). **Next dev session:** enable Settings → Appearance → "Canon workbench", run a `claude` session, trigger a gated tool, confirm the overlay + dimmed-sidebar takeover render simultaneously and Y/A/N resolve once. Two new follow-ups: `2026-05-22-orphaned-agentmonitor-approvaldialog.md` (MED — the legacy dialog is mounted nowhere; → Wave 7 deletion) + `2026-05-22-permission-card-elapsed-no-ticker.md` (LOW — cosmetic, no live ticker). `/promote-vendor-lessons 5` = no-op (no vendor SDK). `/audit-followups wave-5` pending (the 2 new follow-ups are intentionally OPEN/deferred).
- **Carried-forward:** the **Check-6 mutation pre-merge task** (tighten tests for any Wave-3/4 *adapter/derivation* mutation survivor before the 2026-06-01 merge) now also covers Wave 5's `Permission/**` adapter logic — run `npm run mutation:test`, tighten adapter/derivation survivors (UI-style/JSX acceptable). See `wave-5-mechanical-review.md` Check 6.

---

## 🔼 UPDATE 2026-05-22 — Workbench Wave 4 SHIPPED (agent sidebar 5 panel bodies live)

Workbench overhaul: **Waves 0 + 1 + 2 + 3 + 4 all on `master`.**

- **Wave 4 — agent sidebar live: SHIPPED + pushed** (`origin/master` @ `3ede163f`, tag `v2.25.0` on origin, CHANGELOG `[2.25.0]`). CI did not run (GH Actions minutes exhausted until 2026-06-01 — no red-X, no minutes burned; expected per bulletin). Behind the same default-off `layout.canonWorkbench` flag, the five agent-sidebar **panel bodies** now render real runtime data via the **same** `useWorkbenchAgentData` adapter (no competing adapter — D1): **NOW** (active tool/target/elapsed) + **Context** (live tokens/cost/model) wired from existing Wave-3 fields; **Files Touched** (list from `AgentSession.toolCalls`, ellipsis-tolerant dedup) + **Hook Timeline** (merged `toolCalls`+`conversationTurns`, `think` dropped — D6) as pure derivations; **Latest Hunk** + **`+N/−N` badges** from the Wave-94 diff pipeline (`diff_review_ready` → `git:diffReview` → `FileDiff → MockDiffHunk`) via a panel-local subscription in new `useWorkbenchAgentData.diff.ts`, diff held as **ephemeral hook state** (no `AgentSession`/reducer/SQLite change — D3). Diff surfaces piggyback `enableTerminalDiffReview` + degrade to empty/badge-free when off (D5). Renderer-only; `AgentMonitor/types.ts` untouched. Sidebar `MOCK_*` data swept (only `MOCK_STATUS_BAR` + `Mock*` types remain — D8). Plan/ADR/recon/result/smoke in `roadmap/wave-4-workbench-agent-sidebar-live/`. **Gates:** Workbench suite **175/175** (incl. the Phase-3 orchestrator-owned acceptance test + 2 derivation unit-test files), full renderer suite green, tsc clean, `eslint src/` 0 errors, prettier clean. Phases 2 + 3 each got a `sonnet-phase-reviewer` pass (Phase 2: 3 FLAG fixes folded in; Phase 3: PASS + one non-blocking FLAG accepted for codebase consistency → follow-up).
- **Next action:** **Wave 5 — permission overlay / sidebar takeover** (the canon permission-prompt UI inside the workbench; the approval pipeline already exists — `approvalManager`/`ApprovalContext`/`ApprovalDialog`, file-poll protocol). Then 6 (themes + responsive collapse), 7 (cutover — remove legacy shells).
- **Wave 4 NOT done / deferrals:** `/ui-smoke 4` live smoke deferred (Cole not using the app until the remake is done — per Wave 0–3 posture; written + queued at `wave-4-smoke-report.md`). **Next dev session:** enable Settings → Appearance → "Canon workbench", run a `claude` session, confirm NOW/Context/Files Touched/Hook Timeline reflect the live session and (with `enableTerminalDiffReview` on) Latest Hunk + badges show the real diff; toggle the diff setting off → graceful degrade. Two new LOW follow-ups: `2026-05-22-workbench-diff-subscription-latest-ref.md` (subscribe-once latest-ref refinement, both hooks) + `2026-05-22-workbench-files-touched-truncated-path-badges.md` (ellipsis-tolerant badge match for >80-char paths). `/promote-vendor-lessons 4` = no-op (no vendor SDK). `/audit-followups wave-4` pending (run next).
- **Carried-forward from Wave 3:** the **Check-6 mutation pre-merge task** (tighten tests for any Wave-3 *adapter/derivation* mutation survivor before the 2026-06-01 merge — UI-style/JSX survivors acceptable; see `wave-3-mechanical-review.md`) is still open and now joined by Wave 4's adapter logic.

---

## 🔼 UPDATE 2026-05-21 — Workbench Wave 3 SHIPPED (live agent state + hook pipeline)

Workbench overhaul: **Waves 0 + 1 + 2 + 3 all on `master`.**

- **Wave 3 — hook pipeline + live agent state: SHIPPED** (local tag `v2.24.0`). Behind the same default-off `layout.canonWorkbench` flag, the canon workbench's **non-terminal regions now react to real agent activity** instead of `workbenchMockData`. New `useWorkbenchAgentData` adapter derives a six-state presentation status (`fresh/thinking/running/awaiting/errored/done`) from the live `AgentEventsContext` **without mutating the canonical 4-value `AgentStatus`** (~48 AgentMonitor consumers — ADR D1). Live now: the **Agent Globe** (real model/tool/idle), the inner-rail **session list** (status dots: live/warn/idle), the **agent-sidebar header**, **project chips** (+ deterministic per-path color), **git branch name**, **clock**, and **status-bar context stats**. New `useWorkbenchProjects` (workbench-local). Renderer-only, no IPC/schema change. Plan/ADR/recon/result/review/audit in `roadmap/wave-3-workbench-hook-pipeline-state-machine/`. Gates: orchestrator-owned acceptance tests 9/9 (Globe) + 5/5 (sessions), unit 20, Workbench suite 134, tsc + full `eslint src/` (0 err) + prettier clean. One phase-reviewer fix folded in (two-tier `selectPrimarySession` + ADR D4 correction); one orchestrator self-fix (Workbench.test.tsx provider mock).
  - **`/review` verdict: FLAG (non-fatal).** Checks 1–3 clean, 4/5 N/A. **Check 6 mutation score = 31.72%** — below /review's 40% line but **above the project's `break: 21` gate (passed)**; survivors skew toward UI-render constructs (Regex/StringLiteral/Conditional in inline-style/JSX), not the wave's core logic. **PRE-MERGE TASK (before 2026-06-01 merge):** open `reports/mutation/mutation.html`, filter to the Wave-3 source files, and tighten tests for any survivor in the **adapter/derivation logic** (UI-style/JSX survivors are acceptable for a UI wave). See `wave-3-mechanical-review.md`.
- **Next action:** **Wave 4 — Agent sidebar live** (re-layout `AgentMonitor` into the 5 canon panels + make the panel BODIES live: NOW / Context / Files Touched / Latest Hunk / Hook Timeline). Wave 3 deliberately left the 5 panel bodies on mock (ADR D5). Extend the **same** `useWorkbenchAgentData` adapter (D3 — don't add a competing adapter) with the panel data. Two known hard sub-problems carried forward: **Files Touched** has no live backing (derive by scanning `AgentSession.toolCalls` for Edit/Write/Read), and **Latest Hunk** has no structured diff source (reconciliation Open Q2 — decide git-delta vs extended PostToolUse at Wave-4 plan time). Then 5 permissions, 6 themes+responsive, 7 cutover.
- **Wave 3 NOT done / deferrals:** `/ui-smoke 3` live smoke deferred (Cole not using the app until the remake is done; per Wave 0/1/2 posture) — **next dev session:** enable Settings → Appearance → "Canon workbench", run a `claude` session in a terminal, confirm the Globe lights up with real model/tool + returns to idle, the inner rail lists running sessions with green/amber dots, and the title/status bars show the real project/branch/clock/tokens. New follow-up `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (OPEN — git +adds/−dels + per-project dirty need a new main-process git op; deferred, not faked). `2026-05-21-wave-2-dead-terminal-line-mocks.md` **RESOLVED** by Phase 4's sweep (archived). `/promote-vendor-lessons 3` = no-op (no third-party SDK touched).

---

## 🔼 UPDATE 2026-05-21 — Workbench Wave 2 SHIPPED (live terminals + divider)

Workbench overhaul: **Waves 0 + 1 + 2 all on `master`.**

- **Wave 2 — terminal integration: SHIPPED** (local tag `v2.23.0`). Behind the same default-off `layout.canonWorkbench` flag, the canon workbench's two terminal frames are now **real live xterm terminals** bound to workbench-owned ptys (behind the tinted-well glass), and the divider between them is **draggable + persisted** (`layout.workbenchTerminalSplit`, default 0.62). New `Terminals/useWorkbenchTerminals.ts` (thin spawn/kill hook, StrictMode-safe) + `useVerticalSplitResize.ts`; `TerminalShell` now mounts the existing `<TerminalInstance>`; static mock bodies removed. Renderer-only + one config key. Plan/ADR/recon/result in `roadmap/wave-2-workbench-terminal-integration/`. Gates: acceptance 6/6, Workbench 102, `test:main` 6444, tsc + full lint + prettier clean. Two orchestrator review-fixes folded in (StrictMode net-kill; async restore never reaching the UI — both with regression tests).
- **Next action:** **Wave 3 — hook pipeline mapping + state machine** (map canon's idealized hook schema → the real `useAgentEvents`/`AgentEventsContext` wire; extend `AgentStatus` with `thinking/awaiting/errored/done/fresh`; drive the Agent Globe; swap `workbenchMockData` → live data for TitleBar/Rails/AgentSidebar/StatusBar). Then 4 sidebar live, 5 permissions, 6 themes+responsive, 7 cutover.
  - **Wave 3 grounding — read before planning** (so you don't re-derive it): the canon §11/§12 hook schema is **idealized/fiction** — `useHookSubscription`, `transcript_path`, `decision:"request"`, structured `tool_response.diff` do NOT exist. The real wire: `useAgentEvents` + `AgentEventsContext`, `{type, sessionId, timestamp}` envelope, **file-poll approval** (`~/.ouroboros/approvals/{id}.response`, `approve|reject`), `AgentStatus = idle|running|complete|error`. The approval UI already exists (`approvalManager`/`ApprovalContext`/`ApprovalDialog`). The hook work is **mapping + extending the enum/reducer** (`useAgentEvents.helpers.ts`), not building from zero. Full table: `roadmap/discovery/workbench-overhaul-reconciliation.md` §11/§12 + the "Hook schema: canon vs reality" table. Open Qs to resolve at Wave-3 plan time: `transcript_path` forwarding (skip vs plumb), and whether `workbenchMockData` regions swap source-not-shape (they were typed to canon §11 for exactly this).
  - **Wave 2 left a clean seam for live data:** terminals are already live (not mock) — Wave 3 does NOT touch `Terminals/`; it swaps mock→live for the other four regions. The `workbenchMockData` terminal-line constants are now dead (`roadmap/follow-ups/2026-05-21-wave-2-dead-terminal-line-mocks.md`) — sweep them as part of Wave 3's mock rework.
- **Wave 2 NOT done / deferrals:** `/ui-smoke 2` live smoke deferred (Cole not using the app until the remake is done; the Phase-1 runtime FLAG — zero-height-well initial column wrap, mitigated by xterm's `isReadyRef` + ResizeObserver — is unconfirmed in a live IDE; confirm next dev session: enable the flag, type in both frames, drag divider, reload). Follow-up `roadmap/follow-ups/2026-05-21-wave-2-dead-terminal-line-mocks.md` (dead mock constants for Wave 3 to sweep). Tab `+`/split/maximize buttons remain non-functional; Claude auto-launch + multi-tab → Wave 3.

---

## 🔼 UPDATE 2026-05-21 — Workbench Wave 1 SHIPPED (static shell); terminal glass fixed

Workbench overhaul progress: **Wave 0 + Wave 1 + the terminal-glass fix all on `master`.**

- **Wave 1 — static workbench shell: SHIPPED** (tag `v2.22.0`). Behind the default-off `layout.canonWorkbench` flag (**Settings → Appearance → "Canon workbench (experimental)"**), a third `InnerApp` branch renders the full canon shell as a static layout with mock data: title bar (app mark, project/branch chips, Agent Globe, Windows controls), project + inner rails (UnifiedRail built but not mounted), centre terminal frame (62/38, tinted-well, **no xterm yet**), agent sidebar (5 panels), status bar. All under `src/renderer/components/Workbench/` (canon §17 tree) + `shared/Icon.tsx` + `workbenchMockData.*`. 82 tests; tsc + full lint clean. Plan/ADR/result in `roadmap/wave-1-workbench-static-shell/`. Cole reviewed the shape live (approved; height + flag-reachability bugs caught and fixed mid-build).
- **Terminal glass fix — SHIPPED** (tag `v2.21.1`). Wave 0's tinted well wasn't rendering (xterm WebGL composites opaque, #1004) → switched all terminals to the **DOM renderer**, drove canvas bg from `--term-canvas-bg` (well themes tint, others unchanged), Modern well alpha tuned to 0.35. WebGL dependency-removal follow-up: `roadmap/follow-ups/2026-05-21-remove-xterm-webgl-dependency.md`.
- **Next action:** **Wave 2 — terminal integration** (mount real xterm into `Terminals/TerminalShell.tsx`, replacing the static mock body; wire the divider resize). Then Wave 3 (hook pipeline + live data swaps `workbenchMockData`), 4 (agent sidebar live), 5 (permissions), 6 (themes+responsive), 7 (cutover+teardown). Sequence in `roadmap/discovery/workbench-overhaul-reconciliation.md`.
- **Wave 1 deferrals:** window-control IPC (no-op stubs — not in preload bridge), dual/unified toggle wiring, AgentGlobe awaiting/errored states (Wave 3), per-component animation keyframes (consolidate Wave 3). `/ui-smoke 1` + `/review` not run formally (Cole was live reviewer; per-phase gated + flag-isolated).

---

## 🔼 UPDATE 2026-05-21 — Workbench overhaul kicked off; Wave 0 SHIPPED to master

The **workbench overhaul** is the new active initiative. Design canon lives in-repo at `design-system/` (`canon.html` = 18-section written spec; `workbench-tokens.css` = real token values; `workbench-*.jsx` = rendered mockup). Canon-vs-codebase reconciliation: `roadmap/discovery/workbench-overhaul-reconciliation.md` (decisions resolved: **replace everything** → single canon shell at end state; keep all 7 themes, full treatment Modern/Warp/Retro; delete DispatchScreen + "Explain error" at cutover). 8-wave sequence (0→7) in that doc.

- **Wave 0 — token foundations: SHIPPED** to `master` (commits `b4fbc855` docs + `c253cb2e` impl), tag **`v2.21.0`** pushed. Renderer-only. (1) Canon-name alias block in `tokens.css` (29 net-new names; divergences marked). (2) Opt-in theme-driven terminal "tinted well" — new `Theme.terminalWell`/`terminalCanvasOpacity`, wired in `useTheme.tokens.ts`; Modern terminal now translucent; default-preserving for the 4 untouched themes. 6 bridge tests incl. a default-preservation regression guard; phase-reviewer PASS. Plan/ADR/result in `roadmap/wave-0-workbench-token-foundations/`.
- **Wave 0 NOT done:** rendered tinted-well terminal **not visually smoke-verified** — `/ui-smoke 0` skipped; Cole verifies on next `npm run dev` (Modern terminal should read as a translucent indigo well, not opaque black). `/audit-followups` + `/promote-vendor-lessons` skipped (no follow-ups, no vendor).
- **Next action:** Wave 1 — static workbench shell (titlebar + Agent Globe placeholder + dual/unified rails + stacked terminal frame + agent-sidebar frame + statusbar) with mock data, behind a flag. See the reconciliation doc's wave sequence.
- **Branch note:** Wave 0 landed directly on `master` per Cole's call. The `fix/crash-log-settings-freeze` branch (PR #10) is **untouched and intact** — its 2 commits are preserved; return to it for the PR-#10 merge on 2026-06-01.

---

## 🔼 UPDATE 2026-05-21 — backlog pushed; freeze fix in PR #10; Wave 100 parked

Most of this HANDOFF below is now historical. Current state:

- **Master backlog pushed.** `origin/master` is now fully synced (Wave 98, Wave 99 `8c75e940`, terminal-dock `e1d34d3a`, graph cold-acquire `b8666432`, ghost-cursor `fd929b3b`). Tag `v2.20.0` pushed. The "Push backlog held until 2026-06-01" section below is **resolved** — the current bulletin sanctions pushing; only PR *merges* into protected branches wait for CI minutes.
- **Crash-log freeze fix → PR #10** (https://github.com/hesnotsoharry/Ouroboros/pull/10). Branch `fix/crash-log-settings-freeze`. Decoupled from Wave 100 by redirecting `getErrorMessage` imports (`crashHandlers.ts` + test) from `../utils` → `../agentChat/utils`. Pre-push gate green. **Merge waits until 2026-06-01** (branch protection / CI minutes).
- **Wave 100 (chat-surface removal) parked** on branch `wave-100-chat-surface-removal`: parking commit `dec0d793` + `stash@{0}` (Phase A relocation incl. `src/main/utils.ts`). Still PAUSED, 1/11 phases, needs re-scope per the SCOPE CORRECTION in `waveplan-100.md`. The tree no longer holds mixed uncommitted Wave 100 work.
- **Still open:** Wave 99 live UI smoke (`/ui-smoke 99`) — deferrable now that the tree is clean. PR #10 merge on 2026-06-01.

The "Concurrent work in the tree" warning below is **historical** — the tree is clean on master.

---

## ⚠️ Concurrent work in the tree — read this first

This checkout currently holds **two independent efforts**:

1. **Wave 99 (Agent-Completion Rail Indicators) — committed** as `8c75e940`, tagged `v2.20.0` (local, not pushed). Renderer-only.
2. **Wave 100 (Chat-Surface Removal) — IN-PROGRESS, UNCOMMITTED.** ~31 files in the working tree: `src/main/**` (util extraction `getErrorMessage` → new `src/main/utils.ts`, ipc-handler import updates), new `src/main/configDefaults.ts` / `src/main/hooks/types.ts`, plus `roadmap/wave-100-chat-surface-removal/` and `roadmap/discovery/2026-05-19-de-chat-triage.md`. **This is another session's live work — do NOT commit, revert, or build on it without confirming with Cole.** Wave 99 was committed by explicit path specifically to leave Wave 100 untouched.

Two commits also landed during the Wave 99 session that predate it: `e1d34d3a` (terminal-dock fixes) and `b8666432` (graph cold-acquire). Those are committed already.

---

## Wave 99 — what shipped (commit `8c75e940`, tag `v2.20.0`)

Agent-completion indicators on the chat-workbench rail, for **interactive terminal `claude` sessions** (the post-chat-retirement usage pattern).

- **Outer project rail** dot (green=complete / red=error), cwd-based — the reliable signal.
- **Dock terminal tabs + inner-rail terminals list** — per-terminal `CompletionDot` keyed by `claudeSessionId`.
- **Revived the dead "Live" chip** for terminal sessions: `useWorkbenchAttention` gained an additive `AgentSession`-status source (ADR 6); the rail had been reading the retired chat-thread status, which is null for terminal sessions. That was the root cause of "no indicators anywhere."
- New `useAgentCompletionIndicators` hook + shared `AgentCompletionIndicatorsContext`; two independent viewed-watermarks (project-click clears only the outer dot, not the per-terminal dots).

Full story: `roadmap/wave-99-agent-completion-rail-indicators/wave-99-result.md`.

**Gates:** typecheck clean, `eslint src/` clean, ChatOnlyShell + hook suites green. Orchestrator-owned acceptance test (`useWorkbenchAttention.agentSource.acceptance.test.ts`) passes; Phase 3 passed a phase-reviewer pass.

### ⚠️ Wave 99 — NOT done

- **Live UI smoke deferred.** `/ui-smoke 99` was NOT run because the tree concurrently holds incomplete Wave 100 main-process work — a dev-server smoke wouldn't cleanly isolate Wave 99. **Next-session action once Wave 100 is resolved:** run a live smoke to confirm the three dot surfaces render and clear-on-view behaves. The per-phase observation points were verified at the unit/integration boundary only, not in a running IDE.
- **`/promote-vendor-lessons 99`** — no-op (no vendor SDK touched), skipped.
- **`/audit-followups`** — not run (no follow-ups created this wave; tree too mixed for a clean diff scan). Can run next session.

### Wave 99 known debt (in result brief)

- `useWorkbenchProjects` logic duplicated into `AgentCompletionIndicatorsContext` (drift risk) — candidate for shared extraction.
- Session-row chip wired into `InnerSidebarChats` but dormant behind the disabled `chats` tab (Wave-89 pivot).
- Per-terminal dots inherit the heuristic `useClaudeSessionCapture` binding (background-launched claude can mis-bind); outer dot is binding-free.

---

## Push backlog (held until 2026-06-01 GH Actions minutes restore)

Per the 2026-05-19 bulletin, agents do not initiate pushes; CI minutes are exhausted until 2026-06-01. Ahead of `origin/master`:

- The Wave 98 backlog (5 commits + tag `v2.19.3`) from the prior HANDOFF — still unpushed.
- Wave 99: commit `8c75e940` + tag `v2.20.0`.

Plus `e1d34d3a`, `b8666432` (landed this session).

---

## Open follow-ups carried forward

In `roadmap/follow-ups/`:
- `2026-05-19-wave-95-manual-smoke.md` — Wave 95 hands-on smoke walk for G/H (still outstanding)
- `2026-05-18-osc-11-read-allow.md`
- `2026-05-18-ansi-palette-tuning.md`
- `2026-05-16-wave-89-tool-bridge-runtime-smoke.md`
- `2026-05-16-wave-89-stacked-dock-integration-test.md`
- `2026-05-16-wave-89-dead-useWorkbenchCompare-hook.md`
- `2026-05-05-electron-renderer-browser-mcp-wiring.md`

In `roadmap/bugs/`:
- `2026-05-17-chatstatenewpath-dynamic-require-threadstore.md` — OPEN, medium
- `2026-05-17-silent-buildrepoindex-hang-post-graph-ready.md` — TRIAGED, medium
- `2026-05-15-e2e-teardown-hang.md` — Wave 93 carry-over

## Pre-existing uncommitted tree state (from W97/W98, still untouched)

```
M tools/__fixtures__/train-context/test-output-weights.json   (regenerated timestamps, no content change)
?? tools/__scratch__/sample.test.ts                            (scratch dir; needs .gitignore entry)
```

## Vendor patches in tree (unchanged)

`patches/addon-webgl-0.19.0.{original,patched}.{mjs,js}` — postinstall patcher for upstream PR #5883. Remove when `@xterm/addon-webgl >= 0.19.1` ships.

## Next session pickup

- **Coordinate Wave 100** — it's mid-flight uncommitted in the tree (chat-surface removal). Confirm with Cole before touching it.
- **Smoke Wave 99** once the tree is clean — confirm the dot surfaces render live.
- **Push backlog** when 2026-06-01 minutes restore (W98 5 commits + tag, W99 commit + tag, plus the two loose commits).
- Decide on the lingering pre-existing uncommitted fixture/scratch state.
