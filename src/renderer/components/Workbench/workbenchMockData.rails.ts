/**
 * workbenchMockData.rails.ts — mock data for Rails + project navigation regions.
 *
 * Re-exported via workbenchMockData.ts — import from there, not directly.
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
  {
    id: 'agent-ide',
    name: 'agent-ide',
    color: '#818cf8',
    initial: 'A',
    branch: 'wave/1-workbench-static-shell',
    dirty: 4,
    active: true,
  },
  {
    id: 'pinpoint',
    name: 'pinpoint',
    color: '#f472b6',
    initial: 'P',
    branch: 'main',
    dirty: 0,
    active: false,
  },
  {
    id: 'lumen-cli',
    name: 'lumen-cli',
    color: '#34d399',
    initial: 'L',
    branch: 'fix/streaming-edge',
    dirty: 2,
    active: false,
  },
];

export const MOCK_SESSIONS: MockSession[] = [
  // agent-ide sessions (current project) — listed first
  {
    id: 's-ai-1',
    projectId: 'agent-ide',
    kind: 'claude',
    label: 'claude · main',
    sub: 'editing TerminalPane.tsx',
    status: 'live',
    active: true,
  },
  {
    id: 's-ai-2',
    projectId: 'agent-ide',
    kind: 'claude',
    label: 'claude · refactor',
    sub: 'awaiting permission',
    status: 'warn',
    active: false,
  },
  {
    id: 's-ai-3',
    projectId: 'agent-ide',
    kind: 'shell',
    label: 'dev server',
    sub: 'vite · :5173',
    status: 'live',
    active: false,
  },
  {
    id: 's-ai-4',
    projectId: 'agent-ide',
    kind: 'shell',
    label: 'test:watch',
    sub: 'vitest · 24 passed',
    status: 'live',
    active: false,
  },
  // lumen-cli session (other project)
  {
    id: 's-lc-1',
    projectId: 'lumen-cli',
    kind: 'claude',
    label: 'claude · streaming',
    sub: 'running tests',
    status: 'live',
    active: false,
  },
];

export const MOCK_BRANCH: MockBranch = {
  name: 'wave/1-workbench-static-shell',
  adds: 126,
  dels: 42,
};

export const MOCK_TERM_TABS_UPPER: MockTerminalTab[] = [
  { id: 't1', label: 'claude · main', kind: 'cc', status: 'running', dirty: false, active: true },
  {
    id: 't2',
    label: 'claude · refactor',
    kind: 'cc',
    status: 'idle',
    dirty: false,
    active: false,
  },
];

export const MOCK_TERM_TABS_LOWER: MockTerminalTab[] = [
  {
    id: 's1',
    label: 'dev server',
    kind: 'shell',
    status: 'running',
    dirty: false,
    active: true,
  },
  {
    id: 's2',
    label: 'test:watch',
    kind: 'shell',
    status: 'running',
    dirty: false,
    active: false,
  },
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
