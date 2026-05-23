/**
 * useWorkbenchRestore — one-shot reader for the canon workbench session store (Wave 9/10).
 *
 * Wave 10: accepts `projectRoot: string | null`. Reads `canonWorkbenchSessions`
 * (a Record keyed by project root) and returns the slice under [projectRoot].
 *
 * Short-circuits (returns `{ isReady: true }` immediately, no config.get) when:
 *   - projectRoot is null
 *   - persistTerminalSessions is false
 *
 * Legacy-shape guard: if the persisted value has `upper` or `lower` as top-level
 * keys, it is the Wave 9 flat shape — treat as cold-start per ADR D1.
 *
 * Store boundary: reads from electron-store Store A (config.get) only. ADR D4.
 */

import { useEffect, useRef, useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import type { CanonWorkbenchSessions, CanonWorkbenchSessionSlot } from '../../../types/electron';

export interface WorkbenchRestoreState {
  upperCwd?: string;
  lowerCwd?: string;
  resumeSessionId?: string;
  isReady: boolean;
}

/** Returns true when the value looks like Wave 9's legacy flat { upper, lower } shape. */
function isLegacyFlatShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'upper' in obj || 'lower' in obj;
}

function mapSlotToRestoreState(
  slot: CanonWorkbenchSessionSlot | null | undefined,
): WorkbenchRestoreState {
  if (!slot) return { isReady: true };
  return {
    upperCwd: slot.upper?.cwd,
    lowerCwd: slot.lower?.cwd,
    resumeSessionId: slot.upper?.claudeSessionId,
    isReady: true,
  };
}

function resolveFromStore(
  projectRoot: string,
  setRestoreState: (s: WorkbenchRestoreState) => void,
): void {
  void window.electronAPI.config
    .get('canonWorkbenchSessions')
    .then((persisted) => {
      if (isLegacyFlatShape(persisted)) {
        setRestoreState({ isReady: true });
        return;
      }
      const record = persisted as CanonWorkbenchSessions | null | undefined;
      setRestoreState(mapSlotToRestoreState(record?.[projectRoot]));
    })
    .catch(() => {
      setRestoreState({ isReady: true });
    });
}

export function useWorkbenchRestore(projectRoot: string | null): WorkbenchRestoreState {
  const { config } = useConfig();
  const persistEnabled = config?.persistTerminalSessions ?? false;

  const [restoreState, setRestoreState] = useState<WorkbenchRestoreState>({ isReady: false });

  // One-shot guard — never re-reads after the initial load.
  const hasReadRef = useRef(false);

  useEffect(() => {
    if (hasReadRef.current) return;
    hasReadRef.current = true;

    if (projectRoot === null || !persistEnabled) {
      setRestoreState({ isReady: true });
      return;
    }

    if (typeof window === 'undefined' || !window.electronAPI?.config?.get) {
      setRestoreState({ isReady: true });
      return;
    }

    resolveFromStore(projectRoot, setRestoreState);
  }, [persistEnabled, projectRoot]);

  return restoreState;
}
