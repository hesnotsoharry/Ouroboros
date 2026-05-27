---
status: SHIPPED
created: 2026-05-22
updated: 2026-05-22
wave: 7
tag: v2.28.0
---

# Wave 7 — Workbench Parity Completion — Result Brief

## What shipped

The canon §06 TitleBar **right cluster went live** in the canon Workbench shell — three dead stubs are
now wired affordances, all behind the unchanged default-off `layout.canonWorkbench` flag:

| Phase | Commit | Affordance |
|---|---|---|
| 1 | `e0c4b9d2` | **Settings access** — TitleBar cog → shared `SettingsModal` via new `Overlays/WorkbenchSettingsOverlay.tsx` |
| 2 | `e81c5c5d` | **Command Palette** — Ctrl-K pill → existing palette via new `Overlays/WorkbenchCommandPalette.tsx` |
| 3 | `553c9fb7` | **Notification center** — Bell → shared `NotificationCenter` via new `TitleBar/WorkbenchBell.tsx` |

All three reuse existing, proven components/hooks — no new state plumbing, no protocol/IPC/config change,
no flag flip, no deletion. Renderer-only, Workbench-local.

## Why this wave exists (the pivot)

This wave was planned as "**Wave 7 — Cutover & teardown**." A pre-flight parity audit
(`wave-7-parity-audit.md`) found the teardown premise — *"delete at parity, after parity is proven"* —
was **invalid**: Waves 1–6 reached *visual* parity with **stubbed** affordances, not functional parity.
Deleting the legacy shell would have stranded the app with **no Settings access** (the cog was a dead
stub), a non-functional command palette, and a mock-only file tree — a silent regression no green test
catches.

**Decision (ADR D1):** defer teardown. Re-sequence — **Wave 7 = parity completion**, **Wave 8 = cutover
& teardown** (deletion scope unchanged, fully mapped in the audit, gated on proven parity). The workbench
sequence is now 0–8.

This wave closed the three decision-free, universally-required TitleBar gaps (Settings + Command Palette
are hard prerequisites for *any* cutover). FileTree (the 4th gap) and three canon-silent items are
deferred — see follow-ups.

## Key decisions (see `wave-7-decisions.md`)

- **D3 — Settings host:** new Workbench-local overlay reusing the shared `SettingsModal` (the existing
  host lives in doomed ChatOnlyShell; the CentrePane special-view path doesn't exist in canon).
- **D4 — Palette:** mount existing `CommandPalette` via its self-contained `useCommandPalette` +
  `useCommandRegistry` hooks; button dispatches the event the hook already listens for.
- **D5 — Notification badge:** canon §06 warning **dot** (not the legacy count pill); badge + panel driven
  by toast notifications. Approvals already signal via the Wave-5 permission UI — the bell doesn't
  double-signal them.

## Gates

- **Per-phase:** tsc clean, `eslint` 0 errors on touched files, scoped `test:layout` green, orchestrator
  diff review (all three diffs reviewed before commit).
- **Wave-end:** tsc clean (exit 0), `eslint src/` **0 errors** (4 pre-existing warnings in untouched
  FileViewer files), prettier clean on touched files (one WorkbenchBell.tsx format fix folded into the
  Phase 3 commit), **full suite: 11710 passed / 8 skipped / 0 failed (1119 files)**.
- New tests: 7 (Settings overlay) + 7 (Command Palette) + 9 (Bell) = **23 new tests**, all behavioral.

### Regression caught + fixed at the wave-end gate (honest record)

The first full-suite run failed: **37 Workbench tests across 5 files** (`Workbench.test.tsx`, the frozen
Wave-5 `permission-approval.acceptance` + Wave-6 `responsive.acceptance`, and the two new Overlays tests).
Root cause: Phase 3's `WorkbenchBell` calls `useToastContext()`, which throws outside `<ToastProvider>`;
since the TitleBar always renders the bell, every test rendering `<Workbench/>`/`<TitleBar/>` in isolation
threw and cascaded. **Production was never affected** — `ToastProvider` sits above the shell branch in
`ConfiguredApp`. Fix (commit `962bf006`): add the same `vi.mock('.../ToastContext')` pattern the suite
already uses for `AgentEventsContext` (which throws identically) — test-harness only, no assertion or
production change. Full Workbench dir then 239/239; full suite green.

**Process lesson:** after Phases 2–3 I verified with narrow scopes (`Overlays/`, `TitleBar/`) instead of
the full Workbench dir, so mounting a new context-consumer into the shared TitleBar slipped past per-phase
gates. The wave-end full suite caught it (working as designed). Rule for next time: when wiring a new
context-consuming component into a shared shell region, re-run the **whole shell's** test dir, not just the
new files. Commits: `c576f7d1` (plan) · `e0c4b9d2` `e81c5c5d` `553c9fb7` (phases 1–3) · `06e10a29` (docs) ·
`962bf006` (test fix).

## Known limitations / deviations (all documented in follow-ups)

- **Ctrl-K keybind:** the *button* opens the palette; the global keyboard shortcut remains Ctrl+Shift+P
  (canon wants Ctrl+K). Deferred — needs a binding-conflict check.
  (`follow-ups/2026-05-22-workbench-command-palette-canon-polish.md`)
- **Command surface:** the palette includes builtin commands targeting legacy-shell features that no-op
  in the canon shell. Curation deferred (same follow-up).
- **Bell marks-all-read on open:** minor UX deviation from the legacy bell (which doesn't auto-mark).
  Non-destructive (notifications aren't deleted). Accepted.

## What remains for parity (before Wave 8 cutover)

- **Live FileTree** — `InnerRail` still renders `MOCK_FILE_TREE`. HIGH, blocks cutover.
  (`follow-ups/2026-05-22-workbench-live-filetree.md`)
- **Three product decisions** — FilePicker / SymbolSearch / session-restore (canon silent — needs Cole).
  (`follow-ups/2026-05-22-workbench-canon-product-decisions.md`)
- **Multi-terminal tabs** — canon-intended but explicitly deferred by the Wave-2 ADR (own wave).

## Wave 8 (teardown) prep discoveries

Two findings beyond the reconciliation doc's deletion list, captured for Wave 8:
`AgentChat/` becomes runtime-dead after cutover (sever the one `ChatStatusChipRow` compile dep; retire
AgentChat in its own wave), and the `?mode=chat` pop-out machinery becomes orphaned.
(`follow-ups/2026-05-22-wave8-teardown-prep-discoveries.md`)

## NOT done

- `/ui-smoke 7` live smoke — deferred per the Wave 0–6 posture (Cole not using the app until the remake is
  done; everything behind the default-off flag). Next dev session: enable Settings → Appearance → "Canon
  workbench", click the cog (Settings opens), the Ctrl-K pill (palette opens), the bell (notification
  center opens; dot reflects real unread).
- `/promote-vendor-lessons 7` — no-op (no vendor SDK touched).
- Check-6 mutation pre-merge task — carried forward (now also covers Wave 7's overlay hosts; UI-style
  survivors acceptable). Joins the Wave 3/4/5/6 batch for the 2026-06-01 pre-merge run.
