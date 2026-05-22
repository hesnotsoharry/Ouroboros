/**
 * workbenchMockData.sidebar.ts — mock data for AgentSidebar, Terminals, and StatusBar regions.
 *
 * Re-exported via workbenchMockData.ts — import from there, not directly.
 */

// ── Hook event types (§11 shape) ─────────────────────────────────────────────

export type HookEventKind = 'prompt' | 'tool' | 'think';

export interface MockHookEventBase {
  id: string;
  /** Seconds relative to "now" (negative = in the past). */
  t: number;
  kind: HookEventKind;
}

export interface MockPromptEvent extends MockHookEventBase {
  kind: 'prompt';
  text: string;
  tokens: number;
}

export interface MockToolEvent extends MockHookEventBase {
  kind: 'tool';
  tool: string;
  target: string;
  duration: number;
  status: 'ok' | 'warn' | 'running';
  lines?: number;
  files?: number;
  matches?: number;
  adds?: number;
  dels?: number;
  exitCode?: number;
  note?: string;
}

export interface MockThinkEvent extends MockHookEventBase {
  kind: 'think';
  text: string;
  dur: number;
}

export type MockHookEvent = MockPromptEvent | MockToolEvent | MockThinkEvent;

// ── Files touched ────────────────────────────────────────────────────────────

export interface MockFileTouched {
  path: string;
  adds: number;
  dels: number;
  status: 'editing' | 'edited' | 'read';
}

// ── Diff hunk ────────────────────────────────────────────────────────────────

export type DiffLineType = 'ctx' | 'add' | 'del';

export interface MockDiffLine {
  type: DiffLineType;
  n: number;
  text: string;
}

// ── Context / cost ───────────────────────────────────────────────────────────

export interface MockContextStats {
  usedTokens: number;
  maxTokens: number;
  costUsd: number;
  model: string;
  elapsedSec: number;
}

// ── Agent sidebar — Phase 5 ──────────────────────────────────────────────────

/** The currently executing tool call shown in the NOW block. */
export interface MockNowToolCall {
  tool: string;
  /** Display-friendly path or target shown after the arrow. */
  target: string;
  /** One-line description of the tool input (what it is doing). */
  description: string;
  /** Elapsed seconds — rendered as a live duration pill in the UI. */
  elapsedSec: number;
  /** Progress 0–1. Undefined = indeterminate bar. */
  progress?: number;
}

/** Extended diff hunk with file + line anchor metadata. */
export interface MockDiffHunk {
  file: string;
  /** Starting line number of the hunk. */
  startLine: number;
  lines: MockDiffLine[];
}

// ── Terminal mock content (Phase 4) ─────────────────────────────────────────

/**
 * Tone maps to a CSS custom property for color.
 *   'primary'  → --ink        (body text)
 *   'muted'    → --ink-3      (dim/secondary)
 *   'success'  → --success    (ok output)
 *   'warning'  → --warning    (warn output)
 *   'accent'   → --accent     (highlighted / active)
 *   'purple'   → --purple     (tool name badges)
 *   'info'     → --info       (path / info text)
 */
export type TermLineTone =
  | 'primary'
  | 'muted'
  | 'success'
  | 'warning'
  | 'accent'
  | 'purple'
  | 'info';

export interface MockTerminalLine {
  text: string;
  tone?: TermLineTone;
}

// ── Status bar — Phase 6 ─────────────────────────────────────────────────────

export interface MockStatusBar {
  /** Number of tests currently passing (shown in the pill). */
  testsPassing: number;
  /**
   * Static clock string in 24h HH:MM:SS format.
   * Wave 3 replaces this with a live hook; Wave 1 uses a static string.
   */
  clock: string;
}

// ── Static data ──────────────────────────────────────────────────────────────

export const MOCK_HOOK_EVENTS: MockHookEvent[] = [
  {
    id: 'e1',
    t: -312,
    kind: 'prompt',
    text: 'refactor TerminalPane to use the new hook event API',
    tokens: 14,
  },
  {
    id: 'e2',
    t: -298,
    kind: 'tool',
    tool: 'Read',
    target: 'src/renderer/components/Terminal/TerminalPane.tsx',
    duration: 240,
    lines: 412,
    status: 'ok',
  },
  {
    id: 'e3',
    t: -284,
    kind: 'tool',
    tool: 'Read',
    target: 'src/renderer/components/Terminal/CommandBlockOverlayBody.tsx',
    duration: 180,
    lines: 286,
    status: 'ok',
  },
  {
    id: 'e4',
    t: -271,
    kind: 'tool',
    tool: 'Grep',
    target: 'hookEvent',
    files: 12,
    matches: 38,
    duration: 320,
    status: 'ok',
  },
  {
    id: 'e5',
    t: -255,
    kind: 'think',
    text: 'The TerminalPane currently parses xterm scrollback to surface tool calls. With hooks I can replace this with a subscription to the PostToolUse event.',
    dur: 4200,
  },
  {
    id: 'e6',
    t: -240,
    kind: 'tool',
    tool: 'Edit',
    target: 'src/renderer/components/Terminal/TerminalPane.tsx',
    adds: 28,
    dels: 12,
    duration: 410,
    status: 'ok',
  },
  {
    id: 'e7',
    t: -222,
    kind: 'tool',
    tool: 'Bash',
    target: 'pnpm typecheck',
    duration: 1340,
    status: 'ok',
    exitCode: 0,
  },
  {
    id: 'e8',
    t: -201,
    kind: 'tool',
    tool: 'Edit',
    target: 'src/renderer/hooks/useHookSubscription.ts',
    adds: 64,
    dels: 0,
    duration: 380,
    status: 'ok',
  },
  {
    id: 'e9',
    t: -184,
    kind: 'tool',
    tool: 'Bash',
    target: 'pnpm test:run terminal',
    duration: 4200,
    status: 'warn',
    exitCode: 0,
    note: '2 snapshots updated',
  },
  {
    id: 'e10',
    t: -160,
    kind: 'tool',
    tool: 'Read',
    target: 'src/renderer/components/Terminal/RichInputBody.tsx',
    duration: 120,
    lines: 168,
    status: 'ok',
  },
  {
    id: 'e11',
    t: -141,
    kind: 'tool',
    tool: 'Edit',
    target: 'src/renderer/components/Terminal/RichInputBody.tsx',
    adds: 18,
    dels: 9,
    duration: 290,
    status: 'ok',
  },
  {
    id: 'e12',
    t: -12,
    kind: 'tool',
    tool: 'Edit',
    target: 'src/renderer/components/Terminal/TerminalPane.tsx',
    adds: 6,
    dels: 4,
    duration: 0,
    status: 'running',
  },
];

