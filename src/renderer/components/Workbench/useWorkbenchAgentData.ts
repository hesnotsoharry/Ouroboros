/**
 * useWorkbenchAgentData — Workbench-local agent adapter (Wave 3, Phase 1–3).
 *
 * Consumes `useAgentEventsContext()` (the live pipeline shared with AgentMonitor)
 * and derives a workbench-local presentation state + canon-shaped display fields.
 *
 * Key design decisions (ADR D1–D4):
 *   D1 — WorkbenchAgentState is separate from the canonical AgentStatus; do NOT
 *        extend AgentMonitor/types.ts.
 *   D3 — This hook is the single adapter; mock interfaces are its output contract.
 *   D4 — Primary session = most-recently-active across all sessions; null when empty.
 */


import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import type { AgentSession } from '../AgentMonitor/types';
import { buildBadgeMap, deriveLatestHunk, useDiffReviewState } from './useWorkbenchAgentData.diff';
import type {
  MockContextStats,
  MockDiffHunk,
  MockFileTouched,
  MockNowToolCall,
  MockPromptEvent,
  MockToolEvent,
} from './workbenchMockData';

// ── Live timeline event type (D6 — `think` dropped; no wire source) ──────────

/**
 * The union of live timeline events emitted by the adapter.
 * `MockThinkEvent` is intentionally excluded — the named-pipe wire carries no
 * thinking signal (Wave 4 ADR D6).
 */
export type WorkbenchTimelineEvent = MockPromptEvent | MockToolEvent;

// ── Presentation state ────────────────────────────────────────────────────────

export type WorkbenchAgentState =
  | 'fresh'
  | 'idle'
  | 'thinking'
  | 'running'
  | 'awaiting'
  | 'errored'
  | 'done';

// ── Session rail shape ────────────────────────────────────────────────────────

export interface WorkbenchSession {
  id: string;
  projectId: string;
  kind: 'claude' | 'shell';
  label: string;
  sub: string;
  status: 'live' | 'warn' | 'idle';
  active: boolean;
}

// ── Adapter output ────────────────────────────────────────────────────────────

