---
status: RESOLVED
created: 2026-05-22
updated: 2026-05-24
resolved-by-wave: 13
severity: HIGH
blocks: wave-9-cutover (soft — see "Why HIGH")
relates: 2026-05-22-workbench-sidebar-session-scoping.md
---

# Canon workbench `claudeSessionId` binding is a weak heuristic — external/IDE-in-itself sessions can hijack it

## Summary

Wave 8 Phase 1 session-scoped the canon agent sidebar: `useWorkbenchAgentData(claudeSessionId?)`
now returns the bound session directly when an id is supplied, and the scoping *logic* is correct
and frozen-test-covered. But the **binding** that produces that id is a weak heuristic that can bind
to the wrong `claude` session — defeating the wave's motivating requirement in a scenario Cole hits
routinely (running the IDE from a `claude` terminal session — "IDE runs in itself").

## Root cause

`useWorkbenchClaudeCapture` (`src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts`)
rebinds `claudeSessionId` to the `session_id` of **any** binding-class agent event
(`TERMINAL_BIND_TRIGGER_TYPES`), regardless of which pty the event came from. Hook events carry the
Claude `session_id`, not the workbench pty id (`wb-cc-*`), so the renderer has no reliable way to
associate a captured session with the upper terminal — it just takes "whoever last sent a binding
event."

Consequences:
- An **external** `claude` session (another terminal/app) emitting a binding event rebinds the id.
- The **IDE-runs-in-itself** session (the outer `claude` that launched `npm run dev`) emits binding
  events too → can hijack the binding.
- The **bound path bypasses the project-cwd filter** (by design — explicit binding is supposed to win),
  so the fallback that bounds the no-binding case does NOT rescue a wrong binding once it happens.

This is the same class of limitation flagged as Wave-99 debt in the original scoping diagnosis
(`2026-05-22-workbench-sidebar-session-scoping.md`) and explicitly accepted by the Wave 8 plan
("accept the heuristic; don't over-engineer a perfect binding this wave"). Filed separately because
the IDE-in-itself hijack is more central to the bug's motivation than the background-launch case the
plan cited, and the proper fix crosses the renderer-only boundary.

## Proper fix (deferred — main-process scope)

Forward the real `CLAUDE_SESSION_ID` from the pty spawn payload so the renderer can bind the upper
`wb-cc-*` terminal to its actual claude session deterministically, instead of guessing by event
timing. This touches the main-process pty spawn path + the IPC/preload surface — out of scope for the
renderer-only Wave 8. The legacy shell's `useClaudeSessionCapture` has a related (active-terminal)
heuristic with the same underlying gap.

A renderer-only partial mitigation (filter binding events by payload `cwd` matching the active project
root) was considered and rejected: binding-event payloads don't reliably carry `cwd`, and an external
session in the *same* project would still hijack. There is no clean renderer-only full fix.

## Why HIGH

The scoping *logic* is correct and shipped, so the sidebar is correct **whenever the binding is
correct** — which is the common single-`claude`-terminal case (plain `npm run dev`, no external
session). But in Cole's frequent dev-in-itself workflow the binding can latch onto the outer session,
which is exactly the "shows the wrong session" symptom the wave set out to kill. Wave 9 cutover should
not proceed assuming the requirement is fully met until either this is fixed or the smoke confirms the
common case is acceptable and the hijack case is understood as a known limitation.

## Verification at next smoke

The Wave 8 wave-end smoke (`/ui-smoke 8`) MUST include the IDE-runs-in-itself scenario explicitly:
open the canon workbench with the flag on, run `claude` in the upper terminal, AND have the outer
launching `claude` session active — confirm whether the sidebar tracks the upper terminal's session or
gets hijacked by the outer one. Record the result.

_Surfaced by sonnet-phase-reviewer during Wave 8 Phase 1 review, 2026-05-22._

## Resolution (Wave 13)

Closed by `haiku-followup-auditor` during wave audit on 2026-05-24.

Wave 13 Phase 2 shipped the proper fix across the main-process + IPC + renderer boundary:
- Phase 1: `pty.ts` + `hooks.ts` forward `OUROBOROS_PANE_ID` from env → hook payload.paneId.
- Phase 2: `AgentSidebar.tsx` derives `paneId` deterministically from `useActiveWorkbenchFrame` + `useWorkbenchTabs`; `useWorkbenchAgentData.resolvePrimary` filters sessions by `session.paneId === activeTab.id` (no longer relying on event-timing heuristics). Deleted `useWorkbenchClaudeCapture` hook entirely (`src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts` lines 158–192 removed).
- External sessions: their pty was not spawned with `OUROBOROS_PANE_ID`, so `session.paneId` is undefined, and `resolvePrimary` finds no match → D4 empty state. Hijack closed by construction, not by heuristic.

Evidence: Wave 13 result brief section "Wave 13 architecture (the deterministic chain)" (lines 40–82) explicitly solves the IDE-in-itself hijack scenario described in this follow-up's §Why HIGH. Commit `90eb8dd1` Phase 2 deleted `useWorkbenchClaudeCapture` and re-keyed binding to paneId (verified in diff `git diff 1ddbcf73..HEAD -- src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts`).
