---
status: OPEN
created: 2026-05-30
updated: 2026-05-30
priority: LOW
---

# `handleSessionEnd` / `onSessionEnd` activation event fires every turn, not once

Surfaced while fixing `session_stop` ownership in commit `02632ed8` (see
`2026-05-30-session-stop-unowns-multiturn-tool-events.md`).

## Detail
In `src/main/hooks.ts`, `session_stop` remains in `END_EVENT_TYPES` (correct — it
drives legitimate per-turn lifecycle work: CLAUDE.md generation, gotcha nudge,
extension activation). One of those paths, `handleSessionEnd`, calls
`dispatchActivationEvent('onSessionEnd')`. Because Claude Code's `Stop` hook fires
`session_stop` at the end of EVERY turn (the root insight behind the ownership fix),
`onSessionEnd` is dispatched once per turn — not once per true session end.

## Impact
LOW / latent. Any extension that registers an `onSessionEnd` activation handler
expecting it to mean "the session is over" will be invoked on every turn. No current
extension is known to misbehave, but the semantics are wrong and could bite when the
extension surface grows.

## Fix shape
Decide the intended contract for `onSessionEnd`:
- If it should mean true session end, drive it from `agent_end` / the
  `onConnectionDisconnect` synthetic instead of `session_stop` (mirror the ownership
  fix), and introduce a distinct per-turn activation event (`onTurnEnd`?) if any
  consumer actually wants per-turn.
- If per-turn is acceptable for current consumers, rename for honesty and document.
Verify against the extension activation registry before changing — there may be
consumers relying on the current (per-turn) behavior.

## Priority
LOW. File-and-watch; promote if an extension depends on correct session-end timing.
