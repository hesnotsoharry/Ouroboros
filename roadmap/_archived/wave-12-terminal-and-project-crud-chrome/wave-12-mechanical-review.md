---
status: COMPLETED
created: 2026-05-24
updated: 2026-05-24
wave: 12
reviewer: sonnet-implementer (mechanical review)
verdict: FLAG
---

# Wave 12 Mechanical Review

**Diff range:** `48a0cfe6..d30c936c` (4 commits: Phase 1 → Phase 4)
**Plan:** `roadmap/wave-12-terminal-and-project-crud-chrome/waveplan-12.md`
**ADR:** `roadmap/wave-12-terminal-and-project-crud-chrome/wave-12-decisions.md`
**Date:** 2026-05-24

---

## VERDICT: FLAG

Three flags, no FAILs. All flags are bounded and actionable — none block the correctness of the shipped features. Two relate to protocol divergence (close-last-tab behavior, tsc baseline), one to Check 5 timing discipline. Stryker did not complete (ENOENT crash on worktree sandbox copy of a deleted follow-up file — not a code problem; re-run from a clean worktree state).

---

## Check 1 — Forward-trace (production consumer coverage)

**Result: PASS**

### `files.pathExists` IPC (Phase 1)

- `src/main/ipc-handlers/files.ts:336` — handler registered as `['files:pathExists', async (_event, p) => pathExists(p)]`. The `pathExists` helper is imported from `filesHelpers.ts` (pre-existing, verified).
- `src/preload/preload.ts:123` — `pathExists: (p: string) => ipcRenderer.invoke('files:pathExists', p)` wired into the `files` slice.
- `src/renderer/types/electron-runtime-apis.d.ts:212` — `pathExists: (path: string) => Promise<boolean>` typed in `FilesAPI`.
- Production consumer: `src/renderer/components/Workbench/useWorkbenchProjects.ts:98-105` — `fetchExistsMap` calls `window.electronAPI.files.pathExists` per project path on mount and on `projectRoots` change. Wire is complete end-to-end.

### `removeProjectRoot` across 3 surfaces (Phase 2)

- `src/renderer/components/Workbench/useProjectCRUDActions.ts` — `useProjectCRUDActions` hook wraps `removeProjectRoot` + active-switch logic.
- `ProjectRail.tsx:77,90` — imports and calls `removeProject` from the hook; passes `onRemove` to `ProjectChip`.
- `TitleBarProjectDropdown.tsx:167,183` — imports and calls `removeProject`; passes `onRemove` to `ProjectRow`.
- `InnerRailProjectDropdown.tsx:37-40` — imports `useProjectCRUDActions` and `useWorkbenchProjects`; confirmed wired at import level.

All 3 surfaces verified. No surface left without the remove affordance.

### `useWorkbenchTabs` (Phase 3)

- `TerminalShell.tsx:84` — consumes `useWorkbenchTabs(thisFrame, projectRoot)` with `projectRoot` from `useProjectOptional()`.
- `MOCK_TERM_TABS_*` imports are absent from `TerminalShell.tsx` (diff confirms deletion).
- `TabCollection` / `TabState` types exported from `useWorkbenchTabs.ts` and separately defined in `electron-foundation.d.ts` (renderer-side mirror for `tsconfig.web.json`).
- `useWorkbenchSessionPersist` and `useWorkbenchRestore` are both called from within `useWorkbenchTabs` — persistence round-trip is wired.

### `maximizedFrame` (Phase 4)

- `Workbench.tsx:214` — `useState<'upper' | 'lower' | null>(null)` declared.
- Threaded: `Workbench` → `WorkbenchStage` → `MiddleRow` → `CenterPane` via props (`maximizedFrame`, `onSetMaximizedFrame`).
- `CenterPane` conditionally applies `display: 'none'` to the non-maximized `TerminalShell` and hides the divider.
- `TerminalShell` receives `onMaximize` prop; `makeMaximizeHandler` (inline in `CenterPane`) closes over the toggle logic.

All forward-trace chains verified. No dangling exports found.

---

## Check 2 — Plan universal-quantifier scan

**Result: PASS with one note**

Quantifiers scanned: `every`, `all`, `for each`, `always`, `preserve all`, `none of`, `each`.

### "all 3 project-switcher surfaces"