export interface WorkbenchAgentData {
  state: WorkbenchAgentState;
  model: string;
  activeTool: string;
  target: string;
  elapsedSec: number;
  sessions: WorkbenchSession[];
  contextStats: {
    usedTokens: number;
    maxTokens: number;
    costUsd: number;
    model: string;
  };
  now: MockNowToolCall;
  context: MockContextStats;
  filesTouched: MockFileTouched[];
  timeline: WorkbenchTimelineEvent[];
  latestHunk?: MockDiffHunk;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns the "last activity" timestamp for a session (used for primary selection). */
function lastActivityOf(session: AgentSession): number {
  const toolTs = session.toolCalls.reduce(
    (max, tc) => (tc.timestamp > max ? tc.timestamp : max),
    0,
  );
  return Math.max(session.completedAt ?? 0, toolTs, session.startedAt);
}

/**
 * Picks the primary session using a two-tier rule (ADR D4):
 *   Tier 1 — if any session is running, pick the most-recently-active running one.
 *   Tier 2 — otherwise, pick the most-recently-active session from the full list.
 * Returns null only when the list is empty.
 */
export function selectPrimarySession(sessions: AgentSession[]): AgentSession | null {
  if (sessions.length === 0) return null;
  const running = sessions.filter((s) => s.status === 'running');
  const pool = running.length > 0 ? running : sessions;
  return pool.reduce((best, s) => (lastActivityOf(s) > lastActivityOf(best) ? s : best));
}

/**
 * Returns true when the session is at the idle-between-turns boundary.
 * A session is idle-between-turns when `lastTurnEndedAt` is set (session_stop
 * arrived) and no newer activity (pending tool / fresh prompt) has cleared it.
 * The `turnEnd` reducer already clears all pending tools, so this is safe to
 * check independently — if lastTurnEndedAt is set there are no pending tools.
 */
function isIdleBetweenTurns(session: AgentSession): boolean {
  return session.lastTurnEndedAt !== undefined;
}

/**
 * Derives the seven-state workbench presentation state from a single session.
 *
 * Derivation (in precedence order for the 'running' status):
 *   null | status 'idle' (no agent bound)  → 'fresh'   (no session)
 *   'error'                                → 'errored'
 *   'complete'                             → 'done'
 *   'running' + lastTurnEndedAt set        → 'idle'    (session exists, resting between turns)
 *   'running' + latest permissionEvent 'request' → 'awaiting'
 *   'running' + a pending toolCall         → 'running'
 *   'running' (no pending toolCall)        → 'thinking'
 *
 * Key distinction: 'fresh' = no session bound to pane; 'idle' = session bound but resting.
 * AgentSidebar uses (state !== 'fresh') to decide whether to show the empty-state
 * placeholder — 'idle' is NOT fresh, so the NowBlock is shown (with empty tool fields).
 */
export function deriveWorkbenchAgentState(session: AgentSession | null): WorkbenchAgentState {
  if (!session || session.status === 'idle') return 'fresh';
  if (session.status === 'error') return 'errored';
  if (session.status === 'complete') return 'done';

  // status === 'running' from here on.
  // session_stop = turn-ended; session still alive, just idle between prompts.
  if (isIdleBetweenTurns(session)) return 'idle';

  const perms = session.permissionEvents ?? [];
  if (perms.length > 0 && perms[perms.length - 1].type === 'request') {
    return 'awaiting';
  }
  const hasPendingTool = session.toolCalls.some((tc) => tc.status === 'pending');
  return hasPendingTool ? 'running' : 'thinking';
}

// ── Display-field derivation ──────────────────────────────────────────────────

const FALLBACK_MODEL = 'claude';

function deriveModel(session: AgentSession | null): string {
  return session?.model ?? FALLBACK_MODEL;
}

/**
 * Returns the currently-executing tool name, or '' when nothing is pending.
 * Does NOT fall back to the last completed tool — a completed tool is history,
 * not an active indicator. The NOW block and shimmer must be blank when idle.
 */
export function deriveActiveTool(session: AgentSession | null): string {
  if (!session) return '';
  const pending = session.toolCalls.find((tc) => tc.status === 'pending');
  return pending?.toolName ?? '';
}

/**
 * Returns the input/target of the currently-executing tool, or '' when idle.
 * Does NOT fall back to the last completed tool's input.
 */
function deriveTarget(session: AgentSession | null): string {
  if (!session) return '';
  const pending = session.toolCalls.find((tc) => tc.status === 'pending');
  return pending?.input ?? '';
}

function deriveElapsedSec(session: AgentSession | null): number {
  if (!session) return 0;
  return Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
}

// ── Session-rail helpers ──────────────────────────────────────────────────────

/**
 * Derives the rail status dot for a single live session.
 *   running + latest permissionEvent is 'request' → 'warn'
 *   running (otherwise)                            → 'live'
 *   idle                                           → 'idle'
 */
export function deriveSessionStatus(session: AgentSession): 'live' | 'warn' | 'idle' {
  if (session.status === 'idle') return 'idle';
  const perms = session.permissionEvents ?? [];
  if (perms.length > 0 && perms[perms.length - 1].type === 'request') {
    return 'warn';
  }
  return 'live';
}

function sessionBasename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? filePath;
}

/** Derives a stable project-id key from a session's cwd. */
function deriveProjectId(session: AgentSession): string {
  return session.cwd ? sessionBasename(session.cwd) : 'unknown';
}

/** Derives the sub-label text for a session row. */
function deriveSub(session: AgentSession): string {
  const perms = session.permissionEvents ?? [];
  if (perms.length > 0 && perms[perms.length - 1].type === 'request') {
    return 'awaiting permission';
  }
  const pendingTool = session.toolCalls.find((tc) => tc.status === 'pending');
  if (pendingTool) {
    const input = pendingTool.input?.trim() ?? '';
    return input ? `${pendingTool.toolName} ${input}`.slice(0, 40) : pendingTool.toolName;
  }
  if (session.cwd) return sessionBasename(session.cwd);
  return session.status === 'running' ? 'running' : 'idle';
}

/** Maps a live AgentSession to a WorkbenchSession rail shape. */
function mapToRailSession(session: AgentSession, primaryId: string | null): WorkbenchSession {
  return {
    id: session.id,
    projectId: deriveProjectId(session),
    kind: session.kind === 'terminal' ? 'shell' : 'claude',
    label: session.taskLabel,
    sub: deriveSub(session),
    status: deriveSessionStatus(session),
    active: session.id === primaryId,
  };
}

// ── Context-stats derivation ──────────────────────────────────────────────────

