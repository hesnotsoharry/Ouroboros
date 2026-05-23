---
status: RESOLVED
resolved: 2026-05-23
resolved_by: wave-9-canon-workbench-session-restore
created: 2026-05-22
updated: 2026-05-23
severity: MED
area: Workbench / Terminals
origin: Wave 8 Phase 4 (split out by Cole's decision, 2026-05-22)
blocks: wave-9-cutover (soft — see "Cutover note")
---

# Canon Workbench — session-restore-on-launch (split-out wave)

> **RESOLVED 2026-05-23 by Wave 9** (`roadmap/wave-9-canon-workbench-session-restore/`). The architect's "Option C — extend `PersistedSessionInfo` IPC + verify storage" plan below was partly invalidated mid-wave: Phase 0 diagnostic found the architect's narrative said "electron-store" but the target (`PersistedSessionInfo` + `pty:listPersistedSessions`) is the SQLite Store B, not electron-store Store A. The fields the architect wanted to expose ARE already end-to-end via Store A (`terminalSessions` key → `TerminalSessionSnapshot`). Wave 9 re-targeted to Store A, added a new `canonWorkbenchSessions` key for canon-side writes (to avoid mutual-exclusion vs legacy `terminalSessions`), and shipped renderer-only without any IPC change. **Steps 1-2 below (IPC extension + handler passthrough verification) are N/A — superseded by Wave 9 ADR D4.** Steps 3-7 (renderer hook + integration) are preserved in shape, retargeted at Store A. See `roadmap/wave-9-canon-workbench-session-restore/wave-9-result.md` for the full account.

## Why this is its own wave

Wave 8 (canon parity round 2) was scoped renderer-only. Session-restore architecturally FITS
the canon two-frame model (architect validation 2026-05-22), but the clean implementation needs
(a) a **main-process IPC change** and (b) a **user-facing behavior change** (auto `claude --resume`
on relaunch). Cole's call: split it out so Wave 8 stays renderer-only and shippable, and restore
gets its own design + implementation pass. ADR: `roadmap/wave-8-workbench-canon-parity-2/wave-8-decisions.md` D4.

## Product intent (Cole, RESOLVED 2026-05-22)

KEEP session-restore; terminal-first users rely on session survival across restarts. Adapt it to
the canon **two fixed frames** (upper `claude`, lower shell) — restore the two frames' prior
working directories and offer `claude --resume` for the upper frame — NOT restore arbitrary N
dock sessions.

## Architect-validated integration plan (sonnet-architect, 2026-05-22)

Verdict: **FITS via the data layer (Option C)**. The "N arbitrary sessions" problem is confined
to the `RestoreSessionsGate` dialog + `restore(id)` action; the underlying persisted data is
per-session with `cwd` + `isClaude` and maps cleanly to two frames. `RestoreSessionsGate.tsx` is
~44 lines, purely presentational — the canon shell should NOT mount it; it should read the data
hook directly.

**The one concrete API gap:** `PersistedSessionInfo` (the IPC read type,
`src/renderer/types/electron-runtime-apis.d.ts:60–68`) omits `claudeSessionId` / `isClaude`.
Those ARE persisted (in `SavedSessionSnapshot`, `useTerminalSessions.sync.helpers.ts:7–14`,
written to electron-store key `terminalSessions`) but stripped on the IPC read. So `--resume`
needs the type + handler extended.

**Implementation steps (in order):**
1. **Extend `PersistedSessionInfo`** with `isClaude?: boolean` + `claudeSessionId?: string`;
   update the main-side `listPersistedSessions` handler (`src/main/ipc-handlers/ptyPersistence.ts`)
   to pass those through from the stored `SavedSessionSnapshot`. (Confirm the handler currently
   reads/returns them — if it discards them, adding the type field is only half the fix.)
2. **Thread `persistTerminalSessions`** into the canon Workbench (today it only reaches the legacy
   `InnerAppLayout` prop chain via `App`/`App.helpers`). The canon `Workbench` needs it so restore
   no-ops when off.
3. **`useWorkbenchRestore` hook** (`src/renderer/components/Workbench/Terminals/useWorkbenchRestore.ts`):
   reads `usePersistedTerminalSessions()` (read-only — does NOT call `restore()/restoreAll()`);
   returns `{ upperCwd, lowerCwd, resumeSessionId, isReady }`. Maps N sessions → at-most-2:
   `isClaude===true` entry → upper cwd + `resumeSessionId`; first non-claude (or `sessions[0]`) →
   lower cwd. Calls `discardAll()` once consumed. Flag off / loading / empty → all-undefined,
   `isReady: !isLoading`.
4. **Thread restored cwd into `useWorkbenchTerminals`** — accept optional `restoredCwds`; use
   `restoredCwds.upper ?? projectRootRef.current` (and lower). **Gate the spawn effect on
   `isReady`** (add to deps + early-return) so spawn fires once, after restore data is in hand.
5. **Upper-frame `spawnClaude` for resume** — when `resumeSessionId` non-null, spawn upper via
   `pty.spawnClaude(id, { cwd, resumeMode: resumeSessionId })` (`electron-runtime-apis.d.ts:83`,
   `ptySpawn.ts:29–33`); else plain `pty.spawn` (current behavior). Lower always plain spawn.
6. **Do NOT mount `RestoreSessionsGate`** in the Workbench (restore is transparent at spawn time).
7. **`persistTerminalSessions` off → no-op** (`isReady` true immediately, project-root cwd).

**Startup-race analysis (the honeycomb risk):** `isReady` is a one-way latch
(`isLoading` only goes true→false once), so no double-spawn. StrictMode's mount→cleanup→mount
still hits the existing `pendingKillsRef.size > 0` cancel-kills branch when `isReady` is true on
the second mount. IPC failure → empty sessions → spawn proceeds with project-root cwd (correct
degrade). Spawn timing shifts from immediate to ~50–100ms post-mount (one electron-store read) —
imperceptible, and the legacy shell already blocked on the same.

**Implementation risks to brief the implementer on:**
- Verify the `listPersistedSessions` handler actually carries `isClaude`/`claudeSessionId` from the
  store (Step 1 may be a two-part fix).
- Adding `isReady` to `useWorkbenchTerminals`' empty-dep spawn effect changes its lifecycle —
  re-verify the StrictMode cancel-kill path; existing `useWorkbenchTerminals` tests should catch a
  regression.
- `spawnClaude` auto-launches `claude` — keep it STRICTLY conditional on non-null `resumeSessionId`
  so the no-restore path stays a plain shell.
- `discardAll()` must run AFTER cwds are read; it's idempotent on empty store.
- Single-session / no-claude-session degrade: upper falls back to project-root cwd (never undefined).

**UX decision to settle in the split wave:** today the upper frame is a plain shell the user types
`claude` into; auto-`--resume` on relaunch is a behavior change. Confirm with Cole whether restore
should auto-launch the resumed claude session or only restore cwd and let the user launch. Also
whether the legacy "choose which sessions to restore" dialog UX matters in the canon shell (the
plan above drops it for transparent auto-restore).

## Cutover note (Wave 9)

The legacy `RestoreSessionsGate` restore behavior is NOT in the canon shell until this wave lands.
At Wave 9 cutover, flag session-restore as a known parity gap; sequence so the legacy restore path
isn't deleted before this lands (or accept a temporary restore gap with Cole's sign-off).