Plan line 76: "Add inline remove (X) button to all three render surfaces (`ProjectRail.tsx`, `TitleBarProjectDropdown.tsx`, `InnerRailProjectDropdown.tsx`)."

Verified: diff touches all three files. Each renders the X button connected to `removeProject`. PASS.

### "every project" (stale detection)

Plan line 76: `useWorkbenchProjects` derives `exists: boolean` for each project via parallel `pathExists` calls.

Verified: `fetchExistsMap` at `useWorkbenchProjects.ts:98-105` runs `Promise.all(projects.map(p => pathExists(p.path)))`. PASS.

### "preserve hasSpawnedRef invariant"

Plan line 29 and Phase 3 spec: `hasSpawnedRef` Wave 10 invariant must survive the per-tab refactor.

Verified: `useWorkbenchTabs.ts` uses `spawnedTabsRef = useRef<Set<string>>(new Set())` (a per-tab Set rather than a boolean) combined with `hasInitializedRef` to gate the single-init. The `autoResumeCcTab` helper checks `spawned.has(tab.id)` before spawning, preventing double-spawn on StrictMode remount. The semantics of the old invariant are preserved by the Set approach. PASS.

### "all wave-touched files" prettier

Plan Phase 5 spec includes prettier sweep. This check is a Phase 5 gate, not verifiable against the Phase 1–4 diff. Noted for Phase 5.

---

## Check 3 — New exports without production consumers

**Result: PASS**

