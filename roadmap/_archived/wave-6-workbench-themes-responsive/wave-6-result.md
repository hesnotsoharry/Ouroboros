---
status: SHIPPED
created: 2026-05-22
updated: 2026-05-22
wave: 6
slug: workbench-themes-responsive
---

# Wave 6 — Workbench Themes + Responsive Collapse — Result Brief

## What shipped

Two tracks, behind the default-off `layout.canonWorkbench` flag, renderer-only:

1. **Per-theme canon treatment (Modern/Warp/Retro).** A new per-theme token path: `Theme.workbenchTokens?:
   Partial<Record<CanonWorkbenchToken, string>>` whose entries `applyComponentTokens` writes inline AFTER
   the material pass (theme overrides beat the material wash/glows; absent keys leave the existing value,
   preserving the four untreated themes). Completes the deferred `tokens.css:254` promise.
   - **Modern**: terminal well corrected `0.35 → 0.62` (canon §03; live-since-Wave-0 divergence). No
     `workbenchTokens` — its material/tokens.css defaults already match canon §15.
   - **Warp**: warm-amber wash + glows + accent-edge/glow + term-prompt-bg; `terminalCanvasOpacity: 0.86` added.
   - **Retro**: matte — `--blur-strong`/`--blur-soft: 'none'`, opaque `--material-panel`/`-raised` (0.85/0.92),
     green-phosphor wash/glows/accents, + a CRT scanline overlay in the workbench shell (canon §15).
   - cursor/kiro/light/high-contrast: functional, no per-theme tuning (ADR D4).

2. **Responsive collapse (canon §16, three tiers — HUD dropped per D3).** New `useWorkbenchBreakpoint`
   (max-width matchMedia at **1760** and **1440**) drives:
   - **full** (≥1760): ProjectRail + InnerRail; agent sidebar 348px; Latest Hunk full.
   - **compact** (1440–1759): dual rails; agent sidebar 300px; Latest Hunk collapsed to a one-line
     indicator that expands the full hunk on click.
   - **unified** (<1440): `UnifiedRail` mounts (dual rails unmount); agent sidebar 300px.
   - The dead rail collapse-handle stubs now force unified manually (`forceUnified`, left-rail-only).
   - `UnifiedRail` is now **mounted + live-wired** (`useWorkbenchProjects`/`useGitBranch`/
     `useWorkbenchAgentData`) — no `MOCK_*` in its mounted output (file-tree body still `MOCK_FILE_TREE`,
     same deferral as InnerRail).

## Phases

| Phase | What | Commit |
|---|---|---|
| 0 | ADR (7 decisions) + frozen default-preservation guard | (in plan / `398e41fc`) |
| 1 | Per-theme token pipeline (`Theme.workbenchTokens` + `applyWorkbenchTokenOverrides`) + Modern well fix | `398e41fc` |
| 2 | Modern/Warp/Retro canon values + Retro matte + CRT scanline overlay | `a74adae6` |
| 3 | `useWorkbenchBreakpoint` + 3-tier shell collapse + live-wired UnifiedRail + collapse-handle wiring | `ec8d0a2d` |
| 4 | Wave wrap (this brief, CLAUDE.md updates, CHANGELOG, follow-up, prettier, tag) | (wrap commit) |

## Key decisions (ADR `wave-6-decisions.md`)

- **D1** — responsive via a `matchMedia` hook (not CSS-only), because collapse mounts/unmounts components. Corrected boundaries: **1760/1440** (the 1180 line is moot once the HUD is dropped).
- **D2** — per-theme appearance via `Theme.workbenchTokens` + `applyComponentTokens` (completes the `tokens.css:254` promise); material-variant system untouched.
- **D3** — responsive stops at Unified; no floating HUD, no inner-rail drawer (canon §18 "not in v1"). **Cole-locked.**
- **D4** — full treatment Modern/Warp/Retro only; other four functional, untuned. **Cole-locked.**
- **D5** — Modern well 0.35→0.62; Warp gains terminalCanvasOpacity.
- **D6** — Retro matte (blur none + opaque panels + scanlines).
- **D7** — renderer-only; optional Theme fields (back-compatible).

## Divergences from the plan (surfaced + accepted)

- **Breakpoints corrected 1440/1180 → 1760/1440** mid-execution. The original plan/ADR carried the canon
  4-tier boundaries; once the HUD was dropped (D3), below 1440 is uniformly unified, so only two boundaries
  are needed. ADR + plan updated in the Phase-3 commit.
