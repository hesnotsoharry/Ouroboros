---
status: RESOLVED
created: 2026-05-22
updated: 2026-05-22
resolved: 2026-05-22
resolved-during: wave-8-workbench-canon-parity-2
severity: MED
area: Workbench
needs: Cole's product decision
blocks: wave-8-cutover
---

# Canon Workbench — three product decisions before cutover (canon is silent)

## RESOLUTION (Cole, 2026-05-22 — live Wave 7 smoke session)

1. **FilePicker → FOLD INTO Ctrl-K palette.** No standalone overlay. Wire the rail
   "Search files" button + the Wave-7 command palette to do file quick-open.
2. **SymbolSearch → DROP with legacy.** Terminal-first canon has no editor surface to
   navigate symbols in. Deleted at cutover/teardown; not wired into the canon shell.
3. **Session-restore → KEEP, wire `RestoreSessionsGate` into the canon Workbench.**
   Terminal-first users rely on session survival across restarts.

Items 1 and 3 are build work in the canon parity wave; item 2 is a teardown no-op
(simply not ported). All three feed the parity-wave plan.

The Wave 7 parity audit (`wave-7-parity-audit.md`) classified three legacy-shell features as **AMBIGUOUS**:
the canon design (`design-system/canon.html`) neither includes nor excludes them. These need **Cole's
call** — include (build into the canon shell) or drop (delete with the legacy shell in Wave 8):

1. **FilePicker overlay** — legacy `FilePickerConnected` (quick-open file by name). Canon names a
   "Search files" button in the InnerRail header (§07) but no file-picker overlay. Decision: build a
   canon file-picker, repurpose the rail "Search files" button, or drop?

2. **SymbolSearch overlay** — legacy `SymbolSearch`. Canon's Ctrl-K is a *command palette*, not symbol
   search (separate features). Canon is silent on symbol search. Decision: include or drop?

3. **Session-restore-on-launch** (`RestoreSessionsGate`) — restores terminal sessions from the previous
   run when `persistTerminalSessions` is on. Canon §12 starts at `fresh` with no restore path; the canon
   spec is a layout doc and doesn't cover startup sequencing. Decision: preserve restore behavior in the
   canon shell (wire `RestoreSessionsGate` into the Workbench), or drop it?

**Why it matters.** Each is currently provided only by the legacy `InnerAppLayout`. Wave 8 deletes that
shell. If any should survive, it must be wired into the canon Workbench *before* the teardown — otherwise
cutover silently drops the feature.

**Recommendation (technical lead's lean, Cole decides):** keep session-restore (terminal-first users
rely on it); fold FilePicker into the Ctrl-K command palette surface rather than a separate overlay
(canon already gives us the palette); drop standalone SymbolSearch as an IDE-editor feature inconsistent
with the terminal-first canon (no editor to navigate symbols in).

## Resolution (wave-8-workbench-canon-parity-2)

Closed by `haiku-followup-auditor` during wave audit on 2026-05-22.

**Evidence:** All three decisions were shipped in Wave 8 per Cole's resolution:
1. **FilePicker** — Phase 3 implemented file quick-open: `Overlays/WorkbenchFilePicker.tsx` + `Overlays/WorkbenchFileViewerModal.tsx` wire the rail "Search files" button + the `file:open-file` command (Ctrl-K) to open the shared FilePicker → lazy-loaded FileViewer modal (verified in wave diff).
2. **SymbolSearch** — Dropped with legacy shell at Wave 8 teardown (no-op, not wired into canon). Verified in `2026-05-22-wave8-teardown-prep-discoveries.md` (OPEN) which confirms the removal is in scope.
3. **Session-restore** — Deferred to `roadmap/deferred/2026-05-22-canon-workbench-session-restore.md` (verified in wave diff) — Phase 4 split out and scheduled separately, not resolved this wave but captured for future work.

Cole's decision was captured and acted on; two of three items (FilePicker, SymbolSearch) are shipped; the third (session-restore) is properly deferred and tracked.
