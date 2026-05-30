/**
 * hooksLifecycleHandlers.ts — Handlers for new Claude Code hook lifecycle events.
 *
 * Extracted from hooks.ts to keep that file under the 300-line ESLint limit.
 * Also owns HookEventType to avoid a circular dependency with hooks.ts.
 *
 * Handles: cwd_changed, file_changed, config_change, permission_request,
 * permission_denied, and all other pass-through events added in Phase 0.
 */

import log from './logger';

// ---------------------------------------------------------------------------
// HookEventType — canonical union of all wire-format event names.
// Defined here (not in hooks.ts) to avoid a circular dependency since
// hooks.ts imports handlers from this file.
// ---------------------------------------------------------------------------

export type HookEventType =
  // Tools
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'post_tool_use_failure'
  // Agents
  | 'agent_start'
  | 'agent_stop'
  | 'agent_end'
  | 'teammate_idle'
  // Sessions / lifecycle
  | 'session_start'
  | 'session_end'
  | 'session_stop'
  | 'stop_failure'
  | 'setup'
  // Tasks
  | 'task_created'
  | 'task_completed'
  // Conversation
  | 'user_prompt_submit'
  | 'elicitation'
  | 'elicitation_result'
  | 'notification'
  // Workspace
  | 'cwd_changed'
  | 'file_changed'
  | 'worktree_create'
  | 'worktree_remove'
  | 'config_change'
  // Context
  | 'pre_compact'
  | 'post_compact'
  | 'instructions_loaded'
  // Permissions
  | 'permission_request'
  | 'permission_denied';

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handle a cwd_changed event: update the session→cwd registry and notify
 * the context layer so it can re-scope if the working directory changed.
 */
export function handleCwdChanged(
  sessionCwdMap: Map<string, string>,
  payload: { sessionId: string; cwd?: string; data?: Record<string, unknown> },
): void {
  const newCwd = (payload.data?.['cwd'] as string | undefined) ?? payload.cwd;
  if (!newCwd) return;
  sessionCwdMap.set(payload.sessionId, newCwd);
  log.info(`[hooks] cwd_changed session=${payload.sessionId} cwd=${newCwd}`);
}

/**
 * Handle a file_changed event: notify the context layer and graph controller
 * that files may have changed on disk (lighter signal than onGitCommit).
 * Also marks user edits for provenance tracking when no recent agent edit exists.
 */
export function handleFileChanged(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub retained for callers
  _payload: { internal?: boolean; data?: Record<string, unknown> },
): void {
  // editProvenance.markUserEdit removed in Wave 101 Phase 4 (provenance store deleted)
  // Future file-changed handlers go here.
}

/**
 * Log a config_change event. No main-process side effects — the renderer
 * handles config changes by re-reading via IPC.
 */
export function handleConfigChange(sessionId: string): void {
  log.info(`[hooks] config_change session=${sessionId}`);
}

/**
 * Log a permission_request event. The event is forwarded to the renderer via
 * sendPayload before this handler runs; this function handles the main-process
 * side-effect (currently: structured logging only).
 */
export function enrichFromPermissionRequest(payload: {
  sessionId: string;
  data?: Record<string, unknown>;
  toolName?: string;
}): void {
  const permissionType = payload.data?.['permissionType'] as string | undefined;
  const toolName = payload.toolName ?? '';
  log.info(
    `[hooks] permission_request session=${payload.sessionId}` +
      ` tool=${toolName || 'unknown'}` +
      ` permissionType=${permissionType ?? 'unknown'}`,
  );
}
