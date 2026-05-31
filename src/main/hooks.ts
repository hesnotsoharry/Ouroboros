/** hooks.ts - Hook event dispatch for Claude Code sessions. Socket/server code is in hooksNet.ts. */

import { BrowserWindow } from 'electron';

import { traceLink } from './agentChat/subagentLinkTrace';
import { get as getSubagentRecord } from './agentChat/subagentTracker';
import { enrichAgentStartPayload } from './hooksAgentStartEnrich';
import { getChatLaunchesInFlight } from './hooksChatLaunch';
// (tap functions live in hooksTapRunner.ts; tapSkillExecution is also called
// inline from dispatchToRenderer so we keep that one import here)
import { pairCorrelationId } from './hooksCorrelationPairing';
import {
  drainQueue,
  evictOrphanedSessions as evictOrphanedSessionsLogic,
  inferSessionId as inferSessionIdLogic,
  queuePayload,
  shouldSuppressDispatch,
  traceInstructionsLoaded,
  trackSessionLifecycle as trackSessionLifecycleLogic,
  truncatePayloadForDispatch,
} from './hooksDispatchLogic';
import {
  enrichFromPermissionRequest,
  handleConfigChange,
  handleCwdChanged,
  handleFileChanged,
  type HookEventType,
} from './hooksLifecycleHandlers';
import { getHooksNetAddress, startHooksNetServer, stopHooksNetServer } from './hooksNet';
import {
  handleSessionEnd,
  handleSessionStart,
  handleSessionStop,
} from './hooksSessionHandlers';
import { tapSkillExecution } from './hooksSkillExecutionTap';
import { runHookTaps } from './hooksTapRunner';
import log from './logger';
import { broadcastToWebClients } from './web/webServer';
import { getAllActiveWindows } from './windowManager';

// HookEventType is defined in hooksLifecycleHandlers.ts to avoid a circular
// dependency. Re-export it here so callers that import from hooks.ts still work.
export type { HookEventType } from './hooksLifecycleHandlers';

export interface HookPayload {
  type: HookEventType;
  sessionId: string;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  taskLabel?: string;
  durationMs?: number;
  timestamp: number;
  requestId?: string;
  parentSessionId?: string;
  prompt?: string;
  model?: string;
  error?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  /** Provider-reported cost in USD (set on agent_end for chat bridge sessions). */
  costUsd?: number;
  /** Working directory of the Claude Code session — set by hook scripts */
  cwd?: string;
  /** True when the session was spawned internally by the IDE (e.g. Haiku summarizer, CLAUDE.md generator) */
  internal?: boolean;
  /** True when the event originates from a Claude Code process spawned inside the IDE (terminal or agent PTY). */
  ideSpawned?: boolean;
  /** Correlation ID for linking related events (e.g. pre_tool_use → post_tool_use). */
  correlationId?: string;
  /**
   * Wave 13: paneId is the IDE pane identifier (OUROBOROS_PANE_ID) for terminal-scoped binding.
   * Set by hook scripts that inherit the env var from the pty spawn; absent for external sessions.
   */
  paneId?: string;
  /** Catch-all for event-specific data forwarded from Claude Code stdin JSON. */
  data?: Record<string, unknown>;
  /** Absolute context-window token count from the statusline push (context_update event). */
  contextUsedTokens?: number;
  /** Context-window size reported by the model (e.g. 200000 or 1000000). */
  contextMaxTokens?: number;
  /** Context usage percentage (0–100). Not stored on AgentSession; recompute if needed. */
  contextUsedPct?: number;
}

export interface AgentEvent {
  type: 'tool_call' | 'tool_result' | 'message' | 'error' | 'status';
  sessionId?: string;
  agentId?: string;
  timestamp: number;
  payload: unknown;
}

export interface ToolCallEvent extends AgentEvent {
  type: 'tool_call';
  payload: {
    tool: string;
    input: Record<string, unknown>;
    callId: string;
  };
}

let mainWindow: BrowserWindow | null = null;

const pendingQueue: HookPayload[] = [];

// ── Ownership tracking ────────────────────────────────────────────────────────
// Sessions the IDE spawned. A session is owned if its first event carries
// paneId (set only for IDE-spawned PTYs via OUROBOROS_PANE_ID). The Set lets
// subsequent synthetic events (e.g. onConnectionDisconnect agent_stop, which
// carries no paneId) still be recognised as owned.
const ownedSessionIds = new Set<string>();

