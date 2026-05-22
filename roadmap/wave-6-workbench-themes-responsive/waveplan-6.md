---
status: IN-PROGRESS
created: 2026-05-22
updated: 2026-05-22
wave: 6
slug: workbench-themes-responsive
---

# Wave 6 — Workbench Themes + Responsive Collapse (canon §15 + §16)

## Status

DRAFT · target v2.27.0 (minor — net-new per-theme treatment + responsive layout inside the experimental, default-off canon shell) · drafted 2026-05-22.

## Context — why this wave exists

Waves 0–5 built the canon workbench shell behind the default-off `layout.canonWorkbench` flag: token foundations, static shell, live terminals, the live agent-state pipeline, the five live agent-sidebar panels, and the dual-presentation permission UI. The reconciliation doc's wave sequence (`roadmap/discovery/workbench-overhaul-reconciliation.md:126`) puts Wave 6 = **themes + responsive**: full canon glass/matte treatment for Modern/Warp/Retro, opportunistic port of the other four themes, and responsive collapse per canon §16.

Two things in the codebase make this wave a real change rather than a repaint, both confirmed by grounding:

1. **The per-theme token pipeline is incomplete.** `applyComponentTokens` (`src/renderer/hooks/useTheme.tokens.ts:109–116`) writes `--term-bg`/`--terminal-canvas-opacity` from `Theme.terminalWell`/`terminalCanvasOpacity`, but the ambient wash/glow tokens (`--bg-wash`, `--bg-glows`, `--material-panel`) are written by `applyMaterialTokens` (`:149–175`) keyed on the **material variant**, not the theme. There is no mechanism today for "Warp = warm amber wash." Worse, the canon alias block in `tokens.css` (`:210–266`) carries a **deferred promise** — `--accent-edge`/`--accent-glow`/`--term-prompt-bg` are hardcoded Modern literals with the comment "MODERN defaults here; Phase 2 makes per-theme via applyComponentTokens" (`:254–255`). That Phase 2 was never executed. Wave 6 completes it. Also confirmed: Modern's `terminalWell` is `'rgba(6, 8, 16, 0.35)'` (`modern.ts:35`) but canon §03 (`canon.html:258`) specifies `0.62` — a divergence live since Wave 0.

