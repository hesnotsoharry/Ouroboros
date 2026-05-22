---
status: DRAFT
created: 2026-05-22
updated: 2026-05-22
---

# Wave 8 — Architecture Decisions

## Decision 1: How to scope the agent sidebar to the active session

**Context:** `useWorkbenchAgentData` selects from the global `AgentEventsContext.agents`
pool, so the canon sidebar shows any `claude` session machine-wide. The sidebar must reflect
only the session bound to the active workbench terminal in the active project.

**Options considered:**
- *Industry standard:* Pass the entity identity down the component tree and filter at the
  data hook (controlled-component / lifting-state-up). The consumer scopes its own view.
- *Emerging best practice:* A scoped React context provider per active session that the
  sidebar subscribes to.
- *Experimental:* A selector library (e.g. signals/atoms keyed by session id) over the events
  store.

**Pick:** Industry standard — bind + thread + scope. — *standard*

**Rationale:** The events store is already a context; the missing piece is identity, not
infrastructure. Threading the bound `claudeSessionId` and filtering in `useWorkbenchAgentData`
is the minimal correct change, mirrors the legacy shell's existing `useClaudeSessionCapture`
binding, and stays walled off from the canonical `AgentStatus` (ADR D1 from Wave 3). A new
context/atom layer would be over-engineering for a 4-5 file scoping fix.

**Consequences:** Adds a `claudeSessionId` field to `useWorkbenchTerminals` and a parameter to
`useWorkbenchAgentData`; both `AgentSidebar` call sites must pass it. `selectPrimarySession`
stays as the no-binding fallback but gains a project-`cwd` filter. The capture heuristic's
known mis-bind cases (Wave 99 debt) are inherited, bounded by the fallback filter.

## Decision 2: Canon FileTree — reuse legacy component or build canon-styled

**Context:** `InnerRail` renders `MOCK_FILE_TREE`. Canon §07 specifies a live, specifically
styled tree. The legacy `FileTree`/`SidebarSections` exist but are slated for Wave 9 teardown.

**Options considered:**
- *Industry standard:* Reuse the existing `FileTree` component inside the rail — fastest.
- *Emerging best practice:* Reuse only the data layer (`useFileWatcher` + project roots +
  `window.electronAPI.files`); render a Workbench-local canon-styled tree.

**Pick:** Reuse the data layer, build a canon-styled tree. — *emerging*

**Rationale:** The legacy `FileTree` component is deleted in Wave 9 — making the canon shell
depend on it would create a teardown coupling we'd immediately have to unwind. The data layer
(`useFileWatcher`, IPC files API) is NOT going away. Canon §07 styling (depth×12px, dir icon
`--accent-hi`, file `--ink-3`, M/A badges) differs from the legacy tree's anyway.

**Consequences:** A bit more rendering code now; the canon shell owns its tree end-to-end and
Wave 9 teardown is a clean delete with no canon dependency to migrate.

## Decision 3: FilePicker delivery surface

**Context:** Cole resolved FilePicker → fold into the Ctrl-K palette (no standalone overlay).
The rail "Search files" button (§07) needs a target.

**Options considered:**
- *Standard:* Register a file-quick-open command in the existing command registry that both
  the button and Ctrl-K reach.
- *Alternative:* A dedicated palette "mode" for files separate from commands.

**Pick:** A file-quick-open command in the registry. — *standard*

**Rationale:** The Wave 7 palette + `useCommandRegistry` already exist; a command is the
lowest-friction surface and keeps one palette. The button just dispatches the command.

**Consequences:** File search lives alongside commands in one palette (acceptable per the
product decision). If a richer file-search UX is wanted later, it can graduate to its own mode.

## Decision 4: Session-restore in the canon two-frame model — PENDING architect validation

**Context:** Cole resolved session-restore → KEEP. But the canon shell has **two fixed
frames** (upper `claude`, lower shell, auto-spawned on mount by `useWorkbenchTerminals`),
whereas the legacy `RestoreSessionsGate` restores **N arbitrary dock sessions**. These models
do not map 1:1, so "wire `RestoreSessionsGate` in" is not a clean drop-in.

**Proposed pick (to validate, NOT yet locked):** Adapt restore to the two-frame model —
restore the two frames' prior working directories and offer `claude --resume` for the upper
frame — rather than restoring arbitrary N terminals.

**Why this is not yet locked:** It depends on `RestoreSessionsGate`'s actual API and what
`persistTerminalSessions` actually persists (session list shape, cwd, claude session ids).
Phase 4 opens with a `sonnet-architect` read of `RestoreSessionsGate.tsx` +
`useTerminalSessions` restore path to confirm the adaptation fits — and revises this decision
(or splits Phase 4 to its own wave) if the gap is larger than expected.

**Consequences if validated:** Restore preserves the terminal-first user's working context
across restarts without contorting the canon two-frame model. If invalidated, session-restore
becomes a standalone wave and Wave 9 cutover proceeds with restore explicitly deferred (and
flagged to Cole as a parity gap that didn't make this round).
