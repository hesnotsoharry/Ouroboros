---
status: OPEN
created: 2026-05-22
updated: 2026-05-22
severity: HIGH
blocks: wave-8-cutover
---

# Canon workbench agent sidebar is not scoped to the active terminal/project

## Summary

The canon workbench's agent sidebar (5 panels: NOW / Context / Files Touched / Hook
Timeline / Latest Hunk) shows activity for **any `claude` session running on the
machine** — including Claude Code sessions running *outside* the app and the
IDE-runs-in-itself terminal session. It must show data **only for the Claude session
bound to the currently-selected terminal within the currently-selected project/window.**

Surfaced during the live Wave 7 canon-workbench smoke (2026-05-22). User requirement,
verbatim: *"That right side panel needs to show the data for the current terminal I have
selected within the project I have selected."*

This is a **parity gap that blocks Wave 8 cutover** — the canon shell cannot become the
sole shell while its primary agent panel shows the wrong session's data.

## Symptoms (all one root cause)

1. **(Primary)** Sidebar reflects any/all running `claude` sessions, machine-wide.
2. **Context panel stuck at 0% / 0/200k permanently** — same root cause (token stats read
   from the wrong/empty `primary` session). NOT a separate unwired path.
3. **Files Touched** and **Hook Timeline** populate but are noisy — multiple sessions
   writing into one unscoped panel.

## Root cause (code-evident)

`src/renderer/components/Workbench/useWorkbenchAgentData.ts:387`

```ts
const primary = selectPrimarySession(agents);
```

`agents` = `AgentEventsContext.agents`, the full unfiltered list of every `AgentSession`
the named-pipe hook server (`src/main/hooks.ts`) has received — across every `claude`
process on the machine. `selectPrimarySession` (lines ~104-109) is a pure recency/running
heuristic with no knowledge of the active terminal or any `claudeSessionId`.

The missing wire is end-to-end:
`useWorkbenchTerminals` (tracks only `wb-cc-*`/`wb-shell-*` pty IDs, no `claudeSessionId`)
→ `CenterPane` (passes no session identity) → `AgentSidebar.useWorkbenchAgentData()`
called with **no arguments** (`AgentSidebar.tsx:267`, and again in `SidebarHeader`
~`:121`) → `selectPrimarySession(ALL agents)`.

The binding mechanism that exists in the legacy shell (`useClaudeSessionCapture` in
`useTerminalSessions.sync.ts`, which populates `TerminalSession.claudeSessionId`) was
never wired into the workbench's parallel terminal stack. **`AgentSession.id` IS the
`claudeSessionId`** (keyed by hook `session_id` in `useAgentEvents.payload.ts`) — same ID
`useClaudeSessionCapture` captures, so the two sides can be matched once the binding exists.

## Proposed fix (~4-5 files, ~30-50 lines net)

1. **Capture** the upper workbench terminal's (`wb-cc-*`, the one running `claude`)
   `claudeSessionId` — call `useClaudeSessionCapture` (or a shared extraction of it) from
   the workbench terminal stack; expose `claudeSessionId` on `useWorkbenchTerminals`'
   return shape.
2. **Thread** the ID through `CenterPane → Workbench.tsx → AgentSidebar` (lift to
   `Workbench.tsx` state or a small workbench-local context — they're sibling subtrees).
3. **Scope** `useWorkbenchAgentData(claudeSessionId?: string | null)`:
   ```ts
   const primary = claudeSessionId
     ? (agents.find((s) => s.id === claudeSessionId) ?? null)
     : selectPrimarySession(agents); // fallback before a binding exists
   ```
4. **Project-scope the fallback** so even the no-binding path filters `agents` by `cwd`
   matching the active window's `projectRoot` (per-window isolation lives in
   `windowManager.ts` `ManagedWindow.projectRoots`) — otherwise a fresh terminal still
   shows machine-wide sessions before `claude` launches.
5. **Both `AgentSidebar` call sites** must pass the same `claudeSessionId` — the root-level
   call (`:267`) AND the `SidebarHeader` call (`:121`), or the header's active-session
   pick will diverge from the panel stack. Easy to miss.

## Blast radius

- **Legacy AgentMonitor / ~48 `AgentStatus` consumers:** zero risk — `useWorkbenchAgentData`
  is walled off from `AgentStatus` by ADR D1 (Wave 3).
- **Wave-99 `useAgentCompletionIndicators` / `useWorkbenchAttention`:** low — already scoped
  by `claudeSessionId`; untouched by this fix.
- **Frozen tests:** `useWorkbenchAgentData.sessions.acceptance.test.ts` asserts
  `selectPrimarySession` behavior — the fallback `cwd`/`projectRoot` filter will need its
  contract updated. The per-panel derivation tests (`*.filesTouched.test.ts`,
  `*.timeline.test.ts`) operate on a passed `AgentSession` — unaffected.
- **Permission overlay/takeover:** unaffected (reads `ApprovalContext` directly).

## Recommendation

Fold into **Wave 8** as an early phase (cutover prerequisite / parity gap), alongside the
live-FileTree gap (`2026-05-22-workbench-live-filetree.md`) and the three product decisions
(`2026-05-22-workbench-canon-product-decisions.md`). All three are "make the canon shell
correct before deleting the legacy shell" items.

_Diagnosis: sonnet-diagnostician, live Wave 7 smoke session 2026-05-22._
