---
status: IN-PROGRESS
created: 2026-05-24
updated: 2026-05-24
---

# Wave 11 — File Tree + Viewer Modal

## Context

Wave 10 (`v2.31.0`, shipped 2026-05-23) landed the project-scoped state foundation and project-switching wiring, and shipped with `/ui-smoke 10` deferred — documented as "the painful honest finding" of the wave with an explicit note that the Wave 11 session must run the smoke as its very first action. This wave honors that obligation (Phase 0) and then closes two of Cole's specific 2026-05-23 smoke complaints (HANDOFF.md:42, verbatim): **"file tree partial when rail open / broken when collapsed; file click doesn't open a viewer modal."** Both complaints sit on the canon Workbench surfaces Wave 8 P2/P3 created; the underlying infrastructure (file tree component + lazy-loaded file viewer modal) already exists; Wave 11's job is wiring + bug-fix, not new components.

**Grounding (confirmed via parallel haiku-explorer pass 2026-05-24):**
- `src/renderer/components/Workbench/Rails/WorkbenchFileTree.tsx:80-95` — directory rows have `onClick` (toggle expand/collapse); **file rows are display-only** (no onClick). The Wave 11 primary wiring gap is right here.
- `src/renderer/components/Workbench/Rails/useWorkbenchFileTree.ts:1-195` — returns `{ nodes, isLoading, error, toggleDir }`; `expandedDirs` map carries collapse state; lazy IPC-driven child loading via `window.electronAPI.files.readDirSorted`.
- `src/renderer/components/Workbench/Overlays/WorkbenchFileViewerModal.tsx:1-287` — `({ openFilePath, onClose })` prop API; `openFilePath: null` returns `null` (modal closed); current trigger is **lifted state** in `Workbench.tsx:138`, set by `WorkbenchFilePicker`'s `onSelectFile` callback (line 166). **Already mounted; just needs a second producer (the tree).**
- `src/renderer/components/Workbench/Overlays/WorkbenchFileViewerModal.tsx:24-30` — the load-bearing lazy-load pattern (the Workbench/CLAUDE.md gotcha): `const FileViewer = React.lazy(() => import('../../FileViewer/FileViewer').then((m) => ({ default: m.FileViewer })))`. Static import would crash all Workbench tests at module-init (Monaco + pdfjs touch browser APIs jsdom lacks). **Do NOT convert to static import.**
- `src/renderer/components/Workbench/Overlays/useWorkbenchFileLoad.ts:1-133` — load hook with token-based race guard (line 76-87); text/binary fallback via `files.readFile` + `files.readBinaryFile`; save via `files.saveFile`. Wave 11 doesn't modify this.
- `src/renderer/components/Workbench/Workbench.tsx:138,167-170` — `openFilePath` state lifted; modal mounted; `setOpenFilePath` already threaded to `WorkbenchFilePicker`. The Wave 11 plumbing extends the same `setOpenFilePath` reference one more chain down to the tree.
- `src/renderer/components/Workbench/Rails/InnerRail.tsx:289-297` (`FilesSection`) — scroll container is `<div style={{ flex: 1, padding: '10px 6px', overflowY: 'auto', minHeight: 0 }}>` — `minHeight: 0` IS present (the standard flexbox-scroll fix). The "partial when rail open" complaint is NOT a missing-minHeight issue at this layer.
- `src/renderer/components/Workbench/Workbench/CLAUDE.md:344-357` — the lazy-load gotcha documented in full (verbatim above).
- `src/renderer/components/Workbench/Rails/UnifiedRail.tsx` (location TBD by Phase 2 read) — the responsive-collapse variant (Wave 6); Cole's "broken when collapsed" complaint may fire here rather than in `InnerRail`. Phase 2 diagnosis reads both.

