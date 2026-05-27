---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
wave: 2
slug: workbench-terminal-integration
---

# Wave 2 — Workbench Terminal Integration

## Status

DRAFT · target v2.23.0 (minor — net-new live capability inside the experimental, default-off canon shell) · drafted 2026-05-21.

## Context — why this wave exists

Wave 1 (`v2.22.0`) shipped the canon workbench as a complete static six-region shell behind the default-off `layout.canonWorkbench` flag. Its centre column (`Workbench/Terminals/{CenterPane,TerminalShell}.tsx`) renders two stacked terminal frames split ~62/38 with a 30px tab bar over a **static tinted-well body of mock lines** — Wave 1 Decision 6 explicitly deferred the real terminal to this wave (`TerminalShell.tsx:1-11` header: "NO xterm … xterm mounts in Wave 2"). The divider between the frames is an **inert visual handle** today (`CenterPane.tsx:40-61`: "drag logic in Wave 2"). This wave makes both frames real and the divider functional.

This is **not a new architectural surface** — the pty↔xterm path is well-established (the IDE and chat-only shells both mount terminals). What is new is the *composition*: mounting the existing real `TerminalInstance` component inside the Workbench provider tree, owning sessions from `CenterPane`. Two read-only recon passes this session (captured in `recon-2.md`) confirmed the seam: `TerminalInstance` consumes only `ProjectContext` (`TerminalInstanceController.helpers.ts:9,106`), which `ConfiguredApp` already mounts **above** the Workbench branch in `InnerApp` — so no new provider wiring. The companion terminal-glass-fix (`v2.21.1`) already switched all terminals to the xterm **DOM renderer** so `allowTransparency` works and the canvas tints from `--term-canvas-bg`; Wave 2 inherits that, so the tinted well survives the swap from mock `<div>` to live xterm as long as we don't double-tint (recon gotcha).

Renderer-only, plus **one config-schema key** for the persisted divider ratio. No main-process or IPC-contract change — the existing `window.electronAPI.pty.*` channels are reused as-is.

## Goal

