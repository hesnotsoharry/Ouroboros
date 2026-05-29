---
status: OPEN
created: 2026-05-28
updated: 2026-05-28
---

# No `session_stop.mjs` hook — external/top-level sessions stay "running"/"thinking"

## Problem

There is no `assets/hooks/session_stop.mjs` hook script. Only `session_start.mjs`
and `agent_end.mjs` exist. Claude Code fires a `SessionStop` event at top-level
session exit, but with no hook script installed for it, no `session_stop` event
ever reaches the IDE's named pipe.

Consequence: any top-level `claude` session the IDE tracks (notably **external**
sessions running outside the app, which emit `session_start` to the pipe via the
globally-installed hooks) registers as a session and is **never cleared** when it
ends — it sits in the renderer store as `running`/`thinking` until the
`AGENT_END_FORCE_FINALIZE` safety timeout (`FORCE_FINALIZE_TIMEOUT_MS`) eventually
reaps it. This is the likely cause behind the earlier observation that external
sessions show as perpetually "running" in the title-bar globe.

The renderer already HANDLES a `session_stop` event (`dispatchLifecycleEvent` has
a `session_stop` case) — the gap is purely that the emitting hook script is absent.

## Evidence

- `assets/hooks/` contains `session_start.mjs` + `agent_end.mjs`, no `session_stop.mjs`.
- Renderer `dispatchLifecycleEvent` (`useAgentEvents*`) has a `session_stop` case
  with no producer.
- Diagnosed during the 2026-05-28 phantom-session investigation (the usage-poller
  case was fixed separately via `OUROBOROS_CHAT_SESSION=1` suppression; this is the
  residual general gap for sessions that SHOULD be tracked and then cleanly ended).

## Proposed fix

1. Add `assets/hooks/session_stop.mjs` mirroring `agent_end.mjs`'s structure
   (early-exit on `OUROBOROS_CHAT_SESSION`/`shouldSkipForNoIde`, load token, read
   stdin, send a `{ type: 'session_stop', sessionId, ... }` payload incl. `paneId`
   if set).
2. Wire it into `hookInstaller.ts` (the installer is SHA-tracked; adding the script
   to the install set is enough — it reinstalls on next launch).
3. Verify the renderer reducer transitions the matching session to `idle`/`complete`
   on `session_stop` (the case exists; confirm the state transition + sessionId match).
4. Consider the SessionStop event shape from current Claude Code (verify field names
   via ctx7 / the SDK before assuming `session_id`).

## Scope

~2 files (new hook script + hookInstaller wiring) + a renderer reducer check + a
test. Small, but it's hook-infrastructure (install path + lifecycle) so it warrants
its own slice rather than an inline patch. Pairs with the Wave 13 paneId work.
