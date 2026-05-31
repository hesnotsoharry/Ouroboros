/**
 * workbenchMockData.sidebar.ts — sidebar / status-bar mock TYPES + the remaining
 * static status-bar constant.
 *
 * Re-exported via workbenchMockData.ts — import from there, not directly.
 *
 * Wave 4 swept the orphaned sidebar DATA constants (MOCK_HOOK_EVENTS,
 * MOCK_FILES_TOUCHED, MOCK_DIFF_HUNK, MOCK_DIFF_HUNK_META, MOCK_NOW_TOOL_CALL,
 * MOCK_CONTEXT_STATS) once the five AgentSidebar panels went live. The `Mock*`
 * interfaces stay — they are the adapter's typed output contract (ADR D8).
 * `MOCK_STATUS_BAR` remains: StatusBar.testsPassing is still static (→ later wave).
 */

// ── Hook event types (§11 shape) ─────────────────────────────────────────────

export type HookEventKind = 'prompt' | 'tool' | 'think' | 'turn_end';

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

export interface MockTurnEndEvent extends MockHookEventBase {
  kind: 'turn_end';
  label: string;
}

export type MockHookEvent = MockPromptEvent | MockToolEvent | MockThinkEvent | MockTurnEndEvent;

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

export const MOCK_STATUS_BAR: MockStatusBar = {
  testsPassing: 24,
  clock: '14:32:34',
};
