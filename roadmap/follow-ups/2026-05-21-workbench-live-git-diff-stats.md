---
status: OPEN
created: 2026-05-21
wave-origin: 3
slug: workbench-live-git-diff-stats
priority: medium
---

# Workbench needs a live git diff-stat source (+adds/−dels) + per-project dirty counts

**Found during:** Wave 3 Phase 2 pre-flight (live-source recon).

Wave 3 swapped the canon Workbench's chrome from `workbenchMockData` to live data, but two
git-derived fields have **no live source** and could not be wired in a renderer-only wave:

1. **Branch line-level adds/dels** (`MOCK_BRANCH.adds` / `.dels`, rendered as `+126 −42` in
   `Workbench/StatusBar.tsx` and the `Workbench/Rails/InnerRail.tsx` footer). The existing
   `useGitBranch()` (`src/renderer/hooks/useGitBranch.ts`) returns the **branch name only**.
   `useGitStatus()` / `useGitStatusDetailed()` return per-file status chars (`M/A/D/?`), **not**
   aggregate line counts. Producing `+adds/−dels` requires a **new main-process git operation**
   (`git diff --shortstat` or `--numstat` parse) exposed over a new `git:*` IPC channel — which is
   outside Wave 3's renderer-only scope.

2. **Per-project `dirty` count on the ProjectRail chips** (`MOCK_PROJECT.dirty`). Showing a real
   dirty badge per project needs a `useGitStatus()` call **per project root** (N-way fan-out across
   `useWorkbenchProjects()`), not just the active root. Deferred to keep Phase 2 renderer-only and
   avoid an N-call git storm.

**What Wave 3 shipped instead:** StatusBar + InnerRail footer show the **live branch name** (via
`useGitBranch()`) with the +/− counts **omitted** (not faked); ProjectRail chips render live
name/initial/active with a deterministic per-path color and **no dirty badge** (the active project's
dirty state is the only one cheaply available — also omitted for consistency).

**Action for a future wave (likely Wave 6 — themes/responsive, or a dedicated git-stats slice):**
1. Add a main-process `gitDiffStat(root)` operation → `{ adds: number; dels: number }` (parse
   `git diff --shortstat` for unstaged+staged) and expose it on the `git` IPC surface
   (`src/main/ipc-handlers/git.ts`).
2. Add a `useGitDiffStat(root)` renderer hook mirroring `useGitBranch`.
3. Wire `+adds/−dels` into `Workbench/StatusBar.tsx` + `Workbench/Rails/InnerRail.tsx` footer.
4. For per-project dirty: either batch the status calls or accept the active-project-only badge.

This is **not agent-reactive data** (it's git/VCS chrome), so it was correctly the lowest-priority
part of Wave 3 and the cleanest to defer.
