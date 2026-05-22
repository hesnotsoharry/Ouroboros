import type { Theme } from './types';

export const warpTheme: Theme = {
  id: 'warp',
  name: 'Warp',
  fontFamily: {
    mono: '"Hack", "Fira Code", "JetBrains Mono", monospace',
    ui: '"Hack", "Fira Code", monospace',
  },
  colors: {
    bg: '#1a1612',
    bgSecondary: '#211d18',
    bgTertiary: '#2e2720',
    border: '#3d3328',
    borderMuted: '#2c2419',
    text: '#f0e6d3',
    textSecondary: '#c4aa88',
    textMuted: '#7a6650',
    textFaint: '#4a3b2c',
    accent: '#f97316',
    accentHover: '#fb923c',
    accentMuted: 'rgba(249, 115, 22, 0.15)',
    success: '#86efac',
    warning: '#fbbf24',
    error: '#f87171',
    purple: '#d4729a',
    purpleMuted: 'rgba(212, 114, 154, 0.2)',
    selection: 'rgba(249, 115, 22, 0.2)',
    focusRing: 'rgba(249, 115, 22, 0.5)',
    termBg: '#140f0b',
    termFg: '#f0e6d3',
    termCursor: '#f97316',
    termSelection: 'rgba(249, 115, 22, 0.3)',
  },
  terminalWell: 'rgba(14, 9, 4, 0.7)',
  // Wave 6 D5 — Warp missing canvas opacity; canon §03 specifies 0.86 for Modern;
  // Warp gets the same glass-bleed treatment (darker terminal, amber-tinted).
  terminalCanvasOpacity: 0.86,
  // Wave 6 Phase 2 — warm-amber canon wash + glows (canon §15: wash-1 #16100a, wash-2 #1b140c;
  // accent #f97316 / #fb923c). Gradient structure mirrors Modern's material default but
  // recolored to amber. Beats the material default's indigo wash (last-write-wins, written
  // after applyMaterialTokens).
  workbenchTokens: {
    '--bg-wash':
      'radial-gradient(900px 600px at 12% 8%, rgba(249, 115, 22, 0.16), transparent 60%),' +
      ' radial-gradient(800px 500px at 90% 95%, rgba(212, 114, 154, 0.10), transparent 60%),' +
      ' radial-gradient(700px 400px at 60% 30%, rgba(251, 191, 36, 0.06), transparent 70%),' +
      ' linear-gradient(180deg, #16100a 0%, #1b140c 100%)',
    '--bg-glows':
      'radial-gradient(900px 600px at 12% 8%, rgba(249, 115, 22, 0.16), transparent 60%),' +
      ' radial-gradient(800px 500px at 90% 95%, rgba(212, 114, 154, 0.10), transparent 60%),' +
      ' radial-gradient(700px 400px at 60% 30%, rgba(251, 191, 36, 0.06), transparent 70%)',
    // amber-tuned accent-edge / accent-glow — derived from #f97316 / #fb923c (canon §15)
    '--accent-edge': 'rgba(249, 115, 22, 0.4)',
    '--accent-glow': '0 2px 14px -2px rgba(249, 115, 22, 0.55)',
    // warm-tinted prompt background consistent with Warp's amber story
    '--term-prompt-bg': 'rgba(34, 26, 18, 0.5)',
  },
};
