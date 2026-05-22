/**
 * workbenchMockData.ts — static mock data for Wave 1 workbench skeleton.
 *
 * Seeded from design-system/workbench-data.jsx. Types are shaped to the
 * canon §11 hook schemas so Wave 3 can swap the data source without
 * changing component contracts.
 *
 * Nothing in this file is wired to live IPC, useAgentEvents, or xterm.
 * Wave 3 replaces these exports with hook-derived data.
 */

// ── Project / session types ──────────────────────────────────────────────────

export interface MockProject {
  id: string;
  name: string;
  /** Hex accent color — used for the project chip glow (sanctioned: project identity). */
  color: string;
  initial: string;
  branch: string;
  dirty: number;
  active: boolean;
}

export interface MockTerminalTab {
  id: string;
  label: string;
  kind: 'cc' | 'shell';
  status: 'running' | 'idle';
  dirty: boolean;
  active: boolean;
}

export type FileNodeType = 'dir' | 'file';

export interface MockFileNode {
  type: FileNodeType;
  depth: number;
  name: string;
  open?: boolean;
  badge?: string | null;
}

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

// ── Running sessions ─────────────────────────────────────────────────────────

export interface MockSession {
  id: string;
  projectId: string;
  /** 'claude' = CC session (sparkle icon), 'shell' = shell/server (terminal icon). */
  kind: 'claude' | 'shell';
  label: string;
  sub: string;
  /** 'live' = running, 'warn' = awaiting permission, 'idle' = stopped. */
  status: 'live' | 'warn' | 'idle';
  active: boolean;
}

// ── Branch stats ─────────────────────────────────────────────────────────────

export interface MockBranch {
  name: string;
  adds: number;
  dels: number;
}

// ── Static data ──────────────────────────────────────────────────────────────

export const MOCK_PROJECTS: MockProject[] = [
  // Sanctioned hex: project identity colors (non-themeable, user-assigned).
  { id: 'agent-ide', name: 'agent-ide', color: '#818cf8', initial: 'A', branch: 'wave/1-workbench-static-shell', dirty: 4, active: true },
  { id: 'pinpoint', name: 'pinpoint', color: '#f472b6', initial: 'P', branch: 'main', dirty: 0, active: false },
  { id: 'lumen-cli', name: 'lumen-cli', color: '#34d399', initial: 'L', branch: 'fix/streaming-edge', dirty: 2, active: false },
];

export const MOCK_SESSIONS: MockSession[] = [
  // agent-ide sessions (current project) — listed first
  { id: 's-ai-1', projectId: 'agent-ide', kind: 'claude', label: 'claude · main', sub: 'editing TerminalPane.tsx', status: 'live', active: true },
  { id: 's-ai-2', projectId: 'agent-ide', kind: 'claude', label: 'claude · refactor', sub: 'awaiting permission', status: 'warn', active: false },
  { id: 's-ai-3', projectId: 'agent-ide', kind: 'shell', label: 'dev server', sub: 'vite · :5173', status: 'live', active: false },
  { id: 's-ai-4', projectId: 'agent-ide', kind: 'shell', label: 'test:watch', sub: 'vitest · 24 passed', status: 'live', active: false },
  // lumen-cli session (other project)
  { id: 's-lc-1', projectId: 'lumen-cli', kind: 'claude', label: 'claude · streaming', sub: 'running tests', status: 'live', active: false },
];

export const MOCK_BRANCH: MockBranch = {
  name: 'wave/1-workbench-static-shell',
  adds: 126,
  dels: 42,
};

export const MOCK_TERM_TABS_UPPER: MockTerminalTab[] = [
  { id: 't1', label: 'claude · main', kind: 'cc', status: 'running', dirty: false, active: true },
  { id: 't2', label: 'claude · refactor', kind: 'cc', status: 'idle', dirty: false, active: false },
];

export const MOCK_TERM_TABS_LOWER: MockTerminalTab[] = [
  { id: 's1', label: 'dev server', kind: 'shell', status: 'running', dirty: false, active: true },
  { id: 's2', label: 'test:watch', kind: 'shell', status: 'running', dirty: false, active: false },
  { id: 's3', label: 'shell', kind: 'shell', status: 'idle', dirty: false, active: false },
];