/** True when this event belongs to a session the IDE spawned. */
function isOwnedSession(payload: HookPayload): boolean {
  return Boolean(payload.paneId) || ownedSessionIds.has(payload.sessionId);
}

// Session inference: maps sessionId→lastSeen and sessionId→cwd for tool events with unknown IDs
const activeSessions = new Map<string, number>();
const sessionCwdMap = new Map<string, string>();

// beginChatSessionLaunch / endChatSessionLaunch are re-exported from hooksChatLaunch.ts
export { beginChatSessionLaunch, endChatSessionLaunch } from './hooksChatLaunch';
export { shouldSuppressHookEvent } from './hooksDispatchLogic';

function trackSessionLifecycle(p: HookPayload): void {
  trackSessionLifecycleLogic(activeSessions, sessionCwdMap, p);
}

function inferSessionId(payload: HookPayload): HookPayload {
  const result = inferSessionIdLogic(activeSessions, payload);
  if (result.sessionId !== payload.sessionId) {
    log.debug(`inferred session for tool event: ${payload.sessionId} → ${result.sessionId}`);
  }
  return result;
}

function isRenderableWindow(window: BrowserWindow | null): window is BrowserWindow {
  return Boolean(window && !window.isDestroyed());
}

function queuePendingPayload(payload: HookPayload): void {
  log.info(`queuing event (no window): ${payload.type} session=${payload.sessionId}`);
  queuePayload(pendingQueue, payload);
}

function getDispatchWindows(): BrowserWindow[] {
  const activeWindows = getAllActiveWindows().filter((window) => !window.isDestroyed());
  if (activeWindows.length > 0) return activeWindows;
  return isRenderableWindow(mainWindow) ? [mainWindow] : [];
}

function sendPayload(windows: BrowserWindow[], payload: HookPayload): void {
  // Truncate large fields before crossing IPC — original payload stays intact for other consumers.
  const ipcPayload = truncatePayloadForDispatch(payload);
  for (const window of windows) {
    try {
      // Use mainFrame.send directly — webContents.send wraps this in its own
      // try-catch that console.errors before re-throwing, producing noisy logs
      // when the render frame is disposed during navigation/reload.
      window.webContents.mainFrame.send('hooks:event', ipcPayload);
    } catch {
      // Render frame disposed — silently skip this window
    }
  }
  broadcastToWebClients('hooks:event', ipcPayload);
}

function flushPendingQueue(windows: BrowserWindow[]): void {
  for (const payload of drainQueue(pendingQueue)) {
    sendPayload(windows, payload);
  }
}

function dispatchNewEventType(payload: HookPayload): boolean {
  if (payload.type === 'session_end') {
    handleSessionEnd(payload);
    return true;
  }
  if (payload.type === 'cwd_changed') {
    handleCwdChanged(sessionCwdMap, payload);
    return true;
  }
  if (payload.type === 'file_changed') {
    handleFileChanged(payload);
    return true;
  }
  if (payload.type === 'config_change') {
    handleConfigChange(payload.sessionId);
    return true;
  }
  if (payload.type === 'permission_request') {
    enrichFromPermissionRequest(payload);
    return true;
  }
  return false;
}

function traceAgentStart(payload: HookPayload): void {
  const existing = getSubagentRecord(payload.sessionId);
  traceLink('hook:agentStart', {
    childSessionId: payload.sessionId,
    parentSessionId: payload.parentSessionId ?? existing?.parentSessionId,
    source: 'named-pipe',
    timestamp: payload.timestamp,
  });
}

// agent_end = SubagentStop = per-turn, so it must NOT trigger handleSessionEnd
// (onSessionEnd extension activation) — that fires extension teardown after
// every turn. agent_stop (disconnect synthetic) is the true session-end signal;
// the 2-hr orphan sweep is the backstop. (session_stop ALSO fires handleSessionEnd
// per-turn — a known issue tracked as the handlesessionend-fires-per-turn
// follow-up, left untouched here to stay scoped to the silent-sidebar fix.)
const END_EVENT_TYPES = new Set(['session_stop', 'agent_stop']);
function dispatchLifecycleEvent(payload: HookPayload): void {
  if (payload.type === 'agent_start') {
    traceAgentStart(payload);
  }
  if (payload.type === 'session_start') {
    handleSessionStart(payload);
    return;
  }
  if (dispatchNewEventType(payload)) return;

  if (END_EVENT_TYPES.has(payload.type)) handleSessionEnd(payload);
  if (payload.type === 'session_stop') handleSessionStop(payload, sessionCwdMap);
}

