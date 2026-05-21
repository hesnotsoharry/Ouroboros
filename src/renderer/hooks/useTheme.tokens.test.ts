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
import { applyComponentTokens, applyThemeToDom } from './useTheme.tokens';

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
});

// ---------------------------------------------------------------------------
// applyThemeToDom — end-to-end through the full bridge
// ---------------------------------------------------------------------------

describe('applyThemeToDom — tinted well end-to-end', () => {
  it('applies Modern well values end-to-end: --term-bg rgba(6,8,16,0.62) and --terminal-canvas-opacity 0.86', () => {
    applyThemeToDom(modernTheme);

    expect(document.documentElement.style.getPropertyValue('--term-bg')).toBe(
      'rgba(6, 8, 16, 0.62)',
    );
    expect(document.documentElement.style.getPropertyValue('--terminal-canvas-opacity')).toBe(
      '0.86',
    );
  });

  it('preserves always-on-glass default for a theme with no terminal fields: --term-bg rgba(0,0,0,0) and --terminal-canvas-opacity 1', () => {
    // cursorTheme has no terminalWell / terminalCanvasOpacity — proves the default-preservation path.
    applyThemeToDom(cursorTheme);

    expect(document.documentElement.style.getPropertyValue('--term-bg')).toBe('rgba(0,0,0,0)');
    expect(document.documentElement.style.getPropertyValue('--terminal-canvas-opacity')).toBe('1');
  });
});
