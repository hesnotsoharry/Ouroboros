/**
 * useWorkbenchSessionPersist — debounced writer for canon workbench sessions (Wave 12).
 *
 * Wave 12: accepts `{ frame, projectRoot, tabCollection }` and performs a
 * read-modify-write of the `canonWorkbenchSessions` record, updating the
 * [projectRoot].upper or [projectRoot].lower slot to the provided TabCollection
 * while preserving all other projects' data and the other frame's data.
 *
 * Short-circuits (no timers armed) when projectRoot is null.
 *
 * Legacy-shape guard: if the record on disk has `upper` or `lower` as top-level
 * keys (Wave 9 flat shape), replace with a fresh record (cold-start per ADR D1).
 *
 * Mirrors the legacy `persistCurrentSessions` cadence (750ms debounce + 30s
 * safety interval). Does NOT block on shutdown. ADR D5.
 *
 * Store boundary: writes to electron-store Store A only (config.set). ADR D5.
 */

import { useEffect, useRef } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import type { CanonWorkbenchSessions, TabCollection } from '../../../types/electron';

const PERSIST_DEBOUNCE_MS = 750;
const PERSIST_SAFETY_MS = 30_000;

export interface UseWorkbenchSessionPersistArgs {
  frame: 'upper' | 'lower';
  projectRoot: string | null;
  tabCollection: TabCollection | null;
}

function hasElectronConfigApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.electronAPI?.config?.set) &&
    Boolean(window.electronAPI?.config?.get)
  );
}

/** Returns true when the value looks like the Wave 9 legacy flat { upper, lower } shape. */
function isLegacyFlatShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'upper' in obj || 'lower' in obj;
}

const EMPTY_COLLECTION: TabCollection = { activeTabId: null, tabs: [] };

interface PersistRefs {
  inFlightRef: React.MutableRefObject<boolean>;
  hasPendingRef: React.MutableRefObject<boolean>;
  frameRef: React.MutableRefObject<'upper' | 'lower'>;
  projectRootRef: React.MutableRefObject<string | null>;
  tabCollectionRef: React.MutableRefObject<TabCollection | null>;
}

function resolveBase(current: unknown): CanonWorkbenchSessions {
  return isLegacyFlatShape(current) ? {} : ((current as CanonWorkbenchSessions | null) ?? {});
}

function resolveOtherCollection(
  base: CanonWorkbenchSessions,
  projectRoot: string,
  otherFrame: 'upper' | 'lower',
): TabCollection {
  const existingSlot = base[projectRoot];
  if (existingSlot && typeof existingSlot === 'object' && !Array.isArray(existingSlot)) {
    return existingSlot[otherFrame] ?? EMPTY_COLLECTION;
  }
  return EMPTY_COLLECTION;
}

async function writeSlot(
  projectRoot: string,
  frame: 'upper' | 'lower',
  tabCollection: TabCollection,
): Promise<void> {
  const current = await window.electronAPI.config.get('canonWorkbenchSessions');
  const base = resolveBase(current);
  const otherFrame = frame === 'upper' ? 'lower' : 'upper';
  const otherCollection = resolveOtherCollection(base, projectRoot, otherFrame);
  const newSlot =
    frame === 'upper'
      ? { upper: tabCollection, lower: otherCollection }
      : { upper: otherCollection, lower: tabCollection };
  await window.electronAPI.config.set('canonWorkbenchSessions', {
    ...base,
    [projectRoot]: newSlot,
  });
}

async function persist(refs: PersistRefs): Promise<void> {
  const { inFlightRef, hasPendingRef, frameRef, projectRootRef, tabCollectionRef } = refs;
  if (inFlightRef.current) {
    hasPendingRef.current = true;
    return;
  }
  const projectRoot = projectRootRef.current;
  const tabCollection = tabCollectionRef.current;
  if (!projectRoot || !tabCollection) return;

  inFlightRef.current = true;
  try {
    await writeSlot(projectRoot, frameRef.current, tabCollection);
  } catch {
    // Persist failures are non-fatal — next debounce or safety tick will retry.
  } finally {
    inFlightRef.current = false;
    if (hasPendingRef.current) {
      hasPendingRef.current = false;
      void persist(refs);
    }
  }
}

export function useWorkbenchSessionPersist(args: UseWorkbenchSessionPersistArgs): void {
  const { frame, projectRoot, tabCollection } = args;
  const { config } = useConfig();
  const persistEnabled = config?.persistTerminalSessions ?? false;

  // Stable refs — values updated each render, objects stable across renders.
  const inFlightRef = useRef(false);
  const hasPendingRef = useRef(false);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const projectRootRef = useRef(projectRoot);
  projectRootRef.current = projectRoot;
  const tabCollectionRef = useRef(tabCollection);
  tabCollectionRef.current = tabCollection;

  // Stable container object — same identity across renders; inner refs are mutable.
  const refsRef = useRef<PersistRefs>({
    inFlightRef,
    hasPendingRef,
    frameRef,
    projectRootRef,
    tabCollectionRef,
  });

  // Debounced write on tabCollection or projectRoot change.
  useEffect(() => {
    if (!persistEnabled || !hasElectronConfigApi() || projectRoot === null || !tabCollection) {
      return;
    }
    const timer = setTimeout(() => void persist(refsRef.current), PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [persistEnabled, projectRoot, tabCollection]);

  // Safety interval — ensures a write lands even if changes stop arriving.
  useEffect(() => {
    if (!persistEnabled || !hasElectronConfigApi() || projectRoot === null) return;
    const interval = setInterval(() => void persist(refsRef.current), PERSIST_SAFETY_MS);
    return () => clearInterval(interval);
  }, [persistEnabled, projectRoot]);
}
