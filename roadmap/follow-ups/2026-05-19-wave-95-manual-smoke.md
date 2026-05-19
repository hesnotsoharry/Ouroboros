---
status: OPEN
created: 2026-05-19
updated: 2026-05-19
source: Wave 95 wave-wrap deferral
severity: medium
---

# Wave 95 manual smoke walk

Wave 95 wrapped 2026-05-19 with 7 work phases shipped (B, A, C, D, E,
H, G + Path 1 extension). Live-verification was completed in-session
for B, A, C, D, E, and the Phase E follow-up hardenings, but the
following items shipped to local main without a full smoke walk:

## Items needing live verification

### Phase G — multi-project diff state + cross-project grouping
- Open two terminals in different projects (e.g., one in Agent IDE,
  one in another repo).
- Run a Claude `Edit` in each terminal.
- Click the status-bar diff button (bottom-right corner).
- **Expected:** the `ChatOnlyDiffOverlay` sidebar shows two collapsible
  project groups (`▼ <project-name> (N files)`); both diffs visible.
- Click a project group header → group collapses/expands.
- Accept a hunk in one project's file → only that project's count
  decrements. The other project's files are untouched.
- Close one project's review via the per-project close affordance →
  the other remains. Close all → overlay returns to empty state.

### Phase H artifact-pane removal (continuation commit)
- Open the workbench with a Claude session running.
- Run several Claude `Edit` calls in quick succession.
- **Expected:** NO pop-ups anywhere. No artifact pane. No utility-
  drawer review tab. The status-bar diff button is the ONLY trigger.

### Phase C ghost-cursor patch (already live-verified)
- Already confirmed working by Cole 2026-05-18.
- Re-verify if any further xterm.js upgrades land.

### Phase D opaque-canvas + OSC trace
- Run `claude` interactively in a dock-slot terminal.
- TUI status panel boxes, `❯` cursor, and bullet markers should render
  with correct dark-panel backgrounds (parity with external Windows
  Terminal).
- Open DevTools → Console → filter `[trace:osc]`. Capture any OSC
  10/11/12 sequences Claude emits during startup. Save the capture to
  `roadmap/follow-ups/2026-05-18-osc-11-read-allow.md` for that
  follow-up's prerequisite.

### `--terminal-canvas-opacity` CSS var (Phase D extension)
- Default value is `1` (no visual change from Phase D's opaque canvas).
- Try setting `--terminal-canvas-opacity: 0.9` in a theme or via
  DevTools to confirm the tinted-glass effect renders cleanly. Below
  ~0.85 the text wash becomes visible.

## Why deferred

Wave 95 hit 8 phases (some reshaped mid-wave), the diff-review subsystem
got a structural overhaul (Phase G), and end-to-end live verification
across all surfaces requires Cole's hands-on time across both an active
in-IDE Claude session AND an external Claude session in a separate
project. Wave-wrap velocity took precedence; smoke walk deferred to a
dedicated session.

## What to do if a regression surfaces

If any item above fails:
1. Open a new bug doc at `roadmap/bugs/<date>-<slug>.md` with status
   `TRIAGED`.
2. Note which Phase (A–G/H) introduced the regression.
3. If the regression is Phase G state-shape related, the Wave 94
   Phase E acceptance test (`useDiffReviewTrigger.acceptance.test.tsx`)
   should still pass — verify that first to scope the issue.

## Estimate

30–45 min of hands-on smoke. Best done after Cole has 2 active
projects checked out and can spin up Claude in both.