**Companion items (pre-existing OPEN follow-ups):**
- `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (LOW/OPEN) — M/A git-status badges in the tree. Out of Wave 11 scope per D2 (needs a new main-process per-project dirty git op).
- `roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md` (LOW/OPEN) — `forceUnified` flag doesn't clear on window-widen. Out of Wave 11 scope per D4 unless Phase 2 diagnosis identifies it as the same root cause as "broken when collapsed."
- `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md` (HIGH/OPEN) — Wave 13 dependency, not Wave 11.

## Goal

After this wave: clicking any file row in the canon Workbench file tree opens the lazy-loaded FileViewer modal showing that file's content (text via Monaco, binary via the existing binary path) — same modal the Ctrl-K / "Search files" picker already opens. The "partial when rail open" and "broken when collapsed" file-tree render bugs Cole surfaced on 2026-05-23 are diagnosed to root cause and fixed (or, if the diagnosis surfaces them as in-flight Wave 12 territory, explicitly escalated to Cole with the diagnosis attached). Wave 10's smoke debt is closed (Phase 0). The lazy-load gotcha is preserved — `WorkbenchFileViewerModal` continues to import `FileViewer` via `React.lazy` + `<Suspense>`; static-import regression is prevented by a unit guard. The `layout.canonWorkbench` flag still gates canon vs legacy; no new IPC; no schema change.

## Locked decisions (Phase 0 — ADR)

See `roadmap/wave-11-file-tree-viewer-modal/wave-11-decisions.md` for the full ADR:

1. **D1 — File-tree click → modal open via prop-chain callback, NOT a new DOM CustomEvent.** Matches Wave 8 P3's existing picker→modal pattern; prop-chain is 4-5 hops, all already mounted. *(locked 2026-05-24)*
2. **D2 — Defer keyboard navigation, expand-all/collapse-all, M/A git-status badges.** Wave 11 closes specific Cole complaints, not generalized polish; M/A badges remain at `2026-05-21-workbench-live-git-diff-stats.md`. *(locked 2026-05-24)*
3. **D3 — Phase 2 dispatches `sonnet-diagnostician` BEFORE `sonnet-implementer`.** "Partial when rail open / broken when collapsed" is vaguely-specified; per `~/.claude/rules/development-pipeline.md` Lane B B1 the cause must be diagnosed before fix. Phase 2 is two-step. *(locked 2026-05-24)*
4. **D4 — `forceUnified` auto-clear bug is OUT of Wave 11 scope** unless Phase 2 diagnosis identifies it as the same root cause. Conditional resolution via D3's diagnostician verdict. *(locked 2026-05-24)*
5. **D5 — Wave 11 Phase 0 is the deferred `/ui-smoke 10` catch-up.** Wave 10 shipped with smoke deferred; the obligation lands here as a pre-implementation gate. Phase 0 surfacing HIGH/CRITICAL Wave 10 bugs pauses Wave 11 implementation pending Cole's go/no-go. *(locked 2026-05-24)*

## Scope

**In scope:**
- **Phase 0:** `/ui-smoke 10` agent-driven smoke (Wave 10's deferred obligation) against the running canon Workbench with `layout.canonWorkbench` enabled. Smoke covers: outer-rail chip click switches project; title-bar dropdown opens + commits + closes; inner-rail dropdown same; branch dropdown opens + lists + checks out; AddProject opens picker + adds; Layout button responds; Profile button opens placeholder menu; terminals teardown + respawn on project switch; per-project restore preserved across relaunch. Report appended to `roadmap/wave-10-project-scoped-state-foundation/wave-10-smoke-report.md` with the catch-up date stamp.
- **Phase 1:** Wire file-tree row click → modal open. Add `onSelectFile?: (path: string) => void` prop to `WorkbenchFileTree`. Add `onClick={() => props.onSelectFile?.(node.path)}` on file rows (NOT directory rows — those keep their existing expand/collapse onClick). Thread the callback up through `FilesSection` → `InnerRail` → `MiddleRow` → `Workbench.tsx`. `Workbench.tsx` passes `setOpenFilePath` as the same callback it already gives `WorkbenchFilePicker`. Verify by orchestrator-owned acceptance test: `WorkbenchFileTree.fileClick.acceptance.test.tsx` (file row click fires `onSelectFile` with the file's path; directory row click does NOT fire `onSelectFile`). Verify lazy-load stays intact by a regression test: import `WorkbenchFileViewerModal` source, assert the FileViewer reference is a `React.lazy` result (NOT a top-level imported component). Verify end-to-end by an integration test that mounts `<Workbench>` with the canon flag, simulates a file click in the tree, asserts the modal mounts with the right `openFilePath`.
- **Phase 2:** Diagnose + fix scroll/collapse interactions. Two-step:
  - **2a (diagnose).** Dispatch `sonnet-diagnostician` with the live reproduction context (Wave 10 just shipped + Phase 0 smoke result + Cole's exact complaints). Diagnostician reproduces in `npm run dev` with the canon flag on, observes both rail-open and rail-collapsed states, returns: (i) root cause(s) of "file tree partial when rail open"; (ii) root cause(s) of "file tree broken when collapsed"; (iii) proposed fix shape per cause; (iv) scope estimate per fix. Output written to `roadmap/wave-11-file-tree-viewer-modal/wave-11-diagnosis.md`.
  - **2b (fix).** Orchestrator reads diagnosis. For each in-bounds root cause: author a failing regression test (shape per diagnosis — likely a Workbench-render integration test asserting the file tree IS visible / IS scrollable in both rail states). Dispatch `sonnet-implementer` with diagnosis-as-brief + failing test paths. If diagnosis surfaces shared root cause with `forceUnified-no-autoclear` per D4, expand scope inline and close that follow-up too. If diagnosis surfaces out-of-bounds work (e.g., a Wave 12 prerequisite), Tier 3 follow-up + Cole call.
- **Phase 3:** Wave wrap. Full `npx vitest run`; full `eslint src/`; `tsc --noEmit` + `tsc -p tsconfig.web.json` BOTH clean (Wave 9/10 friction pattern); prettier on wave-touched files; `/review` mechanical gap-check; `/audit-followups wave-11-file-tree-viewer-modal` (`forceUnified-no-autoclear` may close per D4; `live-git-diff-stats` stays open per D2; `claudeSessionId-binding-precision` stays open as Wave 13); `/promote-vendor-lessons 11` (no-op expected — no third-party SDK touched); `/ui-smoke 11` agent-driven LIVE — Cole is interactively available; the Wave 10 deferred-smoke pattern is not repeated. Update `roadmap/HANDOFF.md` next-action to Wave 12. Append to `roadmap/wave-temperature-log.md`. Flip plan + ADR status to SHIPPED. Commit + push to `origin/master`. Tag `v2.32.0` on origin.

**Out of scope:**
- Keyboard navigation in the file tree (up/down arrows, Enter/Space to expand) → no scheduled wave; open enhancement.
- Expand-all / collapse-all affordance → no scheduled wave; open enhancement.
- M/A git-status badges in the tree → `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (needs new main-process per-project dirty git op).
- File-tree context menu (right-click → rename / delete / new file / reveal in OS) → no scheduled wave; open enhancement.
- Multi-file viewer / tabbed modal → Wave 11 ships single-file modal (matches existing FilePicker behavior).
- Drag-and-drop reorder → not a canon design feature; out.
- Right-panel binding to `useActiveWorkbenchFrame` → Wave 13.
- Terminal CRUD → Wave 12.
- Status bar real values → Wave 14.
- Wave 15 cutover (delete legacy shell) — still blocked on Waves 11–14 shipping.
- `claudeSessionId-binding-precision` (HIGH/OPEN) → Wave 13 (main-process scope).
- `forceUnified` auto-clear → conditional per D4 (in-scope only if Phase 2 diagnosis shows shared root cause).

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | `/ui-smoke 10` catch-up (Wave 10's deferred obligation) **+ Wave 10.1 inline hotfix (D6)** | `orchestrator` | **Pre-implementation gate.** Dispatch `sonnet-smoke-runner` against running `npm run dev` instance with `layout.canonWorkbench` enabled. Smoke targets: see Scope §Phase 0. Append catch-up report to `roadmap/wave-10-project-scoped-state-foundation/wave-10-smoke-report.md` (don't overwrite the deferred entry — chain a `## 2026-05-24 Catch-up` section). Tier rules: any HIGH/CRITICAL finding → pause Wave 11, file follow-up, Cole call. LOW/MEDIUM findings → log in catch-up report, proceed to Phase 1, surface at wrap. **2026-05-24 actual:** Preview MCP unavailable for Electron → manual smoke; Cole's first launch produced a CRITICAL Conf-schema startup crash on Wave 9 legacy `canonWorkbenchSessions` data (`'upper' in obj || 'lower' in obj` shape failing the new `Record<projectRoot, ...>` schema at `Conf._validate`); Cole signed off on inline hotfix per D6. Hotfix: `src/main/configPreflight.ts` extended with `resetLegacyCanonWorkbenchSessions` + 4 tests in `configPreflight.test.ts`. Resolved follow-up filed at `roadmap/follow-ups/2026-05-24-wave-10-canon-workbench-sessions-startup-crash.md`. Hotfix commit cherry-picked to master + pushed (so Cole's `git pull && npm run dev` picks it up without switching branches). Smoke resumes against the relaunched IDE. Test shape: **trophy** (the hotfix has co-located unit + preflight-integration tests; smoke is live verification). |
| 1 | Wire file-tree row click → modal open | `sonnet-implementer` | **NOT a boundary phase** (no IPC, no schema, no cross-package, no persistent storage). Orchestrator authors three failing tests pre-dispatch (frozen — implementer may not modify): (a) `WorkbenchFileTree.fileClick.acceptance.test.tsx` — render tree with mock `onSelectFile`, click file row, assert callback fired with path; click directory row, assert callback NOT fired (directory keeps its toggle behavior); (b) `WorkbenchFileViewerModal.lazyLoad.regression.test.ts` — import the modal's module source as a string (or use a vitest module-graph assertion), assert `import('../../FileViewer/FileViewer')` is wrapped in `React.lazy` (regression guard for the load-bearing lazy-load gotcha); (c) `Workbench.fileTreeOpensModal.integration.test.tsx` — mount `<Workbench>` with canon flag, render with mock file tree, simulate file-row click, assert `WorkbenchFileViewerModal` receives non-null `openFilePath`. Implementer task: add `onSelectFile` prop to `WorkbenchFileTree`; add `onClick` to file rows (line 80-95 of WorkbenchFileTree.tsx); thread callback up `FilesSection` → `InnerRail` → `MiddleRow` → `Workbench.tsx` (replace its existing `setOpenFilePath` reference being threaded one more level down). NO modification to `WorkbenchFileViewerModal` or `useWorkbenchFileLoad`. `sonnet-phase-reviewer` PASS NOT required (not boundary, not conceptually-risky — established prop-callback pattern from Wave 8 P3). Test shape: **trophy** (UI-heavy; type checker + integration test + per-component render test). |
| 2 | Diagnose + fix scroll/collapse interactions | `sonnet-diagnostician` → `sonnet-implementer` | **Two-step phase per D3.** Step 2a: dispatch `sonnet-diagnostician` with brief: "Cole reported '*file tree partial when rail open / broken when collapsed*' in 2026-05-23 smoke. Reproduce in `npm run dev` with `layout.canonWorkbench` enabled. Read `Rails/InnerRail.tsx` (dual-rail file-tree mount, lines 289-297), `Rails/UnifiedRail.tsx` (responsive-collapse variant), `Rails/WorkbenchFileTree.tsx` + `useWorkbenchFileTree.ts`. Return diagnosis: (i) root cause of partial-when-rail-open; (ii) root cause of broken-when-collapsed; (iii) proposed fix shape per cause; (iv) scope estimate per fix; (v) note if either shares root cause with `forceUnified-no-autoclear` (per Wave 11 D4)." Write diagnosis to `roadmap/wave-11-file-tree-viewer-modal/wave-11-diagnosis.md`. Step 2b: orchestrator reads diagnosis, authors failing regression test(s) keyed to the diagnosed causes (test shape: integration render of `<Workbench>` in the affected rail state, asserting the file tree IS visible AND IS scrollable — exact assertions per diagnosis), dispatches `sonnet-implementer` with diagnosis-as-brief + failing test paths. If diagnosis surfaces forceUnified shared cause, scope expansion is approved in-flight (D4 exception). If diagnosis surfaces Wave 12 prerequisite or other out-of-scope work, Tier 3 follow-up + Cole call before continuing. `sonnet-phase-reviewer` PASS REQUIRED (conceptually-risky — diagnosis-driven fix where the implementer's mental model could diverge from the diagnosis). Test shape: **pyramid or trophy** (depends on diagnosis — pure CSS fix = pyramid via Workbench render test; state-management fix = trophy with broader integration). |
| 3 | Wave wrap | `orchestrator` | Full `npx vitest run` green; full `eslint src/` 0 errors; `tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean (run BOTH explicitly — Wave 9/10 friction pattern); prettier clean on wave-touched files INCLUDING any orchestrator-authored test files (Wave 10 lesson 5 — orchestrator's Write tool doesn't go through prettier); `/review` mechanical gap-check (verdict gates merge — PASS or FLAG-with-flags-addressed); `/audit-followups wave-11-file-tree-viewer-modal` (expected closures: `forceUnified-no-autoclear` IF Phase 2 fixed it per D4; otherwise no closures — `claudeSessionId-binding-precision` is Wave 13, `live-git-diff-stats` is out per D2); `/promote-vendor-lessons 11` (no-op expected — Wave 11 touches no third-party SDK); `/ui-smoke 11` agent-driven LIVE (NOT deferred — Cole is interactively available; the Wave 10 pattern is corrected here); smoke targets: file-row click in canon tree opens modal showing the file content; file rows in unified-rail collapsed state are clickable; the previously-broken render states are confirmed fixed per Phase 2 diagnosis; lazy-load regression test passes (no Monaco in shell module graph); modal close + reopen works cleanly. Report at `roadmap/wave-11-file-tree-viewer-modal/wave-11-smoke-report.md`. Update `roadmap/HANDOFF.md` next-action to Wave 12. Append entry to `roadmap/wave-temperature-log.md`. Flip plan + ADR status to SHIPPED. Commit + push to `origin/master`. Tag `v2.32.0` on origin (minor bump — file-tree click-to-open is new user-facing behavior). |

## Phase ordering

```
Phase 0 (smoke 10 catch-up) ──► [HIGH? pause + Cole] ──► Phase 1 (wire click→modal) ──► Phase 2 (diagnose + fix) ──► Phase 3 (wrap)
                                                                                                            │
                                                                              [2a diagnose] ──► [2b fix]
```

Strictly linear at the wave level. Phase 0 may pause the wave on HIGH/CRITICAL Wave 10 findings (Cole call). Phase 2 internal sequencing is diagnostician-then-implementer; the orchestrator authors the failing test between substeps. No parallelization opportunity — each phase consumes the prior phase's verified output.

## Risks

| Risk | Mitigation |
|---|---|
| **Phase 0 smoke surfaces a HIGH Wave 10 bug** that blocks Wave 11 work (e.g., project switch doesn't actually fire `setActiveProjectRoot`, so file-tree's `projectRoot` prop never changes — Wave 11's "cross-project browse" intent is undermined). | Phase 0 gate IS exactly this: HIGH/CRITICAL → pause Wave 11, file follow-up, Cole call. The cost of pausing is the planning cycle for a Wave 10.1; the cost of NOT pausing is Wave 11 work fighting an unstable foundation. Smoke runs first specifically to surface this. |
| **Phase 2 diagnosis is wrong** — diagnostician produces a plausible-sounding root cause that's actually not the cause; implementer ships a fix that doesn't close Cole's complaint. | Orchestrator-owned failing regression test in 2b is keyed to the SYMPTOM (file tree visible + scrollable in collapsed rail), not the cause. If the implementer's fix passes the cause-driven internal tests but fails the symptom test, the diagnosis was wrong and Phase 2 loops back to 2a. `sonnet-phase-reviewer` PASS required adds a structural integrity check. |
| **Lazy-load regression** — implementer pattern-matches on Wave 8 P3's "extract a helper for the tree click" and accidentally converts the FileViewer import to top-level (the exact regression Wave 8 P3 had + fixed). | Phase 1's orchestrator-owned regression test (test b) is exactly this guard. Test asserts `React.lazy` wrapping is present in the modal's module source. Implementer cannot modify the test. The `Workbench/CLAUDE.md` gotcha is also reinforced via the Phase 1 implementer brief's explicit "DO NOT touch `WorkbenchFileViewerModal`" instruction. |
| **Phase 1's prop-chain ripples through more files than expected** — `FilesSection` may be deeply nested or have multiple call sites; the click callback may need to thread through components the implementer hasn't surveyed. | Phase 1 brief includes the explicit prop-chain hop list (`Workbench.tsx` → `MiddleRow` → `LeftRails` → `InnerRail` → `FilesSection` → `WorkbenchFileTree`). If implementer surfaces additional hops (e.g., `FilesSection` is also rendered inside `UnifiedRail` for the collapsed variant), that's expected — same callback threads through both rail mounts. Acceptance test (c) covers both rail variants if `UnifiedRail` is in the test setup. |
| **Phase 2 diagnosis surfaces "the canon FileTree doesn't mount at all in the unified collapsed rail" — meaning the symptom isn't "broken render" but "not rendered."** | This is a real possibility (UnifiedRail was built in Wave 6 with `MOCK_FILE_TREE` originally; Wave 8 P2 replaced the dual-rail mount only; UnifiedRail's file-tree section may still be a Wave-6-era mock or absent). If diagnosis finds this, scope expands: Phase 2 also wires `WorkbenchFileTree` into `UnifiedRail`'s files section. This is in-bounds per the symptom but expands Phase 2 work; orchestrator surfaces in commit body + result brief. |
| **`useWorkbenchFileTree`'s `expandedDirs` state gets lost across rail variant switches** — if the user has dirs expanded in dual-rail, then widens the window into compact mode (still dual-rail) vs narrows into unified mode (different React tree), the expand state may reset. | Phase 2 diagnosis names this if it's the cause; the fix lives in moving `expandedDirs` up to a context or lifting it to `Workbench.tsx` keyed by `projectRoot` (Wave 10's per-project remount means it ties cleanly to project switch). Out-of-scope: persisting expand state to electron-store across IDE restarts (would be a Wave 14+ polish — current ephemeral is acceptable). |
| **Orchestrator-authored Phase 1 tests fail prettier at wrap** (Wave 10 process catch #5). | Phase 3 wrap explicitly runs `prettier --write` on orchestrator-authored test files BEFORE final lint. Or: orchestrator runs `npx prettier --write` on each authored test file immediately after writing. Both are cheap; pick one and do it. |
| **`/ui-smoke 11` smoke depends on running `npm run dev`** — if the Electron dev instance crashes on launch (Wave 10's project-switch + Wave 11's tree changes together may surface a startup issue not seen in tests). | Phase 0's smoke would have caught a Wave 10 startup issue. Phase 3's smoke catches a Wave 11 startup issue. Both are run live. If startup itself is broken, that's a HIGH bug surfaced before merge — no different from Phase 0 surfacing HIGH bugs. |
| **`forceUnified-no-autoclear` shared root cause** — D4's conditional expansion fires; Phase 2 scope grows. | Acceptable per D4. The fix is small (auto-clear forceUnified when the window's natural breakpoint returns to full/compact). Orchestrator approves in-flight; folds into Phase 2 commit; closes the follow-up at Phase 3 audit. If the fix is NOT small (e.g., requires reworking the breakpoint hook), file as Tier 3 instead and keep Wave 11 to the narrower scope. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a — smoke only | n/a — smoke only | **Smoke only.** Live `npm run dev` + browser MCP. Report shape per `~/.claude/agents/sonnet-smoke-runner.md`. |
| 1 | `WorkbenchFileTree.fileClick.acceptance.test.tsx` (file row vs directory row callback fire); `WorkbenchFileViewerModal.lazyLoad.regression.test.ts` (module source assertion). | `Workbench.fileTreeOpensModal.integration.test.tsx` — mount Workbench, click file row, assert modal mounts with right path. | **Trophy.** UI-heavy + integration carries the wire contract + manual smoke at Phase 3. All three tests are orchestrator-owned (frozen) and authored RED before Phase 1 dispatch. |
| 2 | Per-cause regression test (shape per diagnosis — likely a pure DOM-render assertion that the file tree is visible in collapsed rail state). | Workbench-level integration test asserting the previously-broken render states render correctly + scroll correctly. | **Pyramid or Trophy.** Depends on diagnosis. CSS-only fix = pyramid (small DOM test suffices). State-management fix = trophy (broader integration test needed). Orchestrator-owned regression test authored against diagnosis output. |
| 3 | n/a — wrap | Full `npx vitest run` + `/review` mechanical gap-check + `/ui-smoke 11` agent-driven live. | **Full wave-end gates.** |

## Acceptance criteria

- [ ] `/ui-smoke 10` catch-up report appended at `roadmap/wave-10-project-scoped-state-foundation/wave-10-smoke-report.md` (Phase 0); no unresolved HIGH/CRITICAL Wave 10 findings or, if present, surfaced + Cole-acknowledged before Phase 1.
- [ ] `WorkbenchFileTree` exports the same component name with an additional optional prop `onSelectFile?: (path: string) => void`; existing call sites that don't pass it continue to compile (TypeScript optional prop).
- [ ] File rows in `WorkbenchFileTree` (`node.type !== 'dir'`) call `props.onSelectFile?.(node.path)` on `onClick`; directory rows continue to call `toggleDir` (no behavior change for directories).
- [ ] `FilesSection` (in `InnerRail`) accepts `onSelectFile` as a prop and threads it to `WorkbenchFileTree`.
- [ ] `InnerRail` accepts `onSelectFile` as a prop and threads it to `FilesSection`. (Same if rendered inside `UnifiedRail`.)
- [ ] `Workbench.tsx` passes `setOpenFilePath` as the `onSelectFile` reference through the prop chain (same reference it already passes to `WorkbenchFilePicker.onSelectFile`).
- [ ] `WorkbenchFileViewerModal` source still imports `FileViewer` via `React.lazy(() => import('../../FileViewer/FileViewer').then(...))` (no static-import regression).
- [ ] `WorkbenchFileTree.fileClick.acceptance.test.tsx` exists, RED pre-Phase-1, GREEN post-Phase-1, frozen.
- [ ] `WorkbenchFileViewerModal.lazyLoad.regression.test.ts` exists, GREEN (asserts lazy-import pattern preserved); regression-guards future refactors.
- [ ] `Workbench.fileTreeOpensModal.integration.test.tsx` exists, RED pre-Phase-1, GREEN post-Phase-1, frozen.
- [ ] `roadmap/wave-11-file-tree-viewer-modal/wave-11-diagnosis.md` exists (Phase 2a output) — names root cause(s) of "partial when rail open" and "broken when collapsed" with file:line evidence.
- [ ] Phase 2b regression test(s) exist, RED pre-Phase-2b, GREEN post-Phase-2b, frozen — assert the symptom (tree visible + scrollable in both rail states) not just the cause.
- [ ] In a live `npm run dev` instance with `layout.canonWorkbench` on, the file tree renders correctly in dual-rail open state, dual-rail compact state, AND unified-rail collapsed state; file rows are clickable in all three states and open the modal showing the file content.
- [ ] Either: `roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md` is marked RESOLVED by `/audit-followups` (D4 shared root cause); OR it remains OPEN with a note in the wave-11 result brief that Phase 2 diagnosis confirmed it as unrelated.
- [ ] `/ui-smoke 11` LIVE smoke runs at wrap (NOT deferred); report at `roadmap/wave-11-file-tree-viewer-modal/wave-11-smoke-report.md`; covers file-row click in all three rail states; modal open + close; lazy-load preserved (Monaco doesn't load until modal opens — verifiable via DevTools network tab in smoke session).
- [ ] Full `npx vitest run` green; `tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean; `eslint src/` 0 errors; prettier clean on all wave-touched files (incl. orchestrator-authored tests).
- [ ] `/review` mechanical gap-check returns PASS or FLAG-with-flags-addressed.
- [ ] `roadmap/HANDOFF.md` next-action updated to Wave 12; `roadmap/wave-temperature-log.md` appended; this plan + ADR flipped to `status: SHIPPED`.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | The running `npm run dev` Electron instance with `layout.canonWorkbench` enabled, exercising Wave 10's project-switching surfaces | smoke-runner navigates outer rail → click project chip → observe terminal teardown + respawn; click title bar dropdown → observe list + selection; click inner rail dropdown → observe same; click branch dropdown → observe branch list + checkout; click "+" → observe directory picker; click Layout + Profile → observe stubs | Project switching works across all three surfaces; terminals teardown + respawn; the previously-running session restores under the previously-active project on next switch-back. No HIGH/CRITICAL findings. (If found: pause + Cole call.) |
| 1 | The same running Workbench, with the file tree visible in InnerRail's FilesSection | App boots → InnerRail mounts → `WorkbenchFileTree` renders file tree (one click into a directory expands it, visible in tree). Cole clicks a file row → `props.onSelectFile(path)` fires → `Workbench.setOpenFilePath(path)` → `openFilePath` non-null → `WorkbenchFileViewerModal` mounts → React.lazy resolves `FileViewer` → Monaco loads (first time) → file content renders | The modal opens within ~1 second of the click (Monaco lazy-load latency on first open; subsequent opens are instant). The file's content is visible in Monaco with syntax highlighting. Close → reopen on a different file → that file's content shows. Directory click continues to expand/collapse (no double-handle bug). |
| 2 | The same running Workbench, in BOTH dual-rail-open AND unified-rail-collapsed states (drag the window narrower to trigger UnifiedRail per Wave 6's responsive breakpoint at 1440px) | Per diagnosis. Likely: tree renders in collapsed rail (currently it doesn't, or renders partially); tree scrolls when contents exceed visible height (currently it may not scroll or may clip); expand state preserved or correctly reset on rail switch (per diagnosis verdict). | The previously-broken render states render correctly. Tree is visible. Tree scrolls. File-row clicks open the modal in both rail states. Specific "working" criteria are written against Phase 2a's diagnosis output. |
| 3 | The same running Workbench through the full `/ui-smoke 11` checklist | smoke runner navigates the file-tree + modal surfaces, captures screenshots + console + network state | All Wave 11 smoke scenarios PASS or document ACCEPTED-AS-IS per the smoke-report template; no Monaco bundle in initial network load (lazy-load gotcha preserved — Monaco chunks only appear on first modal open). |

### Data-shape probes

```ts
// Phase 1 — orchestrator runs at wrap:
//   npx vitest run src/renderer/components/Workbench/Rails/WorkbenchFileTree.fileClick.acceptance.test.tsx
//   npx vitest run src/renderer/components/Workbench/Overlays/WorkbenchFileViewerModal.lazyLoad.regression.test.ts
//   npx vitest run src/renderer/components/Workbench/Workbench.fileTreeOpensModal.integration.test.tsx
// Asserts: file-row click fires onSelectFile(path); directory-row click does NOT; lazy import wrapper preserved;
//   full Workbench mount + file-click → modal opens with right openFilePath.

// Phase 2 — orchestrator runs at wrap (test paths per diagnosis):
//   npx vitest run <Phase 2 regression test path>
// Asserts: per diagnosis verdict — tree visible + scrollable in collapsed rail state, etc.
```

```bash
# After wave wrap — runtime smoke probes (manual, from running IDE DevTools console):
# Verify lazy-load gotcha — Monaco should NOT be in the initial bundle.
performance.getEntriesByType('resource').filter(r => r.name.includes('monaco')).length
// Expected on app boot: 0
// Expected after opening the modal for the first time: > 0 (Monaco chunks loaded on first lazy-import resolve)

# Verify file tree mount in canon Workbench:
document.querySelector('[data-testid="workbench-file-tree"]')
// or whatever the canon test-id is — verify the tree DOM node exists
# Click a file row programmatically:
document.querySelector('[data-testid="workbench-file-tree-row-file"]').click()
// Expected: WorkbenchFileViewerModal opens
```

## Files the next agent should read first

1. `roadmap/wave-11-file-tree-viewer-modal/wave-11-decisions.md` — locked ADR (D1–D5).
2. `roadmap/wave-10-project-scoped-state-foundation/wave-10-result.md` — Wave 10's lessons (esp. lesson 5 — deferred smoke; lesson 2 — orchestrator-mock-surface drift; lesson 4 — `hasSpawnedRef` invariant Wave 11 must NOT break in the unrelated InnerRail-prop-thread).
3. `roadmap/wave-10-project-scoped-state-foundation/wave-10-smoke-report.md` — context for Phase 0's catch-up.
4. `roadmap/wave-10-project-scoped-state-foundation/waveplan-10.md` — exemplar for the canonical wave-plan shape (this plan mirrors it).
5. `roadmap/HANDOFF.md:42` — Cole's verbatim smoke complaint (Wave 11's load-bearing user input).
6. `src/renderer/components/Workbench/Rails/WorkbenchFileTree.tsx:80-95` — Phase 1 primary edit site (file rows lack onClick).
7. `src/renderer/components/Workbench/Rails/useWorkbenchFileTree.ts:1-195` — data hook; Phase 1 does NOT modify; Phase 2 may, depending on diagnosis.
8. `src/renderer/components/Workbench/Overlays/WorkbenchFileViewerModal.tsx:24-30` — the load-bearing lazy-load pattern (DO NOT TOUCH).
9. `src/renderer/components/Workbench/Overlays/useWorkbenchFileLoad.ts` — load hook; reference only; Wave 11 does NOT modify.
10. `src/renderer/components/Workbench/Workbench.tsx:138,167-170` — `openFilePath` state lifted + modal mount; Phase 1 threads the callback one chain further down.
11. `src/renderer/components/Workbench/Rails/InnerRail.tsx:289-297` — `FilesSection` mount point; Phase 1 thread site; Phase 2 may diagnose here.
12. `src/renderer/components/Workbench/Rails/UnifiedRail.tsx` (location confirm in Phase 2) — responsive-collapse variant; Phase 2 diagnosis reads.
13. `src/renderer/components/Workbench/CLAUDE.md:344-357` — verbatim lazy-load gotcha; reinforce in Phase 1 brief.
14. `roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md` — Phase 2's D4-conditional-expansion candidate.
15. `~/.claude/notes/wave-process.md` — Sites 1/2/3 rules; orchestrator-owned acceptance test discipline; per-phase review escalation rules.
16. `~/.claude/rules/development-pipeline.md` § Scope-creep tiers — Phase 2's diagnostician-first discipline.

