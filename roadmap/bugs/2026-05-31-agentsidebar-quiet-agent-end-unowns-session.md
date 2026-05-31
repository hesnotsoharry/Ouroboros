---
status: RESOLVED
created: 2026-05-31
updated: 2026-05-31
resolved: 2026-05-31
branch: merged to master (ea1546f1)
---

# AgentSidebar goes silent after turn 1 — `agent_end` (SubagentStop) un-owns the live session

> **RESOLVED 2026-05-31 — shipped to master.** The symptom spanned THREE distinct
> causes, all fixed + live-verified:
> 1. **agent_end ownership** — `agent_end` (SubagentStop, per-turn) was treated as
>    session-terminal; removed from `TERMINAL_EVENT_TYPES`/`END_EVENT_TYPES`, and the
>    renderer no longer flips the live parent session to complete. Commit `2f35f27d`.
> 2. **Resume removal** — interactive/workbench Claude+Codex session resume reattached
>    stale session ids to panes AND billed expired prompt caches; removed end-to-end
>    (always fresh). Commit `9aea7ce9`. (Resume was a red herring for the misbinding
>    but the correct call on token cost — kept removed. Chat-bridge turn-continuation
>    preserved, 281 tests.)
> 3. **THE misbinding root cause** — `inferSessionId` substituted a guessed session for
>    pane-stamped tool events after a per-turn `session_stop` evicted the session from
>    `activeSessions`. Fix: a payload carrying a `paneId` is authoritative — never
>    remap. Commit `6ad5747f`, **live-trace confirmed**. Investigation trace removed in
>    `1e2f9a70`.
>
> Bug #1 ("timeline freeze from missing toolCallId") remains DEBUNKED. Related new bug
> filed separately: `2026-05-31-commandblockoverlay-disposablestore-leak.md` (LOW).

## Summary

The workbench AgentSidebar stops updating after the first turn of an inner Claude Code
session. **Confirmed by live `[trace:bind]` repro on 2026-05-31** (session
`a01d1809-…`, pane `wb-upper-cc-1780235270072-jz6sae`):

- **Turn 1 works.** Read→Bash→Grep each arrived with a distinct real `tool_use_id`
  (`toolu_01NbsRtz…`, `toolu_015ENSB5…`, `toolu_01P48kR1…`), reducer branch `append`,
  count 0→1→2→3. The sidebar timeline grows.
- **After the turn**, `agent_end` fired (twice: 09:48:28 and 09:48:37), carrying the
  pane's `paneId`, while the session was still alive (a `user_prompt_submit` had just
  arrived at 09:48:27).
- **A tool call ~15 min later (same server) produced ZERO `[trace:bind]` lines** — not
  even `emit`. The event was dropped at the main process before dispatch.

## Root cause (confirmed, two interacting facts)

1. `agent_end.mjs` is bound to Claude Code's **`SubagentStop`** hook
   (`src/main/hookInstallerCommands.ts:62` → `SubagentStop: mjs('agent_end.mjs')`). It
   fires per-turn / per-subagent, NOT at true session end, and arrives on the **parent
   session's** id. It carries `paneId` (`assets/hooks/agent_end.mjs` reads
   `OUROBOROS_PANE_ID`).
2. `agent_end` is in `TERMINAL_EVENT_TYPES` (`src/main/hooks.ts:228`), so
   `dispatchOwnedEvent` runs `ownedSessionIds.delete(payload.sessionId)` (~line 270).
   → a subagent/turn stop **evicts the live parent session's ownership.**
3. Tool events (`pre_tool_use`/`post_tool_use`) arrive with **`paneId: null`**
   (`assets/hooks/pre_tool_use.mjs`, `post_tool_use.mjs` never set it). So once the
   ownership Set is cleared, `isOwnedSession` (`hooks.ts:115`,
   `Boolean(payload.paneId) || ownedSessionIds.has(sessionId)`) returns false → the
   event is never dispatched → sidebar silent.

This is the exact twin of the `session_stop` bug fixed in `02632ed8`; they pulled
`session_stop` out of the terminal set but left `agent_end` in. Same class, same fix.

