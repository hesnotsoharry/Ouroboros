---
status: SHIPPED
created: 2026-05-21
updated: 2026-05-21
wave: 0
slug: workbench-token-foundations
tag: v2.21.0
---

# Wave 0 — Workbench Token Foundations · Result

Foundation wave of the workbench overhaul (`roadmap/discovery/workbench-overhaul-reconciliation.md`). Established the token grammar later workbench waves author against, and made the canon's terminal "tinted well" achievable. Renderer-only; no main/IPC/schema change.

## Per-phase outcomes

| Phase | Outcome |
|---|---|
| 0 — ADR | `wave-0-decisions.md`, 6 decisions resolved (1–5 from reconciliation/canon; 6 — apply tinted well to current terminal now — locked by Cole). |
| 1 — Canon alias block | `tokens.css`: labeled canon-alias `:root` sub-block (lines ~198–260), 29 net-new names. Aligned names → `var()` references (theme-reactive); divergent canon values → literals with `canon-divergence` markers. No legacy-block duplication. No consumer yet (grammar only). |
| 2 — Theme fields + tinted-well bridge | `Theme` gains optional `terminalWell?: string` / `terminalCanvasOpacity?: number`; `applyComponentTokens` writes `--term-bg` ← `well ?? 'rgba(0,0,0,0)'` and `--terminal-canvas-opacity` ← `String(canvasOpacity ?? 1)`, threaded via `EffectiveTheme`/`resolveEffectiveTheme`. Modern `rgba(6,8,16,0.62)`/`0.86`, Warp `rgba(14,9,4,0.7)`, Retro `rgba(4,10,6,0.96)`. Other 4 themes unset → byte-identical glass default. `useTheme.tokens.test.ts` (6 tests). `sonnet-phase-reviewer` PASS on all four axes. |
| 3 — Wrap | typecheck clean, lint clean (one autofixed import-sort), prettier, 6/6 tests, docs, CHANGELOG [2.21.0], CLAUDE.md, tag v2.21.0. |

## Verification

- **Tokens written correctly — confirmed by test.** `useTheme.tokens.test.ts` asserts Modern → `--term-bg: rgba(6,8,16,0.62)` + `--terminal-canvas-opacity: 0.86`; an unset theme (cursor) → `rgba(0,0,0,0)` / `1`; and the regression guard goes red if the `??` fallback is removed (verified live by the implementer: 4 tests red on removal, restored).
- **Rendered terminal — NOT visually smoke-verified.** The plan's observation point ("Modern-theme terminal reads as a translucent tinted well in a live IDE") was not driven headless. `/ui-smoke 0` was skipped; Cole verifies visually on next `npm run dev`. Honest gap per the wave's Site 2/3 observation discipline.

## Scope notes / deferrals

- `--accent-edge` / `--accent-glow` / `--term-prompt-bg` carry static Modern defaults (Phase 1); per-theme wiring deferred to the themes wave (Wave 6) — no Wave-0 consumer (YAGNI).
- Canon-divergence markers left in `tokens.css` for `--ink-3`/`--ink-4` (bridge hardcodes `--text-muted`/`-faint`), `--info` (`--status-info` aliases to accent), `--glass-panel-hi` (`--material-panel-raised` is a gradient), `--purple` (legacy `#a78bfa` vs canon `#c084fc`). A later token-cleanup pass reconciles the semantic tokens.
- `--glass-rail` → `--surface-panel` is transparent at runtime; workbench rail components needing opacity should use `--material-panel` (flagged inline).

## Ship

- Landed on `master` (local), tag `v2.21.0`. Push per Cole's "send it" call. (CI minutes exhausted to 2026-06-01 per bulletin — workflows won't run; direct push only.)
