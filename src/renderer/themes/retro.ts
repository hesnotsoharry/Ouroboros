import type { Theme } from './types';

export const retroTheme: Theme = {
  id: 'retro',
  name: 'Retro Terminal',
  fontFamily: {
    mono: '"JetBrains Mono", "Courier New", monospace',
    ui: '"JetBrains Mono", monospace',
  },
  colors: {
    bg: '#0d1117',
    bgSecondary: '#111820',
    bgTertiary: '#1a2433',
    border: '#1e3a2f',
    borderMuted: '#152b22',
    text: '#39ff5a',
    textSecondary: '#2bcc45',
    textMuted: '#1a7a2e',
    textFaint: '#0f4d1e',
    accent: '#39ff5a',
    accentHover: '#5fffa0',
    accentMuted: 'rgba(57, 255, 90, 0.15)',
    success: '#39ff5a',
    warning: '#e5c07b',
    error: '#ff4757',
    purple: '#c678a0',
    purpleMuted: 'rgba(198, 120, 160, 0.2)',
    selection: 'rgba(57, 255, 90, 0.2)',
    focusRing: 'rgba(57, 255, 90, 0.5)',
    termBg: '#0d1117',
    termFg: '#39ff5a',
    termCursor: '#39ff5a',
    termSelection: 'rgba(57, 255, 90, 0.25)',
  },
  effects: {
    scanlines: true,
    glowText: true,
  },
  terminalWell: 'rgba(4, 10, 6, 0.96)',
  // Wave 6 Phase 2 — matte green-phosphor canon treatment (canon §15, D6).
  // Materials become opaque (alpha 0.85–0.95). Blur suppressed — Retro is NOT glass.
  // Accent-edge / accent-glow use the phosphor green (#39ff5a / #5fffa0).
  workbenchTokens: {
    // Matte: suppress backdrop-filter blur entirely (D6 — only Retro sets these).
    '--blur-strong': 'none',
    '--blur-soft': 'none',
    // Opaque green-tinted panels (alpha 0.85–0.95, canon §15 / §03 glass material table).
    '--material-panel': 'rgba(8, 18, 12, 0.85)',
    '--material-panel-raised': 'rgba(14, 26, 18, 0.92)',
    // Green phosphor wash + glows (canon §15: wash-1 #050a07, wash-2 #060f0a).
    '--bg-wash':
      'radial-gradient(900px 600px at 30% 10%, rgba(57, 255, 90, 0.10), transparent 60%),' +
      ' radial-gradient(700px 400px at 70% 80%, rgba(57, 255, 90, 0.06), transparent 60%),' +
      ' linear-gradient(180deg, #050a07 0%, #060f0a 100%)',
    '--bg-glows':
      'radial-gradient(900px 600px at 30% 10%, rgba(57, 255, 90, 0.10), transparent 60%),' +
      ' radial-gradient(700px 400px at 70% 80%, rgba(57, 255, 90, 0.06), transparent 60%)',
    // Green phosphor accent-edge / accent-glow (canon §15: accent #39ff5a, hi #5fffa0).
    '--accent-edge': 'rgba(57, 255, 90, 0.4)',
    '--accent-glow': '0 0 14px rgba(57, 255, 90, 0.5)',
    // Dark green-tinted prompt background
    '--term-prompt-bg': 'rgba(10, 22, 14, 0.9)',
  },
};