// session_stop fires at the END OF EVERY TURN (Claude Code's Stop hook), NOT
// at true session end. Keeping it here caused ownership to be released after
// turn 1, dropping all subsequent pre_tool_use/post_tool_use events.
// agent_end = SubagentStop = per-turn / per-subagent, NOT true session end.
// Ownership must survive SubagentStop so turn-2+ tool events are still dispatched.
// agent_stop is the synthetic terminal event produced by onConnectionDisconnect;
// it is the correct ownership-terminal event along with the 2-hr orphan sweep.
const TERMINAL_EVENT_TYPES = new Set(['agent_stop']);

/** Runs the full dispatch pipeline for a confirmed IDE-owned event. */
function dispatchOwnedEvent(rawPayload: HookPayload): void {
  tapSkillExecution(rawPayload);
  traceInstructionsLoaded(rawPayload, new Set());
  if (shouldSuppressDispatch(rawPayload.type, getChatLaunchesInFlight(), 0)) {
    log.info(`suppressing: ${rawPayload.type} session=${rawPayload.sessionId}`);
    return;
  }

  pairCorrelationId(rawPayload);
  trackSessionLifecycle(rawPayload);
  const inferred = inferSessionId(rawPayload);
  const payload = enrichAgentStartPayload(inferred);

  const windows = getDispatchWindows();
  if (windows.length === 0) {
    queuePendingPayload(payload);
    return;
  }

  flushPendingQueue(windows);
  log.debug(
    `dispatching to ${windows.length} renderer(s): ${payload.type} session=${payload.sessionId} tool=${payload.toolName ?? ''}`,
  );
  sendPayload(windows, payload);
  dispatchLifecycleEvent(payload);
  runHookTaps(payload, sessionCwdMap);

  // Remove from owned set AFTER dispatch so the terminal event itself goes
  // through. Bounds the set to actively-running sessions only.
  if (TERMINAL_EVENT_TYPES.has(payload.type)) {
    ownedSessionIds.delete(payload.sessionId);
  }
}

function dispatchToRenderer(rawPayload: HookPayload): void {
  // Register paneId before the gate so the first owned event populates the set
  // and all subsequent paneId-less synthetics for that session still pass.
  if (rawPayload.paneId) {
    ownedSessionIds.add(rawPayload.sessionId);
  }

  if (!isOwnedSession(rawPayload)) {
    // External session: drop — do NOT dispatch to the renderer.
    return;
  }

  dispatchOwnedEvent(rawPayload);
}

function evictOrphanedSessions(): void {
  const evicted = evictOrphanedSessionsLogic(activeSessions, sessionCwdMap);
  for (const id of evicted) {
    log.info(`evicting orphaned session: ${id}`);
  }
}

function onConnectionDisconnect(sessionIds: string[]): void {
  for (const sessionId of sessionIds) {
    log.info(`[disconnect] synthesizing agent_stop for terminated session ${sessionId}`);
    dispatchToRenderer({ type: 'agent_stop', sessionId, timestamp: Date.now() });
  }
}

export async function startHooksServer(window: BrowserWindow): Promise<{ port: number | string }> {
  mainWindow = window;
  setInterval(evictOrphanedSessions, 5 * 60 * 1000);
  return startHooksNetServer(window, pendingQueue, dispatchToRenderer, onConnectionDisconnect);
}

export function stopHooksServer(): Promise<void> {
  return stopHooksNetServer();
}

/** Dispatch a synthetic hook event (from chat orchestration). Skips approval — chat sessions manage permissions. */
export function dispatchSyntheticHookEvent(rawPayload: HookPayload): void {
  const payload: HookPayload = { ...rawPayload, ideSpawned: true };
  trackSessionLifecycle(payload);

  const windows = getDispatchWindows();
  if (windows.length === 0) {
    queuePendingPayload(payload);
    return;
  }

  flushPendingQueue(windows);
  sendPayload(windows, payload);
  dispatchLifecycleEvent(payload);
  runHookTaps(payload, sessionCwdMap);
}

export function getHooksAddress(): string | null {
  return getHooksNetAddress();
}

// ── Test seams ────────────────────────────────────────────────────────────────
// Exported for unit testing only. Do not import these from application code.

/** @internal */
export { dispatchToRenderer as _dispatchToRenderer };

/** Clears the owned-session set between tests.
 * @internal */
export function _resetOwnedSessionIds(): void {
  ownedSessionIds.clear();
}
