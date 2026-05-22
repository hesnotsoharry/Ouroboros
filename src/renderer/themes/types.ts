/** Wave 6 — the set of canon workbench tokens that per-theme overrides may set. */
export type CanonWorkbenchToken =
  | '--bg-wash'
  | '--bg-glows'
  | '--blur-strong'
  | '--blur-soft'
  | '--accent-edge'
  | '--accent-glow'
  | '--term-prompt-bg'
  | '--material-panel'
  | '--material-panel-raised';

export interface Theme {
  id: string;
  name: string;
  fontFamily: {
    mono: string; // terminal + code
    ui: string; // UI labels, buttons
  };
  colors: {
    bg: string; // main background
    bgSecondary: string; // panel backgrounds
    bgTertiary: string; // hover/active states
    border: string;
    borderMuted: string; // softer border for dividers
    text: string; // primary text
    textSecondary: string;
    textMuted: string;
    textFaint: string; // even lighter than textMuted (placeholders, timestamps)
    accent: string; // primary accent
    accentHover: string;
    accentMuted: string; // dimmed accent for subtle highlights
    success: string;
    warning: string;
    error: string;
    purple: string; // for tool call badges (Grep, Glob)
    purpleMuted: string; // dimmed purple
    selection: string; // text selection background
    focusRing: string; // focus ring color
    // terminal-specific
    termBg: string;
    termFg: string;
    termCursor: string;
    termSelection: string;
  };
  effects?: {
    scanlines?: boolean; // retro theme only
    glowText?: boolean;
  };
  /** Workbench tinted-well terminal treatment (canon §08). Optional — when unset,
   *  the bridge keeps the always-on-glass default (transparent --term-bg, opaque canvas). */
  terminalWell?: string; // CSS value for --term-bg, e.g. 'rgba(6, 8, 16, 0.62)'
  terminalCanvasOpacity?: number; // --terminal-canvas-opacity, e.g. 0.86
  /** Wave 6 — per-theme canon token overrides. Each entry, when present, is written
   *  inline by the theme bridge AFTER the material tokens, overriding the
   *  material/stylesheet default. Absent keys leave the existing value untouched
   *  (this is what preserves the four untreated themes — see the preservation guard). */
  workbenchTokens?: Partial<Record<CanonWorkbenchToken, string>>;
}
