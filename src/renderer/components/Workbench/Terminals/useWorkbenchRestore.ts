/**
 * useWorkbenchRestore — one-shot reader for the canon workbench session store (Wave 9/10/12).
 *
 * Wave 12: also returns `upperCollection` and `lowerCollection` (TabCollection)
 * when the persisted value has the Wave-12 shape. The Wave-9 fields
 * (`upperCwd`, `lowerCwd`, `resumeSessionId`) are preserved for backward
 * compat with `useWorkbenchTerminals` (Wave-9 acceptance test must stay GREEN).
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
import type {
  CanonWorkbenchSessions,
  CanonWorkbenchSessionSlot,
  TabCollection,
} from '../../../types/electron';

export interface WorkbenchRestoreState {
  /** Wave-9 compat fields — derived from upper tab sessionId / tab cwds when available. */
  upperCwd?: string;
  lowerCwd?: string;
  resumeSessionId?: string;
  /** Wave-12 fields — full TabCollection per frame. */
  upperCollection?: TabCollection;
  lowerCollection?: TabCollection;
  isReady: boolean;
}

/** Returns true when the value looks like Wave 9's legacy flat { upper, lower } shape. */
function isLegacyFlatShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'upper' in obj || 'lower' in obj;
}

/** Returns true when a slot has the Wave-12 TabCollection shape (has `tabs` array). */
function isWave12Slot(slot: unknown): slot is CanonWorkbenchSessionSlot {
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return false;
  const s = slot as Record<string, unknown>;
  return (
    'upper' in s &&
    'lower' in s &&
    typeof s.upper === 'object' &&
    s.upper !== null &&
    'tabs' in (s.upper as Record<string, unknown>)
  );
}

function mapSlotToRestoreState(
  slot: CanonWorkbenchSessionSlot | null | undefined,
): WorkbenchRestoreState {
  if (!slot) return { isReady: true };

  const upper = slot.upper;
  const lower = slot.lower;

  // Wave-12 shape: derive Wave-9 compat fields from the active CC tab.
  const activeCcTab =
    upper.tabs.find((t) => t.kind === 'cc' && t.id === upper.activeTabId) ??
    upper.tabs.find((t) => t.kind === 'cc');

  return {
    upperCollection: upper,
    lowerCollection: lower,
    // Wave-9 compat: upperCwd and lowerCwd from first tab sessionId (no cwd stored in tabs).
    // resumeSessionId from the active CC tab's sessionId.
    resumeSessionId: activeCcTab?.sessionId,
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
      const slot = record?.[projectRoot];
      // Wave-12 shape: has `tabs` on upper. Wave-10 shape: has `cwd` on upper (cleared by
      // preflight before app starts, but guard here for safety).
      if (slot && isWave12Slot(slot)) {
        setRestoreState(mapSlotToRestoreState(slot));
      } else {
        setRestoreState({ isReady: true });
      }
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
