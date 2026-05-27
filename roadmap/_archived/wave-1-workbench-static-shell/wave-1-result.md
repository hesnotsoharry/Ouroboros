---
status: SHIPPED
created: 2026-05-21
updated: 2026-05-21
wave: 1
slug: workbench-static-shell
tag: v2.22.0
---

# Wave 1 — Workbench Static Shell · Result

Built the canon workbench shell as a complete static layout with mock data, behind a default-off Settings toggle, additive alongside the existing shells (cutover is Wave 7). Renderer-only. New architectural surface delivered walking-skeleton-first.

## Per-phase outcomes

| Phase | Outcome |
|---|---|
| 0 — ADR | `wave-1-decisions.md`, 7 decisions resolved (1–6 from canon/reconciliation; 7 — Settings → Appearance toggle — locked by Cole). |
| 1 — Walking skeleton | `layout.canonWorkbench` flag (config schema in both type files + default), `useCanonWorkbenchFlag`, Settings → Appearance toggle, third `InnerApp` branch, six-region `Workbench` grid (canon §02 dims) with labeled placeholders, `shared/Icon.tsx` (inline-SVG set), `workbenchMockData.ts` (typed to canon §11 schemas). Frame renders end-to-end behind the flag. |
| 2 — Title bar | `TitleBar/{TitleBar,TitleChip,AgentGlobe,WindowControls}` — app mark, project/branch chips, centre Agent Globe (running/idle, shimmer), Windows controls (#e81123 close-hover). |
| 3 — Rails | `Rails/{ProjectRail,InnerRail,UnifiedRail,FileNode}` — 56px project rail (chips, active glow, dirty badges), 256px inner rail (cross-project Running list + Files tree + branch footer), 272px UnifiedRail (built per Decision 3, not mounted). |
| 4 — Terminals | `Terminals/{CenterPane,TerminalShell}` — vertical 62/38 split, tab bars, static tinted-well bodies (`--term-bg`/`--term-inset`), upper CC prompt+status mock, lower shell mock. NO xterm (Decision 6 → Wave 2). Added `--term-inset` token (canon §03, was missing). |
| 5 — Agent sidebar | `AgentSidebar/{AgentSidebar,NowBlock,ContextBlock,FilesTouched,LatestHunk,HookTimeline}` — header + five panels; HookTimeline has the adaptive collapse/hover-expand cards (treatment B). |
| 6 — Status bar | `StatusBar.tsx` — canon §10 slots (branch/adds/dels, model, context, tests pill / cost, clock, connection). `PlaceholderRegion` fully removed — all six regions live. |
| 7 — Wrap | prettier + full lint (caught 11 max-lines violations → fixed: extracted helpers, split 3 over-300 files via `.parts.tsx` + a mock-data re-export barrel), tsc clean, 82 tests, CLAUDE.md, this brief, CHANGELOG [2.22.0], tag v2.22.0. |

## Verification

- **End-to-end render — confirmed live by Cole.** Toggling Settings → Appearance → "Canon workbench (experimental)" switches the IDE into the six-region frame. Cole reviewed the shape ("seems fine") and the proportions across the build. (A height bug — stage collapsed to content height — was caught live and fixed with `100vh`; the flag was also initially unreachable behind the `isImmersive` check and reordered to win.)
- **Tests:** 82 in `Workbench.test.tsx` (region presence + mock content per region). tsc clean, full lint 0 errors (4 pre-existing warnings unrelated).
- **Not done:** no live data (Wave 3), no real xterm (Wave 2), no permissions (Wave 5), responsive collapse (Wave 6). AgentGlobe awaiting/errored deferred to Wave 3.

## Companion fix shipped this session (v2.21.1, separate commit)

Wave 0's tinted well wasn't actually rendering — xterm's WebGL renderer composites opaque regardless of `allowTransparency` (xterm #1004). Switched all terminals to the DOM renderer (drops WebGL; honors transparency), drove the canvas + container from `--term-canvas-bg` (well themes tint, others opaque-unchanged), tuned Modern's well alpha to 0.35. WebGL dependency-removal tracked in `roadmap/follow-ups/2026-05-21-remove-xterm-webgl-dependency.md`.

## Follow-ups / deferrals (carry to later waves)

- Window-control IPC (min/max/close) not in the preload bridge — buttons are no-op stubs (Phase 2 note).
- Dual/unified rail toggle wiring (the collapse handles are no-op stubs) — a later wave.
- Workbench animation keyframes injected per-component (NowBlock/HookTimeline) — consolidate into one stylesheet (Wave 3 note).
- Mock cost `$0.09` vs canon mock `$0.18` — cosmetic mock value; Wave 3 replaces with live stats.
- `/ui-smoke 1` not run as a formal smoke (Cole was the live reviewer throughout); `/review` mechanical gap-check deferrable given per-phase gating + the flag isolation.

## Ship

Phases 0–7 on `master` (commits `83728c91` status bar + the per-phase commits + the lint-fix refactor), tag `v2.22.0`. Push per the 2026-05-19 bulletin (workflows won't run; merges wait for CI minutes 2026-06-01).
