---
status: COMPLETE
created: 2026-05-24
updated: 2026-05-24
---

# Wave 11 Phase 0 — Wave 10 production-bug diagnosis

## Bug 1 — Project switching does not actually switch

**Status:** confirmed root cause

**Root cause:**

`setActiveProjectRoot` in `ProjectContext.tsx` (lines 135-143) only promotes a path to `projectRoots[0]` if the path is already present in `projectRoots`. However, `useWorkbenchProjects.ts` (lines 66-91) builds the visible project list from both `projectRoots` AND `config.recentProjects`, deduplicating by path. A project that exists only in recents appears as a chip/row in all three switcher surfaces, but clicking it calls `setActiveProjectRoot(path)` which hits the guard at `ProjectContext.tsx:138` (`if (!prev.includes(path)) return prev;`) and silently no-ops. State never changes, no re-render fires.

All three surfaces call the correct API (`setActiveProjectRoot`, not `setProjectRoot`):
- `ProjectRail.tsx:84` — `onClick={() => setActiveProjectRoot(p.path)}`
- `TitleBarProjectDropdown.tsx:118` — `setActiveProjectRoot(path)`
- `InnerRailProjectDropdown.tsx:186` — `setActiveProjectRoot(path)`

The contract mismatch is between `useWorkbenchProjects` (shows recents) and `setActiveProjectRoot` (guards against paths not in `projectRoots`). Switching between projects both already in `projectRoots` works. Switching to a recent-only project silently fails.

**Proposed fix shape:**

Change `setActiveProjectRoot` from move-to-[0]-or-no-op to move-to-[0]-and-add-if-absent in `ProjectContext.tsx` lines 135-143:

```ts
const setActiveProjectRoot = useCallback(
  (path: string): void => {
    updateRoots((prev) => {
      if (prev.includes(path)) {
        return [path, ...prev.filter((root) => root !== path)];
      }
      // Path is recent-only — add it as the new active root.
      return [path, ...prev];
    });
  },
  [updateRoots],
);
```

**Estimated LOC:** 4

**Test shape:** unit test asserting `setActiveProjectRoot` with a path absent from `projectRoots` (present only in `recentProjects`) causes it to become `projectRoots[0]`. Existing tests cover only the already-present path — the absent path is the gap that let this ship.

---

## Bug 2 — Branch chip not rendering

**Status:** confirmed root cause (most probable of two causes)

**Root cause:**

`TitleBar.tsx:207` gates BranchChip on `{branch && (...)}`. `branch` from `useGitBranch` starts null and becomes non-null only after two async IPC calls succeed: `git.isRepo` returns true (`useGitBranch.ts:184-186`), then `git.branch` resolves (`useGitBranch.ts:146-148`). If `isRepo` returns false or either call fails silently (all errors caught at `useGitBranch.ts:149-151`, setting `branch = null`), the chip is permanently absent.

Most probable cause: the project directory tested is not a git repo, or the IPC fails silently. This is not a Wave 10 regression — the `{branch && ...}` guard predates Wave 10. Cole is noticing it because Wave 10 made the title bar prominent.

The InnerRail footer handles null gracefully (`branch ?? "—"` at `InnerRail.tsx:329`), which is why only the title bar chip appears missing.

**Proposed fix shape:**

Show a placeholder chip when `branch` is null but a project is active. In `TitleBar.tsx`, change the condition from `branch` to `activeProject`, pass `branch ?? "—"` to BranchChip, and gate the dropdown on `branch` being non-null:

From: `{branch && (<div>...<BranchChip branch={branch} .../></div>)}`
To:   `{activeProject && (<div>...<BranchChip branch={branch ?? "—"} .../>{branchOpen && branch && <TitleBarBranchDropdown />}</div>)}`

**Estimated LOC:** 3

**Test shape:** unit test for TitleBar asserting the branch chip renders with "—" when `useGitBranch` returns null and `activeProject` is non-null.

---

## Bug 3 — Popover background/contrast unreadable

**Status:** confirmed root cause

**Root cause:**

All four popovers use `background: "var(--glass-panel)"`:
- `ProjectRailAvatar.tsx:12` PROFILE_MENU_STYLE
- `TitleBarProjectDropdown.tsx:22` DROPDOWN_STYLE
- `InnerRailProjectDropdown.tsx:56` DROPDOWN_STYLE
- `TitleBarBranchDropdown.tsx` (assumed same pattern — verify on read)

Token chain: `--glass-panel` → `--material-panel` → `rgba(18, 20, 32, 0.35)` — **35% opacity** (`tokens.css:119, 223`).

At 35% opacity with native Mica window transparency active, desktop content bleeds through making text unreadable against arbitrary backgrounds. The correct token for menus and dialogs is `--glass-overlay` → `--surface-overlay` → `rgba(10, 10, 14, 0.92)` — **92% opacity** (`tokens.css:49, 224`). All four surfaces used the panel token instead of the overlay token.

**Proposed fix shape:**

In DROPDOWN_STYLE / PROFILE_MENU_STYLE of each affected file, change:
`background: "var(--glass-panel)"` to `background: "var(--glass-overlay)"`

Files: `ProjectRailAvatar.tsx`, `TitleBarProjectDropdown.tsx`, `InnerRailProjectDropdown.tsx`, `TitleBarBranchDropdown.tsx`.

**Estimated LOC:** 4

**Test shape:** no unit test can verify CSS variable resolution at runtime. Long-term fix: lint rule flagging `var(--glass-panel)` on z-index > 50 elements.

---

## Bonus — Terminals do not work

Downstream of Bug 1. `Workbench.tsx:143` drives `CenterPane` remount via `key={projectKey}` where `projectKey = projectCtx?.projectRoot ?? "__no-project__"`. Since Bug 1 prevents `projectRoot` from changing, `CenterPane` never remounts and terminals stay bound to the original project PTY sessions. Fixing Bug 1 causes `projectRoot` to update, the key changes, `CenterPane` remounts — which is the Wave 10 Phase 3 design intent (`Workbench.tsx:139-143` comment). No additional terminal work needed.

---

## Aggregate scope estimate

| Bug | Files | LOC |
|-----|-------|-----|
| Bug 1 — setActiveProjectRoot silent no-op on recent-only paths | `ProjectContext.tsx` | 4 |
| Bug 2 — Branch chip null fallback render | `TitleBar.tsx` | 3 |
| Bug 3 — Popover token glass-panel to glass-overlay | `ProjectRailAvatar.tsx`, `TitleBarProjectDropdown.tsx`, `InnerRailProjectDropdown.tsx`, `TitleBarBranchDropdown.tsx` | 4 |
| **Total** | **5-6 files** | **~11 LOC** |

**Recommendation: inline in Wave 11 Phase 0, before Phase 1 begins.**

All three bugs are self-contained, ~11 LOC total, no IPC contract changes, no schema changes, no architectural consequence. A dedicated Wave 10.1 adds branch/PR/CI/changelog overhead not justified for 11 lines. Defer only if repro reveals hidden scope — code reading shows none.
