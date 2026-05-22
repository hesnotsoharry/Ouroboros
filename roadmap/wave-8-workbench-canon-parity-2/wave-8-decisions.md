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

**Pick (REVISED by Cole 2026-05-22 — see below):** A file-quick-open command in the registry. — *standard*

**Rationale:** The Wave 7 palette + `useCommandRegistry` already exist; a command is the
lowest-friction surface and keeps one palette. The button just dispatches the command.

**Consequences:** File search lives alongside commands in one palette (acceptable per the
product decision). If a richer file-search UX is wanted later, it can graduate to its own mode.

**REVISION (Cole, 2026-05-22).** During Phase 3 planning, investigation surfaced that the
canon shell has **no file-open destination** (no editor/viewer pane) — selecting a file in a
quick-open had nowhere to go — AND that the legacy `FilePickerConnected` is mounted nowhere
(dormant), so the original "fold into a command" framing solved the wrong half. Cole's
direction: **reuse the existing full-featured `FileViewer/` subsystem (Monaco-based,
view + edit) as a MODAL in the canon shell.** The command + Ctrl-K palette + rail "Search
files" button still drive quick-open (selection), but the selected file opens in the ported
`FileViewer` modal (full view/edit), not "a command that does nothing." `FileViewer/` is NOT
in the Wave 9 teardown scope (only `Layout/**` + `Editor*` wrappers are), so the canon shell
must mount `FileViewer`/`FileViewerManager` **directly**, not via the legacy `Layout/Editor*`
host components. This supersedes the "no standalone overlay / a single command" framing above.
Phase 3 re-planned accordingly (architect pass: reuse plan + coupling assessment).

## Decision 4: Session-restore in the canon two-frame model — RESOLVED: SPLIT to its own wave

**Context:** Cole resolved session-restore → KEEP. The canon shell has **two fixed frames**
(upper `claude`, lower shell, auto-spawned on mount by `useWorkbenchTerminals`), whereas the
legacy `RestoreSessionsGate` restores **N arbitrary dock sessions**.

**Architect validation (2026-05-22, `sonnet-architect`):** the adaptation FITS the actual APIs
(the "N sessions" concern lives only in the dialog/`restore(id)` layer; the underlying data —
`usePersistedTerminalSessions` → `listPersistedSessions` IPC → electron-store `terminalSessions`
— exposes `cwd` per session and maps cleanly to two frames). BUT the clean implementation
requires:
- a **main-process IPC change** — `PersistedSessionInfo` (the read type) omits `claudeSessionId`
  / `isClaude`; they're persisted in `SavedSessionSnapshot` but stripped on the IPC read, so
  offering `claude --resume` for the upper frame needs the type + `listPersistedSessions`
  handler extended (or an abstraction-violating direct electron-store read from the renderer);
- a **user-facing behavior change** — the upper frame would auto-`spawnClaude({resumeMode})` on
  relaunch instead of being a plain shell the user types `claude` into.

**Pick:** **SPLIT Phase 4 into its own wave** (Cole, 2026-05-22). — *scope decision*

**Rationale:** Wave 8 is scoped renderer-only; the clean restore path needs main-process IPC
work, and the auto-resume UX deserves its own design pass. The plan explicitly permitted the
split. Keeping it out preserves Wave 8 as a tight, renderer-only, shippable wave (Phases 1–3).

**Consequences:** Wave 8 ships without session-restore. A dedicated wave owns the
`PersistedSessionInfo` IPC extension + handler passthrough, the `useWorkbenchRestore` hook,
threading restored cwds into `useWorkbenchTerminals` (gated on `isReady` to avoid the
auto-spawn race), and the upper-frame `spawnClaude --resume` UX. Deferral artifact:
`roadmap/deferred/2026-05-22-canon-workbench-session-restore.md` (carries the architect's full
integration plan + risks). **Wave 9 cutover note:** the legacy `RestoreSessionsGate` restore
behavior is NOT in the canon shell yet — flag this as a known parity gap at cutover; do not
delete the legacy restore path until the split wave lands, or sequence accordingly.