## Note to the implementer

This wave is **wiring + bug-fix on top of an established surface**. Wave 8 P2 + P3 built the file tree + modal infrastructure; Wave 10 built per-project remount; Wave 11 connects the existing pieces and closes two specific smoke-surfaced bugs. Resist the urge to also fix what you see broken adjacent to your edits — the canon Workbench has accumulated a ~20-gap backlog and Wave 11 is closing TWO of them. Wave 12 owns terminal CRUD; Wave 13 owns right-panel binding; Wave 14 owns status bar. Other gaps are owned, just not by Wave 11.

Three temptations to resist:

1. **Don't refactor `WorkbenchFileViewerModal`'s lazy-load pattern.** It's load-bearing. The Workbench/CLAUDE.md gotcha (lines 344-357) documents Wave 8 P3 already regressed this once and fixed it. Phase 1's regression test guards it. If you see a "cleaner" pattern, the test will catch you; the gotcha exists for a reason.

2. **Don't add keyboard navigation, M/A badges, expand-all, or context menus.** D2 explicitly defers these. They're real UX gaps and Cole has not complained about them; closing them un-asked is invented scope. M/A badges have their own deferred follow-up (`2026-05-21-workbench-live-git-diff-stats.md`) with a separate prerequisite (new main-process git op).

