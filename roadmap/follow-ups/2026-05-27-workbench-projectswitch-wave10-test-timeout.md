---
status: OPEN
severity: LOW
created: 2026-05-27
updated: 2026-05-27
surfaced-by: wave-14-rails-ui-fix-sweep Phase 6 wrap
---

# Workbench.projectSwitch.wave10 test times out at 20s

## Symptom

`src/renderer/components/Workbench/Workbench.projectSwitch.wave10.test.tsx` — single test inside (`clicking chip beta in outer rail updates TitleBar chip label and InnerRail header`) — times out at 20 seconds in `npm run test:renderer`.

Not in any scoped script that Wave 12, 13, 14, 100 ran — `test:layout` covers `src/renderer/components/Layout/` only, NOT `src/renderer/components/Workbench/`. Hidden until Wave 14 Phase 6 wrap ran `test:renderer` as a broader gate.

## Diagnosis (Wave 14 sonnet-diagnostician, HIGH confidence — empirical bisect)

- Pre-`872e1dbb` (Wave 12 Phase 2 commit): test PASSES in 257ms.
- At `872e1dbb` and after: test TIMES OUT at 20s.

Root cause: `useWorkbenchProjects` (introduced in Wave 12 Phase 2) fires a `Promise.resolve({}).then(setExistsMap)` microtask on every render when `window.electronAPI.files.pathExists` is undefined. The test's `stubElectronAPI()` originally omitted `pathExists`. With 5 concurrent instances of `useWorkbenchProjects` in the render tree (ProjectRail + TitleBar + InnerRail + nested consumers), React 18's `act(async fn)` cannot drain the cascading microtask + state-update cycle within 20s.

## What Wave 14 tried

Wave 14 Phase 6 wrap added `pathExists: vi.fn().mockResolvedValue(true)` to the test's `stubElectronAPI()`. The change is correct hygiene (the stub was incomplete) but does NOT alone resolve the timeout — additional cascade still hangs the test.

## Suggested approach when picked up

1. Investigate whether other `window.electronAPI.*` fields used by `useWorkbenchProjects` (or its callees) also need mocking. Likely candidates: anything called inside an effect that triggers re-render.
2. Consider whether `useWorkbenchProjects` should guard against undefined IPC at the hook level (e.g., skip the effect if `pathExists` is undefined) — that would defend against test setup gaps AND production cold-boot races.
3. Alternative: replace the integration test with a narrower unit test that mocks the hook directly — the test currently renders 3 components inside a Provider, which is integration-shaped; if the assertion can be made at the click-propagation level instead of the InnerRail re-render level, a simpler test would not exhibit the cascade.

## Scope estimate

LOC: ~5-20 (depending on whether the fix is test-only stub additions, hook-level guard, or test rewrite). LOW severity because the test is pre-existing dead (was failing before Wave 14, just not exercised) — fixing it doesn't change user-facing behavior; it just restores a regression guard for the Wave 10 project-switch acceptance.

## Why LOW

- No user-facing impact (this is a test infrastructure issue).
- Wave 14's user-facing fixes (#1 right-click, #2 fake sessions, #3 top terminal cwd, #4 unified rail) all work correctly per `test:layout` (909 GREEN) + the orchestrator-owned acceptance tests added per phase.
- The Wave 10 project-switch behavior the test was designed to guard IS verified working by Wave 14 Phase 3's `ProjectRail.rightClick.acceptance.test.tsx` + Phase 4's `InnerRail.projectScoping.acceptance.test.tsx` (different angles, same surface).

## Related

- Wave 12 Phase 2 introduction of `useWorkbenchProjects` (`roadmap/wave-12-terminal-and-project-crud-chrome/`)
- Wave 14 Phase 6 wrap diagnostic memo: `roadmap/wave-14-rails-ui-fix-sweep/phase-6-regression-diag.md`
- Wave 14 partial fix landed: `pathExists` stub addition (not sufficient on its own)
