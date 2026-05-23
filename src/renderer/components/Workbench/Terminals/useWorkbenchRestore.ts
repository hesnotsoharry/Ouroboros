/**
 * useWorkbenchRestore — one-shot reader for the canon workbench session store (Wave 9).
 *
 * Reads `canonWorkbenchSessions` from electron-store once on mount and maps the
 * two-frame persisted shape into the spawn-ready form consumed by useWorkbenchTerminals
 * (Phase 2). Returns `isReady: false` until the async read completes.
 *
 * Short-circuits when `persistTerminalSessions` is false — returns `{ isReady: true }`
 * immediately with all cwd/id fields undefined, so Phase 2 spawns at project root.
 *
 * Store boundary: reads from electron-store Store A (config.get) only.
 * Never reads from SQLite Store B (pty:listPersistedSessions). ADR D4.
 */

import { useEffect, useRef, useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';

export interface WorkbenchRestoreState {
  upperCwd?: string;
  lowerCwd?: string;
  resumeSessionId?: string;
  isReady: boolean;
}

function mapPersistedToRestoreState(
  persisted:
    | { upper: { cwd: string; claudeSessionId?: string } | null; lower: { cwd: string } | null }
    | null
    | undefined,
): WorkbenchRestoreState {
  if (!persisted) {
    return { isReady: true };
  }
  return {
    upperCwd: persisted.upper?.cwd,
    lowerCwd: persisted.lower?.cwd,
    resumeSessionId: persisted.upper?.claudeSessionId,
    isReady: true,
  };
}

export function useWorkbenchRestore(): WorkbenchRestoreState {
  const { config } = useConfig();
  const persistEnabled = config?.persistTerminalSessions ?? false;

  const [restoreState, setRestoreState] = useState<WorkbenchRestoreState>({
    isReady: false,
  });

  // One-shot guard — never re-reads after the initial load.
  const hasReadRef = useRef(false);

  useEffect(() => {
    if (hasReadRef.current) return;

    if (!persistEnabled) {
      hasReadRef.current = true;
      setRestoreState({ isReady: true });
      return;
    }

    if (typeof window === 'undefined' || !window.electronAPI?.config?.get) {
      hasReadRef.current = true;
      setRestoreState({ isReady: true });
      return;
    }

    hasReadRef.current = true;

    void window.electronAPI.config
      .get('canonWorkbenchSessions')
      .then((persisted) => {
        setRestoreState(mapPersistedToRestoreState(persisted));
      })
      .catch(() => {
        setRestoreState({ isReady: true });
      });
  }, [persistEnabled]);

  return restoreState;
}
