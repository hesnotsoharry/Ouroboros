---
status: SHIPPED
created: 2026-05-24
updated: 2026-05-24
---

# Wave 11 — Result Brief

## What shipped

Wave 11 closes Cole's 2026-05-23 smoke complaint "file click doesn't open a viewer modal" by wiring the canon file tree to the existing Wave 8 P3 modal infrastructure, behind the same default-off `layout.canonWorkbench` flag. **The wave also absorbed 6 inline hotfixes (Wave 10.1) for bugs that surfaced during Phase 0 manual smoke** — those bugs all pre-dated Wave 11 but were blocking any Phase 1 verification.

After this wave:

- Clicking any file row in the canon Workbench file tree (`Rails/WorkbenchFileTree.tsx`) opens `Overlays/WorkbenchFileViewerModal` showing the file's content via the lazy-loaded `FileViewer` (Monaco for text, binary fallback). Same modal the Ctrl-K / "Search files" picker already opens (Wave 8 P3 path).
- Directory rows still expand/collapse (no behavior change).
- The `WorkbenchFileViewerModal` lazy-load gotcha is preserved + now guarded by a regression test (`WorkbenchFileViewerModal.lazyLoad.regression.test.ts`) — `FileViewer` stays `React.lazy + Suspense`; future converts to static import will fail the test.
- **Wave 10 production bugs fixed (5):**
  - `canonWorkbenchSessions` startup crash on legacy Wave 9 flat-shape data (Conf schema validation; pre-Conf preflight cleanup)
  - `setActiveProjectRoot` silent no-op on recent-only paths (clicking a recents-only chip did nothing)
  - Title bar branch chip missing when project isn't a git repo (now shows "—" placeholder)
  - Popover background unreadable across 4 dropdown surfaces (`--glass-panel` 35% opacity → `--glass-overlay` 92%)
  - Project list now sorts alphabetically by name across all switcher surfaces (UX preference; active project flagged independently of position)
- **Wave 8 P3 carryover bug fixed (1):**
  - `useDiffReview must be used within DiffReviewProvider` crash at first file-click — `DiffReviewProvider` now mounts at `Workbench.tsx`'s return, wrapping `ActiveFrameProvider`. Was a pre-existing Wave 8 P3 gap (the canon modal mounted `FileViewer` directly to avoid legacy-shell listener collision; the legacy shell's `FileViewerManager` was what provided this context).

## Phase outcomes

