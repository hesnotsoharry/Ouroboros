---
status: IN-PROGRESS
created: 2026-05-22
updated: 2026-05-22
wave: 6
slug: workbench-themes-responsive
---

# Wave 6 — Architecture Decision Record

Decisions committed before code. D1 + D2 carry the best-practice spectrum (`~/.claude/rules/best-practice-spectrum.md`); the rest are abbreviated (Context / Pick / Rationale).

## Decision 1: Responsive mechanism

**Context:** Canon §16 collapse requires switching *which components mount* (a single `UnifiedRail` replaces `ProjectRail`+`InnerRail` below 1180), not just restyling. The mechanism choice gates how Phase 3 is built.

**Options considered:**
- *Industry standard:* CSS viewport media queries (`@media (max-width: …)`). Ubiquitous, zero JS. **Disqualifier:** CSS can hide/show but cannot mount/unmount React components or swap component trees — our collapse needs a real component swap (different rail component with different data wiring), and the agent-rail width + Latest-Hunk-collapse also drive conditional render, not just display.
- *Emerging best practice:* a JS `matchMedia`-driven React hook (`useWorkbenchBreakpoint`) returning a mode enum, with components conditionally rendering per mode. `matchMedia` + its `change` event is the lightest reactive primitive (no per-frame resize spam, unlike a raw `resize` listener), is trivially testable by mocking `matchMedia`, and supports conditional mounting.
- *Experimental / cutting-edge:* CSS container queries (`@container`). Excellent for component-local responsiveness. **Wrong tool here:** we respond to *window/shell* width, not container width, and it's still pure CSS — same mount/unmount disqualifier as media queries.

**Pick:** Emerging — `useWorkbenchBreakpoint` via `matchMedia` (queries at **1760 and 1440**). Note: once the HUD is dropped (D3), the canon §16 1180 boundary is moot — everything below 1440 is uniformly Unified — so the 3-tier system needs only the 1760 (full↔compact) and 1440 (compact↔unified) boundaries.

**Rationale:** Conditional component mounting is the hard requirement; only a JS-driven mode enum satisfies it. `matchMedia` over a raw `resize` listener avoids reflow thrash and is cleanly mockable for the acceptance test. Electron's modern Chromium supports `matchMedia` + `change` fully.

**Consequences:** Adds one renderer-local hook + a mode-keyed conditional render in `Workbench.tsx`. Must be StrictMode-safe (listener cleanup). The HUD tier is explicitly NOT built (see D3), so the enum is 3-valued (`full`/`compact`/`unified`); everything below 1440 (the canon 1180–1439 Unified band AND the <1180 HUD band) clamps to `unified`.

## Decision 2: Per-theme wash/glow/blur/accent mechanism

**Context:** Today `--bg-wash`/`--bg-glows`/`--material-panel` are written by `applyMaterialTokens` keyed on the **material variant**, not the theme — so "Warp = warm amber wash" has no home. `tokens.css:254–255` carries a deferred promise: "MODERN defaults here; Phase 2 makes per-theme via applyComponentTokens." Wave 6 must give the three headline themes distinct ambient appearance.

**Options considered:**
- *Industry standard:* per-theme CSS classes / `data-theme` attribute selectors carrying full token sets in CSS. The app already uses `data-theme` + a JS bridge, so this is partially in place.
- *Emerging best practice:* extend the existing JS theme bridge (`applyComponentTokens`) to write per-theme wash/glow/blur/accent tokens from typed optional `Theme` fields — completing the exact deferred promise already written into `tokens.css:254`, and matching the Wave-0 pattern (`terminalWell`/`terminalCanvasOpacity` are already theme fields driven through this same function).
- *Experimental / cutting-edge:* decouple appearance into composable material-variant presets that themes select. More flexible, but couples two axes that are deliberately independent and is far more change than the wave needs.

**Pick:** Emerging — extend the `Theme` interface (optional fields) + `applyComponentTokens`.