3. **Don't touch `useWorkbenchTerminals.ts` or anything Wave 10 shipped.** Wave 10's `hasSpawnedRef` invariant is load-bearing. Wave 11 is renderer-only and OUT of the terminals subtree — the file-tree click thread lives in InnerRail/FilesSection, not in Terminals/. If Phase 2's diagnosis surfaces a terminals-adjacent issue, that's Tier 3 — file follow-up, Cole call.

For Phase 2 specifically: the diagnosis-first discipline (D3) exists because "fix the file tree" without knowing WHAT's broken produces fixes that paper over the symptom while the root cause persists. Trust the diagnostician's verdict; if its proposed fix doesn't actually close Cole's complaint (Phase 2b regression test fails), loop back to 2a with the new evidence. Don't extend a wrong diagnosis with more code — diagnose again.

Phase 0's `/ui-smoke 10` catch-up is the wave-10 obligation Wave 11 inherits. If it surfaces a HIGH/CRITICAL Wave 10 bug, PAUSE — don't try to fix it in Wave 11 inline. File a follow-up, surface to Cole, get an explicit go/no-go on whether the fix lands in a Wave 10.1, in Wave 11 inline (expanded scope), or in a future wave. The Wave 10 deferred-smoke pattern is what produced the 20-gap backlog in the first place — corrective discipline means surfacing problems early, not absorbing them quietly.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