Likely also the **globe-idle / session-vanishes** symptom: see "renderer audit" below.

## NOT the fix

Do **not** rebind `agent_end.mjs` from `SubagentStop` to `SessionEnd`. `agent_end` also
feeds `subagentTracker.ts`, `subagentLinkTrace.ts`, and per-turn cost (`costUsd` "set on
agent_end for chat bridge sessions"). Rebinding breaks subagent tracking + cost capture.
(A haiku-explorer recommended this; it only looked at the ownership angle. Overruled.)

## The fix (3 parts — `agent_end` must not be treated as session-terminal anywhere)

**Part C — keystone, fixes the sidebar directly and robustly.**
Add `paneId` to the tool hooks so tool events are self-identifying and the sidebar no
longer depends on the ownership Set at all:
- `assets/hooks/pre_tool_use.mjs` — read `const paneId = process.env.OUROBOROS_PANE_ID;`
  and add `if (paneId) payload.paneId = paneId;` to the payload (mirror
  `agent_end.mjs:25,37` / `session_start.mjs`).
- `assets/hooks/post_tool_use.mjs` — same.
- Root CLAUDE.md gotcha already says "both lifecycle hooks must emit paneId"; the tool
  hooks were just never included. This closes that gap.

**Part A — ownership-lifecycle correctness (mirror the session_stop fix).**
- `src/main/hooks.ts:228` — remove `'agent_end'` from `TERMINAL_EVENT_TYPES`
  (leave `'agent_stop'`). Update the comment: agent_end = SubagentStop = per-turn, not
  session end; ownership releases on `agent_stop` (onConnectionDisconnect synthetic) +
  SessionEnd + the 2-hr orphan sweep.

**Part B — audit the other terminal-treatment sites for agent_end (the globe half):**
- `src/main/hooks.ts:209` — `END_EVENT_TYPES` ALSO includes `agent_end` → calls
  `handleSessionEnd` on every SubagentStop. Check what `handleSessionEnd` does; if it
  marks the session ended/removes it, agent_end must be dropped from there too (or the
  handler must distinguish per-turn from true end).
- Renderer `AGENT_END` reducer (`src/renderer/hooks/useAgentEvents.helpers.ts` /
  `useAgentEvents.ts`) — confirm a subagent-stop doesn't flip a live parent session to
  idle/complete (the globe-idle + session-vanish symptom). Fix there if it does.

## Verification

1. Relaunch (`npm run dev` full restart — main + hook reinstall; changing the .mjs bumps
   the SHA-256 hook version so `hookInstaller` re-copies on launch, autoInstallHooks is on).
2. Re-run the repro: inner session, Turn 1 (Read→Bash→Grep), let it end (agent_end fires),
   then Turn 2 (another tool-using prompt).
3. PASS = Turn 2 tool events now show `[trace:bind] emit/recv/toolAttach` lines with a
   non-null `paneId`, branch `append`, count keeps climbing, and the sidebar keeps
   updating across the turn boundary. Globe stays active while the session is alive.
4. Add a regression test (mirror `sessionStartHookPaneId.test.ts`) asserting
   `pre_tool_use.mjs`/`post_tool_use.mjs` emit `paneId` from `OUROBOROS_PANE_ID`.

## Cleanup

Revert the trace-instrumentation commit **`7faef0b7`** ("trace(workbench): [trace:bind]
… REVERT AFTER REPRO") — `git revert 7faef0b7` (or drop it if unpushed; it's local-only,
sitting on pushed base `93ff8325`). Keep any baseline structural logging; remove only the
`[trace:bind]` investigation lines.

## Cross-reference

- Trace instrumentation that proved this: commit `7faef0b7` on
  `freeze-fix-and-wave-101-scaffold`.
- Prior half-fix (same bug class, session_stop): `02632ed8`.
- Bug #1 ("timeline freeze from missing toolCallId") from the prior session's handoff is
  **debunked** — hooks forward `tool_use_id` correctly; that timeline-freeze does not
  reproduce. Do not re-investigate it.
