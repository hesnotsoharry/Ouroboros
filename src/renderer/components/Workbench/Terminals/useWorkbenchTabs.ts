/**
 * useWorkbenchTabs — thin wrapper over WorkbenchTabsProvider context (bug fix).
 *
 * Previously owned the full tab state machine per call site, causing a
 * dual-instance state split when called from both TerminalShell and AgentSidebar.
 * The state machine has moved into WorkbenchTabsProvider (ONE instance per project).
 * This wrapper delegates to useWorkbenchTabsContext so existing call sites and
 * vi.mock('./useWorkbenchTabs') test stubs continue to work without change.
 *
 * The `projectRoot` parameter is now unused — the provider owns project isolation
 * via its own key-based remount. It is kept in the signature for backward compat
 * with existing call sites and test mocks.
 *
 * @deprecated Pass - callers should migrate to useWorkbenchTabsContext(frame)
 * directly when convenient; the thin wrapper will be removed in a future cleanup.
 */

import type { TabCollection, TabState } from '../../../types/electron';
import { useWorkbenchTabsContext, type UseWorkbenchTabsResult } from './WorkbenchTabsProvider';

// Re-export types that external consumers (tests, TerminalShell, AgentSidebar)
// currently import from this module. Keeping them here avoids cascading import
// updates across every consumer.
export type { TabCollection, TabState, UseWorkbenchTabsResult };

/**
 * buildSpawnEnv — constructs the env object injected into every pty spawn for
 * OUROBOROS_PANE_ID round-trip binding (Wave 13 D6).
 *
 * Kept here because external PTY spawn consumers import it from this module.
 */
export const buildSpawnEnv = (tabId: string): { OUROBOROS_PANE_ID: string } => ({
  OUROBOROS_PANE_ID: tabId,
});

/**
 * Thin wrapper — delegates to the shared WorkbenchTabsProvider context.
 * `projectRoot` is ignored; the provider owns it.
 */
export function useWorkbenchTabs(
  frame: 'upper' | 'lower',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  projectRoot: string | null,
): UseWorkbenchTabsResult {
  return useWorkbenchTabsContext(frame);
}