A green per-phase gate with nothing Tier 3 means dispatch the next phase **in the same turn** — the gate is a verification checkpoint, not a stop-and-check-in. End the turn between phases only for a Tier 3 discovery needing Cole's call, a genuine user-judgment decision, or wave-end.

1. **Verify ADR** exists at `roadmap/wave-11-file-tree-viewer-modal/wave-11-decisions.md` with D1–D5 locked. Wave status `IN-PROGRESS` in both this plan's frontmatter and the ADR's.

2. **Phase 0 — `/ui-smoke 10` catch-up.** Confirm `npm run dev` Electron instance is launchable (if not, that's Phase 0's first finding — escalate). Dispatch `sonnet-smoke-runner` with brief targeting Wave 10's project-switching surfaces (per Scope §Phase 0). Append the report as a `## 2026-05-24 Catch-up` section to `roadmap/wave-10-project-scoped-state-foundation/wave-10-smoke-report.md` — don't overwrite the deferred-entry section. Gate: report exists + no HIGH/CRITICAL findings unaddressed. If HIGH/CRITICAL surfaced: file `roadmap/follow-ups/{date}-wave-10-{slug}.md`, surface to Cole, end turn pending go/no-go. If only LOW/MEDIUM: log in catch-up report, proceed.

3. **Phase 1 — Wire file-tree click → modal open.** Author the three orchestrator-owned tests (1a, 1b, 1c per Scope) and run them RED (frozen). Run `npx prettier --write` on the three test files immediately after authoring (Wave 10 lesson 5 — prevent the wrap-time prettier friction). Dispatch `sonnet-implementer` with the brief + test file paths + the explicit constraint: "DO NOT modify `WorkbenchFileViewerModal.tsx` or `useWorkbenchFileLoad.ts`; the lazy-load pattern is load-bearing per Workbench/CLAUDE.md:344-357 and Phase 1 test (b) regression-guards it." Gate: all three orchestrator-owned tests green + `tsc --noEmit` + `tsc -p tsconfig.web.json` BOTH clean + `eslint src/renderer/components/Workbench` 0 errors + targeted `test:layout` green + Wave 10's `useWorkbenchTerminals.restore.acceptance.test.ts` + `Workbench.projectSwitch.acceptance.test.tsx` still green (regression check). No `sonnet-phase-reviewer` dispatch (not boundary, established pattern from Wave 8 P3).