export const MOCK_FILE_TREE: MockFileNode[] = [
  { type: 'dir', depth: 0, name: 'src', open: true },
  { type: 'dir', depth: 1, name: 'renderer', open: true },
  { type: 'dir', depth: 2, name: 'components', open: true },
  { type: 'dir', depth: 3, name: 'Layout', open: true },
  { type: 'file', depth: 4, name: 'ChatOnlyShell.tsx', badge: 'M' },
  { type: 'file', depth: 4, name: 'WorkbenchMenuBar.tsx', badge: null },
  { type: 'dir', depth: 3, name: 'Terminal', open: true },
  { type: 'file', depth: 4, name: 'TerminalPane.tsx', badge: 'M' },
  { type: 'file', depth: 4, name: 'CommandBlockOverlayBody.tsx', badge: null },
  { type: 'dir', depth: 2, name: 'styles', open: true },
  { type: 'file', depth: 3, name: 'tokens.css', badge: 'M' },
  { type: 'file', depth: 3, name: 'globals.css', badge: null },
  { type: 'dir', depth: 0, name: 'roadmap', open: false },
  { type: 'file', depth: 0, name: 'package.json', badge: null },
  { type: 'file', depth: 0, name: 'CLAUDE.md', badge: 'A' },
];

export const MOCK_HOOK_EVENTS: MockHookEvent[] = [
  { id: 'e1', t: -312, kind: 'prompt', text: 'refactor TerminalPane to use the new hook event API', tokens: 14 },
  { id: 'e2', t: -298, kind: 'tool', tool: 'Read', target: 'src/renderer/components/Terminal/TerminalPane.tsx', duration: 240, lines: 412, status: 'ok' },
  { id: 'e3', t: -284, kind: 'tool', tool: 'Read', target: 'src/renderer/components/Terminal/CommandBlockOverlayBody.tsx', duration: 180, lines: 286, status: 'ok' },
  { id: 'e4', t: -271, kind: 'tool', tool: 'Grep', target: 'hookEvent', files: 12, matches: 38, duration: 320, status: 'ok' },
  { id: 'e5', t: -255, kind: 'think', text: 'The TerminalPane currently parses xterm scrollback to surface tool calls. With hooks I can replace this with a subscription to the PostToolUse event.', dur: 4200 },
  { id: 'e6', t: -240, kind: 'tool', tool: 'Edit', target: 'src/renderer/components/Terminal/TerminalPane.tsx', adds: 28, dels: 12, duration: 410, status: 'ok' },
  { id: 'e7', t: -222, kind: 'tool', tool: 'Bash', target: 'pnpm typecheck', duration: 1340, status: 'ok', exitCode: 0 },
  { id: 'e8', t: -201, kind: 'tool', tool: 'Edit', target: 'src/renderer/hooks/useHookSubscription.ts', adds: 64, dels: 0, duration: 380, status: 'ok' },
  { id: 'e9', t: -184, kind: 'tool', tool: 'Bash', target: 'pnpm test:run terminal', duration: 4200, status: 'warn', exitCode: 0, note: '2 snapshots updated' },
  { id: 'e10', t: -160, kind: 'tool', tool: 'Read', target: 'src/renderer/components/Terminal/RichInputBody.tsx', duration: 120, lines: 168, status: 'ok' },
  { id: 'e11', t: -141, kind: 'tool', tool: 'Edit', target: 'src/renderer/components/Terminal/RichInputBody.tsx', adds: 18, dels: 9, duration: 290, status: 'ok' },
  { id: 'e12', t: -12, kind: 'tool', tool: 'Edit', target: 'src/renderer/components/Terminal/TerminalPane.tsx', adds: 6, dels: 4, duration: 0, status: 'running' },
];

export const MOCK_FILES_TOUCHED: MockFileTouched[] = [
  { path: 'src/renderer/components/Terminal/TerminalPane.tsx', adds: 34, dels: 16, status: 'editing' },
  { path: 'src/renderer/hooks/useHookSubscription.ts', adds: 64, dels: 0, status: 'edited' },
  { path: 'src/renderer/components/Terminal/RichInputBody.tsx', adds: 18, dels: 9, status: 'edited' },
  { path: 'src/renderer/components/Terminal/CommandBlockOverlayBody.tsx', adds: 0, dels: 0, status: 'read' },
];

export const MOCK_DIFF_HUNK: MockDiffLine[] = [
  { type: 'ctx', n: 84, text: '  useEffect(() => {' },
  { type: 'del', n: 85, text: "    const lines = parseXtermBuffer(term.buffer)" },
  { type: 'del', n: 86, text: '    const calls = extractToolCalls(lines)' },
  { type: 'add', n: 85, text: "    const unsubscribe = hooks.on('PostToolUse', (e) => {" },
  { type: 'add', n: 86, text: '      setCommandBlocks((prev) => [...prev, fromHookEvent(e)])' },
  { type: 'add', n: 87, text: '    })' },
  { type: 'ctx', n: 88, text: '    setBlocks(calls)' },
  { type: 'ctx', n: 89, text: '  }, [term])' },
];

export const MOCK_CONTEXT_STATS: MockContextStats = {
  usedTokens: 42_800,
  maxTokens: 200_000,
  costUsd: 0.087,
  model: 'claude-sonnet-4-6',
  elapsedSec: 312,
};