export function deriveContextStats(primary: AgentSession | null): WorkbenchAgentData['contextStats'] {
  if (!primary) {
    return { usedTokens: 0, maxTokens: 200_000, costUsd: 0, model: FALLBACK_MODEL };
  }
  return {
    usedTokens: primary.contextUsedTokens ?? (primary.inputTokens + primary.outputTokens),
    maxTokens: primary.contextMaxTokens ?? 200_000,
    costUsd: primary.costUsd ?? 0,
    model: primary.model ?? FALLBACK_MODEL,
  };
}

// ── NOW + Context panel derivation ───────────────────────────────────────────

/**
 * Derives the MockNowToolCall shape from the primary session's live fields.
 * `progress` is always undefined — there is no live progress signal (D1/§5).
 * `description` is the target path or '' when no active tool.
 */
function deriveNow(activeTool: string, target: string, elapsedSec: number): MockNowToolCall {
  return {
    tool: activeTool,
    target,
    description: target,
    elapsedSec,
    progress: undefined,
  };
}

/**
 * Derives the MockContextStats shape by merging contextStats + elapsedSec.
 * MockContextStats requires elapsedSec inside the object (§5).
 */
function deriveContext(
  stats: WorkbenchAgentData['contextStats'],
  elapsedSec: number,
): MockContextStats {
  return { ...stats, elapsedSec };
}

// ── Files Touched derivation ─────────────────────────────────────────────────

/** Tool names that represent file-touch operations we track. */
const FILE_TOOL_NAMES = new Set(['Edit', 'Write', 'Read', 'MultiEdit']);
const EDIT_WRITE_NAMES = new Set(['Edit', 'Write', 'MultiEdit']);

type FileTouchAccumulator = {
  firstTs: number;
  hasEditWrite: boolean;
  hasPendingEditWrite: boolean;
};

type TouchSignal = { firstTs: number; isEditWrite: boolean; isPending: boolean };

/** Accumulates per-path touch state from a single ToolCallEvent. */
function accumulateTouch(
  map: Map<string, FileTouchAccumulator>,
  key: string,
  sig: TouchSignal,
): void {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      firstTs: sig.firstTs,
      hasEditWrite: sig.isEditWrite,
      hasPendingEditWrite: sig.isEditWrite && sig.isPending,
    });
    return;
  }
  if (sig.isEditWrite) existing.hasEditWrite = true;
  if (sig.isEditWrite && sig.isPending) existing.hasPendingEditWrite = true;
}

/** Derives a MockFileTouched status from the accumulated touch state. */
function touchStatus(acc: FileTouchAccumulator): MockFileTouched['status'] {
  if (acc.hasPendingEditWrite) return 'editing';
  if (acc.hasEditWrite) return 'edited';
  return 'read';
}

/**
 * Derives the Files Touched list from a session's tool calls.
 *
 * Contract (pinned by the orchestrator-owned test):
 *   - Only Edit/Write/Read/MultiEdit participate; Bash/Grep/Glob are excluded.
 *   - Dedup key = ToolCallEvent.input (truncated path — recon §3).
 *   - Status precedence: pending Edit/Write → 'editing'; completed → 'edited'; Read → 'read'.
 *   - adds/dels enriched from badgeMap when available (Phase 3); 0 otherwise.
 *   - Rows ordered by each path's first-appearance timestamp ascending.
 *   - null session → [].
 */
export function deriveFilesTouched(
  session: AgentSession | null,
  badgeMap?: Map<string, { adds: number; dels: number }>,
): MockFileTouched[] {
  if (!session) return [];
  const map = new Map<string, FileTouchAccumulator>();
  for (const call of session.toolCalls) {
    if (!FILE_TOOL_NAMES.has(call.toolName)) continue;
    accumulateTouch(map, call.input, {
      firstTs: call.timestamp,
      isEditWrite: EDIT_WRITE_NAMES.has(call.toolName),
      isPending: call.status === 'pending',
    });
  }
  const rows: MockFileTouched[] = Array.from(map.entries()).map(([path, acc]) => {
    const badge = badgeMap?.get(path);
    return {
      path,
      adds: badge?.adds ?? 0,
      dels: badge?.dels ?? 0,
      status: touchStatus(acc),
    };
  });
  rows.sort((a, b) => (map.get(a.path)?.firstTs ?? 0) - (map.get(b.path)?.firstTs ?? 0));
  return rows;
}

// ── Hook Timeline derivation ─────────────────────────────────────────────────