**Rationale:** It completes a promise already encoded in the codebase, reuses the established Wave-0 pattern, keeps theme and material-variant as independent axes, and localizes the change to two files (`themes/types.ts` + `useTheme.tokens.ts`) plus the three theme value files. Optional fields with literal fallback keep the four untouched themes and both legacy shells byte-identical.

**Consequences:** `Theme` grows optional fields; `applyComponentTokens` grows present-field→var writes with absent→fallback. The fallback branch is load-bearing for non-regression and is guarded by the orchestrator-owned default-preservation test. The material-variant system is untouched.

## Decision 3: Responsive depth stops at Unified (≥1180)

**Context:** Canon §16 defines four tiers (Full/Compact/Unified/HUD); §18 separately lists the floating HUD as "not in v1." Building the HUD also forces resolving how the Wave-5 permission surfaces behave when the agent rail becomes a corner pill (canon §13 has no responsive sub-spec).

**Pick:** Full / Compact / Unified only; clamp `<1180` to Unified. No HUD, no inner-rail drawer. **Cole-locked 2026-05-22.**

**Rationale:** Honors §18; keeps the wave bounded; sidesteps the unspecified permission-in-HUD problem entirely (the agent rail — and thus the sidebar permission takeover — always has a home at all three implemented tiers).

**Consequences:** A genuinely tiny desktop window (<1180) gets the Unified layout, not a HUD. If a real narrow-window need surfaces later, the HUD is a clean fast-follow on top of the mode enum.

## Decision 4: Full treatment for Modern/Warp/Retro only

**Context:** Reconciliation Decision 2 already scoped full glass treatment to the three v1 themes; the other four are "opportunistic."

**Pick:** Modern/Warp/Retro get full canon treatment; cursor/kiro/light/high-contrast stay functional with existing tokens, no per-theme tuning this wave. **Cole-locked 2026-05-22.**

**Rationale:** Bounds the wave; light/high-contrast non-tinted terminals are arguably correct for accessibility. The optional-field design means the untouched four simply omit the new fields and fall back to current behavior.

**Consequences:** A later polish pass tunes the other four if desired. No regression risk to them (fallback path).

## Decision 5: Reconcile Modern terminalWell 0.35 → 0.62

**Context:** `modern.ts:35` sets `terminalWell: 'rgba(6, 8, 16, 0.35)'`; canon §03 (`canon.html:258`) specifies `0.62`. A divergence live since Wave 0.

**Pick:** Fix toward canon (0.62); add the missing Warp `terminalCanvasOpacity`.

**Rationale:** Canon is the contract; 0.62 is "a deeper well in the glass, not a black hole" per canon §01 principle 03. Visible improvement, trivial change.

**Consequences:** Modern terminal reads as a deeper well — the Phase 1 observation point.

## Decision 6: Retro is matte, not glass

**Context:** Canon §15 (`canon.html:884`) says Retro materials go opaque (panel opacities 0.85–0.95), add CRT scanlines, drop most shadows, keep the green phosphor glow. The blur tokens are currently constants.

**Pick:** Make `--blur-strong`/`--blur-soft` theme-driven (resolve to `none` for Retro via `applyComponentTokens`); opaque `--material-panel`; scanlines via the existing `Theme.effects.scanlines` field (already Retro-only).

**Rationale:** Theme-driven blur is the localized way to suppress glass for one theme without affecting the others; scanlines already have a typed home.

**Consequences:** `blur` becomes a per-theme optional field; only Retro sets `'none'`. Render tests assert Modern/Warp keep non-`none` blur and emit no scanline layer.

## Decision 7: Renderer-only; no material-variant / IPC / config / main-process change

**Context:** The theme bridge is shared infra; the temptation is to reach into the material-variant system or main process.

**Pick:** All changes confined to `src/renderer/themes/**` + `useTheme.tokens.ts` + `Workbench/**`. New `Theme` fields are optional (back-compatible).

**Rationale:** Keeps blast radius minimal and the diff reviewable; the four untouched themes typecheck unchanged because the fields are optional.

**Consequences:** `git diff` must be empty on `src/main/**`, IPC, `ApprovalContext`, the material-variant module, and config schema (an acceptance criterion).