4. **Phase 2a — Diagnose scroll/collapse interactions.** Dispatch `sonnet-diagnostician` with brief (per Phases table Phase 2 Notes). Diagnostician needs Bash access to launch `npm run dev` (`sonnet-diagnostician` has Read/Grep/Glob/Edit/Bash/LS — confirmed). Read its diagnosis output at `roadmap/wave-11-file-tree-viewer-modal/wave-11-diagnosis.md`. Gate to advance to 2b: diagnosis exists + names root cause(s) + proposed fix shape(s) + notes on `forceUnified` shared-cause (D4). If diagnosis says "out of scope — Wave 12 prerequisite" or similar: Tier 3 follow-up + Cole call.

5. **Phase 2b — Fix per diagnosis.** Orchestrator authors failing regression test(s) keyed to symptom (per Phases table) — runs them RED, prettier them. Dispatch `sonnet-implementer` with brief: diagnosis summary + test file path(s) + explicit "do not touch `useWorkbenchTerminals` or anything Wave 10 shipped." If diagnosis surfaced forceUnified shared cause (D4 exception): brief expands to include the forceUnified fix; otherwise stays narrow. Gate: regression test(s) green + Phase 1's three orchestrator-owned tests still green + Wave 10's regression-check tests still green + `tsc --noEmit` + `tsc -p tsconfig.web.json` clean + `eslint src/` 0 errors + `sonnet-phase-reviewer` PASS (conceptually-risky — diagnosis-driven fix).