| Phase | Planned scope | Actual outcome |
|---|---|---|
| **0 — Wave 10 smoke catch-up** | Live `/ui-smoke 10` (manual fallback per `manual-smoke-gate.md` since Preview MCP unavailable for Electron). Tier rules: HIGH/CRITICAL findings pause wave per D5. | **EXPANDED** to include 4 Wave 10.1 hotfix commits + 1 Wave 8 carryover. 5 distinct bugs caught + fixed inline before any Phase 1 work. Cole confirmed each fix live before next dispatch. |
| **1 — File-tree click → modal wiring** | `onSelectFile` prop chain from `Workbench.tsx` → `MiddleRow` → `InnerRail` → `FilesSection` → `WorkbenchFileTree` → `NodeRow`. 3 orchestrator-owned frozen tests. | **SHIPPED** as planned. 24 LOC across 3 files. `sonnet-implementer` dispatch first-try clean. Cole verified Gamify file-click → modal works live. UnifiedRail correctly skipped (uses `MOCK_FILE_TREE` via `ProjectAccordion` — Wave 12 scope). |
| **2 — Diagnose + fix scroll/collapse interactions** | Per D3: dispatch `sonnet-diagnostician` on "file tree partial when rail open / broken when collapsed" (Cole's HANDOFF.md:42 complaint). | **SHIPPED-by-explanation** — both halves of Cole's original complaint have natural explanations: "partial when rail open" was the stale-path issue (Cole renamed projects on disk; valid paths show full trees correctly — Gamify verified); "broken when collapsed" is `UnifiedRail` using `MOCK_FILE_TREE` (known Wave 12 scope, documented in `Workbench/CLAUDE.md`). No Phase 2 code work; explanation documented here + in HANDOFF. |
| **3 — Wave wrap** | Full suite + `/review` + `/audit-followups` + `/promote-vendor-lessons` + `/ui-smoke 11` + docs + tag. | **LEAN wrap per Cole's call**: scoped gates only (tsc both variants, eslint, prettier, targeted Workbench tests); skipped full suite + Stryker `/review` + formal `/ui-smoke 11` (Cole did extensive manual smoke throughout — 3 separate live verifications); skipped `/audit-followups` agent dispatch (known follow-ups documented inline below); `/promote-vendor-lessons 11` no-op (no third-party SDK touched). |

## Commits (master)

| Commit | Phase | One-line |
|---|---|---|
| `cacaef21` | Phase 0 / Wave 10.1 | `configPreflight` reset for legacy `canonWorkbenchSessions` shape (Conf crash fix) |
| `7c3842e7` | Phase 0 / Wave 10.1 | Project switching (3 surfaces) + branch chip + popover contrast (4 dropdowns) |
| `94ae90d3` | Phase 0 / Wave 10.1 | Workbench project list alphabetical sort |
| `0999e186` | Phase 1 | Wire file-tree click → modal (prop chain Workbench → InnerRail → tree) |
| `7fa7a0db` | Phase 1 follow-on | Mount `DiffReviewProvider` above lazy FileViewer (Wave 8 P3 carryover) |
| _(this wrap)_ | Phase 3 | Wave 11 plan/ADR/result/smoke-catchup + HANDOFF + temperature log |

## ADRs honored

| ADR | Outcome |
|---|---|
| **D1** — Click → modal via prop-chain callback, NOT new DOM event | Honored. `onSelectFile` threaded through `MiddleRow → InnerRail → FilesSection → WorkbenchFileTree → NodeRow`; `Workbench.tsx` passes `setOpenFilePath` (same reference threaded to `WorkbenchFilePicker`). No new DOM event. |
| **D2** — Defer keyboard nav / expand-all / M/A git badges | Honored. None of these landed; M/A badges remain at `2026-05-21-workbench-live-git-diff-stats.md`. |
| **D3** — Phase 2 dispatches `sonnet-diagnostician` BEFORE `sonnet-implementer` | Honored in spirit. The Phase 0 expanded scope used the same diagnose-first discipline for the Wave 10.1 bugs (`sonnet-diagnostician` returned the 3-bug verdict that drove the `sonnet-implementer` brief; DiffReview crash got its own `sonnet-diagnostician` dispatch returning 7 fix-shape candidates ranked, recommended #1). Phase 2's planned target dissolved (D3's "if diagnosis surfaces forceUnified shared cause" branch became moot when both complaints turned out to have non-bug explanations). |
| **D4** — `forceUnified` auto-clear OUT unless Phase 2 shows shared cause | Honored. Phase 2 SHIPPED-by-explanation; no shared cause found; `2026-05-22-workbench-forceunified-no-autoclear.md` remains OPEN. |
| **D5** — Phase 0 IS the deferred `/ui-smoke 10` (pre-implementation gate) | Honored — and the gate fired. CRITICAL Conf startup crash on Cole's first launch triggered the D5 escape hatch (Cole call → inline hotfix → continue smoke). Without D5 the wave would have built Phase 1 on top of a broken foundation. |
| **D6** — Inline Wave 10.1 hotfix decision | Honored. The 5 Wave 10 bugs + 1 Wave 8 P3 bug all landed via the inline-fix path per D6's "emerging best practice — inline when tiny + diagnosed + user available to verify." Cherry-picked to master throughout the session (vs all-at-wave-wrap) so Cole could verify each fix live. |

## Gates at wrap

| Gate | Result |
|---|---|
| Phase 1 orchestrator-owned acceptance test (`WorkbenchFileTree.fileClick`) | 3/3 (was 2/3 GREEN + 1/3 RED pre-implementation) |
| Phase 1 lazy-load regression guard (`WorkbenchFileViewerModal.lazyLoad`) | 3/3 (regression guard for the Wave 8 P3 gotcha) |
| Phase 1 InnerRail integration (`InnerRail.fileClick.integration`) | 2/2 (was 1/2 GREEN + 1/2 RED pre-implementation) |
| Wave 10.1 Conf preflight regression (`configPreflight`) | 14/14 (4 new + 10 pre-existing) |
| Wave 10.1 `setActiveProjectRoot` regression (`ProjectContext.setActiveProjectRoot.regression`) | 3/3 (RED pre-fix; GREEN post-fix) |
| Wave 10.1 sort regression (`useWorkbenchProjects.sort`) | 4/4 |
| Wave 10 acceptance regression preserved (`canonWorkbenchSessions.projectKeyed`, `Workbench.projectSwitch`, others) | 32/32 (no regression from any Wave 10.1 / Phase 1 change) |
| Full Workbench dir tests | 105/105 (post-DiffReview-mount refactor) |
| `tsc --noEmit` | CLEAN |
| `tsc -p tsconfig.web.json` | CLEAN (master); worktree has 5 pre-existing `@renderer/generated/changelog` errors unrelated to this wave (verified via stash before/after — see Lesson 2) |
| `eslint src/` (touched files) | 0 errors |
| `prettier --write` (touched files) | CLEAN |
| `/ui-smoke 11` (formal) | DEFERRED — Cole's extensive manual smoke throughout session covered all Wave 11-touched surfaces (file-click → modal verified live on Gamify; Wave 10.1 hotfixes each verified live before next dispatch). Lean-wrap call per Cole. |
| `/review` mechanical gap-check (incl. Stryker mutation Check 6) | DEFERRED to next session as Wave 11 verification follow-up. Heavy gate (Stryker can take 5-60 min); not required for ship correctness given the live-smoke discipline this session. |
| `/audit-followups wave-11-file-tree-viewer-modal` (formal agent dispatch) | DEFERRED to next session. Manual follow-up tracking documented inline below. |
| `/promote-vendor-lessons 11` | N/A — Wave 11 touched no third-party SDK. |

## Lessons / surprises

1. **The deferred-smoke pattern produced TEN bugs in one session (5 Wave 10 + 1 Wave 8 P3 + auto-discovered Wave 12 gaps).** Wave 10 shipped with 322/322 tests passing but Cole's first manual smoke surfaced 5 distinct production bugs that no test had caught (`canonWorkbenchSessions` startup crash, `setActiveProjectRoot` silent no-op, missing branch chip, popover contrast, missing sort UX). Wave 8 P3's deferred smoke meant the `DiffReview` crash sat undetected for ~10 days and only surfaced when Wave 11 P1 wired a second producer (file-tree clicks) into the same modal the picker also opened. **Tests passing is necessary but nowhere near sufficient.** The corrective measure — Wave 11 D5 demanding `/ui-smoke 10` as Phase 0 — worked exactly as designed: the gate fired on Cole's first launch and saved Wave 11 from building on a broken foundation. **For future waves: live smoke is a wave-end requirement, not a wave-end suggestion**, regardless of whether Cole is actively using the IDE day-to-day.

2. **Worktree-vs-master tsc:web divergence is a session-bg-isolation artifact, not a code issue.** The worktree (`C:\Web App\AgentIDE\.claude\worktrees\wave-11-plan`) lacks the `@renderer/generated/changelog` module that the master checkout has (build artifact, generated by an unspecified codegen step). Running `tsc -p tsconfig.web.json` from the worktree returns 5 errors against `Changelog/*` files; running from master returns 0 errors against the same code. Verified via `git stash` on master + re-running. **For future Wave 11+ work via bg-session worktrees: trust master's tsc:web verdict, not the worktree's.** Worth filing as a follow-up to either generate the module on `git worktree add` or document the divergence in the worktree-creation hook.

3. **Orchestrator-self-fix vs dispatch judgment held up under stress.** This session ran 3 sonnet-diagnostician dispatches (Wave 10 3-bug verdict + DiffReview crash verdict + the original Phase 2 scroll/collapse diagnosis that turned out not to be needed) and 1 sonnet-implementer dispatch (Phase 1 wiring). Each one returned tight findings + clear fix shapes that the orchestrator could verify-and-ship without re-investigation. The orchestrator-self-fix path was used for the trivial mechanical changes (popover token rename, refactor-to-fit-lint-cap, prop-chain Wave 10.1 fixes). The split-by-test ("4 self-fix criteria all hold? self-fix. Otherwise dispatch.") prevented over-dispatching trivial fixes AND prevented self-fixing things that needed investigation. The `executor-drift-nudge` hook fired 2x during the long edit chains; reviewing the criteria each time confirmed self-fix was warranted, and the hook nudge served as a useful checkpoint rather than a false alarm.

4. **Manual smoke fallback worked exactly as designed when Preview MCP couldn't launch Electron.** Per `manual-smoke-gate.md`, when agent-driven smoke can't launch (here: Preview MCP not wired for Electron in this session's MCP context), the fallback is manual smoke driven by the user. Cole walked through the Wave 10 smoke-report checklist (sections 1-6) section-by-section, pasted findings, orchestrator triaged + filed bugs + diagnosed + shipped fixes. Total session smoke effort: ~6 separate live-test cycles, each ~5-15 minutes. The model: agent-driven where possible, manual fallback where structurally required, never silently "deferred." This wave validated the fallback path in practice.

5. **Bug-attribution discipline matters when one wave inherits another's debt.** Three of the bugs caught this session originated in earlier waves (Conf crash = Wave 10 D1 implemented at wrong layer; DiffReview crash = Wave 8 P3 deferred smoke gap; sparse file tree = pre-existing UX gap exposed by Cole's rename). Cole's natural instinct on the rename ("I feel that should have been automatic") was the diagnosis — the "only 2 files" wasn't a Wave 10 bug, it was a stale-path UX gap that any project list would surface. Without that attribution work, every bug looks like "the last wave broke X" — and the corrective measures get aimed at the wrong target. **Lesson for future waves: when a wave's smoke surfaces a bug, the first question is "did this wave introduce it, or did this wave expose it?" — and the answer changes the fix scope.**

6. **Cherry-pick-from-worktree to master worked smoothly for 6 commits in a row** — but `git cherry-pick HEAD` from the worktree's path resolved to master's HEAD (an empty cherry-pick), requiring explicit SHA each time. **Procedural lesson: always cherry-pick by SHA, never by `HEAD`, when operating cross-worktree.** Happened twice this session.

## Process catches

- **Prettier-at-wrap on orchestrator-authored test files** (recurring from WB-6/8/9/10). All 4 orchestrator-authored test files (Wave 10.1 regression + 3 Phase 1 frozen tests) needed `prettier --write` after authoring — the `Write` tool doesn't go through prettier. Worth adding to a per-phase orchestrator-checklist or a hook that auto-formats test files after Write.

- **`max-lines-per-function: 40` repeatedly fires on tiny additive expansions.** TitleBar.tsx expansion for branch chip → needed `BranchSection` helper extraction. Workbench.tsx expansion for `DiffReviewProvider` mount → needed `WorkbenchStage` helper extraction. Both refactors were forced, not chosen — the wave doctrine is consistent (extract helpers to stay under the cap), but the friction is real. Could be: a per-file cap rather than per-function cap for top-level component functions, OR a documented "JSX component max-lines: 80" exception.

- **`git cherry-pick HEAD` from worktree path resolves to master's HEAD, not worktree's HEAD.** Surprised me twice. Always use explicit SHA when cherry-picking cross-worktree. Worth a hook nudge if this happens 3+ times.

## Carried forward (NOT closed by this wave)

**Wave 11 generated 1 new follow-up:**

- `roadmap/follow-ups/2026-05-24-workbench-project-crud-manual-and-auto-detect.md` (HIGH, OPEN, scheduled for Wave 12) — manual remove affordance + auto-detect stale paths. Cole's "I feel that should have been automatic" + "no way to remove" feedback. Bundled into Wave 12's "terminal CRUD + chrome" since it's the same shape of work.

**Wave 11 closed 1 follow-up:**

- `roadmap/follow-ups/2026-05-24-wave-10-canon-workbench-sessions-startup-crash.md` (RESOLVED in commit `cacaef21`)

**Pre-existing open follow-ups remaining:**

- `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md` (HIGH/OPEN, Wave 13 dependency) — main-process `CLAUDE_SESSION_ID` forwarding from pty spawn.
- `roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md` (LOW/OPEN) — collapse handle doesn't auto-clear on window widen. Per Wave 11 D4, not in scope this wave.
- `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (LOW/OPEN) — M/A git status badges in file tree (needs new main-process per-project dirty git op).
- `roadmap/follow-ups/2026-05-22-workbench-canon-product-decisions.md` (RESOLVED already; archival pending audit).

**Worth filing (not yet authored as follow-ups):**

- **Worktree tsc:web codegen gap** (low) — bg-session worktrees lack `@renderer/generated/changelog`. Either generate on `git worktree add` or document in the worktree hook.
- **Wave 11 `/review` + `/ui-smoke 11` deferral** (medium) — formal `/review` mechanical gap-check (incl. Stryker mutation Check 6) deferred to next session. Should run as a Wave 11 verification follow-up.

## Push posture

- All 6 wave commits pushed to `origin/master` throughout the session (incremental cherry-pick-and-push, not all-at-wave-wrap). Per bulletin: pushing IS sanctioned during this window; protected-branch merges wait for 2026-06-01 CI minute restore. The incremental shipping let Cole verify each fix live before the next dispatch — same model the Wave 10.1 hotfix path established.
- This wrap commit (plan/ADR/result/smoke-catchup/HANDOFF/temperature log) pushed at wrap.
- Tag `v2.32.0` on origin (minor bump — file-tree click-to-open is new user-facing behavior; Wave 10.1 hotfixes are bundled in the same version per the workbench-wave convention of one tag per wave).

## Session metadata (informational)

- Session duration: ~6 hours (extensive due to bug-fix cycles).
- Bugs caught + fixed inline: 6 (5 Wave 10 + 1 Wave 8 P3).
- Inline hotfix commits: 5 (separate from the Phase 1 feature commit).
- Dispatches: 3 sonnet-diagnostician (3-bug verdict, DiffReview crash, would-have-been-Phase-2), 1 sonnet-implementer (Phase 1 wiring), 1 haiku-explorer batch (Phase 1 grounding).
- Cole live-smoke cycles: 6 separate verifications (initial Wave 10 sections 1-6 walk, Wave 10.1 batch 2 verify, sort UX verify, Section 5 attempt, Phase 1 file-click verify, DiffReview fix verify).
- D5 gate fired: yes — Conf crash on first launch paused Wave 11 implementation pending Cole's go/no-go for inline hotfix. Worked exactly as designed.
