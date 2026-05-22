---
status: DEFERRED-QUEUED
created: 2026-05-22
wave: 4
slug: workbench-agent-sidebar-live
---

# Wave 4 — UI Smoke Report

## Disposition: DEFERRED (live), QUEUED for next dev session

Per the established Wave 0–3 posture: the canon workbench shell is **experimental and default-off**
(`layout.canonWorkbench`), and Cole is not running the app interactively until the workbench remake
is complete. Live MCP-driven smoke is therefore deferred — this report documents the surface to
exercise so a future dev session can run it from a warm dev server.

This is not a substitute for runtime observation. The wave's behavior was verified at the **test
boundary** (175/175 Workbench tests incl. the Phase-3 acceptance test), not in a running Electron
instance. Tests passing at the unit/integration boundary is necessary but not sufficient.

## Surface to exercise (flag ON)

Enable **Settings → Appearance → "Canon workbench (experimental)"**, then with a live `claude`
session running in a workbench terminal frame:

1. **NOW panel** — names the tool the agent is currently running (e.g. "Edit src/…") with a ticking
   elapsed timer; goes idle when no session runs.
2. **Context panel** — shows the session's real token count / cost / model (not frozen mock numbers).
3. **Files Touched** — lists the files the session has edited/read, each with the correct status dot
   (editing = accent border + live dot, edited, read); no merged/wrong rows for deep paths.
4. **Hook Timeline** — scrolls the real tool-call + prompt sequence in order; **no "thinking" rows**.
5. **Latest Hunk** (requires **Settings → `enableTerminalDiffReview` ON**) — after an agent Edit,
   shows the actual added/removed diff lines (green/red); Files Touched rows show real `+N/−N` badges.
6. **Graceful degrade** — with `enableTerminalDiffReview` **OFF**: Latest Hunk reads empty
   ("No recent diff" placeholder), Files Touched rows show no badges, nothing breaks.
7. **Flag OFF regression** — disable the canon workbench: the legacy shells render byte-identically.

## What "working" looks like

Each panel reflects the live `claude` session driving the workbench — no invented entries, no frozen
mock constants, and the diff-backed surfaces degrade cleanly to empty/badge-free when the diff
setting is off.

## Console / network expectations

No new console errors when toggling the flag or firing agent Edits. `git:diffReview` IPC fires only
after a `diff_review_ready` event (which only fires when `enableTerminalDiffReview` is on).