export const MOCK_FILES_TOUCHED: MockFileTouched[] = [
  {
    path: 'src/renderer/components/Terminal/TerminalPane.tsx',
    adds: 34,
    dels: 16,
    status: 'editing',
  },
  { path: 'src/renderer/hooks/useHookSubscription.ts', adds: 64, dels: 0, status: 'edited' },
  {
    path: 'src/renderer/components/Terminal/RichInputBody.tsx',
    adds: 18,
    dels: 9,
    status: 'edited',
  },
  {
    path: 'src/renderer/components/Terminal/CommandBlockOverlayBody.tsx',
    adds: 0,
    dels: 0,
    status: 'read',
  },
];

export const MOCK_DIFF_HUNK: MockDiffLine[] = [
  { type: 'ctx', n: 84, text: '  useEffect(() => {' },
  { type: 'del', n: 85, text: '    const lines = parseXtermBuffer(term.buffer)' },
  { type: 'del', n: 86, text: '    const calls = extractToolCalls(lines)' },
  { type: 'add', n: 85, text: "    const unsubscribe = hooks.on('PostToolUse', (e) => {" },
  { type: 'add', n: 86, text: '      setCommandBlocks((prev) => [...prev, fromHookEvent(e)])' },
  { type: 'add', n: 87, text: '    })' },
  { type: 'ctx', n: 88, text: '    setBlocks(calls)' },
  { type: 'ctx', n: 89, text: '  }, [term])' },
];

export const MOCK_NOW_TOOL_CALL: MockNowToolCall = {
  tool: 'Edit',
  target: 'src/renderer/components/Terminal/TerminalPane.tsx',
  description: 'Replace parseXtermBuffer with PostToolUse subscription',
  elapsedSec: 12,
  progress: undefined, // indeterminate while running
};

export const MOCK_DIFF_HUNK_META: MockDiffHunk = {
  file: 'src/renderer/components/Terminal/TerminalPane.tsx',
  startLine: 84,
  lines: MOCK_DIFF_HUNK,
};

/** CC status line text — mirrors real CC TUI output (static mock). */
export const MOCK_CC_STATUS_LINE =
  '✻ claude-sonnet-4-6 · ⏵⏵ auto-accept on · 47% context left · esc to interrupt';

/** Placeholder prompt text shown in the CC prompt box. */
export const MOCK_CC_PROMPT_PLACEHOLDER = 'Try "add a snapshot test for the hook subscription"';

/** Upper terminal (Claude Code) — mock TUI output lines. */
export const MOCK_CC_TUI_LINES: MockTerminalLine[] = [
  { text: '⎿ Reading src/renderer/components/Terminal/TerminalPane.tsx', tone: 'muted' },
  { text: '  412 lines · done', tone: 'muted' },
  { text: '' },
  { text: '⎿ Searching for hookEvent', tone: 'muted' },
  { text: '  12 files · 38 matches', tone: 'muted' },
  { text: '' },
  { text: '● Thinking…', tone: 'accent' },
  { text: '  The TerminalPane currently parses xterm scrollback.', tone: 'muted' },
  { text: '  With hooks I can replace this with PostToolUse subscription.', tone: 'muted' },
  { text: '' },
  { text: '⎿ Edit(src/renderer/components/Terminal/TerminalPane.tsx)', tone: 'purple' },
  { text: '  +28 −12 lines applied', tone: 'success' },
  { text: '' },
  { text: '⎿ Bash(npx tsc --noEmit)', tone: 'purple' },
  { text: '  exit 0 · 1.34s', tone: 'success' },
  { text: '' },
  { text: '⎿ Edit(src/renderer/hooks/useHookSubscription.ts)', tone: 'purple' },
  { text: '  Applying edit…', tone: 'warning' },
];

/** Lower terminal (shell) — mock shell output lines. */
export const MOCK_SHELL_LINES: MockTerminalLine[] = [
  { text: '  VITE v5.4.2  ready in 312 ms', tone: 'muted' },
  { text: '' },
  { text: '  ➜  Local:   http://localhost:5173/', tone: 'success' },
  { text: '  ➜  Network: use --host to expose', tone: 'muted' },
  { text: '' },
  { text: '  ✓ 24 tests passing  (4.2s)', tone: 'success' },
  { text: '  ⚠  2 snapshots updated', tone: 'warning' },
];

export const MOCK_CONTEXT_STATS: MockContextStats = {
  usedTokens: 42_800,
  maxTokens: 200_000,
  costUsd: 0.087,
  model: 'claude-sonnet-4-6',
  elapsedSec: 312,
};

export const MOCK_STATUS_BAR: MockStatusBar = {
  testsPassing: 24,
  clock: '14:32:34',
};