After Wave 2, flipping `layout.canonWorkbench` on renders a workbench whose two terminal frames host **real, live xterm terminals bound to actual pty processes** (workbench-owned, independent of the other shells): the upper and lower frames each run a live shell — type a command, see real output — behind the translucent tinted-well glass, with cursor, scrollback, and resize all working. The static mock bodies are gone from the live path. The divider between the two frames is **drag-resizable** (vertical `row-resize`), the terminals reflow live as it moves, and the split ratio **persists** across IDE reloads via a new config key. With the flag off, every existing shell renders exactly as before.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-2-workbench-terminal-integration/wave-2-decisions.md`.

1. **Reuse `TerminalInstance`; do not re-implement the xterm mount.** Each `TerminalShell` body renders the existing `<TerminalInstance sessionId isActive>` (the hook chain that owns `new Terminal()`/`open()`/fit/data-bridge). RESOLVED — recon confirmed the chain needs only `ProjectContext`, already present above the Workbench branch.
2. **Workbench-owned independent pty sessions.** The workbench manages its own sessions; they are **not** shared with the IDE/chat shells, and we do **not** mount `ProjectTerminalsContext`/`DockSlot`. (Cole deferred this to the technical best call; isolation is simplest while the shell is flag-gated and experimental — sharing is reconsidered at the Wave 7 cutover.) RESOLVED.
3. **Thin workbench-owned session hook (`useWorkbenchTerminals`), not `useTerminalSessions` wholesale.** A small hook spawns exactly the two fixed ptys (upper/lower) with caller-owned ids via `window.electronAPI.pty.spawn(id,{cwd})`, tracks exit status, and kills both on unmount. Rationale (best-practice spectrum in the ADR): the industry-standard "reuse the existing session manager" is over-broad here — `useTerminalSessions`' array/tab/recording/split/reorder surface is built for multi-tab shells and `spawnSession()` doesn't return its id; YAGNI favours a purpose-built two-frame hook that converges with `useTerminalSessions` only when multi-tab lands (later wave). RESOLVED — planner's call (technical seam Cole delegated).
4. **Divider: draggable vertical `row-resize` + persisted split ratio.** A new config key `layout.workbenchTerminalSplit` (number, default `0.62`) persists the upper-frame fraction; a small vertical-resize hook (forked from / parameterizing `useSplitResize`, which is horizontal-only) drives it. RESOLVED — Cole locked "draggable + persisted."
5. **Tinted well preserved, not double-tinted.** `TerminalShell`'s well `<div>` keeps `--term-bg` (panel) + `--term-inset`; the xterm canvas/opacity (`--term-canvas-bg`, `--terminal-canvas-opacity`) are the terminal's own job. No extra `opacity` wrapper around `<TerminalInstance>`. RESOLVED — recon gotcha.
6. **One live terminal per frame; multi-tab and Claude auto-launch deferred.** Both frames spawn a **plain shell pty**. The 30px tab bar stays as a single-tab affordance reflecting the live session; multi-tab management is out. The upper ("CC") frame is **not** auto-launched into `claude` this wave — that binding (and the Agent-Globe coupling) is Wave 3. RESOLVED — scope.

## Scope

**In scope:**
- `useWorkbenchTerminals` hook (new, under `Workbench/Terminals/` or `src/renderer/hooks/`): spawns two caller-owned ptys, exposes `{ upperSessionId, lowerSessionId, statuses }`, kills both on unmount; cwd from `ProjectContext`/`config.defaultProjectRoot`.
- Rewrite `Workbench/Terminals/TerminalShell.tsx`: replace the mock body (`CcBody`/`ShellBody`/mock-line renderers) with `<TerminalInstance sessionId isActive>`; keep the tab bar + tinted-well `<div>` wrapper (Decision 5).
- Edit `Workbench/Terminals/CenterPane.tsx`: call `useWorkbenchTerminals`, pass session ids down, and wire the divider drag.
- New vertical resize hook (or `direction`-parameterized `useSplitResize`) for the `row-resize` divider; `layout.workbenchTerminalSplit` config key (default `0.62`) read + written; ratio drives the 62/38 flex and persists.
- Orchestrator-owned acceptance test for the pty-mount boundary (`CenterPane`/`TerminalShell` × mocked `window.electronAPI.pty`): asserts spawn-before-mount, data round-trip to xterm, kill-on-unmount.
- Unit/integration tests per the table; `test:layout` / `test:renderer` scope.
- Update `Workbench/CLAUDE.md` (Wave 2 line: xterm now mounted; Decisions 1–6).

**Out of scope:**
- Live agent/hook data, `useAgentEvents`, the Agent-Globe state machine → Wave 3.
- Auto-launching `claude` in the upper frame / CC-specific binding → Wave 3.
- Multi-tab session management, the `+`/split/maximize tab-bar buttons becoming functional → later wave (the buttons stay visual affordances).
- `DockSlot` / `ProjectTerminalsContext` / shared cross-shell sessions → reconsidered at Wave 7 cutover, not now.
- Permission overlay / sidebar takeover → Wave 5.
- Responsive collapse / theme treatment of the terminal → Wave 6.
- Removing the WebGL dependency (`roadmap/follow-ups/2026-05-21-remove-xterm-webgl-dependency.md`) — separate follow-up.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | orchestrator | Author `wave-2-decisions.md`, Decisions 1–6 (Decision 3 carries the best-practice spectrum per `~/.claude/rules/best-practice-spectrum.md`). Gate to 1. |
| 1 | Walking skeleton — one live terminal end-to-end (upper frame) | sonnet-implementer | **Boundary phase — orchestrator authors the failing acceptance test first; subagent may not modify it.** Thinnest end-to-end slice: create `useWorkbenchTerminals` (spawn the upper pty with a fresh caller-owned id via `window.electronAPI.pty.spawn(id,{cwd})`, kill on unmount), give `TerminalShell` a `sessionId?`/`isActive?` prop, and render `<TerminalInstance sessionId={…} isActive>` in the **upper** frame's well body in place of `CcBody`. Lower frame stays mock this phase. Keep the well `<div>` (`--term-bg`/`--term-inset`); do NOT add an opacity wrapper (Decision 5). Deliverable: with the flag on, the upper frame is a **live shell** — typing `echo hi` prints `hi` behind the tinted glass — and the orchestrator's acceptance test passes. Gets a `sonnet-phase-reviewer` pass (boundary + conceptually-risky: provider ancestry, fit-timing, spawn-before-mount ordering). |
| 2 | Lower frame live + focus/active + mock teardown | sonnet-implementer | Extend `useWorkbenchTerminals` to the lower pty; render `<TerminalInstance>` in the lower frame; wire `isActive`/focus so clicking a frame focuses its terminal (the other goes `visibility:hidden`-inactive per `TerminalInstance`'s model). Remove the now-dead mock body components and mock-line constants from the live path (`CcBody`, `ShellBody`, `MOCK_CC_*`, `MOCK_SHELL_LINES`, `TermLineRow` etc. — delete or stop importing). Both frames are live shells. |
| 3 | Divider drag + persisted split | sonnet-implementer | Wire the inert `CenterPane` divider: a vertical `row-resize` hook (fork `useSplitResize` with a `direction` param, or a small new hook reading `clientY`/`rect.height`) updates the split fraction; the fraction drives the two frames' flex; persist to new config key `layout.workbenchTerminalSplit` (number, default `0.62`) and restore on mount. xterm reflows on drag via the existing ResizeObserver (no manual fit call needed). Touches the config schema (both type files + default) — a small persistent-storage boundary; orchestrator confirms the persist/restore round-trip. |
| 4 | Wave wrap | orchestrator | `test:layout` + `test:renderer`, full lint + typecheck + prettier, orchestrator diff review, `/review` mechanical gap-check (Check 6 if stryker), update `Workbench/CLAUDE.md`, `wave-2-result.md`, `CHANGELOG [2.23.0]`, `/ui-smoke 2` (UI-bearing — Wave 1's was deferred; run it now that terminals are live), local `git tag v2.23.0` (push per bulletin; merges wait), HANDOFF flip, `/promote-vendor-lessons 2` (xterm — likely appends to existing gotchas), `/audit-followups wave-2-workbench-terminal-integration`. |

### Phase ordering

```
Phase 0 (ADR)
   |
   v
