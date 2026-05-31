/**
 * workbenchMockData.ts — static mock data for Wave 1 workbench skeleton.
 *
 * Seeded from design-system/workbench-data.jsx. Types are shaped to the
 * canon §11 hook schemas so Wave 3 can swap the data source without
 * changing component contracts.
 *
 * Nothing in this file is wired to live IPC, useAgentEvents, or xterm.
 * Wave 3 replaces these exports with hook-derived data.
 *
 * Data lives in sibling files split by region to stay within the 300-line cap:
 *   workbenchMockData.rails.ts   — projects, sessions, branch, file tree, terminal tabs
 *   workbenchMockData.sidebar.ts — hook events, diff, sidebar, terminal lines, status bar
 */

export type {
  FileNodeType,
  MockBranch,
  MockFileNode,
  MockProject,
  MockSession,
  MockTerminalTab,
} from './workbenchMockData.rails';
export {
  MOCK_BRANCH,
  MOCK_FILE_TREE,
  MOCK_PROJECTS,
  MOCK_SESSIONS,
  MOCK_TERM_TABS_LOWER,
  MOCK_TERM_TABS_UPPER,
} from './workbenchMockData.rails';
export type {
  DiffLineType,
  HookEventKind,
  MockContextStats,
  MockDiffHunk,
  MockDiffLine,
  MockFileTouched,
  MockHookEvent,
  MockHookEventBase,
  MockNowToolCall,
  MockPromptEvent,
  MockStatusBar,
  MockThinkEvent,
  MockToolEvent,
  MockTurnEndEvent,
} from './workbenchMockData.sidebar';
export { MOCK_STATUS_BAR } from './workbenchMockData.sidebar';