/**
 * Derives the Hook Timeline event stream from a session's tool calls and
 * conversation turns. `think` events are intentionally absent (D6 — no wire
 * source). Events are sorted by source timestamp ascending (oldest first).
 * Pure: same session in → structurally identical out (no module-level state).
 * null session → [].
 */
export function deriveTimeline(session: AgentSession | null): WorkbenchTimelineEvent[] {
  if (!session) return [];

  const now = Date.now();
  const events: WorkbenchTimelineEvent[] = [];

  for (const tc of session.toolCalls) {
    const toolEvent: MockToolEvent = {
      id: tc.id,
      t: (tc.timestamp - now) / 1000,
      kind: 'tool',
      tool: tc.toolName,
      target: tc.input,
      duration: tc.duration ?? 0,
      status: tc.status === 'pending' ? 'running' : tc.status === 'error' ? 'warn' : 'ok',
    };
    events.push(toolEvent);
  }

  (session.conversationTurns ?? []).forEach((turn, idx) => {
    if (turn.type !== 'prompt' && turn.type !== 'elicitation') return;
    const promptEvent: MockPromptEvent = {
      id: `prompt-${turn.timestamp}-${idx}`,
      t: (turn.timestamp - now) / 1000,
      kind: 'prompt',
      text: turn.content,
      tokens: 0,
    };
    events.push(promptEvent);
  });

  events.sort((a, b) => a.t - b.t);
  return events;
}

// ── Session scoping helpers (Wave 13 Phase 2) ────────────────────────────────

/**
 * Picks the primary session applying the Wave 13 paneId-keyed scoping contract
 * (replaces the Wave 8 claudeSessionId contract):
 *   - Bound path (paneId supplied): direct `agents.find` by `session.paneId`
 *     (stamped from AGENT_START hook payload's OUROBOROS_PANE_ID); project
 *     filter does NOT apply. Returns null (D4 empty state) when no session
 *     matches the active pane's id.
 *   - Fallback path (no paneId, D4 Option A): return null. The heuristic
 *     project-cwd fallback path (Wave 8) is intentionally removed — it was the
 *     source of the hijack bug this wave closes (ADR D4, D5).
 */
function resolvePrimary(
  agents: AgentSession[],
  paneId: string | null | undefined,
): AgentSession | null {
  if (paneId != null && paneId !== '') {
    // Wave 13 Phase 2.5: match by AgentSession.paneId (stamped from AGENT_START
    // hook payload's OUROBOROS_PANE_ID), NOT by claude session id. The pane
    // identity is the IDE's tab id; the claude session id is a separate value.
    return agents.find((s) => s.paneId === paneId) ?? null;
  }
  // D4 Option A: no paneId → no fallback → empty state.
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Wave 13 Phase 2: param renamed from `claudeSessionId` to `paneId`.
 * Filters the agent session pool to the session whose `paneId` matches the
 * active pane (stamped via AGENT_START → OUROBOROS_PANE_ID at Phase 2.5).
 * When paneId is null/undefined/empty, returns the empty data shape (D4 empty
 * state — no heuristic fallback, per ADR D4 Option A).
 */
export function useWorkbenchAgentData(paneId?: string | null): WorkbenchAgentData {
  const { agents, currentSessions } = useAgentEventsContext();
  const { latestFiles } = useDiffReviewState();
  const primary = resolvePrimary(agents, paneId);
  // Note: useProjectOptional removed in Wave 13 Phase 2 (D4 Option A — no cwd fallback).
  const primaryId = primary?.id ?? null;

  const state = deriveWorkbenchAgentState(primary);

  const sessions = currentSessions.map((s) => mapToRailSession(s, primaryId));
  const activeTool = deriveActiveTool(primary);
  const target = deriveTarget(primary);
  const elapsedSec = deriveElapsedSec(primary);
  const contextStats = deriveContextStats(primary);
  const badgeMap = latestFiles.length > 0 ? buildBadgeMap(latestFiles) : undefined;

  return {
    state,
    model: deriveModel(primary),
    activeTool,
    target,
    elapsedSec,
    sessions,
    contextStats,
    now: deriveNow(activeTool, target, elapsedSec),
    context: deriveContext(contextStats, elapsedSec),
    filesTouched: deriveFilesTouched(primary, badgeMap),
    timeline: deriveTimeline(primary),
    latestHunk: deriveLatestHunk(latestFiles),
  };
}

