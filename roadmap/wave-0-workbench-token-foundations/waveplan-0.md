---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
wave: 0
slug: workbench-token-foundations
---

# Wave 0 — Workbench Token Foundations

## Status

DRAFT · target v2.21.0 (minor — user-visible terminal treatment change behind the default theme) · drafted 2026-05-21.

## Context — why this wave exists

This is the foundation wave of the workbench overhaul (see `roadmap/discovery/workbench-overhaul-reconciliation.md`, which reconciles `design-system/canon.html` + `workbench-tokens.css` against the live renderer). Every later wave — the static shell, the terminal integration, the agent sidebar — consumes the token grammar this wave establishes. Shipping it first means the rest of the overhaul authors against a stable token surface instead of inventing one per-wave.

Two token-layer gaps block the canon. **First**, the canon mockup authors against short variable names (`--accent`, `--ink-2`, `--glass-panel`, `--r-md`) while the app uses a 3-tier semantic system (`--interactive-accent`, `--text-secondary`, `--material-panel`, `--radius-md`) written at runtime by the theme bridge (`useTheme.tokens.ts:238` `applyThemeToDom`). The reconciliation resolved this (Decision 3) as: add the canon names as a thin alias layer over the real tokens, reusing the existing compat-alias pattern already present in `tokens.css`. **Second**, the canon's "tinted well" terminal treatment (`--term-bg: rgba(6,8,16,0.62)`, `--terminal-canvas-opacity: 0.86`) is not achievable today: `applyComponentTokens` (`useTheme.tokens.ts:105`) *unconditionally* force-overrides `--term-bg` to `rgba(0,0,0,0)`, and `--terminal-canvas-opacity` exists in `tokens.css` (default `1`, added Wave 95 Phase D) but has no `Theme` interface field and no bridge `setProperty` call — nothing ever writes it from theme data.

The load-bearing constraint (`renderer.md`): the always-on-glass behavior relies on the bridge forcing surfaces and `--term-bg` transparent so the native mica/vibrancy shows through. The fix must therefore be **opt-in and default-preserving** — the transparent default stays for any theme that doesn't ask for a well, so the four themes not in v1 scope (cursor/kiro/light/high-contrast) are untouched. Renderer-only; no main-process, IPC, or schema change.

## Goal

