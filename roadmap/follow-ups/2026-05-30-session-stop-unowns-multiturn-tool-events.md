---
status: OPEN
created: 2026-05-30
updated: 2026-05-30
priority: HIGH
---

# `session_stop` un-owns the session → multi-turn tool events dropped

**Priority: HIGH** — this is the actual reason the AgentSidebar still doesn't populate tool calls after the first turn, even now that pane-binding is fixed (commit `d4fc7318`). Fix this next; the sidebar feature is not usable without it.

## Symptom (live-verified 2026-05-30)
First prompt's timeline populates, but the agent's tool calls and any subsequent prompt never appear in the sidebar. Globe/sidebar go quiet after turn 1.

## Root cause (confirmed via `[trace:hookserver]` instrumentation)
`src/main/hooks.ts`, the named-pipe server:
- `dispatchToRenderer` (~line 261) adds a session to `ownedSessionIds` when an event carries a `paneId`, then **drops any event whose session is not owned** (`if (!isOwnedSession(...)) return;`, ~line 268).
- `TERMINAL_EVENT_TYPES = {'session_stop', 'agent_end'}` (~line 224) causes `ownedSessionIds.delete(sessionId)` **after dispatch** (~line 256-258).
- **But Claude Code's Stop hook (→ `session_stop`) fires at the END OF EVERY TURN, not at session end.** So after turn 1's `session_stop`, the session is removed from the owned set, and every later turn's `pre_tool_use`/`post_tool_use` arrives with `paneId: null` (tool hooks don't carry paneId) and `owned: false` → **dropped before reaching the renderer.**

Live evidence: session `1816bc95-...` logged `owned: true` through its first `user_prompt_submit`, then `session_stop` at 20:10:03, then every subsequent event (`user_prompt_submit`, `pre_tool_use`, `post_tool_use`) flipped to `owned: false`. It only re-owned on `agent_end` (which DOES carry paneId) at the very end.

## Fix shape (don't blind-code — verify hook-script semantics first)
- Stop treating per-turn `session_stop` as ownership-terminal. Remove `session_stop` from `TERMINAL_EVENT_TYPES` so ownership persists across turns; release ownership only on a true session end (`agent_end`, plus the connection-disconnect synthetic `agent_stop` in `onConnectionDisconnect`).
- First confirm which hook script emits `session_stop` vs `agent_end` and their real lifecycle (`assets/hooks/*.mjs`): `session_stop` = per-turn Stop; `agent_end` = true end. Check `END_EVENT_TYPES` (~line 209) too — `handleSessionEnd`/`handleSessionStop` may rely on `session_stop` for non-ownership cleanup; don't break those.
- **Caution:** confirm the change doesn't leak ownership for sessions that never emit `agent_end` (the 5-min `evictOrphanedSessions` interval + `onConnectionDisconnect` should backstop, but verify).

## Verification
Temporarily re-add the `[trace:hookserver]` log in `dispatchToRenderer` (it logs `{type, sessionId, paneId, owned}`). After the fix, a 2nd-turn `pre_tool_use` should show `owned: true`, reach the renderer, and the sidebar's tool-call data should populate across turns.

## Source
Surfaced during the live verification of the WorkbenchTabsProvider fix (commit `d4fc7318`). Pre-existing — `hooks.ts` ownership logic was not touched by that fix. See `roadmap/bugs/2026-05-30-workbench-tab-state-instance-split.md`.
