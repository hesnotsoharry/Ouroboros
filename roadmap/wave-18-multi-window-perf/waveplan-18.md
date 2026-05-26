---
status: PLANNED
created: 2026-05-25
updated: 2026-05-25
type: perf-investigation
predecessor: wave-17-editor-cascade-perf
severity: SHOWSTOPPER
---

# Wave 18 — Multi-Window Perf

## Status

PLANNED. Surfaced by Cole's Wave 17 verification trace (2026-05-25
23:02-23:03). Wave 17's targeted save-cascade fix landed cleanly
(no-op reindex 9075ms → 159ms, verified), BUT a different perf
class is making the app functionally unusable when 3 windows are
open: 27s renderer bundle load, 13.3s save-time jank, native
watcher handle contention, duplicate event firing.

**Cole's quote:** "I functionally can't use the app or my computer
while the 3 windows are open. Closing them is painful, causes more
lag, having them open is painful, it is so poorly optimized."

This is a SHOWSTOPPER. Lane B B1 diagnose-first; do not swing at
fixes before evidence.

## Symptoms (from Cole's 23:02-23:03 trace)

| Symptom | Measured cost |
|---|---|
| 3 BrowserWindow instances on `npm run dev` (perf markers fire 3×) | (3 windows where 1 expected) |
| `renderer-bundle-loaded` first-marker | **26,936 ms** (was <5s in Wave 16 single-window) |
| `first-render` | **26,993 ms** |
| `[jank] event loop blocked` (one event) | **13,321 ms** |
| `files:saveFile` slow-handler line during that jank | **13,467 ms** (per Phase 1's Wave 17 finding, this is `patchIpcMainHandle` timer artifact — the real cause is the 13.3s jank itself) |
| Active handles during jank | 419 (271 Socket + 95 MessagePort + **45 ChildProcess + 45 Pipe**) |
| `[rulesWatcher] watchRecursive failed: Invalid handle` | **22 occurrences** on `.claude/commands` + `.claude/rules` |
| `mergeThreadCollection` duplicate fires (same empty payload) | **5 occurrences** in startup |
| `[approval.wait]` fires duplicate per ID | every ID fires 2x |
| `[perf] markStartup` duplicates explicitly logged | 6 duplicate markers |
| `[trace:contextLayer.buildRepoIndex]` | fires 2× (78ms + 290ms) |
| `[xterm-init]` create+open | **12 occurrences** (6 sessions × 2 windows visible) |

## Hypotheses (to verify via parallel diagnostician dispatch)

1. **Session restoration restores 3 windows on `npm run dev`** —
   per-window state is persisted in `sessionsData` (SQLite); cold
   boot restores N=3 because the prior session had 3 open. Dev
   command doesn't override.
2. **45 ChildProcess + 45 Pipe = 15 subprocesses per window
   spawning concurrently** — pty sessions, hook pipes, claude-usage
   poller, shell history probes, etc. Per-window-isolated where
   they should be main-process-shared.
3. **27s renderer bundle load is Vite HMR / asset contention across
   3 BrowserWindows** — each window pulls the renderer bundle
   independently; Vite dev server serializes or fights with itself.
4. **`rulesWatcher` per-window setup with shared OS handles** —
   each window tries `@parcel/watcher`'s `watchRecursive` on the
   same `.claude/commands` + `.claude/rules` paths; only one
   handle is available; the others fail with "Invalid handle." 22
   failures = 11 retry attempts × 2 paths.
5. **Duplicate event firing = handlers registered per-window when
   they should be global** — mirror of Wave 16 P5 (where global
   teardown was firing per-window). This wave may surface the
   inverse: per-window handlers firing globally OR global handlers
   re-registering per-window.

## Diagnostic dispatch plan (Phase 1)

Five parallel `sonnet-diagnostician` dispatches on disjoint
surfaces + one `haiku-research-extractor` for best-practice
research. All read-only. Briefs reference this plan.

| # | Surface | Agent | Output |
|---|---|---|---|
| 1A | Window-spawn behavior (why 3 on `npm run dev`) | sonnet-diagnostician | wave-18-diagnostic-window-spawn.md |
| 1B | Subprocess multiplication during save (45 ChildProcess + 45 Pipe) | sonnet-diagnostician | wave-18-diagnostic-subprocess-multiplication.md |
| 1C | Renderer bundle 27s load with 3 windows | sonnet-diagnostician | wave-18-diagnostic-renderer-bundle.md |
| 1D | rulesWatcher OS handle contention + watcher singleton audit | sonnet-diagnostician | wave-18-diagnostic-watcher-contention.md |
| 1E | Duplicate event firing audit (per-window vs global handlers) | sonnet-diagnostician | wave-18-diagnostic-duplicate-events.md |
| 1F | Multi-window Electron perf best practices | haiku-research-extractor | wave-18-research-electron-multi-window-perf.md |

## Phase plan (placeholder — will revise after Phase 1 returns)

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Wave plan + ADR | DONE | This document. |
| 1 | Parallel diagnose (5 + research) | DISPATCHED | See above. |
| 2 | Synthesize findings + revise plan | PENDING | Orchestrator-side. Cole picks fix scope. |
| 3+ | Fix phases | PENDING | Shape depends on diagnostic verdicts. |
| N | Smoke + wrap | PENDING | Live verification with 3-window scenario. |

## Constraints (upfront)

- **Diagnose-first.** Wave 17 P1/P3 lesson: parallel diagnose on
  disjoint surfaces saves wall-clock; don't fix before evidence.
- **Worktree isolation NOT yet — diagnostic-only Phase 1.** Set up
  worktree before Phase 3+ when actual code changes start.
- **Architect dispatch trigger.** If any diagnostic returns a
  recommendation that's architecturally non-trivial (multi-option
  tradeoff, library choice, IPC contract change), dispatch
  `sonnet-architect` per the best-practice-spectrum rule before
  writing the ADR.
- **Cole authorization on scope.** This wave's findings will
  surface multiple distinct issues. Cole picks which to address in
  Wave 18 vs split into Wave 19, 20, etc.

## Acceptance criteria (provisional — refine post-Phase-1)

After the wave ships, a fresh `npm run dev` boot with default
session state should show:

| Surface | Target |
|---|---|
| Window count on `npm run dev` | 1 (with explicit opt-in for multi-window restore) |
| `renderer-bundle-loaded` to `first-render` | <5s (Wave 16 baseline) regardless of window count |
| Event-loop jank events > 500ms during normal use | 0 over 5 min |
| `[rulesWatcher] watchRecursive failed` | 0 |
| `[approval.wait]` duplicate fires | 0 (each event fires once) |
| `mergeThreadCollection` duplicate fires | 0 |
| Active subprocess count under normal load | <20 (was 45) |
| Cole's subjective verdict | "actually usable" |

## Note to subsequent phases

Cole's quote captured at top — refer back to it when scoping. This
is not "make it 20% faster"; it's "make it usable at all in
multi-window."
