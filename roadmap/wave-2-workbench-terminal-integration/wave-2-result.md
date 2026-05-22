---
status: SHIPPED
created: 2026-05-21
updated: 2026-05-21
wave: 2
slug: workbench-terminal-integration
tag: v2.23.0
---

# Wave 2 — Workbench Terminal Integration · Result

Made the canon workbench's two terminal frames real: both now host live xterm terminals
bound to workbench-owned ptys, behind the tinted-well glass, with a draggable + persisted
divider. The static mock bodies are gone. Renderer-only + one config key. Behind the
default-off `layout.canonWorkbench` flag, additive alongside the existing shells (cutover
is Wave 7).

## Per-phase outcomes

| Phase | Outcome |
|---|---|
| 0 — ADR | `wave-2-decisions.md`, 6 decisions resolved + `recon-2.md` grounding (two explorer passes). Plan validated (gates A N/A · B/C pass · D advisory pass). |
| 1 — Walking skeleton (upper live) | `useWorkbenchTerminals` (caller-owned id, spawn-on-mount/kill-on-real-unmount, StrictMode-safe deferred-cancellable teardown); `TerminalShell` gained `sessionId`/`isActive` → mounts `<TerminalInstance>` in the tinted well (no opacity wrapper, ADR 5); `CenterPane` owns the session. Orchestrator-owned acceptance test (spawn-before-mount, id wired through, data round-trip, kill-on-unmount). Phase-reviewer PASS. |
| 2 — Lower live + mock teardown | Hook extended to both ptys with a per-session `Map<id,timer>` deferred-kill (single ref would collide/leak the second pty under StrictMode); both frames `isActive` (vertical split = both visible, native click-to-focus); `sessionId`/`isActive` made required; mock body components + helpers removed (tab bar kept, ADR 6); acceptance test extended to the two-pty contract; `Workbench.test.tsx` updated to live-terminal assertions. |
| 3 — Divider drag + persistence | `useVerticalSplitResize` (vertical counterpart of horizontal-only `useSplitResize`; `clientY`/`rect.height`, pointer-capture, `onCommit` on drag-END only, clamped 0.15–0.85, exported pure `computeSplitRatio`); new config key `layout.workbenchTerminalSplit` (number, default 0.62) mirrored across schema + both type files; `CenterPane` drives frame flex from the live ratio, persists on drag-end, restores on mount; xterm reflows via its own ResizeObserver (no manual fit). |
| 4 — Wrap | Full lint (0 errors), tsc clean (web+node), prettier, `test:main` 6444 pass, Workbench 102 pass; dead-export audit → follow-up filed; CLAUDE.md, this brief, CHANGELOG [2.23.0], tag v2.23.0. |

## Verification

- **Tests:** orchestrator-owned acceptance test 6/6 (incl. a StrictMode guard + the two-pty
  contract); `useVerticalSplitResize` 14/14 (resize math, clamp, persist-on-drag-end-only,
  read/write round-trip, late-arriving-ratio regression guard); `Workbench.test.tsx` 82/82;
  `test:main` 6444 pass; tsc + full lint + prettier clean.
- **Two orchestrator fixes during review (not separate phases):**
  1. *StrictMode net-kill (Phase 1).* The app renders under `<StrictMode>` (the env Cole
     verifies in via `npm run dev`); the original `spawnedRef` latch let the dev
     double-invoke's first cleanup kill the pty without re-spawning → dead terminal + leaked
     cleanup. Replaced with a deferred-cancellable teardown; added a StrictMode acceptance
     case that bites it.
  2. *Restore never reached the UI (Phase 3).* `useState(initialRatio)` ignores a changed
     initial arg on re-render, so the async-loaded persisted ratio was read from config but
     never applied to the rendered flex. Added a sync effect (applies a late `initialRatio`
     when not dragging) + a regression test. The implementer's "restore" tests had only
     checked `readSplitRatio` in isolation — a real test gap.
- **NOT done — live UI smoke deferred.** `/ui-smoke 2` was NOT run as a live smoke. Cole is
  not using the app until the overhaul is done (per his note), and the agent-driven smoke
  would need a running Electron dev instance with the experimental flag toggled on — fragile
  to automate. The runtime FLAG from the Phase 1 review (zero-height well → wrong initial
  column wrap; mitigated by xterm's `isReadyRef` double-rAF + ResizeObserver) is **unconfirmed
  in a live IDE.** Next dev session: enable Settings → Appearance → "Canon workbench", confirm
  both frames are live shells behind the tinted glass, type a command in each, drag the
  divider, reload, and confirm the split persists. Matches the Wave 0/1 deferral posture.

## Decisions (ADR `wave-2-decisions.md`)

Reuse `TerminalInstance` (don't re-implement xterm) · workbench-owned independent sessions
(no `DockSlot`/`ProjectTerminalsContext`) · thin `useWorkbenchTerminals` hook (not
`useTerminalSessions` wholesale) · draggable + persisted divider · tinted well preserved, no
double-tint · one plain shell pty per frame (Claude auto-launch + multi-tab → Wave 3).

## Follow-ups / deferrals

- `roadmap/follow-ups/2026-05-21-wave-2-dead-terminal-line-mocks.md` — terminal-line mock
  constants orphaned by the body teardown; Wave 3 sweeps them with its mock→live rework.
- `/ui-smoke 2` live smoke (above) — confirm in next dev session.
- The `window.electronAPI?.pty?.kill` optional-chaining guard in `useWorkbenchTerminals` is
  test-defensive (production always has the bridge) — harmless; remove with a shared
  test-teardown that flushes deferred timers.
- Tab bar `+`/split/maximize buttons remain non-functional affordances; multi-tab is a later
  wave.

## Ship

Phases 0–4 on `master` (commits `5d46fa8e` plan/ADR, `f7328bce` phase 1, `ec298541` phase 2,
`5bf35adf` phase 3, + wrap), tag `v2.23.0`. Push per the 2026-05-19 bulletin (workflows
won't run; merges wait for CI minutes 2026-06-01).
