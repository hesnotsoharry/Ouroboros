<!-- claude-md-auto:start -->

<!-- claude-md-auto:end -->

<!-- claude-md-manual:preserved -->
# Themes — Runtime theme definitions and registry

## Key Files

| File                              | Role                                                                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                        | `Theme` interface — colors, fonts, optional effects (`scanlines`, `glowText`), optional terminal-well fields (`terminalWell`, `terminalCanvasOpacity` — Wave 0), and the optional Wave-6 `workbenchTokens` map (`Partial<Record<CanonWorkbenchToken, string>>` — per-theme canon overrides for wash/glows/blur/panel/accent-edge). Material grammar lives in `material.ts`; per-theme canon appearance lives in `workbenchTokens`. |
| `material.ts`                     | Wave 45 material variants — `MATERIAL_VARIANTS = { vapor, prism, warp }`. User-selected via `config.materialVariant`; themes paint accent/text on top.       |
| `index.ts`                        | Theme registry — exports `themes` record, `getTheme()`, `themeList`, and extension theme registration (`registerExtensionTheme`/`unregisterExtensionTheme`) |
| `retro.ts`                        | Green-on-black CRT theme — only theme using `effects` (scanlines + glow). Pairs naturally with the Warp material variant.                                   |
| `modern.ts`                       | Default theme (`defaultThemeId = 'modern'`). Zinc palette, indigo accent. Also the base for `customTheme`.                                                  |
| `light.ts`                        | Light mode — white bg, indigo accent                                                                                                                        |
| `high-contrast.ts`                | Accessibility theme — pure black bg, white text, teal accent, higher contrast ratios                                                                        |
| `warp.ts`, `cursor.ts`, `kiro.ts` | Branded themes inspired by other IDE tools                                                                                                                  |

## How Themes Work

1. Each theme file exports a `Theme` object with `id`, `name`, `fontFamily` (mono + ui), and `colors` (25 tokens)
2. `index.ts` collects all themes into a `Record<string, Theme>` and exposes `getTheme(id)` with fallback to `modern`
3. `useTheme` hook (in `../hooks/`) applies the active theme by setting CSS custom properties on `:root` — components never read theme objects directly
4. Extension themes from VS Code extensions are registered at runtime via `registerExtensionTheme()` and added to the `themes` record

## Color Token Contract

Every theme must define all 25 color tokens in `Theme.colors`. The tokens map to CSS vars consumed by Tailwind and components:

- **Surfaces**: `bg`, `bgSecondary`, `bgTertiary` → `var(--bg)`, `var(--bg-secondary)`, `var(--bg-tertiary)`
- **Text**: `text`, `textSecondary`, `textMuted`, `textFaint` → `var(--text)`, etc.
- **Accent**: `accent`, `accentHover`, `accentMuted` → `var(--accent)`, etc.
- **Semantic**: `success`, `warning`, `error`, `purple`, `purpleMuted`
- **Terminal**: `termBg`, `termFg`, `termCursor`, `termSelection` → `var(--term-bg)`, etc.
- **Interactive**: `border`, `borderMuted`, `selection`, `focusRing`

## Adding a New Theme

1. Create `<name>.ts` exporting a `Theme` object — copy `modern.ts` as a template
2. Import and add to `themes` record and `themeList` array in `index.ts`
3. The theme automatically appears in the settings UI theme picker

## Gotchas

- `customTheme` is a mutable singleton that gets its `colors` overwritten at runtime by `useTheme` — don't treat it as immutable
- `themeList` deliberately excludes `customTheme` — it only shows in the picker when the user has saved custom colors
- Theme `id` must match the key in the `themes` record (e.g. `id: 'high-contrast'` → `themes['high-contrast']`)
- `effects` is only used by `retro` theme — the renderer checks `theme.effects?.scanlines` to conditionally apply CSS overlay
- **Tinted-well terminal is opt-in (Wave 0).** `applyComponentTokens` (in `../hooks/useTheme.tokens.ts`) writes `--term-bg` ← `theme.terminalWell ?? 'rgba(0,0,0,0)'` and `--terminal-canvas-opacity` ← `theme.terminalCanvasOpacity ?? 1`. A theme that sets neither field keeps the always-on-glass default (transparent `--term-bg`, opaque canvas) — do NOT remove the `??` fallbacks; the four themes without these fields (cursor/kiro/light/high-contrast) depend on them, and `useTheme.tokens.test.ts` will go red if you do. Modern/Warp/Retro set `terminalWell`; Modern + Warp set `terminalCanvasOpacity` (0.86). Modern's well is `rgba(6, 8, 16, 0.1)` (tuned 2026-05-22 for a lighter glass read — an intentional divergence from canon §03's 0.62, which Wave 6 had corrected up from 0.35).
- **Canon-name aliases live in `../styles/tokens.css`**, not here — a labeled "Canon aliases (workbench overhaul)" `:root` block. Several carry `canon-divergence` markers where the canon value differs from the nearest semantic token (`--info`, `--ink-3/-4`, `--glass-panel-hi`, `--purple`); a later token-cleanup pass reconciles them.