| Export | File | Production consumer |
|--------|------|-------------------|
| `pathExists` (IPC) | `electron-runtime-apis.d.ts:212` | `useWorkbenchProjects.ts:98` via `window.electronAPI.files.pathExists` |
| `useProjectCRUDActions` | `useProjectCRUDActions.ts` | `ProjectRail.tsx:11`, `TitleBarProjectDropdown.tsx:13`, `InnerRailProjectDropdown.tsx:39` |
| `TabState`, `TabCollection` | `electron-foundation.d.ts` | `useWorkbenchRestore.ts`, `useWorkbenchSessionPersist.ts`, `configSchemaMiddle.ts` |
| `TabState`, `TabCollection` | `useWorkbenchTabs.ts` | `TerminalShell.tsx:84` (via the hook's return shape) |
| `useWorkbenchTabs` | `useWorkbenchTabs.ts` | `TerminalShell.tsx:17,84` |
| `TerminalShell.parts.tsx` (TabBar, etc.) | `TerminalShell.parts.tsx` | `TerminalShell.tsx:16` imports `TabBar` |
| `TerminalShell.tabitem.ts` | `TerminalShell.tabitem.ts` | Consumed by `TerminalShell.parts.tsx` |
| `WorkbenchProject.exists` field | `useWorkbenchProjects.ts` | `ProjectRail.tsx:220-222` (opacity style), `TitleBarProjectDropdown.tsx` (stale dim), `InnerRailProjectDropdown.tsx` |

All net-new exports have at least one verified production consumer. No dead exports found.

---

## Check 4 — Schema-removal migration safety

**Result: PASS**

This is the highest-risk check for Wave 12 given the `canonWorkbenchSessions` schema evolution history.

### Wave 10 shape detection in `configPreflight.ts`

`src/main/configPreflight.ts:80-152` (new code) — `resetLegacyCanonWorkbenchSessions` was extended with a two-stage detector:

1. **Stage 1 (Wave 9 flat shape):** `if ('upper' in record || 'lower' in record)` — detects the Wave 9 flat shape where `upper`/`lower` are top-level keys. This is the Wave 10.1 hotfix path; confirmed preserved at line 109.
2. **Stage 2 (Wave 10 slot shape):** `hasAnyWave10SlotEntry` → `isWave10SlotShape` → `hasCwdProperty`. Detects any entry where `upper` or `lower` has a `cwd` property (Wave 10 `SessionSlot` shape). Wave 12's `TabCollection` uses `activeTabId + tabs`, never `cwd`. The distinguishing heuristic is sound.

### Logic verification

`hasCwdProperty(slot.upper)` is true if `slot.upper` is a non-null non-array object containing `cwd`. `isWave10SlotShape` fires if `upper` or `lower` is present AND either bears `cwd`. A valid Wave 12 `TabCollection` with `{ activeTabId: null, tabs: [] }` has no `cwd` property — will not trigger. A null `lower` (allowed by the schema) does not trigger because `hasCwdProperty(null) === false`. SOUND.

### Wave 9 regression check

Test `configPreflight.wave10Migration.test.ts:170-186` explicitly covers the Wave 9 flat shape regression case. It passes (confirmed by test run: 19/19 green across the 3 Phase 1+3 acceptance files). PASS.

### `configPreflight.wave10Migration.test.ts` coverage

5 tests: (1) Wave 10 shape clears; (2) Wave 10 with null lower clears; (3) Wave 12 shape preserved untouched (including file mtime unchanged); (4) Wave 9 flat shape regression; (5) empty `{}` untouched. Full coverage of the migration contract. PASS.

### Cold-start doctrine (D1)

ADR D1 confirms cold-start over migration. The canon flag is default-off; only Cole has live Wave 10 data. No data loss for production users. The Phase 3 commit message documents this. PASS.

---

## Check 5 — Boundary-phase orchestrator-owned acceptance tests

**Result: FLAG (1 flag — timing discipline, not correctness)**

### Phase 1 (`files.pathExists.acceptance.test.ts`)

- File exists at `src/main/ipc-handlers/files.pathExists.acceptance.test.ts`.
- Git history: `48a0cfe6` — the same commit that ships the implementation. The test was NOT authored in a separate prior commit.
- Per `~/.claude/rules/orchestrator-owned-acceptance-tests.md`: "The orchestrator runs the test locally to confirm it FAILS before dispatch." The waveplan Phase 0 notes (line 101) state the acceptance test is "frozen" and "authored RED pre-dispatch."
- **FLAG:** The git log shows a single commit for both the acceptance test and the implementation (`48a0cfe6` contains both `files.pathExists.acceptance.test.ts` + `files.ts` modification). There is no separate "test RED" commit preceding the implementation commit. This means the orchestrator-runs-before-dispatch ordering is not verifiable from the git history.
- **Severity:** Low — the test content is correct (6 cases: existing file, existing dir, missing path, empty string, NUL bytes, boolean primitive), the tests pass, and the implementation passes them. The timing discipline violation is a process finding, not a correctness problem.
- **Evidence:** `git log --follow -- src/main/ipc-handlers/files.pathExists.acceptance.test.ts` returns only `48a0cfe6`.

### Phase 3 (`useWorkbenchTabs.acceptance.test.ts`, `configPreflight.wave10Migration.test.ts`)

- Both files: git history shows only `983fa656` (the Phase 3 implementation commit). Same single-commit pattern.
- Same timing flag applies: no separate RED-first commit visible.
- **FLAG (same as above):** Process-level finding, not correctness. Tests are correct and green.
- Acceptance test content verified: `useWorkbenchTabs.acceptance.test.ts` covers 7 required contract cases: add / setActive / rename / closeTab / per-project isolation / Wave 9 CC auto-resume regression / persistence round-trip.

### Phase 2 acceptance tests (non-boundary phase)

Phase 2 is marked "NOT a boundary phase" in the waveplan. Orchestrator-owned tests still present (`useWorkbenchProjects.staleDetection.acceptance.test.tsx`, `ProjectRail.removeButton.acceptance.test.tsx`, `Workbench.activeProjectRemoval.acceptance.test.tsx`) and green. The ATDD timing rule does not formally apply to non-boundary phases, so no flag.

### Phase 4 acceptance tests (conceptually-risky, not strict boundary)

Phase 4 is marked "CONCEPTUALLY-RISKY" but not a boundary phase in the strict IPC/sync sense. Acceptance tests present and green. Same single-commit pattern; same process note applies but not escalated to FLAG given non-boundary classification.

---

## Check 6 — Mutation score (Stryker)

**Result: INCOMPLETE — Stryker crashed (environment issue, not code issue)**

Stryker exited with ENOENT when trying to copy `roadmap/follow-ups/2026-05-24-workbench-project-crud-manual-and-auto-detect.md` into its sandbox. This file was present in the worktree's glob during the previous incremental run but was subsequently moved to `roadmap/_archived/follow-ups/` by the follow-up audit. The incremental cache references the old path; Stryker attempts to copy it and fails.

**Root cause:** Stryker's `--incremental` mode cached a file glob that included the follow-up file. The file moved; next sandbox build fails. This is a known Stryker incremental-cache invalidation edge case on Windows paths — not a code defect.

**Resolution for Phase 5:** Delete `.stryker-tmp/` to bust the stale cache and re-run `npm run mutation:test` from a clean state. Prior baseline was 31.72% (Wave 11 Phase 0 finding — pre-existing `src/shared/` debt). Wave 12 adds significant state-machine code (`useWorkbenchTabs.ts`) that warrants mutation coverage verification.

**Phase 5 gate status:** Stryker result MUST be obtained before merge. Phase 5 wrap must not proceed with Check 6 INCOMPLETE.

---

## Additional finding — plan/implementation divergence on close-last-tab behavior

**Severity: FLAG (minor, ADR-resolvable)**

**Plan (Risks table, line 126):** "When closing the last tab in a frame: auto-spawn a replacement tab ... Replacement uses the frame's default kind."

**Acceptance test (`useWorkbenchTabs.acceptance.test.ts:230`):** `'closeTab sets activeTabId to null when the last tab is closed'` — explicitly asserts `null`, not an auto-spawned replacement.

**Implementation (`useWorkbenchTabs.ts:75-81`):** `resolveCloseResult` sets `activeTabId: nextTab?.id ?? null` with `remaining = []` on last-tab-close. No auto-spawn. Implementation follows the acceptance test, not the plan risk table.

**Assessment:** Per `~/.claude/rules/orchestrator-owned-acceptance-tests.md`, the orchestrator-authored acceptance test is the authoritative contract. The plan's risk table is informational; the test overrides it. The null-on-last-close behavior is the intended contract. However, this leaves the Workbench in a state where closing the last terminal in a frame results in an empty frame with no visible terminal — a UX state the plan explicitly intended to prevent.

**Flag:** This is a plan/acceptance-test disagreement that should be documented as a confirmed behavior choice (add a follow-up or note to the result brief). The implementation is internally consistent and correct against its own test; the question is whether Cole accepted null-on-last-close as the intended UX.

---

## Summary table

| Check | Result | Notes |
|-------|--------|-------|
| 1 — Forward-trace | PASS | All 4 change sites reach production consumers |
| 2 — Universal quantifiers | PASS | All 3 surfaces, stale-detection, hasSpawnedRef preserved |
| 3 — Dead exports | PASS | No net-new exports without consumers |
| 4 — Schema migration | PASS | Wave 9 + Wave 10 detection correct; tests cover all 5 cases |
| 5 — Acceptance test discipline | FLAG | Single-commit timing (test + impl together, no separate RED commit); correctness unaffected |
| 6 — Mutation score | INCOMPLETE | Stryker ENOENT crash (stale incremental cache); re-run required before Phase 5 wrap |
| Additional | FLAG | close-last-tab: plan says auto-spawn, acceptance test says null; implementation follows test |

**Overall verdict: FLAG** — 2 flags + 1 incomplete. No correctness defects. Phase 5 wrap is blocked on Stryker re-run (delete `.stryker-tmp/`, re-run `npm run mutation:test`). Flags should be addressed or explicitly accepted before merge.

---

## Actions required before Phase 5 wrap

1. **Stryker:** Delete `.stryker-tmp/`, re-run `npm run mutation:test --incremental`. Check score against `break: 21` floor. If Wave 12's new files (especially `useWorkbenchTabs.ts`) are under the floor, add tests.
2. **close-last-tab UX:** Cole confirms whether null-on-last-close (current behavior) or auto-spawn-replacement (plan) is the intended UX. If auto-spawn, update the acceptance test + implementation. If null, add a note to the result brief acknowledging the plan/test divergence.
3. **Check 5 timing (optional):** For future waves, author acceptance tests in a separate commit before the implementation commit so the RED-first discipline is verifiable from git history. Not a blocking action for Wave 12.
4. **tsc note:** `npx tsc --noEmit` and `npx tsc -p tsconfig.web.json --noEmit` both produce pre-existing errors in `src/renderer/components/Changelog/` (`@renderer/generated/changelog` not found — build-generated module). These errors predate Wave 12 (Changelog not touched in the diff). They are baseline debt; Wave 12 did not introduce them. Verify via pre-Wave-12 checkout before marking tsc clean at Phase 5.