- **Modern got no `workbenchTokens`** (plan said "verify/align"). Verified canon-matched; not overriding the
  default theme's wash was the conservative correct call (the implementer stopped-and-confirmed, as briefed).
- **`useWorkbenchBreakpoint` is called once in `Workbench.tsx`** and `breakpointMode` is passed to
  `AgentSidebar` as a prop (rather than each consumer calling the hook). Cleaner; single subscription.
- **UnifiedRail adapts live data to the existing `MockProject`/`MockSession` part types** (inline ~15-line
  adapters) rather than redesigning `UnifiedRail.parts.tsx`. 4 stale UnifiedRail mock-assertion tests
  updated to live values (legitimate — data source moved).

## Gates

- **Frozen preservation guard** (`useTheme.tokens.preservation.test.ts`, 2/2): byte-identity of the four
  untreated themes' bridge output — green through Phases 1–3.
- **Frozen responsive acceptance test** (`Workbench.responsive.acceptance.test.tsx`, 5/5, authored failing
  before Phase 3, untouched by the implementer): the 3-tier mount contract + the <1180 clamp + live UnifiedRail data.
- **`useWorkbenchBreakpoint` unit test** 14/14; theme-value tests + Workbench suite green (215/215 at Phase 3).
- **tsc** clean; **`eslint src/`** 0 errors (4 pre-existing warnings in untouched files); **prettier** clean
  (wave-6 files formatted at wrap).
- **Per-phase reviews**: Phase 1 `sonnet-phase-reviewer` PASS; Phase 2 PASS (1 FLAG: scanline `rgba` needed
  the `// hardcoded:` suppression — resolved inline); Phase 3 PASS (1 FLAG: inert LatestHunkCollapsed toggle
  — resolved inline, now expands the real hunk).
- **`/review` mechanical**: **PASS** (Checks 1–3 clean, 4/5 N/A, 6 deferred to pre-merge mutation task). See
  `wave-6-mechanical-review.md`.
- **Full suite**: see "Wrap status" below.

## Follow-ups filed

- `roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md` (LOW) — manual `forceUnified` doesn't
  auto-clear on window-widen; clears only via the expand button. Acceptable; candidate Wave-7 fold-in.

## NOT done / deferred

- **Live UI smoke** (`/ui-smoke 6`) deferred per the Wave 0–5 posture (Cole isn't using the app until the
  remake is done). Written + queued at `wave-6-smoke-report.md`. **Next dev session:** enable the flag, switch
  Modern/Warp/Retro (deeper indigo well; warm amber wash; matte green + scanlines + no blur), and drag-resize
  the window across ~1760 and ~1440 to watch the agent rail narrow + Latest Hunk collapse, then the rails merge
  into the unified rail.
- **Check 6 mutation** deferred to the carried-forward pre-merge task (now also covers Wave 6's adapter/
  derivation logic) — run before the 2026-06-01 merge.
- **`/promote-vendor-lessons 6`** — no-op (no third-party SDK touched).
- UnifiedRail/InnerRail file-tree body still `MOCK_FILE_TREE`; git +adds/−dels still deferred (existing follow-up).

## Files of record

- Plan: `waveplan-6.md` · ADR: `wave-6-decisions.md` · `/review`: `wave-6-mechanical-review.md` · this brief · `wave-6-smoke-report.md`
- Code: `src/renderer/themes/{types,index,modern,warp,retro}.ts`, `src/renderer/hooks/useTheme.tokens.ts`,
  `src/renderer/components/Workbench/{Workbench.tsx,useWorkbenchBreakpoint.ts,AgentSidebar/AgentSidebar.tsx,
  Rails/{UnifiedRail,UnifiedRail.parts,ProjectRail,InnerRail}.tsx}`
- Tests: `useTheme.tokens.preservation.test.ts` (frozen), `Workbench.responsive.acceptance.test.tsx` (frozen),
  `useWorkbenchBreakpoint.test.ts`, `useTheme.tokens.test.ts`, `Workbench.test.tsx`
- Docs: `Workbench/CLAUDE.md` (Wave 6 line + breakpoint/scanline/forceUnified gotchas), `themes/CLAUDE.md`
  (`workbenchTokens` + Modern-well gotchas)
