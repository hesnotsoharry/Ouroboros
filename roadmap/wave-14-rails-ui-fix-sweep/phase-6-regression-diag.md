---
status: COMPLETE
created: 2026-05-27
wave: 14
phase: 6
---

# Phase 6 Regression Diagnostic — projectSwitch.wave10 timeout

## Root cause

The test was **broken before Wave 14** — the regression was introduced in commit `872e1dbb` (Wave 12 Phase 2) which added `useEffect(() => { void fetchExistsMap(...).then(setExistsMap); }, [projects])` to `useWorkbenchProjects`, but the test's `stubElectronAPI()` never stubbed `window.electronAPI.files.pathExists`, so every call to `fetchExistsMap` emits an unresolved-then-resolved `Promise.resolve({})` microtask that React 18's `act(async fn)` cannot drain when 5+ concurrent `useWorkbenchProjects` hook instances are all emitting them simultaneously.

**Evidence:** Running the test against `872e1dbb~1` (pre-Wave-12-Phase-2) passes in 257ms. Running against `872e1dbb` and every subsequent commit times out at the configured limit. Wave 14 Phases 3–5 did not introduce the hang.

## Why the test hangs at 20s instead of failing fast

`act(async () => { fireEvent.click(...) })` in React 18 waits for all pending microtasks and async state updates to drain before returning. The `useWorkbenchProjects` hook is called in 5 independent component instances in the render tree (ProjectRail, useProjectCRUDActions×2, InnerRailProjectDropdown, TitleBar). Each instance fires its own `useEffect([projects])` which emits a `Promise.resolve({}).then(setExistsMap)` microtask. When any `setExistsMap({})` settles, the second `useMemo([projects, existsMap])` produces a new array reference, which propagates to `useProjectCRUDActions` as a new `projects` dep, producing a new `removeProject` callback, causing downstream re-renders. These re-renders cause `act` to re-queue work. The cycle doesn't infinitely loop (the `useEffect([projects])` deps remain stable after the first round), but the concurrent microtask fan-out across 5 instances combined with React 18 scheduling causes `act` to never reach a fully-settled state within the 20s timeout window.

## Fix scope

**Test-only fix.** Add `pathExists` to `stubElectronAPI()` in the test:

```ts
files: {
  readDir: vi.fn().mockResolvedValue({ success: true, items: [] }),
  pathExists: vi.fn().mockResolvedValue(true),  // ← add this
},
```

This makes `fetchExistsMap` return a real resolved value via a concrete stub rather than bailing out at the `if (!pathExists ...)` guard. With a stub, each of the 5 `useWorkbenchProjects` instances resolves its effect once with a stable existsMap value, and `act` can drain the queue. The fix also makes `exists` state accurate for the test's alpha/beta projects (both return `true`, matching the test's expectations).

Files to touch: `src/renderer/components/Workbench/Workbench.projectSwitch.wave10.test.tsx`, line 148 (`stubElectronAPI`). Estimated: 1 line added. Source code unchanged.

## Confidence

HIGH — empirically confirmed via bisect: pre-`872e1dbb` = PASS (257ms), post-`872e1dbb` = FAIL (timeout). Fix scope is narrow and matches the proven root cause.