2. **The workbench shell is entirely fixed-width.** Grounding confirmed **zero** responsive logic under `src/renderer/components/Workbench/` — no `@media`, no `matchMedia`, no resize handling. Rail widths are hardcoded inline numbers (`ProjectRail.tsx:26` = 56, `InnerRail.tsx:24` = 256, `UnifiedRail.tsx:23` = 272, `AgentSidebar.tsx:199` = 348). `UnifiedRail` is **built but not mounted**. The collapse-handle buttons (`ProjectRail.tsx:67`, `InnerRail.tsx:92`) are visual stubs with `onClick: () => undefined`. Canon §16 (`canon.html:901–928`) defines four responsive tiers; this wave implements three of them (Cole's scope call — see Locked decisions D3).

This is **not a new architectural surface** — no IPC, no SDK, no cross-package, no persistent storage. It is renderer-only: the theme bridge (shared infra) plus a new renderer-local breakpoint hook. The dominant risk is regression of the four untouched themes and the legacy shells that also consume the theme bridge.

## Goal

After Wave 6, with `layout.canonWorkbench` on: switching the theme to **Warp** tints the entire workbench warm amber (per-theme wash + glows), **Retro** renders opaque matte-green panels with CRT scanlines and no glassy blur, and **Modern** shows a deeper indigo terminal well (the canon `0.62`, not the washed-out `0.35`) — all three driven through one extended per-theme token path. The other four themes (cursor/kiro/light/high-contrast) still render correctly in the shell with their existing tokens, just without bespoke canon tuning. Independently, dragging the IDE window narrower crosses canon §16 breakpoints: past 1440 the agent rail narrows 348→300 and the Latest Hunk panel collapses to a one-line indicator; past 1180 the project rail merges into a single unified rail (the previously-unmounted `UnifiedRail`), and the Wave-5 permission card still fits the narrowed agent rail. With the flag off, every legacy shell and all seven themes render byte-identically to before.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-6-workbench-themes-responsive/wave-6-decisions.md`.

1. **Responsive mechanism = a renderer-local `useWorkbenchBreakpoint` hook (matchMedia-driven), NOT pure CSS media queries.** The collapse requires *conditional component mounting* (UnifiedRail replaces ProjectRail+InnerRail), which CSS alone cannot do. RESOLVED — carries the best-practice spectrum.
2. **Per-theme wash/glow/blur/accent tokens are driven by extending the `Theme` interface + `applyComponentTokens`**, completing the deferred `tokens.css:254` promise — NOT by coupling per-theme appearance to the material-variant system (themes and material variant stay independent axes). RESOLVED — carries the best-practice spectrum.
3. **Responsive depth stops at Unified (≥1180).** Implement Full (≥1760) / Compact (1440–1759) / Unified (1180–1439); below 1180 clamps to the Unified layout. No floating HUD, no inner-rail slide-in drawer (canon §18 lists the HUD as "not in v1"). RESOLVED — **Cole-locked 2026-05-22.**
4. **Full canon treatment for Modern/Warp/Retro only; cursor/kiro/light/high-contrast stay functional with existing tokens, no per-theme tuning this wave.** Light/high-contrast non-tinted terminals are arguably correct for accessibility and are left alone. RESOLVED — **Cole-locked 2026-05-22** (inherits reconciliation Decision 2).
5. **Reconcile Modern `terminalWell` 0.35 → canon 0.62** and add the missing `terminalCanvasOpacity` to Warp. A divergence from canon live since Wave 0; fix toward canon. RESOLVED.
6. **Retro is matte, not glass:** suppress blur for Retro by making `--blur-strong`/`--blur-soft` theme-driven (resolve to `none` for Retro via `applyComponentTokens`), drive opaque panel opacities (0.85–0.95), and render CRT scanlines via the existing `Theme.effects.scanlines` field (already present on Retro). RESOLVED.
7. **No change to the material-variant system, IPC, config schema, or any main-process code.** Renderer-only; `Theme` interface gains optional fields (back-compatible — the four untouched themes omit them and fall back to current behavior). RESOLVED.

## Scope

**In scope:**
- **Per-theme token pipeline** — extend the `Theme` interface (`src/renderer/themes/types.ts`) with optional `bgWash` / `bgGlows` / `blur` / `accentEdge` / `accentGlow` / `termPromptBg` fields (exact field set finalized in Phase 1); extend `applyComponentTokens` (`useTheme.tokens.ts`) to write `--bg-wash`, `--bg-glows`, `--blur-strong`, `--blur-soft`, `--accent-edge`, `--accent-glow`, `--term-prompt-bg` from those fields when present, falling back to today's values when absent. Fix Modern `terminalWell` → `0.62`; add Warp `terminalCanvasOpacity`.
- **Modern / Warp / Retro canon values** — author the per-theme field values: Modern (verify/align indigo wash + glows to canon §15), Warp (warm amber wash `#16100a`/`#1b140c` + amber glows), Retro (matte opaque panels + green phosphor wash + `blur: none` + scanlines via `effects.scanlines`). Per canon §15 (`canon.html:857–895`).
- **Responsive breakpoint hook** — new `Workbench/useWorkbenchBreakpoint.ts` returning a 3-mode enum (`full` | `compact` | `unified`) from two `matchMedia` queries (1440px, 1180px), SSR/StrictMode-safe.
- **Responsive layout wiring** in `Workbench.tsx` + rails: Compact narrows the agent sidebar 348→300 and collapses the Latest Hunk panel to a one-line click-to-expand indicator (canon §16 collapse priority 1); Unified mounts `UnifiedRail` and unmounts `ProjectRail`+`InnerRail`; wire the two collapse-handle stub buttons (`ProjectRail.tsx:67`, `InnerRail.tsx:92`) to force unified mode.
- **Permission-surface fit at narrowed widths** — verify/adjust the Wave-5 `Permission/PermissionSidebarTakeover.tsx` and `PermissionOverlay.tsx` render correctly when the agent rail is 300px (Compact/Unified). This is the "responsive collapse of the dual permission surfaces" from the Wave-6 charter, bounded by D3 (no HUD).
- **Default-preservation regression guard** (orchestrator-owned, Phase 1): the four untouched themes + flag-off legacy shells emit byte-identical token values post-change.
- Render/integration tests per the table; canon-token compliance (zero new hardcoded hex outside documented exceptions).
- Update `Workbench/CLAUDE.md` (Wave 6: per-theme token path; breakpoint hook; D1–D7) and `src/renderer/themes/CLAUDE.md` if the Theme-interface extension warrants a gotcha line.

**Out of scope:**
- The `<1180` floating HUD + inner-rail slide-in drawer → D3 (canon §18 "not in v1"); revisit only if a real narrow-window need surfaces.
- Per-theme tuning of cursor/kiro/light/high-contrast → D4 (later polish pass; functional-only this wave).
- The `--purple` canon-vs-legacy divergence (`tokens.css:240`, `#c084fc` vs `#a78bfa`) → not this wave unless it falls out naturally from the Modern values; it's flagged in tokens.css for separate reconciliation.
- Any change to the material-variant system, `approvalManager`, IPC, or config schema → D7.
- Cutover / legacy-shell deletion (`AppLayout`/`InnerAppLayout`/`ChatOnlyShell`/`Dispatch/`/"Explain error") → Wave 7.
- The carried-forward Check-6 mutation pre-merge task (Waves 3/4/5 adapter survivors) → tracked separately against the 2026-06-01 merge, not Wave 6 feature work.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | orchestrator | Author `wave-6-decisions.md`, Decisions 1–7 (D1 + D2 each carry the best-practice spectrum per `~/.claude/rules/best-practice-spectrum.md`). Gate to 1. |
| 1 | Per-theme token pipeline + Modern well fix | sonnet-implementer | **Orchestrator authors the failing default-preservation regression test FIRST** (see dispatch step 2). Extend `themes/types.ts` `Theme` with optional `bgWash`/`bgGlows`/`blur`/`accentEdge`/`accentGlow`/`termPromptBg`. Extend `applyComponentTokens` (`useTheme.tokens.ts`) to write the matching CSS vars from those fields, **falling back to today's literal values when a field is absent** (so the 4 untouched themes are unchanged). Fix `modern.ts:35` `terminalWell` 0.35→0.62; add Warp `terminalCanvasOpacity`. NO per-theme *values* for Warp/Retro yet beyond Modern's well — this phase is the mechanism + the one Modern fix. **Conceptually-risky** (shared theme bridge read by all 7 themes + both shells; fallback correctness is where a wrong mental model regresses everything) → `sonnet-phase-reviewer` pass. Implement against the regression test (may not modify it). |
| 2 | Modern / Warp / Retro canon treatment | sonnet-implementer | Author the per-theme field values on `modern.ts`/`warp.ts`/`retro.ts` consuming Phase 1's pipeline: Modern indigo wash/glows aligned to canon §15; Warp warm-amber wash (`#16100a`/`#1b140c`) + amber glows + `terminalCanvasOpacity`; Retro matte (opaque panel opacities 0.85–0.95, `blur: 'none'`, green phosphor wash) + CRT scanlines via existing `effects.scanlines`. Values from `canon.html:857–895` (§15) + `:196–213,258–267` (§03). Render tests assert each theme emits the expected token values; visual contract verified at smoke. `sonnet-phase-reviewer` pass (Retro matte/no-blur is the divergence-prone bit). |
| 3 | Responsive breakpoint hook + shell collapse | sonnet-implementer | **Orchestrator authors the failing breakpoint-mode acceptance test FIRST** (mocked matchMedia → mode enum + which rails mount — see dispatch step 4). Build `Workbench/useWorkbenchBreakpoint.ts` (matchMedia at 1440/1180 → `full`/`compact`/`unified`, StrictMode-safe). Wire into `Workbench.tsx`: Compact → agent rail 348→300 + Latest Hunk one-line collapse (canon §16 priority 1, 3); Unified → mount `UnifiedRail`, unmount `ProjectRail`+`InnerRail`; clamp `<1180` to unified. Wire the collapse-handle stubs (`ProjectRail.tsx:67`, `InnerRail.tsx:92`) to force unified. Verify the Wave-5 `PermissionSidebarTakeover`/`PermissionOverlay` fit at 300px. **Conceptually-risky** (conditional component mounting + the mount/unmount of UnifiedRail is where divergence hides) → `sonnet-phase-reviewer` pass. Implement against the acceptance test. |
| 4 | Wave wrap | orchestrator | `test:layout` + `test:renderer` (+ full suite background), full lint + typecheck + prettier, orchestrator full-wave diff review, `/review` mechanical gap-check (Check 6 if stryker). Update `Workbench/CLAUDE.md` + `themes/CLAUDE.md`. Author `wave-6-result.md`. Append `CHANGELOG [2.27.0]`. `/ui-smoke 6` (UI-bearing — themes + responsive are the most visual wave yet; live smoke deferred per the Wave 0–5 posture, written + queued). Local `git tag v2.27.0` (push per the 2026-05-19 bulletin — pushing safe, merges wait for CI minutes). HANDOFF flip. `/promote-vendor-lessons 6` (likely no-op). `/audit-followups wave-6-workbench-themes-responsive`. |

### Phase ordering

```
Phase 0 (ADR)
   |
   v
Phase 1 (per-theme token pipeline + Modern well fix)   ← regression test gates it; the mechanism
   |
   v
Phase 2 (Modern/Warp/Retro canon values)               ← consumes Phase 1's pipeline; depends on it
   |
   v
Phase 3 (responsive breakpoint hook + shell collapse)  ← INDEPENDENT of theme work; could parallelize, but kept sequential (same shell files, single-threaded writes)
   |
   v
Phase 4 (wave wrap)
```

Phases 1→2 are a hard dependency (Phase 2 authors values for the path Phase 1 builds). Phase 3 (responsive) is logically independent of the theme work, but it edits `Workbench.tsx` and the rails which Phase 2 may also touch for matte/glass surfaces — to keep writes single-threaded and avoid merge churn, it runs after Phase 2 rather than in parallel. Phase 4 wraps.

## Risks

| Risk | Mitigation |
|---|---|
| Extending `applyComponentTokens` regresses the 4 untouched themes or the legacy shells (the bridge is shared infra read by ~48 AgentMonitor consumers + both shells) | D2 fallback discipline: new fields are optional; absent → today's literal values. **Orchestrator-owned default-preservation regression test** (Phase 1) asserts the 4 untouched themes + flag-off legacy shell emit byte-identical token values. Phase-reviewer checks the fallback branch. Mirrors Wave 0's default-preservation guard. |
| Retro blur suppression leaks to other themes (everyone goes matte) or the scanlines render on glass themes | D6: `blur` is a per-theme optional field; only Retro sets `'none'`. Scanlines gate on `effects.scanlines` (already Retro-only). Render test asserts Modern/Warp keep `--blur-strong` non-`none` and emit no scanline layer. |
| `matchMedia` mocking differs from real Electron Chromium → hook passes tests but misbehaves live | Acceptance test mocks `matchMedia` for the mode logic; the live behavior (drag-resize) is the Phase 3 observation point and the `/ui-smoke 6` checklist. Hook uses both `matchMedia().matches` (initial) and the `change` listener (reactive), StrictMode-safe (cleanup on unmount). |
| Unmounting `ProjectRail`/`InnerRail` on the unified transition drops their state (scroll position, selected project) | Unified mode mounts `UnifiedRail` which owns its own projects/sessions source (`useWorkbenchProjects`); selection lives in shared context, not rail-local state. Phase 3 brief verifies selection survives a full→unified→full round-trip; render test asserts. |
| The Wave-5 permission sidebar takeover overflows or clips at the 300px agent rail (Compact/Unified) | In-scope check: Phase 3 verifies `PermissionSidebarTakeover` at 300px; the card is full-width with stacked actions (already the sidebar variant), so it should reflow — render test at 300px width asserts the action buttons remain visible and the card doesn't clip. If it clips, that's a Phase 3 fix, not a follow-up. |
| `UnifiedRail` is built-but-never-mounted → mounting it surfaces latent bugs (it "still uses MOCK_PROJECTS/MOCK_SESSIONS/MOCK_BRANCH" per `Workbench/CLAUDE.md`) | Phase 3 brief: mounting `UnifiedRail` means wiring it to the **live** `useWorkbenchProjects`/session data (same source the inner rail uses), not shipping its mock data into a user-visible surface. If the live wiring is larger than expected, that's a Tier-3 call at the phase boundary (file a follow-up, ship unified-with-live-data in a fast-follow) — do not ship MOCK_* to the user. |
| Canon §15 specifies `--purple` values that diverge from the live themes (`tokens.css:240`) → implementer "fixes" purple and shifts every accent | Out of scope (D-scope); the divergence is flagged for separate reconciliation. Phase 2 brief: author wash/glow/blur/accent-edge only; do NOT touch the base `--purple`/accent palette. Reviewer flags any change to `colors.purple`/`colors.accent`. |
| Theme-interface change is back-incompatible (a required field) → the 4 untouched themes fail to typecheck | D7: all new fields are **optional** (`?:`). `tsc` gate + the regression test catch a non-optional slip. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR is documentation. |
| 1 | `applyComponentTokens` field→CSS-var mapping (each new field present → expected `setProperty`; absent → today's fallback literal). Modern `terminalWell` resolves to `0.62`; Warp `terminalCanvasOpacity` present. | **Orchestrator-owned default-preservation regression test**: for cursor/kiro/light/high-contrast, the full set of tokens `applyComponentTokens` writes is byte-identical before/after the change; flag-off legacy shell token snapshot unchanged. | Trophy (UI-heavy + type-checker is a real net here). `test:renderer`. |
| 2 | Per-theme value assertions: Warp emits warm-amber `--bg-wash`/`--bg-glows`; Retro emits `--blur-strong: none` + opaque `--material-panel` + scanline layer; Modern keeps blur + indigo wash. | Render `<Workbench>` (flag on) under each of Modern/Warp/Retro → root carries the expected theme token values; Modern/Warp do NOT emit scanlines. | Trophy. `test:layout`/`test:renderer`. |
| 3 | `useWorkbenchBreakpoint` mode logic: matchMedia(1440)=false,matchMedia(1180)=false → `full`; (1440)=true → `compact`; (1180)=true → `unified`; clamps `<1180` to `unified`; `change` event flips the mode. | **Orchestrator-owned breakpoint acceptance test**: render `<Workbench>` (flag on) with mocked matchMedia → full mounts ProjectRail+InnerRail (no UnifiedRail); compact narrows agent rail to 300 + Latest Hunk one-line; unified mounts UnifiedRail (no ProjectRail/InnerRail) with live data (no MOCK_*); `PermissionSidebarTakeover` renders un-clipped at 300px; full→unified→full preserves project selection. | Trophy. `test:layout`/`test:renderer`. |
| 4 | n/a | Scoped suites green; dead-export/lint clean; `/review` PASS/FLAG-addressed; `/ui-smoke 6` written. | Wrap. |

## Acceptance criteria

- [ ] `src/renderer/themes/types.ts` `Theme` gains optional `bgWash?`/`bgGlows?`/`blur?`/`accentEdge?`/`accentGlow?`/`termPromptBg?` (final field names per Phase 1); all optional, so cursor/kiro/light/high-contrast typecheck unchanged.
- [ ] `applyComponentTokens` (`useTheme.tokens.ts`) writes `--bg-wash`/`--bg-glows`/`--blur-strong`/`--blur-soft`/`--accent-edge`/`--accent-glow`/`--term-prompt-bg` from the new fields when present, and emits today's literal values when absent (fallback verified by the regression test).
- [ ] `modern.ts` `terminalWell` resolves to `rgba(6, 8, 16, 0.62)` (canon §03); `warp.ts` defines `terminalCanvasOpacity` (< 1).
- [ ] Warp emits a warm-amber `--bg-wash` (derived from `#16100a`/`#1b140c`) and amber `--bg-glows`; Retro emits `--blur-strong: none`, opaque `--material-panel` (alpha 0.85–0.95), a green phosphor wash, and a CRT scanline layer; Modern/Warp emit NO scanline layer and keep a non-`none` `--blur-strong`.
- [ ] The four untouched themes (cursor/kiro/light/high-contrast) and the flag-off legacy shells emit byte-identical token values before/after this wave (orchestrator-owned regression test passes).
- [ ] `Workbench/useWorkbenchBreakpoint.ts` returns `full`/`compact`/`unified` from matchMedia(1440)/matchMedia(1180), clamps `<1180` to `unified`, and updates reactively on the matchMedia `change` event; StrictMode-safe (no leaked listener).
- [ ] In `compact` the agent sidebar renders at width 300 (not 348) and the Latest Hunk panel renders as a one-line click-to-expand indicator; in `unified` `UnifiedRail` is mounted (wired to live `useWorkbenchProjects`/session data — **no MOCK_\* in the user-visible rail**) and `ProjectRail`/`InnerRail` are not mounted.
- [ ] The collapse-handle buttons (`ProjectRail.tsx:67`, `InnerRail.tsx:92`) force unified mode on click (no longer `() => undefined`).
- [ ] `PermissionSidebarTakeover` renders un-clipped with all actions visible at a 300px agent rail (render test at 300px).
- [ ] A full→unified→full breakpoint round-trip preserves the selected project (render test).
- [ ] No change to `src/main/**`, IPC, the material-variant system, `ApprovalContext`, or any config schema (`git diff` empty on those paths).
- [ ] Zero new hardcoded hex in renderer components (canon tokens / theme fields only); the new per-theme color values live in the `themes/*.ts` theme objects, not inline in components.
- [ ] `tsc` clean; `eslint src/` 0 errors; prettier clean.
- [ ] `Workbench/CLAUDE.md` updated (Wave 6 line: per-theme token path + breakpoint hook); `wave-6-result.md`, `CHANGELOG [2.27.0]`, `/ui-smoke 6` report, local tag `v2.27.0`.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR is the orchestrator's planning artifact — Cole reviews it; nothing renders. |
| 1 | The Modern terminal background in a live IDE (flag on, Modern theme) | `modern.ts terminalWell` → `applyComponentTokens` sets `--term-bg`/`--term-canvas-bg` → xterm DOM-renderer canvas bg → terminal pane in the canon workbench | Cole sees the Modern terminal read as a **deeper, clearly-tinted indigo well** sitting inside the glass — not the near-transparent washed-out tint it showed before (the 0.35→0.62 fix is visible to the eye). The other six themes' terminals look exactly as they did. |
| 2 | The whole workbench surface after switching theme to Warp, then Retro, in a live IDE (flag on) | theme switch → `useTheme` → `applyComponentTokens` per-theme fields → `--bg-wash`/`--bg-glows`/`--blur-*`/`--material-panel` on `:root` → every glass/panel surface in `<Workbench>` repaints | Switching to **Warp** washes the entire workbench in warm amber (the ambient wash + corner glows go orange, not indigo); switching to **Retro** makes the panels read as **opaque matte green with visible CRT scanlines and no glassy blur**, while Modern still looks like translucent indigo glass. |
| 3 | The workbench layout as Cole drags the IDE window narrower in a live session (flag on) | window resize → browser `matchMedia` `change` → `useWorkbenchBreakpoint` mode state → `Workbench.tsx` conditional render (rail mount/unmount + agent-rail width + Latest Hunk collapse) → on-screen layout | Past ~1440px wide, Cole sees the agent sidebar **narrow** and the Latest Hunk panel **collapse to a single clickable line**; past ~1180px the left project rail and inner rail **merge into one unified rail**; widening back restores the full layout with the same project still selected. The Wave-5 permission card still fits the narrowed sidebar. |
| 4 | Internal — no observation point | n/a | Wrap phase — gates, doc updates, brief, CHANGELOG, tag are build artifacts; the product surface is Phases 1–3, re-verified by `/ui-smoke 6`. |

### Data-shape probes

```bash
# Phase 1 — token pipeline + Modern well
npx vitest run src/renderer/hooks/useTheme.tokens.test.ts src/renderer/components/Workbench
#   Modern terminalWell is the canon value, not the legacy one:
#   grep -n "terminalWell" src/renderer/themes/modern.ts   → rgba(6, 8, 16, 0.62)
#   New Theme fields are optional (no required-field break):
#   grep -nE "bgWash\??:|bgGlows\??:|blur\??:" src/renderer/themes/types.ts  → all carry "?"

# Phase 2 — per-theme values
npx vitest run src/renderer/components/Workbench
#   Retro suppresses blur; only Retro:
#   grep -n "blur" src/renderer/themes/retro.ts   → 'none'
#   grep -L "blur.*none" src/renderer/themes/modern.ts src/renderer/themes/warp.ts  → both listed (no none)

# Phase 3 — responsive
npx vitest run src/renderer/components/Workbench
#   Collapse handles wired (no dead onClick):
#   grep -n "() => undefined" src/renderer/components/Workbench/Rails/{ProjectRail,InnerRail}.tsx  → no matches
#   No MOCK_* leaked into a mounted unified rail path:
#   grep -rn "MOCK_PROJECTS\|MOCK_SESSIONS\|MOCK_BRANCH" src/renderer/components/Workbench/Rails/UnifiedRail.tsx  → none

# Wave-wide — no protocol/IPC/material-variant/config drift
git diff --stat src/main src/renderer/contexts/ApprovalContext.tsx   # → empty
git diff --stat src/renderer/hooks/useTheme.material.ts 2>/dev/null   # → empty (material-variant untouched; adjust path if named differently)
npm run lint && npm run typecheck
```

## Files the next agent should read first

1. `roadmap/wave-6-workbench-themes-responsive/wave-6-decisions.md` — the ADR (Decisions 1–7; D1+D2 carry the spectrum). Read first.
2. `roadmap/discovery/workbench-overhaul-reconciliation.md` — §15/§16 expectations, the wave-sequence rationale, and reconciliation Decision 2 (themes fate). Lines 42–48 (§03 token gaps), 116–127 (wave sequence).
3. `src/renderer/hooks/useTheme.tokens.ts` — the theme bridge this wave extends. `applyComponentTokens` (`:109–116`) is the function gaining per-theme fields; `applyMaterialTokens` (`:149–175`) writes `--bg-wash`/`--bg-glows` today (material-variant-keyed — **do not modify**, D7); `:266–267` source `terminalWell`/`terminalCanvasOpacity`.
4. `src/renderer/themes/types.ts` — the `Theme` interface (`:1–42`); `terminalWell?`/`terminalCanvasOpacity?`/`effects?.scanlines` already exist. The new optional fields go here.
5. `src/renderer/themes/{modern,warp,retro}.ts` — the three themes getting full treatment. `modern.ts:35` is the `terminalWell` to fix (0.35→0.62).
6. `src/renderer/styles/tokens.css` — the canon alias block (`:210–266`); the deferred "Phase 2" note (`:254–255`) is exactly what Phase 1 completes; `--glass-panel-hi` hardcoded Modern literal (`:229`); `--purple` divergence note (`:240`, out of scope).
7. `design-system/canon.html` — §15 per-theme palettes (`:857–895`), §03 token requirements (`:196–213,258–267`), §16 responsive tiers + collapse priority (`:901–928`). The visual + responsive contract.
8. `src/renderer/components/Workbench/Workbench.tsx` — the shell; `MiddleRow` (`:40–57`) is where responsive conditional rendering goes.
9. `src/renderer/components/Workbench/Rails/{ProjectRail,InnerRail,UnifiedRail}.tsx` — rail widths (`ProjectRail:26`=56, `InnerRail:24`=256, `UnifiedRail:23`=272); collapse-handle stubs (`ProjectRail:67`, `InnerRail:92`); `UnifiedRail` is built-but-unmounted and still on MOCK_* (must wire to live data when mounted).
10. `src/renderer/components/Workbench/AgentSidebar/AgentSidebar.tsx` — agent rail width (`:199`=348, narrows to 300 in compact); the Latest Hunk panel that collapses; the NOW slot the Wave-5 permission takeover swaps into.
11. `src/renderer/components/Workbench/Permission/{PermissionOverlay,PermissionSidebarTakeover}.tsx` — the Wave-5 surfaces to verify at 300px (do NOT rebuild — verify fit + reflow only).
12. `roadmap/wave-0-workbench-token-foundations/waveplan-0.md` — the prior token-bridge wave + its default-preservation regression-guard pattern this wave reuses.
13. `roadmap/wave-5-workbench-permission-overlay/wave-5-result.md` — the most recent shipped wave; the don't-touch-the-protocol / renderer-only posture this wave inherits.

## Note to the implementer

The spirit of this wave is **make the three headline themes look the way the canon draws them, and make the shell collapse gracefully as the window narrows — without disturbing anything outside the canon workbench.** Two distinct tracks share the wave: a per-theme *token path* (Phases 1–2) and a *responsive layout* (Phase 3). They're independent in concept but touch overlapping shell files, so they run sequentially.

Resist these temptations: (a) do NOT couple per-theme appearance to the material-variant system — extend the `Theme` interface and `applyComponentTokens` instead (D2); the material variant is an independent axis and `applyMaterialTokens` stays untouched. (b) Every new `Theme` field is **optional with a fallback to today's literal value** — that fallback is what keeps cursor/kiro/light/high-contrast and both legacy shells byte-identical; the orchestrator-owned regression test will fail loudly if you regress them. (c) Do NOT build the `<1180` floating HUD or the inner-rail drawer — Cole scoped responsive to stop at Unified (D3); below 1180 just clamps to the unified layout. (d) When you mount `UnifiedRail`, wire it to the **live** project/session data the inner rail already uses — do NOT ship its `MOCK_PROJECTS`/`MOCK_SESSIONS`/`MOCK_BRANCH` into a user-visible surface; if live-wiring it is bigger than a phase, stop and flag it (Tier 3). (e) Do NOT touch the base `--purple`/accent palette to "match canon" — that divergence is flagged for separate reconciliation (out of scope). The Modern terminal-well fix (0.35→0.62) is small but it's a real visible change — it's your Phase 1 observation point, not a throwaway.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

When a phase's gate is green and nothing Tier 3 surfaced, the orchestrator dispatches the next phase in the same turn — it does not end the turn to summarize or ask. The turn ends between phases only for a Tier 3 discovery needing a user call, a genuine user-judgment decision, or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** at `roadmap/wave-6-workbench-themes-responsive/wave-6-decisions.md` with Decisions 1–7 (D1 + D2 carrying the best-practice spectrum). Gate to Phase 1.
2. **Author the Phase 1 default-preservation regression test first (orchestrator).** Per `~/.claude/rules/orchestrator-owned-acceptance-tests.md`: a test that snapshots the full set of CSS vars `applyComponentTokens` writes for cursor/kiro/light/high-contrast (and a flag-off legacy-shell token snapshot) and asserts they are byte-identical to the pre-change baseline. Capture the baseline from current `main` first. Confirm the test PASSES on current code (it's a guard, not a red test) — then it must STILL pass after Phase 1.
3. **Phase 1 — sonnet-implementer (conceptually-risky).** Brief: extend `Theme` (optional fields), extend `applyComponentTokens` with present-field→CSS-var writes + absent→literal-fallback, fix Modern `terminalWell`→0.62, add Warp `terminalCanvasOpacity`. NO Warp/Retro values yet. Gate: regression test still green + new field-mapping unit tests green + `test:renderer` green + lint/tsc clean + **`sonnet-phase-reviewer` pass** (fallback-branch correctness; shared-bridge regression risk). Orchestrator cross-phase check: is the field set shaped so Phase 2 just *fills values*, not reshapes the path? + manual: Modern terminal well looks deeper.
4. **Author the Phase 3 breakpoint acceptance test first (orchestrator)** — can be authored now or at the Phase 2→3 boundary. A failing test rendering `<Workbench>` (flag on) with mocked `matchMedia`: full → ProjectRail+InnerRail mount, no UnifiedRail; compact → agent rail width 300 + Latest Hunk one-line; unified → UnifiedRail mounts (no ProjectRail/InnerRail) with live data; `PermissionSidebarTakeover` un-clipped at 300px; full→unified→full preserves selection. Confirm it FAILS before Phase 3 dispatch.
5. **Phase 2 — sonnet-implementer.** Brief: author Modern/Warp/Retro per-theme field values (canon §15/§03); Retro matte+scanlines+`blur:'none'`; do NOT touch base palette/`--purple`. Gate: per-theme value render tests green + `test:layout`/`test:renderer` green + lint/tsc clean + **`sonnet-phase-reviewer` pass** (Retro matte/no-blur scoping) + manual: Warp warm wash, Retro matte+scanlines, Modern still glass.
6. **Phase 3 — sonnet-implementer (conceptually-risky).** Brief: build `useWorkbenchBreakpoint`, wire the 3 modes into `Workbench.tsx`, narrow agent rail in compact, collapse Latest Hunk, mount live-wired `UnifiedRail` in unified, wire collapse-handle stubs, verify permission card at 300px. Implement against the acceptance test (may not modify it). Gate: acceptance test passes + `useWorkbenchBreakpoint` unit tests green + `test:layout`/`test:renderer` green + lint/tsc clean + **`sonnet-phase-reviewer` pass** (conditional mount/unmount; selection-preservation; no MOCK_* leak) + manual: drag-resize collapses the layout through the tiers.
7. **Phase 4 — wave wrap.** `npm run lint`, `npm run typecheck`, prettier, `npx vitest run src/renderer/components/Workbench` (+ full suite in background). Orchestrator full-wave diff review. `/review` mechanical gap-check (Check 6 if stryker). Update `Workbench/CLAUDE.md` (Wave 6: per-theme token path + breakpoint hook) + `themes/CLAUDE.md` if warranted. Author `wave-6-result.md`. Append `CHANGELOG [2.27.0]`. Run `/ui-smoke 6` (UI-bearing; live smoke deferred per the Wave 0–5 posture — written + queued for next dev session). Local tag `v2.27.0` (push per the 2026-05-19 bulletin — pushing safe, merges wait for CI minutes). Update `HANDOFF.md`. `/promote-vendor-lessons 6` (likely no-op). `/audit-followups wave-6-workbench-themes-responsive`.
