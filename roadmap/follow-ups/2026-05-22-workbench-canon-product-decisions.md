---
status: OPEN
created: 2026-05-22
severity: MED
area: Workbench
needs: Cole's product decision
blocks: wave-8-cutover
---

# Canon Workbench — three product decisions before cutover (canon is silent)

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