After Wave 0, the renderer carries a stable workbench token grammar: canon-named CSS variables (`--accent`, `--ink-*`, `--glass-*`, radii, status, plus the new `--accent-edge`/`--accent-glow`/`--term-prompt-bg`) resolve to the real theme-reactive token layer, so workbench components in later waves author against canon names verbatim; and the terminal "tinted well" is theme-driven — `Theme` carries optional `terminalWell` + `terminalCanvasOpacity` fields, the bridge writes them (defaulting to today's transparent/opaque behavior when unset), and Modern/Warp/Retro set the canon values so the Modern terminal reads as a translucent tinted well with the glass wash visible through it, rather than an opaque black panel.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-0-workbench-token-foundations/wave-0-decisions.md`.

1. **Alias strategy — canon names resolve to the real semantic tokens via `var()` references, not redefined values.** Where a canon value already matches the nearest semantic token (accent `#818cf8` = `--palette-accent`, the ink ramp, status, radii), the canon name is a static reactive alias (`--accent: var(--interactive-accent)`). RESOLVED (reconciliation Decision 3).
2. **Canon tokens with no aligned equivalent are theme-driven, not static.** `--accent-edge`, `--accent-glow`, `--term-prompt-bg` (and the tinted-well `--term-bg`/`--terminal-canvas-opacity`) are accent/theme-derived and differ per theme, so the bridge writes them from theme data rather than the static alias block. RESOLVED.
3. **Tinted well is opt-in and default-preserving.** Add optional `Theme.terminalWell?: string` and `Theme.terminalCanvasOpacity?: number`; the bridge writes `--term-bg` ← `terminalWell ?? 'rgba(0,0,0,0)'` and `--terminal-canvas-opacity` ← `terminalCanvasOpacity ?? 1`. Unset = today's behavior, so the four out-of-v1 themes are unchanged. RESOLVED (load-bearing constraint + reconciliation Decision 2).
4. **Per-theme well values come from `workbench-tokens.css` verbatim.** Modern `rgba(6,8,16,0.62)` / `0.86`; Warp `rgba(14,9,4,0.7)` / `1` (canon Warp sets no canvas opacity); Retro `rgba(4,10,6,0.96)` / `1`. RESOLVED (canon).
5. **The canon alias block is a new, clearly-labeled Tier-2 sub-block in `tokens.css`** — separate from the legacy "remove after Phase 3" compat aliases, so the two removals stay independent. RESOLVED.
6. **Apply the tinted well to the current terminal now — LOCKED (Cole, 2026-05-21).** Phase 2 sets Modern's `terminalWell` + `terminalCanvasOpacity`, so the existing IDE-shell terminal renders as a tinted glass well immediately. This gives Wave 0 a real user-observable surface and validates the treatment early on real content; it is one-line reversible (unset the two Modern fields) if it reads poorly over busy terminal output.

## Scope

**In scope:**
- **Canon alias block** in `src/renderer/styles/tokens.css` — a labeled Tier-2 sub-block defining the aligned canon names as `var()` aliases: `--accent`/`--accent-hi`, `--ink`/`--ink-2`/`--ink-3`/`--ink-4`/`--ink-on-accent`, `--glass-panel`/`--glass-panel-hi`/`--glass-overlay`/`--glass-rail`, `--stroke-inner`/`--stroke-faint`/`--stroke-strong`, `--success`/`--warning`/`--error`/`--info`/`--purple` (+ their `-tint` forms), and the radii `--r-xs..--r-pill`. Mapping source of truth: `design-system/workbench-tokens.css` + the live token inventory in `tokens.css`. Per-token reconciliation rule (Decision 1): alias when values align; if a canon value diverges from the nearest semantic token, add the canon token with the canon value and leave a `/* canon-divergence: reconcile semantic token in a later wave */` marker.
- **Theme interface fields** in `src/renderer/themes/types.ts` — optional `terminalWell?: string`, `terminalCanvasOpacity?: number`.
- **Bridge wiring** in `src/renderer/hooks/useTheme.tokens.ts` — `applyComponentTokens` writes `--term-bg` ← `terminalWell ?? 'rgba(0,0,0,0)'` (replacing the unconditional transparent override), `--terminal-canvas-opacity` ← `terminalCanvasOpacity ?? 1`, and the theme-driven `--accent-edge` / `--accent-glow` / `--term-prompt-bg` from per-theme values.
- **Per-theme values** in `src/renderer/themes/{modern,warp,retro}.ts` — set `terminalWell` + `terminalCanvasOpacity` (Decision 4) and the accent-edge/glow/term-prompt-bg values per `workbench-tokens.css`.
- **Unit test** for `applyComponentTokens` (or its extracted helper): asserts a theme with `terminalWell`/`terminalCanvasOpacity` set writes the expected `--term-bg`/`--terminal-canvas-opacity`, and a theme with them unset writes `rgba(0,0,0,0)` / `1` (the preserved default).
- **Doc** — note the canon alias block + tinted-well bridge in the nearest token/theme CLAUDE.md (renderer styles or themes).

**Out of scope:**
- Any component authoring against the canon names — that begins Wave 1 (static shell). This wave only defines the grammar.
- Porting cursor/kiro/light/high-contrast to the canon well treatment — they stay on the preserved transparent default (deferred, opportunistic in Wave 6).
- Tailwind `@theme` utility classes for the canon names in `globals.css` — only add if a later wave needs canon names as utility classes; raw `var(--canon-name)` usage suffices for the mockup. Deferred to Wave 1 if needed.
- The terminal-pane *element* wiring that applies `--term-bg`/canvas-opacity to the right DOM nodes in the new workbench — Wave 2. (Wave 0 only makes the tokens correct + theme-driven; the *current* shell already reads them, which is what makes Decision 6's "apply now" observable.)
- Reconciling divergent semantic-token values to canon (the markers from the In-scope rule) — a later token-cleanup pass.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | orchestrator | Author `wave-0-decisions.md` with Decisions 1–5 RESOLVED and Decision 6 reflecting Cole's lock. Gate to 1. |
| 1 | Canon alias block | sonnet-implementer | Add the labeled Tier-2 canon-alias sub-block to `tokens.css` (Decision 5). Aligned canon names become `var()` references to the real semantic tokens (Decision 1) — reactive to theme switches. Use `design-system/workbench-tokens.css` as the value source and the existing `tokens.css` inventory as the alias target; where a value diverges, define with the canon value + the `canon-divergence` marker. NO new component consumes these yet — internal. Mind the renderer no-hex rule: divergent tokens that must carry a literal value are tokens, not component hex, so they're permitted here with the marker comment. Test shape: trophy (typecheck is the real net; no meaningful unit surface for static CSS). |
| 2 | Theme fields + tinted-well bridge wiring + per-theme values | sonnet-implementer | Add `terminalWell?: string`/`terminalCanvasOpacity?: number` to `Theme` (`types.ts`). In `applyComponentTokens` (`useTheme.tokens.ts:105`) replace the unconditional `--term-bg: rgba(0,0,0,0)` with `well ?? 'rgba(0,0,0,0)'` and add `--terminal-canvas-opacity` ← `String(canvasOpacity ?? 1)`; thread the two values from `theme` via `EffectiveTheme`/`resolveEffectiveTheme` and pass to `applyComponentTokens` as a small options object (respect ESLint max-params:4). Set Modern/Warp/Retro `terminalWell` (+ Modern `terminalCanvasOpacity: 0.86`) per Decision 4. Leave the other four themes unset (default-preserving). Author the unit test asserting set-vs-unset bridge output. Test shape: trophy. **Scope note:** `--accent-edge`/`--accent-glow`/`--term-prompt-bg` keep their Phase-1 Modern static defaults — per-theme wiring deferred to the themes wave (Wave 6), since nothing consumes them in Wave 0 (YAGNI; avoids interface surface for unread tokens). **Conceptually-risky (touches the load-bearing glass override) — `sonnet-phase-reviewer` pass after, on spec-alignment + integrity (did the default-preserving branch survive for unset themes?).** |
| 3 | Wave wrap | orchestrator | `test:renderer` (covers `src/renderer/hooks` + `styles`), full lint + typecheck + formatter, orchestrator diff review, `/review` mechanical gap-check (Check 6 mutation if stryker present), CLAUDE.md update (renderer styles/themes), `wave-0-result.md`, `CHANGELOG.md [2.21.0]`, `/ui-smoke 0` if Decision 6 = apply-now (terminal is UI-bearing), local `git tag v2.21.0` (HOLD push per 2026-05-19 bulletin — minutes exhausted to 2026-06-01), HANDOFF flip, `/promote-vendor-lessons 0` (no-op — no vendor SDK), `/audit-followups wave-0-workbench-token-foundations`. |

### Phase ordering

```
Phase 0 (ADR + Decision 6 lock)
   |
   v
Phase 1 (canon alias block)      Phase 2 (theme fields + bridge + values)
   |                                  |
   +──────────────┬───────────────────+
                  v
            Phase 3 (wrap)
```

- Phases 1 and 2 touch **disjoint files** (Phase 1: `tokens.css`; Phase 2: `types.ts` + `useTheme.tokens.ts` + three theme files) and are independent — they can run in either order or be taken by one implementer in sequence. Neither blocks the other.
- Phase 0 blocks both (Decision 6 lock determines whether Phase 2 sets Modern's values or leaves them unset). Phase 3 blocks on 1 + 2.

## Risks

| Risk | Mitigation |
|---|---|
| Removing the unconditional `--term-bg: rgba(0,0,0,0)` override regresses always-on glass for the four untouched themes | The replacement is `terminalWell ?? 'rgba(0,0,0,0)'` — unset themes get the identical transparent value. Phase 2 unit test asserts an unset theme still writes `rgba(0,0,0,0)`; phase-reviewer checks the default branch survived. |
| Canon-value divergence from the nearest semantic token (e.g. `--accent-tint` rgba(129,140,248,0.14) vs `--interactive-accent-subtle` rgba(88,166,255,0.08)) — a blind alias silently shifts the mockup's intended color | Decision 1's per-token rule: alias only when values align; on divergence, define the canon token with the canon value + a `canon-divergence` marker. Implementer diffs each canon var against its target before aliasing, not after. |
| Modern's 0.86 canvas opacity makes terminal text illegible over busy/bright output | Decision 6's fallback: revert Modern's two fields (one-line), tokens stay defined for Wave 2. `/ui-smoke 0` visually checks legibility before ship if apply-now is locked. |
| `--accent-edge`/`--accent-glow`/`--term-prompt-bg` are accent-derived; defining them static (not per-theme) breaks on theme switch | Decision 2 routes them through the bridge as theme-driven, so they update with `--interactive-accent` on every theme change. |
| ESLint complexity/line caps on `applyComponentTokens` after adding writes | Brief mandates helper extraction; lint runs at the Phase 2 gate on touched files. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR is documentation. |
| 1 | n/a | n/a | Static CSS aliases — no meaningful unit surface; typecheck + the no-hex lint + visual smoke are the net. Trophy. |
| 2 | `applyComponentTokens` (or extracted helper): theme with `terminalWell`/`terminalCanvasOpacity` set → `--term-bg`/`--terminal-canvas-opacity` written to those values; unset → `rgba(0,0,0,0)` / `1` (default preserved); `--accent-edge`/`--accent-glow`/`--term-prompt-bg` written per theme | Bridge applied on a real theme switch writes the expected `:root` custom properties (jsdom `getComputedStyle` or `documentElement.style` read) | Trophy. `test:renderer`. |
| 3 | n/a | Scoped suite green, `/review` PASS/FLAG-addressed, `/ui-smoke 0` (if apply-now) | Wrap. |

## Acceptance criteria

- [ ] `src/renderer/styles/tokens.css` contains a labeled canon-alias Tier-2 sub-block, separate from the legacy compat block, defining `--accent`/`--accent-hi`/`--ink`/`--ink-2`/`--ink-3`/`--ink-4`/`--ink-on-accent`/`--glass-panel`/`--glass-panel-hi`/`--glass-overlay`/`--glass-rail`/`--stroke-inner`/`--stroke-faint`/`--stroke-strong`/`--success`/`--warning`/`--error`/`--info`/`--purple` (+ `-tint` forms) and `--r-xs`..`--r-pill`.
- [ ] Aligned canon names are `var()` references (theme-reactive); any divergent token carries a `canon-divergence` marker comment.
- [ ] `src/renderer/themes/types.ts` `Theme` interface has optional `terminalWell?: string` and `terminalCanvasOpacity?: number`.
- [ ] `applyComponentTokens` writes `--term-bg` ← `terminalWell ?? 'rgba(0,0,0,0)'` (the unconditional transparent override is gone) and `--terminal-canvas-opacity` ← `terminalCanvasOpacity ?? 1`.
- [ ] A theme with both fields unset still produces `--term-bg: rgba(0,0,0,0)` and `--terminal-canvas-opacity: 1` (regression-proof for the four untouched themes), asserted by a unit test that fails if the default branch is removed.
- [ ] `modern.ts`/`warp.ts`/`retro.ts` set `terminalWell` + `terminalCanvasOpacity` per Decision 4; `--accent-edge`/`--accent-glow`/`--term-prompt-bg` are written by the bridge per theme.
- [ ] cursor/kiro/light/high-contrast themes leave the new fields unset and render unchanged.
- [ ] `wave-0-decisions.md` records Decisions 1–5 RESOLVED and Decision 6 as Cole locked it.
- [ ] `CHANGELOG.md [2.21.0]` entry; `wave-0-result.md` with per-phase outcomes; local tag `v2.21.0`; `/ui-smoke 0` report if Decision 6 = apply-now; HANDOFF deferred-push reminder.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR is the orchestrator's planning artifact — Cole reviews it, but it is not a product surface; nothing renders. |
| 1 | Internal — no observation point | n/a | Canon alias names resolve in `:root`, but no component consumes them yet (that begins the static-shell wave); nothing changes on screen. Pure token plumbing — verified by typecheck + a computed-style spot check, not a user surface. |
| 2 | Terminal pane in a running IDE on the Modern theme | theme select → `applyThemeToDom` → `applyComponentTokens` writes `--term-bg: rgba(6,8,16,0.62)` + `--terminal-canvas-opacity: 0.86` to `documentElement` → `.xterm` canvas opacity + terminal container background → terminal pane re-render → user sees the terminal | The terminal's opaque black panel becomes a translucent indigo-tinted well — the glass/mica wash behind it is faintly visible through the canvas, and terminal text stays legible. Switching to an untouched theme (e.g. Light) shows the terminal unchanged from today. |
| 3 | Internal — no observation point | n/a | Wrap phase — gates, result brief, CHANGELOG, and local tag are build artifacts, not product surfaces. The product surface is Phase 2's terminal, re-verified by `/ui-smoke 0`. |

### Data-shape probes

```bash
# Phase 1 — canon alias block present, separate from legacy compat block
# Grep tokens.css for the canon-alias block label and for `--accent:` / `--glass-panel:` / `--r-md:`.
# Grep tokens.css for any new bare `#hex` outside a canon-divergence marker (renderer no-hex rule).

# Phase 2 — Theme fields + bridge wiring + default preservation
# Grep themes/types.ts for `terminalWell` + `terminalCanvasOpacity`.
# Grep useTheme.tokens.ts for `terminalWell ?? 'rgba(0,0,0,0)'` and `terminal-canvas-opacity`.
# Grep modern.ts/warp.ts/retro.ts for `terminalWell` + `terminalCanvasOpacity`.
npx vitest run src/renderer/hooks/useTheme.tokens.test.ts   # set-vs-unset bridge output

# Wrap
npm run lint && npm run typecheck
npx vitest run src/renderer/hooks src/renderer/themes
```

## Files the next agent should read first

1. `roadmap/wave-0-workbench-token-foundations/wave-0-decisions.md` — ADR; the 6 locked decisions, esp. Decision 6 (apply-now vs define-only) and Decision 1 (alias-vs-divergence rule).
2. `roadmap/discovery/workbench-overhaul-reconciliation.md` — the full canon↔codebase reconciliation; §03 Tokens is this wave's spec.
3. `design-system/workbench-tokens.css` — canon token values (the source of truth for the alias mapping + per-theme well values).
4. `src/renderer/styles/tokens.css` — the live 3-tier token system + the existing legacy compat-alias block to mirror (the pattern, not the same block).
5. `src/renderer/hooks/useTheme.tokens.ts` — `applyComponentTokens` (line ~105, the `--term-bg` override to replace) and `applyThemeToDom` (line ~238, the bridge call sequence).
6. `src/renderer/themes/types.ts` — the `Theme` interface to extend.
7. `src/renderer/themes/{modern,warp,retro}.ts` — the three themes that get the v1 well values; and one of cursor/kiro/light to confirm the unset-default path.
8. `src/renderer/styles/globals.css` — the Tailwind `@theme` bridge (read-only this wave unless a canon utility class is needed; if so it's deferred to Wave 1).

## Note to the implementer

The spirit of this wave is **lay the token grammar the rest of the overhaul builds on — without changing how anything is composed yet.** You are defining names and wiring the bridge, not building UI. Resist three temptations: (a) don't start using the canon names in components — no component consumes them until Wave 1; (b) don't "simplify" the theme bridge or collapse the 3-tier system — the tiers and the runtime overrides are load-bearing (always-on glass depends on them); (c) don't blind-alias a canon name to a semantic token without diffing the values first — `--accent-tint` and `--interactive-accent-subtle` differ in hue and alpha, and a silent alias would shift the mockup's intended color. When values diverge, the canon value wins, with a marker for a later reconciliation pass.

Phase 2 is the one that touches load-bearing code: the unconditional `--term-bg: rgba(0,0,0,0)` override is what gives every theme its glass terminal today. Your replacement must keep that exact value for any theme that doesn't set `terminalWell` — the four out-of-v1 themes must look identical after your change. The unit test asserting "unset → rgba(0,0,0,0) / 1" is the guard; if you ever find yourself removing the `?? 'rgba(0,0,0,0)'` fallback, stop.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

A green gate with nothing Tier 3 means the orchestrator dispatches the next phase in the same turn — the turn ends between phases only for a Tier 3 discovery needing a user call, a genuine user-judgment decision, or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** at `roadmap/wave-0-workbench-token-foundations/wave-0-decisions.md` with Decisions 1–5 RESOLVED and Decision 6 reflecting Cole's lock.
2. **Phase 1 — sonnet-implementer.** Brief: add the labeled canon-alias Tier-2 block to `tokens.css` (Decision 5), `var()` aliases for aligned names, canon-value + marker on divergence (Decision 1), value source `workbench-tokens.css`. No component consumption. Gate: typecheck clean, lint clean (incl. no-hex — divergent tokens carry the marker), `test:renderer` green.
3. **Phase 2 — sonnet-implementer (conceptually-risky — load-bearing glass override).** Brief: add `Theme` fields; replace the `--term-bg` override with `terminalWell ?? 'rgba(0,0,0,0)'`; add `--terminal-canvas-opacity` and the theme-driven accent-edge/glow/term-prompt-bg writes; set Modern/Warp/Retro per Decision 4 (Modern's values applied or omitted per Decision 6); author the set-vs-unset unit test. **`sonnet-phase-reviewer` pass after** (spec-alignment + integrity: did the unset-default branch survive for the four untouched themes?). Gate: `test:renderer` green incl. the bridge test, lint + typecheck clean, phase-reviewer PROCEED, manual (if apply-now): Modern terminal reads as a tinted well + an untouched theme is unchanged.
4. **Phase 3 — wave wrap.** `npm run lint`, `npm run typecheck`, `npx vitest run src/renderer/hooks src/renderer/themes` (+ full suite in background if available). `/review` mechanical gap-check (Check 6 if stryker present). Update the renderer styles/themes CLAUDE.md. Author `wave-0-result.md`. Append `CHANGELOG.md [2.21.0]`. Run `/ui-smoke 0` if Decision 6 = apply-now. Create local tag `v2.21.0` (HOLD push per 2026-05-19 bulletin). Update `HANDOFF.md`. `/promote-vendor-lessons 0` (no-op). `/audit-followups wave-0-workbench-token-foundations`.
