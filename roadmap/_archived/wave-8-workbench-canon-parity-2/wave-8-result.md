---
status: SHIPPED
created: 2026-05-22
updated: 2026-05-22
---

# Wave 8 — Canon Workbench Parity Round 2 — Result Brief

Renderer-only, behind the default-off `layout.canonWorkbench` flag. Closes the cutover-blocking
parity gaps from the Wave 7 smoke so the canon shell can become the sole shell (Wave 9) without
silently dropping a feature. **Planned as 4 phases; shipped 3 — Phase 4 (session-restore) split to
its own wave (Cole's call).**

## What shipped

### Phase 1 — agent sidebar session scoping (commit `5707f0aa`)
`useWorkbenchAgentData(claudeSessionId?)` now scopes to the session bound to the active workbench
terminal in the active project, instead of `selectPrimarySession` over the global machine-wide pool.
- **Bound path** (id supplied): `agents.find(s => s.id === claudeSessionId)` — bypasses the project
  filter (explicit binding wins). Null primary → zeroed contextStats (graceful).
- **Fallback path** (no id): `selectPrimarySession` over agents filtered by the active project root,
  read via the **non-throwing `useProjectOptional()`** (null outside a provider → no filter →
  pre-Wave-8 behavior preserved; this is why the frozen Wave-3 `sessions.acceptance.test.ts` stays
  green UNMODIFIED).
- Captured the upper `wb-cc-*` terminal's `claudeSessionId` in a workbench-local
  `useWorkbenchClaudeCapture` (reuses `TERMINAL_BIND_TRIGGER_TYPES`; no coupling to the legacy
  `TerminalSession` model); threaded `useWorkbenchTerminals → CenterPane → Workbench → AgentSidebar`;
  both `AgentSidebar` call sites (root + `SidebarHeader`) pass it.
- **Gate:** orchestrator-owned frozen `useWorkbenchAgentData.scoping.acceptance.test.ts` (5/5, authored
  RED pre-impl, subagent could not modify). `sonnet-phase-reviewer` PASS (1 advisory non-blocking FLAG).

### Phase 2 — live canon FileTree (commit `6e9cf3ec`)
Replaced `InnerRail`'s `MOCK_FILE_TREE` with a Workbench-local canon §07 tree
(`Rails/WorkbenchFileTree.tsx` + `Rails/useWorkbenchFileTree.ts`) over `useFileWatcher` +
`window.electronAPI.files.readDir` (lazy dir expansion; dirs-before-files sort; reuses the existing
canon-styled `FileNode`). NO dependency on the legacy `FileTree` (ADR D2 — it's deleted in Wave 9).
M/A git-status badges deferred (existing follow-up `2026-05-21-workbench-live-git-diff-stats.md`).
`MOCK_FILE_TREE` retained (still used by `UnifiedRail.parts`). Fixed an undefined token
(`--status-err` → `--status-error`) inline.

### Phase 3 — file quick-open + FileViewer modal (commit `acfeba98`)
Per Cole's direction (supersedes ADR D3's "a command, no overlay"): reuse the existing full-featured
`FileViewer/` Monaco subsystem as a **modal**. The `file:open-file` command + Ctrl-K palette + the
InnerRail "Search files" button all dispatch `agent-ide:open-file-picker` → `Overlays/WorkbenchFilePicker`
(shared `FilePicker` quick-open) → lifts `openFilePath` → `Overlays/WorkbenchFileViewerModal` hosts
`FileViewer`.
- Mounts `FileViewer` **directly** (NOT `FileViewerManager` — a second manager instance would
  double-register global DOM listeners and collide with the still-mounted legacy shell during Wave 8).
- **`FileViewer` is LAZY** (`React.lazy` + `Suspense`, only when `openFilePath != null`) — keeps
  Monaco/pdfjs out of the Workbench shell's static import graph AND code-splits them out of the main
  bundle. (A static import regressed this mid-phase — see "Process notes".)
- Race-guarded file-load hook (text → binary fallback; image/pdf/audio/video special-viewers),
  dirty-on-close `window.confirm` guard (v1), Monaco layout nudge on mount.

### Held fix bundled
Terminal tinted-well mount-sync fix (`57b750b1`, prior session) + Modern well `rgba(6,8,16,0.1)` —
already committed locally, pushed with this wave.

## What did NOT ship — Phase 4 (session-restore) → SPLIT to its own wave
`sonnet-architect` validated it FITS the canon two-frame model (the "N sessions" concern is only in
the dialog layer; the underlying `cwd` data maps cleanly), BUT the clean path needs a **main-process
IPC change** (expose `claudeSessionId`/`isClaude` on `PersistedSessionInfo`) — breaking this wave's
renderer-only scope — and a **user-facing behavior change** (auto `claude --resume` on relaunch).
Cole's call: split it out to keep Wave 8 renderer-only. Full architect integration plan + risks
captured in `roadmap/deferred/2026-05-22-canon-workbench-session-restore.md`. ADR D4 RESOLVED → SPLIT.

## Gates
- Orchestrator-owned acceptance test (Phase 1) 5/5, authored RED pre-impl, frozen.
- Frozen Wave-3 `sessions.acceptance.test.ts` UNMODIFIED + green.
- Full Workbench suite 269/269, 21/21 suites, 0 failed.
- `tsc --noEmit` clean; `eslint src/` 0 errors (4 pre-existing warnings, none new); prettier clean on
  all wave-touched files.
- Full project suite: **1124 files, 11742 passed / 8 skipped / 0 failed** (Wave 7 baseline 11710 → +32 new Wave 8 tests).
- `/review` mechanical: **FLAG (non-fatal)** — `wave-8-mechanical-review.md`. Checks 1/2/4 clean; Check 3 = 3 over-exports (`compareEntries` test-only, `useRootDir` superfluous, `OPEN_FILE_PICKER_EVENT` drift risk — small follow-up worthwhile); Check 5 = commit-ordering proxy fired but the substantive orchestrator-owned-test constraint held (authored + RED pre-dispatch, untouched by impl) → git-hygiene lesson; Check 6 deferred to the batched pre-merge mutation task. No structurally fatal findings.

## Follow-ups (this wave)
- **`2026-05-22-workbench-claudeSessionId-binding-precision.md` (OPEN, HIGH)** — the residual Phase 1
  limitation: the `claudeSessionId` binding is a timing heuristic that an external / IDE-runs-in-itself
  session can hijack (and the bound path bypasses the project filter, so the fallback doesn't catch it).
  The proper fix (forward the real `CLAUDE_SESSION_ID` from the pty spawn) is main-process scope.
  **This is Cole's common dev pattern (running the IDE from a `claude` session), so the wave-end smoke
  MUST test the IDE-in-itself case explicitly.**
- 3 parity follow-ups closed by this wave (sidebar-scoping, live-filetree, product-decisions) — see
  `wave-8-followup-audit.md`.

## Deferred to wave-end / next session
- **`/ui-smoke 8`** — deferred per the Wave 0–7 posture (Cole not using the app until the remake is
  done). When run, it must: (a) confirm the sidebar tracks the selected terminal's session incl. the
  IDE-in-itself hijack test; (b) re-run the deferred **#5 permission overlay** smoke (its
  sidebar-takeover reads the now-scoped data); (c) confirm the live FileTree renders real files; (d)
  confirm Ctrl-K / "Search files" → FileViewer modal opens a real file with Monaco at full height.
- Check-6 mutation joins the batched pre-merge task (pre-2026-06-01 merge), now also covering Wave 8's
  scoping + filetree + modal logic.

## Process notes
- Phase 3 caught a verification-discipline miss: the implementer claimed 3 crashing shell suites were
  "pre-existing/unrelated." Independent verification showed Phase 3's static `FileViewer` import pulled
  Monaco/pdfjs into every `<Workbench/>`-rendering test's module graph (crash at import, 0 tests). Fixed
  at the root by lazy-loading — which also code-splits Monaco out of the main bundle. Lesson recorded as
  a load-bearing gotcha in `Workbench/CLAUDE.md`.