6. **Phase 3 — Wave wrap.**
   - Full suite (`npx vitest run`) green.
   - Full `eslint src/` 0 errors; `tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean (run BOTH explicitly — Wave 9/10 friction pattern); prettier clean on all wave-touched files INCLUDING orchestrator-authored test files (Wave 10 lesson 5).
   - `/review` mechanical gap-check. Verdict gates: PASS or FLAG-with-flags-addressed.
   - `/audit-followups wave-11-file-tree-viewer-modal` — expected closures: `forceUnified-no-autoclear` IF Phase 2 fixed per D4 exception. `claudeSessionId-binding-precision` stays OPEN (Wave 13). `live-git-diff-stats` stays OPEN (out per D2).
   - `/promote-vendor-lessons 11` — no-op expected (no third-party SDK touched in Wave 11).
   - **`/ui-smoke 11` agent-driven, LIVE — NOT deferred.** Covers: file-row click opens modal showing the file content; modal open works in dual-rail open + dual-rail compact + unified-rail collapsed states; modal close → reopen on different file works; Monaco bundle NOT in initial network load (DevTools network tab check); Phase 2's previously-broken states confirmed fixed. Report at `roadmap/wave-11-file-tree-viewer-modal/wave-11-smoke-report.md`.
   - Update `roadmap/HANDOFF.md` next-action: "Wave 12 — terminal CRUD + chrome (project-scoped)."
   - Append entry to `roadmap/wave-temperature-log.md`.
   - Flip this plan's frontmatter to `status: SHIPPED`; flip the ADR's similarly.
   - Commit + push to `origin/master` (bulletin sanctions pushes; CI minutes still exhausted until 2026-06-01 — workflows skip cleanly; protected-branch merge waits for the restore).
   - Tag `v2.32.0` on origin (minor bump — file-tree click-to-open is new user-facing behavior).