Phase 1 (walking skeleton: upper frame live + acceptance test)  ← blocks 2, 3
   |
   v
Phase 2 (lower frame live + mock teardown)
   |
   v
Phase 3 (divider drag + persistence)
   |
   v
Phase 4 (wrap)
```

Strictly sequential. Phase 1 establishes the mount seam + `useWorkbenchTerminals` hook that Phase 2 extends; Phase 2 removes the mock substrate that would otherwise conflict with Phase 3's edits to the same files (`CenterPane`/`TerminalShell`). No parallelization — all three implementation phases touch the same two files in the `Terminals/` folder.

## Risks

| Risk | Mitigation |
|---|---|
| `TerminalInstance` crashes mounting in the Workbench tree (missing provider) | Recon confirmed only `ProjectContext` is consumed and it's already above the Workbench branch (`recon-2.md`). The Phase 1 acceptance test mounts within the real provider stack; the smoke is a live IDE render. |
| pty not spawned before `TerminalInstance` registers `pty.onData(id)` → typed output goes nowhere | `useWorkbenchTerminals` issues `pty.spawn` for the id it owns; ids are generated synchronously (available first render) so spawn is dispatched as the frame mounts. Phase 1 acceptance test asserts data pushed via mocked `onData` reaches the terminal; the live smoke (type → see output) is the real proof. |
| Zero-height well at mount → `proposeDimensions()` undefined → scrollback wraps at wrong columns | The well body is inside a sized grid cell (`flex:1; minHeight:0`); the `isReadyRef` double-rAF + ResizeObserver recover after first layout. Smoke checks that a wide command's output wraps correctly. |
| Double-tint — wrapping `<TerminalInstance>` in another `opacity` layer washes the canvas out | Decision 5 + brief: the well `<div>` sets `--term-bg` panel bg only; canvas bg/opacity stay the terminal's own (`--term-canvas-bg`/`--terminal-canvas-opacity`). `/ui-smoke 2` visually confirms legibility. |
| Reused session id replays stale serialized scrollback (`useSessionRestore`) on flag re-toggle | `useWorkbenchTerminals` generates **fresh** ids per mount; never reuse across toggles. Cleanup kills ptys on unmount so no orphan sessions accumulate. |
| pty leak — toggling the flag off (Workbench unmounts) without killing ptys | Hook cleanup calls `pty.kill` for both ids on unmount; acceptance test asserts kill-on-unmount. |
| `useSplitResize` is horizontal-only; naive reuse drags the wrong axis | Phase 3 forks it with a `direction` param (or writes a small vertical-only hook reading `clientY`/`rect.height`) — called out in the brief; not a silent reuse. |
| Config-key persist/restore race (ratio written every drag-move → write storm) | Persist on drag-**end** (pointerup), not per move; in-memory state drives the live flex during the drag. Orchestrator confirms the round-trip in Phase 3. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR is documentation. |
| 1 | `useWorkbenchTerminals`: spawns the upper pty with a fresh id; kills on unmount (mocked `window.electronAPI.pty`). | **Orchestrator-owned acceptance test** (honeycomb — boundary): mount the upper-frame path with mocked `pty`; assert `pty.spawn` called before `onData` registers, data pushed via the mocked `onData` callback reaches the terminal, `pty.kill` fires on unmount. | Honeycomb — the pty↔xterm seam is the failure surface. `test:layout`/`test:renderer`. |
| 2 | Frame focus/`isActive` toggling sets the inactive terminal hidden. | Render: both frames mount a `<TerminalInstance>`; the mock body components are no longer rendered. | Trophy. `test:layout`. |
| 3 | Vertical resize math (`clientY`/`rect.height` → clamped fraction). | `layout.workbenchTerminalSplit` persists on drag-end and the saved fraction restores the split on remount (mocked config). | Honeycomb — persistent-storage round-trip. `test:layout`. |
| 4 | n/a | Scoped suites green, `/review` PASS/FLAG-addressed, `/ui-smoke 2` written. | Wrap. |

## Acceptance criteria

- [ ] `useWorkbenchTerminals` exists, spawns the workbench ptys with fresh caller-owned ids via `window.electronAPI.pty.spawn`, and kills them on unmount.
- [ ] `Workbench/Terminals/TerminalShell.tsx` renders `<TerminalInstance sessionId={…} isActive={…}>` in the well body — no `xterm`/`@xterm/*` re-implementation; the existing component is mounted.
- [ ] `CenterPane` owns the two sessions and passes ids to the two `TerminalShell`s; both frames host live terminals (flag on).
- [ ] The static mock body path (`CcBody`/`ShellBody`/`MOCK_CC_*`/`MOCK_SHELL_LINES`) is removed or no longer rendered in the live workbench.
- [ ] Tinted well visible behind the live terminal — `--term-bg` on the well `<div>`, canvas via `--term-canvas-bg`; no extra opacity wrapper around `<TerminalInstance>` (no double-tint).
- [ ] Dragging the divider resizes the two frames live; `layout.workbenchTerminalSplit` (number, default `0.62`) exists in the config schema, persists on drag-end, and restores the split on reload.
- [ ] ptys are killed on Workbench unmount (no session leak); flag-off leaves the existing shells byte-unchanged (render test).
- [ ] The orchestrator-owned Phase 1 acceptance test passes against the implementation.
- [ ] Zero new hardcoded hex in `Workbench/**` except sanctioned platform/brand colors (lint clean); tsc clean.
- [ ] `Workbench/CLAUDE.md` updated (xterm now mounted; Wave 2 decisions).
- [ ] `wave-2-result.md`, `CHANGELOG [2.23.0]`, `/ui-smoke 2` report, local tag `v2.23.0`.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR is the orchestrator's planning artifact — Cole reviews it; nothing renders. |
| 1 | The upper terminal frame in a live IDE (flag on) | flip Settings → Appearance toggle → `useCanonWorkbenchFlag` → `Workbench` → `CenterPane` → `useWorkbenchTerminals` spawns the pty (`window.electronAPI.pty.spawn` IPC → main) → `TerminalShell kind="cc"` → `<TerminalInstance>` → `term.open()` on the well body → xterm canvas | Cole types `echo hi` in the upper frame and sees `hi` printed by a real shell — a live block cursor and real prompt behind the indigo tinted-well glass, replacing the mock lines that were there in Wave 1. |
| 2 | Both terminal frames in the workbench (flag on) | flag on → `Workbench` → `CenterPane` → both `TerminalShell`s → two `<TerminalInstance>`s → two ptys | Cole clicks into the lower frame, runs `ls`, and sees the real directory listing; the upper frame still holds its live session; focus moves between the two frames and each accepts input independently — no mock text anywhere. |
| 3 | The divider between the two terminals in the workbench (flag on) | drag the `row-resize` handle → vertical resize hook (`clientY`/`rect.height`) → split-fraction state → `CenterPane` flex on both frames → xterm ResizeObserver reflow → on drag-end persist to `config.layout.workbenchTerminalSplit` | Cole drags the divider up/down and watches both terminals resize and reflow live; after closing and reopening the IDE (flag still on) the split sits where he left it, not back at 62/38. |
| 4 | Internal — no observation point | n/a | Wrap phase — gates, brief, CHANGELOG, tag are build artifacts; the product surface is Phases 1–3, re-verified by `/ui-smoke 2`. |

### Data-shape probes

```bash
# Phase 1 — hook + mount seam
# Confirm TerminalShell imports TerminalInstance; useWorkbenchTerminals calls pty.spawn.
npx vitest run src/renderer/components/Workbench src/renderer/hooks

# Phase 3 — config key
# Grep the config schema (both type files + defaults) for `workbenchTerminalSplit`.
npx vitest run src/renderer/components/Workbench

# Wrap
npm run lint && npm run typecheck
npx vitest run src/renderer/components/Workbench src/renderer/components/Terminal
```

## Files the next agent should read first

1. `roadmap/wave-2-workbench-terminal-integration/recon-2.md` — the seam map + gotchas (reuse verdict, provider ancestry, tinted-well token chain, fit-timing, divider fork). Read first.
2. `roadmap/wave-2-workbench-terminal-integration/wave-2-decisions.md` — the ADR (Decisions 1–6).
3. `roadmap/wave-1-workbench-static-shell/wave-1-result.md` — what Wave 1 shipped (the static `TerminalShell`/`CenterPane` this wave makes live).
4. `src/renderer/components/Workbench/Terminals/TerminalShell.tsx` — the file being rewritten (mock body → real terminal).
5. `src/renderer/components/Workbench/Terminals/CenterPane.tsx` — the divider host + where sessions are owned.
6. `src/renderer/components/Terminal/TerminalInstance.tsx` (+ `TerminalInstanceController.types.ts`) — the component being mounted; its prop contract (`sessionId`, `isActive`).
7. `src/renderer/hooks/useTerminalSessions.ts` — the spawn/kill reference for the thin hook.
8. `src/renderer/components/Terminal/terminalHelpers.ts` — `buildXtermTheme()` and the tinted-well canvas tokens.
9. `src/renderer/components/Terminal/TerminalManagerSplitPane.tsx` — `useSplitResize` (horizontal; fork for the vertical divider).
10. `.claude/vendor-gotchas/xterm.md` — xterm v6 / DOM-renderer / transparency gotchas.
11. `src/renderer/components/Workbench/CLAUDE.md` — the static-mock constraint this wave relaxes for terminals.
12. The config schema file(s) (`src/main/config*.ts` / `configSchema*`) — where `layout.workbenchTerminalSplit` is added.

## Note to the implementer

The spirit of this wave is **make the two static terminal frames real by reusing what already works — not by re-architecting terminals.** The hard parts (xterm lifecycle, fit timing, the DOM-renderer transparency fix, the write-buffer) are already solved inside `TerminalInstance`; you mount it and feed it a `sessionId`. Resist four temptations: (a) do NOT re-implement `new Terminal()`/`term.open()`/fit — mount the existing component (Decision 1); (b) do NOT pull in `DockSlot`/`ProjectTerminalsContext` or build multi-tab session management — Wave 2 is exactly two fixed frames, one terminal each (Decisions 2, 6); (c) do NOT auto-launch `claude` in the upper frame or touch the Agent Globe — that's Wave 3 (Decision 6); (d) do NOT wrap the terminal in an extra opacity layer to "match the mock" — the tinted well is the panel `<div>`'s `--term-bg`, the canvas tints itself (Decision 5). Generate fresh session ids per mount and kill ptys on unmount — reused ids replay stale scrollback, un-killed ptys leak. The divider's `useSplitResize` precedent is horizontal-only; fork it for the vertical axis, don't reuse it blind.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

When a phase's gate is green and nothing Tier 3 surfaced, the orchestrator dispatches the next phase in the same turn — it does not end the turn to summarize or ask. The turn ends between phases only for a Tier 3 discovery needing a user call, a genuine user-judgment decision, or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** at `roadmap/wave-2-workbench-terminal-integration/wave-2-decisions.md` with Decisions 1–6 (Decision 3 carrying the best-practice spectrum). Gate to Phase 1.
2. **Author the Phase 1 acceptance test first (orchestrator).** Per `~/.claude/rules/orchestrator-owned-acceptance-tests.md`: a failing test expressing the pty-mount boundary contract — mount the upper-frame path with a mocked `window.electronAPI.pty`; assert spawn-before-`onData`, data round-trip to the terminal, kill-on-unmount. Confirm it FAILS before dispatch.
3. **Phase 1 — sonnet-implementer (walking skeleton).** Brief: `useWorkbenchTerminals` (upper pty, fresh id, kill on unmount) + `TerminalShell` `sessionId?`/`isActive?` prop rendering `<TerminalInstance>` in the upper well, lower stays mock. Implement against the acceptance test (may not modify it). Gate: acceptance test passes + `useWorkbenchTerminals` unit test green + `test:layout`/`test:renderer` green + lint/tsc clean + **`sonnet-phase-reviewer` pass** (boundary/conceptually-risky) + manual: upper frame is a live shell. Orchestrator does the cross-phase check (does Phase 1's hook shape match what Phase 2's lower-frame extension assumes?).
4. **Phase 2 — sonnet-implementer.** Brief: extend the hook to the lower pty, render the lower `<TerminalInstance>`, wire focus/`isActive`, remove the dead mock body. Gate: render test (both frames live, no mock body) + `test:layout` green + lint/tsc clean + manual: both frames live, focus switches.
5. **Phase 3 — sonnet-implementer.** Brief: vertical resize hook + `layout.workbenchTerminalSplit` config key (persist on drag-end, restore on mount). Gate: resize-math unit + persist/restore integration green + `test:layout` green + lint/tsc clean + manual: drag resizes + survives reload. Persistent-storage touch → orchestrator confirms the round-trip in the diff review.
6. **Phase 4 — wave wrap.** `npm run lint`, `npm run typecheck`, prettier, `npx vitest run src/renderer/components/Workbench src/renderer/components/Terminal` (+ full suite in background). Orchestrator full-wave diff review. `/review` mechanical gap-check (Check 6 if stryker). Update `Workbench/CLAUDE.md` + author `wave-2-result.md`. Append `CHANGELOG [2.23.0]`. Run `/ui-smoke 2` (UI-bearing). Local tag `v2.23.0` (push per the 2026-05-19 bulletin — pushing safe, merges wait for CI minutes). Update `HANDOFF.md`. `/promote-vendor-lessons 2` (xterm — append to existing gotchas if new lessons). `/audit-followups wave-2-workbench-terminal-integration`.
