/**
 * agentChatUiHelpers.ts — Agent chat UI helper functions.
 */

import type { ToastType } from './useToast';

export type ToastFn = (
  message: string,
  type?: ToastType,
  options?: Record<string, unknown>,
) => unknown;

interface AgentChatHandlerArgs {
  projectRoot: string | null;
  toast: ToastFn;
}

interface AgentChatStatusHandlerArgs {
  seenStatuses: Set<string>;
  status: unknown;
  toast: ToastFn;
}

// Wave 100: agentChat API removed. These handlers are no-ops.
export function createResumeLatestAgentChatThreadHandler(
  args: AgentChatHandlerArgs,
): EventListener {
  void args;
  return () => { /* no-op: agentChat surface removed in Wave 100 */ };
}

export function createOpenLatestAgentChatDetailsHandler(
  args: AgentChatHandlerArgs,
): EventListener {
  void args;
  return () => { /* no-op: agentChat surface removed in Wave 100 */ };
}

export function handleAgentChatStatusEvent(args: AgentChatStatusHandlerArgs): void {
  const status = args.status;
  if (
    status !== null &&
    typeof status === 'object' &&
    'threadId' in (status as Record<string, unknown>) &&
    'status' in (status as Record<string, unknown>)
  ) {
    const record = status as { threadId: string; status: string };
    const key = `${record.threadId}:${record.status}`;
    if (args.seenStatuses.has(key)) return;
    args.seenStatuses.add(key);

    if (record.status === 'complete') {
      args.toast('Agent chat completed');
    } else if (record.status === 'failed') {
      args.toast('Agent chat failed', 'error');
    }
  }
}
