---
status: RESOLVED
created: 2026-05-21
updated: 2026-05-21
wave: 2
slug: workbench-terminal-integration
---

# Wave 2 — Workbench Terminal Integration · Decisions (ADR)

Decisions committed before any code is written. Grounded in two read-only recon
passes captured in `recon-2.md`. Decision 3 carries the best-practice spectrum per
`~/.claude/rules/best-practice-spectrum.md`; the rest are abbreviated
(Context / Pick / Rationale) routine calls.

## Decision 1: Reuse `TerminalInstance`, do not re-implement the xterm mount

**Context:** The two Workbench terminal frames must become live. The codebase already
owns a battle-tested xterm mount — the hook chain inside
`src/renderer/components/Terminal/TerminalInstance.tsx` (`new Terminal()` → pre-open
addons → `term.open()` → post-open addons → fit/ResizeObserver → pty data/input
bridges). Re-implementing any of that in the Workbench tree would duplicate hard-won
fixes (double-rAF `isReadyRef` guard, DOM-renderer transparency, rAF write-buffer).

**Pick:** Each `TerminalShell` body renders `<TerminalInstance sessionId isActive>`.

**Rationale:** Recon confirmed the whole chain consumes only `ProjectContext`
(`TerminalInstanceController.helpers.ts:9,106`), which `ConfiguredApp` already mounts
above the Workbench branch in `InnerApp` — so the component mounts with no new provider
wiring. Mounting beats re-implementing on every axis: less code, inherits all lifecycle
fixes, single source of truth for terminal behavior.

**Consequences:** Workbench terminals track `TerminalInstance`'s behavior automatically.
The `sessionId`/`isActive` prop contract is the seam; the parent owns session creation.

## Decision 2: Workbench-owned independent pty sessions

**Context:** Should the workbench's terminals be the same pty sessions as the existing
IDE/chat shells (continuity across the experimental-flag toggle), or its own?

**Pick:** Workbench-owned, independent sessions. Do **not** mount
`ProjectTerminalsContext` or reuse `DockSlot`. (Cole delegated this to the best technical
call.)

**Rationale:** The shell is flag-gated and experimental; isolation is the simplest
correct posture and avoids pulling cross-shell session-routing + Wave 89–99
agent-completion coupling into the Workbench tree now. Sharing is reconsidered at the
Wave 7 cutover, when the workbench becomes the sole shell and continuity actually matters.

**Consequences:** Toggling the flag does not carry a running session across shells —
acceptable during parity. Cross-shell session sharing is deferred to Wave 7.

## Decision 3: Thin workbench-owned session hook, not `useTerminalSessions` wholesale

**Context:** `CenterPane` needs to own exactly two pty sessions (upper + lower) and hand
their ids to the two `TerminalShell`s. Where do those ids come from?

**Options considered:**
- *Industry standard:* **Reuse the existing session manager** (`useTerminalSessions`).
  It already encapsulates spawn/kill/exit/title and has zero context deps. But it manages
  a **sessions array** with tab / recording / split / reorder semantics built for the
  multi-tab IDE and dock shells, and `spawnSession()` does **not** return the new id (you
  read `activeSessionId` after — racy when spawning two in a batch).
- *Emerging best practice:* **A thin purpose-built hook** (`useWorkbenchTerminals`) that
  spawns exactly the two fixed ptys with caller-owned ids via
  `window.electronAPI.pty.spawn(id,{cwd})`, tracks exit, and kills both on unmount —
  exposing `{ upperSessionId, lowerSessionId, statuses }`. Owns only what the two-frame
  layout needs.
- *Experimental / cutting-edge:* **Generalize a shared `useFixedTerminalGrid` primitive**
  now, anticipating the eventual multi-pane workbench. Premature — the shape isn't known.

**Pick:** Thin purpose-built hook (`useWorkbenchTerminals`) — *emerging best practice* tier.

**Rationale:** YAGNI. Wave 2's layout is two fixed frames, one terminal each (Decision 6);
`useTerminalSessions`' array/tab/recording/split/reorder surface is dead weight here, and
its no-return-id spawn is an awkward fit for a deterministic two-session layout. A small
hook with caller-owned ids is the honest shape, sidesteps the spawn-id wrinkle, and keeps
the seam minimal. It converges with `useTerminalSessions` only when multi-tab actually
lands.

**Consequences:** A new small hook to maintain. When multi-tab arrives (later wave), this
hook either grows or is replaced by the array model — revisit then. Spawn/kill logic is
mirrored (not shared) with `useTerminalSessions`; both call the same `pty.*` IPC, so drift
risk is low.

## Decision 4: Divider — draggable vertical `row-resize` + persisted split ratio

**Context:** Wave 1's `CenterPane` divider is an inert visual handle. Cole locked
"draggable + persisted."

**Pick:** A vertical `row-resize` hook (forked from / parameterizing `useSplitResize`,
which is horizontal-only) drives the split fraction; persist to new config key
`layout.workbenchTerminalSplit` (number, default `0.62`); restore on mount; persist on
drag-**end** (not per move).

**Rationale:** Matches the dock's `useDockSlotHeights` persistence precedent and the
canon's adjustable panes. Persist-on-drag-end avoids a config write storm. `useSplitResize`
reads `clientX`/`rect.width` — the vertical axis needs `clientY`/`rect.height`, so it's a
fork with a `direction` param, not a blind reuse.

**Consequences:** One new config key (renderer + main type files + default). xterm reflows
on resize via its existing ResizeObserver — no manual `fit()` call needed.

## Decision 5: Tinted well preserved, not double-tinted

**Context:** The Wave 1 `TerminalShell` well `<div>` sets `background: var(--term-bg)` +
`boxShadow: var(--term-inset)` (the glass panel). The real terminal tints its own canvas
via `--term-canvas-bg` and applies `--terminal-canvas-opacity` to its wrapper (the
terminal-glass-fix, v2.21.1, DOM renderer).

**Pick:** Keep the well `<div>`'s `--term-bg`/`--term-inset`; do **not** add any extra
`opacity` wrapper around `<TerminalInstance>`. The canvas bg + opacity stay the terminal's
own job.

**Rationale:** Recon gotcha — wrapping `TerminalInstanceView` in a second opacity layer
double-tints and washes the canvas out. Three distinct tokens (`--term-bg` panel,
`--term-canvas-bg` canvas, `--terminal-canvas-opacity` wrapper) must each live in exactly
one place.

**Consequences:** `/ui-smoke 2` visually confirms legibility of live text behind the well.

## Decision 6: One live terminal per frame; multi-tab and Claude auto-launch deferred

**Context:** The canon frames carry a tab bar and an upper "CC" (Claude Code) vs lower
"shell" distinction. How much of that is real in Wave 2?

**Pick:** Both frames spawn a **plain shell pty**. The 30px tab bar stays as a single-tab
affordance reflecting the live session. Multi-tab management is out. The upper frame is
**not** auto-launched into `claude` this wave.

**Rationale:** Wave 2's job is "mount real xterm." Auto-launching `claude` and the
CC-specific Agent-Globe binding belong with the hook pipeline / state machine in Wave 3;
multi-tab is a separate concern with its own session-array needs. Keeping both frames as
plain ptys is the conservative in-scope call and keeps the seam minimal.

**Consequences:** The two frames are functionally identical live shells this wave; the
visual CC/shell distinction (prompt-box styling) was mock and is dropped from the live
path. The tab-bar `+`/split/maximize buttons remain non-functional affordances. Wave 3
adds the CC binding.
