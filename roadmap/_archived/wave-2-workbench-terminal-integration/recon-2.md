---
status: GROUNDING
created: 2026-05-21
wave: 2
slug: workbench-terminal-integration
---

# Wave 2 — Terminal Integration · Recon grounding

> Distilled from two read-only `sonnet-explorer` passes (2026-05-21) over the live
> terminal/pty machinery. This is the seam map the implementer builds against —
> grounding, not gospel; verify against the files before relying on a line number.

## The reuse seam (verdict)

**Mount the existing real `TerminalInstance` component inside each `TerminalShell`
body. `CenterPane` owns pty session creation. Skip `DockSlot`.**

- The real xterm mount is **not a component you call** — it is the hook chain inside
  `src/renderer/components/Terminal/TerminalInstance.tsx` →
  `useTerminalInstanceController` → `useTerminalSetup` → `createBootstrapTerminal`
  (`useTerminalSetup.lifecycle.ts`). You do not re-implement `new Terminal()` /
  `term.open()` / fit / data-bridge — you mount `<TerminalInstance>` and it does all of it.
- `TerminalInstance` takes **`sessionId: string`** (parent-owned) + **`isActive: boolean`**
  (controls a `visibility:hidden` toggle, never `display:none`). The pty session must
  **already be spawned in main** before/at mount — `setupDataBridge` registers
  `window.electronAPI.pty.onData(sessionId, …)` on mount.
- **Provider ancestry — confirmed clean.** The only React context `TerminalInstance`'s
  whole chain consumes is `ProjectContext` via `useProject()`
  (`TerminalInstanceController.helpers.ts:9,106`). `ProjectProvider` is the innermost
  app-level provider in `ConfiguredApp` (`App.tsx`), **above** the Workbench branch in
  `InnerApp`. So `<TerminalInstance>` mounts in the Workbench tree with no missing
  providers and no new provider wiring.

## Why NOT `DockSlot` / `useTerminalSessions` wholesale

- `DockSlot.tsx` consumes `useProjectTerminalsContext()` (`DockSlot.tsx:295`) — a
  provider **not** in the Workbench's ancestry (it lives only inside `ChatWorkbenchShell`),
  and it hardcodes the two-slot primary/secondary model plus Wave 89–99 agent-completion
  coupling and a 28px collapse-strip header. Wrong abstraction for Wave 2.
- `useTerminalSessions` (`src/renderer/hooks/useTerminalSessions.ts`) has zero context
  deps and handles spawn/kill/exit/title — but it manages a **sessions array** with
  tab/recording/split/reorder semantics built for the multi-tab IDE/dock shells, and
  **`spawnSession()` does not return the new id** (you'd read `activeSessionId` after).
  For Wave 2's fixed two-frame, one-terminal-each layout that machinery is dead weight.
  Decision 3 (ADR) chooses a thin workbench-owned hook instead.

## `useTerminalSessions` spawn reference (for the thin hook)

`spawnSession(optionalCwd?: string)` internally: generates
`term-${Date.now()}-${rand}` id → `window.electronAPI.pty.spawn(id, { cwd })` → pushes
to `sessions` → sets `activeSessionId`. `cwd` falls back to
`config.get('defaultProjectRoot')`. Cleanup: `handleTerminalClose(id)` → `pty.kill`;
`pty.onExit` marks `status:'exited'`. The thin hook mirrors just spawn + kill with
caller-owned ids.

## Tinted-well token chain (must stay intact, must NOT double-tint)

Three distinct tokens, set in two places:

- `--term-bg` — the **glass panel** behind the terminal. `TerminalShell`'s well `<div>`
  already sets `background: var(--term-bg)` + `boxShadow: var(--term-inset)`. Keep this.
- `--term-canvas-bg` — the **xterm canvas** background. Driven inside the real terminal:
  `buildXtermTheme()` (`terminalHelpers.ts:75`) and `CONTAINER_STYLE`
  (`TerminalInstanceView.helpers.ts:33`).
- `--terminal-canvas-opacity` — CSS opacity applied to the xterm wrapper
  (`TerminalInstanceView.helpers.ts`). **Do NOT** wrap `<TerminalInstance>` in an
  additional `opacity` layer inside `TerminalShell` — that double-tints. The well `<div>`
  sets panel bg only; the canvas/opacity are the terminal's own job.

DOM renderer is the sole renderer (`@xterm/addon-webgl` installed but not loaded —
`useTerminalSetup.lifecycle.ts:121-127`); `allowTransparency:true` works only under DOM.

## Fit-timing + lifecycle gotchas (carry into briefs)

- **pty must exist before `onData` registers.** Issue `pty.spawn` before/at the mount of
  `<TerminalInstance>`; if the listener registers against a not-yet-spawned id, later
  output goes nowhere. Verify with the smoke (typed output appears).
- **Zero-height well breaks the first fit.** The well body is `flex:1; minHeight:0`. If
  its measured height is 0 at mount (collapsed grid cell), the double-rAF fires with zero
  dims, `proposeDimensions()` returns `undefined`, first fit is a no-op — scrollback wraps
  at wrong columns until the ResizeObserver recovers. Ensure the grid cell is sized.
- **`isReadyRef` double-rAF guard** (`createReadyObserver`, lifecycle.ts:261-273) gates
  every fit; it survives reuse — don't fight it.
- **Write-buffer rAF** (`setupDataBridge`, `useTerminalSetupData.ts:64-83`) batches
  `pty.onData` → `term.write` on rAF; input is synchronous `pty.write`.
- **`useSessionRestore` replays serialized output** on first mount for a *reused* id.
  Generate **fresh ids per mount**; don't reuse a session id across flag toggles or it
  replays stale scrollback into the new xterm.

## Divider (the other half of the wave)

- `TerminalManagerSplitPane.tsx` exports `useSplitResize` + `SplitPaneLayoutFrame` — but
  it is **horizontal-only** (`moveEvent.clientX / rect.width`, ~line 73). The Wave 2
  divider is **vertical** (`clientY / rect.height`, `row-resize`). Fork it with a
  `direction` param or write a small vertical-only resize hook. The Wave 1 `CenterPane`
  divider is an inert visual handle today (`CenterPane.tsx:40-61`) — wire it.
- Persistence precedent: `useDockSlotHeights` (localStorage + electron-store) in the dock.
  Wave 2 persists a single split ratio to a config key (ADR Decision 4).

## Key file inventory

| File | Role for Wave 2 |
|---|---|
| `Workbench/Terminals/TerminalShell.tsx` | **Rewrite** — mock body → `<TerminalInstance>` |
| `Workbench/Terminals/CenterPane.tsx` | **Edit** — own sessions, wire divider drag |
| `Terminal/TerminalInstance.tsx` | **Reuse** — the component mounted (props: `sessionId`, `isActive`) |
| `hooks/useTerminalSessions.ts` | Reference for the thin spawn/kill hook |
| `Terminal/terminalHelpers.ts` | `buildXtermTheme` — tinted-well canvas tokens |
| `Terminal/TerminalManagerSplitPane.tsx` | `useSplitResize` — horizontal; fork for vertical |
| `.claude/vendor-gotchas/xterm.md` | xterm v6 / DOM-renderer / transparency gotchas |
