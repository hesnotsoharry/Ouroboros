/**
 * useWorkbenchTerminals — legacy pty session id hook (Wave 2, now id-only).
 *
 * Returns stable { upperSessionId, lowerSessionId } so CenterPane can pass them
 * as fallback sessionId props to the two TerminalShell frames. TerminalShell
 * overrides these with the active tab's id (via useWorkbenchTabsContext) when
 * any tab exists, so the fallback is only used in the rare empty-tab edge case.
 *
 * Wave 2 origin: spawned both ptys here.
 * Wave 9 Phase 2: added restore-gate + resumeMode for auto-resume.
 * Wave 12 Phase 3: tab system (WorkbenchTabsProvider) took over authoritative
 *   spawning; this hook's spawns became orphaned ptys the user never sees.
 * Freeze-fix (2026-05-30): SPAWNING REMOVED from this hook entirely.
 *   WorkbenchTabsProvider is the sole spawn authority. Removing the spawn here
 *   eliminates the double-spawn (one pty per pane from the provider + one orphaned
 *   pty from this hook) and the bogus --resume flag that was passed via
 *   resumeSessionId (resumeMode was set to a pane-id string, not a real Claude
 *   session id → picker appeared on every cold start).
 *
 * The hook still calls useWorkbenchRestore to remain StrictMode-safe (restore is
 * a pure config read) and to preserve the module-dependency graph. Kill-on-unmount
 * is also removed — there are no ptys to kill here. The fallback ids are stable
 * ref values so they do not trigger re-renders.
 *
 * ADR Decision 3: caller-owned ids, no useTerminalSessions array model.
 * ADR Decision 2: workbench-owned, independent sessions.
 */

import { useRef } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { useWorkbenchRestore } from './useWorkbenchRestore';

function makeUpperId(): string {
  return `wb-cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeLowerId(): string {
  return `wb-shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface WorkbenchTerminals {
  upperSessionId: string;
  lowerSessionId: string;
}

export function useWorkbenchTerminals(): WorkbenchTerminals {
  const { projectRoot } = useProject();
  const upperSessionId = useRef<string>(makeUpperId()).current;
  const lowerSessionId = useRef<string>(makeLowerId()).current;

  // Consume useWorkbenchRestore so the module dependency graph stays intact
  // (useWorkbenchRestore is a pure config read — no side effects in calling it).
  useWorkbenchRestore(projectRoot);

  return { upperSessionId, lowerSessionId };
}
