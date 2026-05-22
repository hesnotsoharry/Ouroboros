/**
 * @vitest-environment jsdom
 *
 * useTheme.tokens.test.ts — unit tests for the tinted-well bridge (Wave 0 Phase 2).
 *
 * Uses document.documentElement.style.getPropertyValue() — NOT getComputedStyle —
 * because jsdom does not resolve CSS custom properties through the cascade.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { cursorTheme } from '../themes/cursor';
import { modernTheme } from '../themes/modern';
import { retroTheme } from '../themes/retro';
import { warpTheme } from '../themes/warp';
import {
  applyComponentTokens,
  applyThemeToDom,
  applyWorkbenchTokenOverrides,
} from './useTheme.tokens';

afterEach(() => {
  // Clean up inline styles written to :root between tests.
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme-id');
  document.documentElement.removeAttribute('data-scanlines');
  document.documentElement.removeAttribute('data-glow-text');
  document.documentElement.removeAttribute('data-material');
});

// ---------------------------------------------------------------------------
// applyComponentTokens — unit tests (no DOM cascade involved)
// ---------------------------------------------------------------------------

describe('applyComponentTokens — tinted well', () => {
  it('writes the supplied well value to --term-bg and canvas opacity to --terminal-canvas-opacity', () => {
    applyComponentTokens(document.documentElement, modernTheme.colors, {
      well: 'rgba(6, 8, 16, 0.62)',
      canvasOpacity: 0.86,
    });

    expect(document.documentElement.style.getPropertyValue('--term-bg')).toBe(
      'rgba(6, 8, 16, 0.62)',
    );
    expect(document.documentElement.style.getPropertyValue('--terminal-canvas-opacity')).toBe(
      '0.86',
    );
  });

  it('falls back to rgba(0,0,0,0) / 1 when terminal options object is empty — regression guard', () => {
    applyComponentTokens(document.documentElement, modernTheme.colors, {});

    expect(document.documentElement.style.getPropertyValue('--term-bg')).toBe('rgba(0,0,0,0)');
    expect(document.documentElement.style.getPropertyValue('--terminal-canvas-opacity')).toBe('1');
  });

  it('falls back to rgba(0,0,0,0) / 1 when well and canvasOpacity are explicitly undefined — regression guard', () => {
    applyComponentTokens(document.documentElement, modernTheme.colors, {
      well: undefined,
      canvasOpacity: undefined,
    });

    expect(document.documentElement.style.getPropertyValue('--term-bg')).toBe('rgba(0,0,0,0)');
    expect(document.documentElement.style.getPropertyValue('--terminal-canvas-opacity')).toBe('1');
  });

  it('falls back to rgba(0,0,0,0) / 1 when no terminal argument is passed at all', () => {
    applyComponentTokens(document.documentElement, modernTheme.colors);

    expect(document.documentElement.style.getPropertyValue('--term-bg')).toBe('rgba(0,0,0,0)');
    expect(document.documentElement.style.getPropertyValue('--terminal-canvas-opacity')).toBe('1');
  });

  it('sets --term-canvas-bg to the well value when a well is provided — tinted canvas guard', () => {
    applyComponentTokens(document.documentElement, modernTheme.colors, {
      well: 'rgba(6,8,16,0.62)',
    });

    expect(document.documentElement.style.getPropertyValue('--term-canvas-bg')).toBe(
      'rgba(6,8,16,0.62)',
    );
  });

  it('removes --term-canvas-bg when no well is set — unset-theme-preservation guard', () => {
    // Pre-set the property so the removeProperty branch is exercised, not just an absent value.
    document.documentElement.style.setProperty('--term-canvas-bg', 'rgba(6,8,16,0.62)');

    applyComponentTokens(document.documentElement, modernTheme.colors, {});

    // getPropertyValue returns '' for a removed property in jsdom.
    expect(document.documentElement.style.getPropertyValue('--term-canvas-bg')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// applyThemeToDom — end-to-end through the full bridge
// ---------------------------------------------------------------------------

describe('applyThemeToDom — tinted well end-to-end', () => {
  it("applies Modern's well values end-to-end (asserts against the theme's own fields, not magic numbers, so tuning the well doesn't break this test)", () => {
    applyThemeToDom(modernTheme);

    // modernTheme.terminalWell / terminalCanvasOpacity are the source of truth; the
    // bridge must flow them through to the CSS vars verbatim.
    expect(document.documentElement.style.getPropertyValue('--term-bg')).toBe(
      modernTheme.terminalWell,
    );
    expect(document.documentElement.style.getPropertyValue('--terminal-canvas-opacity')).toBe(
      String(modernTheme.terminalCanvasOpacity),
    );
    // Sanity: Modern must actually declare a well (guards against the field being dropped).
    expect(modernTheme.terminalWell).toBeTruthy();
  });

  it('preserves always-on-glass default for a theme with no terminal fields: --term-bg rgba(0,0,0,0) and --terminal-canvas-opacity 1', () => {
    // cursorTheme has no terminalWell / terminalCanvasOpacity — proves the default-preservation path.
    applyThemeToDom(cursorTheme);

    expect(document.documentElement.style.getPropertyValue('--term-bg')).toBe('rgba(0,0,0,0)');
    expect(document.documentElement.style.getPropertyValue('--terminal-canvas-opacity')).toBe('1');
  });

  it("applies Modern's well as rgba(6, 8, 16, 0.62) after the D5 fix — the canon §03 value", () => {
    applyThemeToDom(modernTheme);

    expect(document.documentElement.style.getPropertyValue('--term-bg')).toBe(
      'rgba(6, 8, 16, 0.62)',
    );
  });
});

// ---------------------------------------------------------------------------
// applyWorkbenchTokenOverrides — unit tests (Wave 6 per-theme override path)
// ---------------------------------------------------------------------------

describe('applyWorkbenchTokenOverrides — conditional write discipline', () => {
  it('writes each present key to its CSS custom property with the supplied value', () => {
    applyWorkbenchTokenOverrides(document.documentElement, {
      '--bg-wash': 'radial-gradient(red)',
      '--blur-strong': 'none',
    });

    expect(document.documentElement.style.getPropertyValue('--bg-wash')).toBe(
      'radial-gradient(red)',
    );
    expect(document.documentElement.style.getPropertyValue('--blur-strong')).toBe('none');
  });

  it('is a no-op when tokens argument is undefined — root cssText unchanged', () => {
    const before = document.documentElement.style.cssText;
    applyWorkbenchTokenOverrides(document.documentElement, undefined);

    expect(document.documentElement.style.cssText).toBe(before);
  });

  it('is a no-op when tokens argument is an empty object — root cssText unchanged', () => {
    const before = document.documentElement.style.cssText;
    applyWorkbenchTokenOverrides(document.documentElement, {});

    expect(document.documentElement.style.cssText).toBe(before);
  });
});

describe('applyThemeToDom — workbenchTokens override path end-to-end', () => {
  it('a theme with a --bg-wash workbenchTokens entry emits that value, overriding the material default', () => {
    // Construct a minimal inline theme that carries a workbenchTokens override.
    // Using modernTheme as the base for colors/fonts; the key assertion is that
    // --bg-wash ends up with the theme's override value, not the material default.
    const testTheme = {
      ...modernTheme,
      workbenchTokens: { '--bg-wash': 'radial-gradient(ellipse, rgba(22,16,10,0.9), transparent)' },
    };

    applyThemeToDom(testTheme);

    expect(document.documentElement.style.getPropertyValue('--bg-wash')).toBe(
      'radial-gradient(ellipse, rgba(22,16,10,0.9), transparent)',
    );
  });

  it('a theme with no workbenchTokens does not disturb --bg-wash set by the material pass', () => {
    // cursorTheme has no workbenchTokens — the material pass writes --bg-wash;
    // applyWorkbenchTokenOverrides must not clobber or remove it.
    applyThemeToDom(cursorTheme);

    // The material default writes a non-empty radial-gradient to --bg-wash.
    const bgWash = document.documentElement.style.getPropertyValue('--bg-wash');
    expect(bgWash).toBeTruthy();
    expect(bgWash).toMatch(/radial-gradient/);
  });
});

// ---------------------------------------------------------------------------
// Wave 6 Phase 2 — per-theme canon value assertions
// ---------------------------------------------------------------------------

describe('Warp theme — warm-amber canon token overrides', () => {
  it('--bg-wash contains a warm-amber override (not the indigo material default)', () => {
    applyThemeToDom(warpTheme);

    const bgWash = document.documentElement.style.getPropertyValue('--bg-wash');
    // Must contain the canon §15 Warp wash-1 colour (#16100a) — not the indigo default.
    expect(bgWash).toContain('#16100a');
    // Must not be the material's indigo wash.
    expect(bgWash).not.toContain('#0a0b14');
  });

  it('--terminal-canvas-opacity is 0.86 (D5 — Warp was missing canvas opacity)', () => {
    applyThemeToDom(warpTheme);

    expect(document.documentElement.style.getPropertyValue('--terminal-canvas-opacity')).toBe(
      '0.86',
    );
  });

  it('--accent-edge is the amber-tuned value (derived from canon §15 #f97316)', () => {
    applyThemeToDom(warpTheme);

    expect(document.documentElement.style.getPropertyValue('--accent-edge')).toBe(
      'rgba(249, 115, 22, 0.4)',
    );
  });

  it('--accent-glow is the amber-tuned glow shadow (canon §15 Warp accent)', () => {
    applyThemeToDom(warpTheme);

    expect(document.documentElement.style.getPropertyValue('--accent-glow')).toBe(
      '0 2px 14px -2px rgba(249, 115, 22, 0.55)',
    );
  });

  it('--blur-strong is NOT none — Warp keeps glass blur', () => {
    applyThemeToDom(warpTheme);

    const blurStrong = document.documentElement.style.getPropertyValue('--blur-strong');
    // Warp does not set --blur-strong in workbenchTokens; the stylesheet default
    // (non-"none") is what the material pass does NOT override inline. In jsdom,
    // inline style will be empty for this property (stylesheet not applied), so
    // the contract is: the inline value is NOT "none".
    expect(blurStrong).not.toBe('none');
  });

  it('data-scanlines is "false" for Warp — glass themes emit no scanline layer', () => {
    applyThemeToDom(warpTheme);

    expect(document.documentElement.dataset['scanlines']).toBe('false');
  });
});

describe('Retro theme — matte green-phosphor canon token overrides', () => {
  it('--blur-strong is "none" — Retro suppresses glass blur (D6)', () => {
    applyThemeToDom(retroTheme);

    expect(document.documentElement.style.getPropertyValue('--blur-strong')).toBe('none');
  });

  it('--blur-soft is "none" — Retro suppresses all backdrop blur (D6)', () => {
    applyThemeToDom(retroTheme);

    expect(document.documentElement.style.getPropertyValue('--blur-soft')).toBe('none');
  });

  it('--material-panel is the opaque green panel value (alpha 0.85 — canon §15 opaque 0.85–0.95)', () => {
    applyThemeToDom(retroTheme);

    expect(document.documentElement.style.getPropertyValue('--material-panel')).toBe(
      'rgba(8, 18, 12, 0.85)',
    );
  });

  it('--material-panel-raised is the opaque raised panel value (alpha 0.92)', () => {
    applyThemeToDom(retroTheme);

    expect(document.documentElement.style.getPropertyValue('--material-panel-raised')).toBe(
      'rgba(14, 26, 18, 0.92)',
    );
  });

  it('--bg-wash contains the green phosphor wash (canon §15 wash-1 #050a07)', () => {
    applyThemeToDom(retroTheme);

    const bgWash = document.documentElement.style.getPropertyValue('--bg-wash');
    expect(bgWash).toContain('#050a07');
  });

  it('--accent-edge is the phosphor-green value (canon §15 accent #39ff5a)', () => {
    applyThemeToDom(retroTheme);

    expect(document.documentElement.style.getPropertyValue('--accent-edge')).toBe(
      'rgba(57, 255, 90, 0.4)',
    );
  });

  it('--accent-glow is the phosphor-green glow shadow (canon §15)', () => {
    applyThemeToDom(retroTheme);

    expect(document.documentElement.style.getPropertyValue('--accent-glow')).toBe(
      '0 0 14px rgba(57, 255, 90, 0.5)',
    );
  });

  it('data-scanlines is "true" for Retro — CRT scanline layer enabled', () => {
    applyThemeToDom(retroTheme);

    expect(document.documentElement.dataset['scanlines']).toBe('true');
  });
});

describe('Modern theme — glass preservation (no --blur-strong override)', () => {
  it('--blur-strong is NOT none — Modern keeps glass blur', () => {
    applyThemeToDom(modernTheme);

    const blurStrong = document.documentElement.style.getPropertyValue('--blur-strong');
    // Modern has no workbenchTokens, so no inline --blur-strong is written.
    // The contract is it is not set to "none" inline (the stylesheet default applies).
    expect(blurStrong).not.toBe('none');
  });

  it('data-scanlines is "false" for Modern — no scanline layer', () => {
    applyThemeToDom(modernTheme);

    expect(document.documentElement.dataset['scanlines']).toBe('false');
  });
});
