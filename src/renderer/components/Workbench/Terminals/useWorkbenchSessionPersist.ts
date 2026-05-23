/**
 * useWorkbenchSessionPersist — debounced writer for canon workbench sessions (Wave 9/10).
 *
 * Wave 10: accepts `projectRoot: string | null`. Performs a read-modify-write of
 * the `canonWorkbenchSessions` record, updating only the [projectRoot] slot and
 * preserving all other projects' data. Short-circuits (no timers armed) when
 * projectRoot is null.
 *
 * Legacy-shape guard: if the record on disk has `upper` or `lower` as top-level
 * keys (Wave 9 flat shape), replace with a fresh record carrying only the active
 * project's slot (cold-start per ADR D1).
 *
 * Mirrors the legacy `persistCurrentSessions` cadence (750ms debounce + 30s
 * safety interval). Does NOT block on shutdown. ADR D5.
 *
 * Store boundary: writes to electron-store Store A only (config.set). ADR D5.
 */

import { useEffect, useRef } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import type { CanonWorkbenchSessions, CanonWorkbenchSessionSlot } from '../../../types/electron';

const PERSIST_DEBOUNCE_MS = 750;
const PERSIST_SAFETY_MS = 30_000;

export interface UseWorkbenchSessionPersistArgs {
  projectRoot: string | null;
  upperSessionId: string;
  lowerSessionId: string;
  claudeSessionId: string | null;
}

function hasElectronPtyApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.electronAPI?.pty?.getCwd) &&
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

interface PersistRefs {
  inFlightRef: React.MutableRefObject<boolean>;
  hasPendingRef: React.MutableRefObject<boolean>;
  upperRef: React.MutableRefObject<string>;
  lowerRef: React.MutableRefObject<string>;
  claudeRef: React.MutableRefObject<string | null>;
  projectRootRef: React.MutableRefObject<string | null>;
}

async function buildSlot(
  upperSessionId: string,
  lowerSessionId: string,
  claudeSessionId: string | null,
): Promise<CanonWorkbenchSessionSlot> {
  const [upperCwdResult, lowerCwdResult] = await Promise.all([
    window.electronAPI.pty.getCwd(upperSessionId),
    window.electronAPI.pty.getCwd(lowerSessionId),
  ]);
  const upper =
    upperCwdResult.success && upperCwdResult.cwd
      ? { cwd: upperCwdResult.cwd, ...(claudeSessionId ? { claudeSessionId } : {}) }
      : null;
  const lower = lowerCwdResult.success && lowerCwdResult.cwd ? { cwd: lowerCwdResult.cwd } : null;
  return { upper, lower };
}

async function persist(refs: PersistRefs): Promise<void> {
  const { inFlightRef, hasPendingRef, upperRef, lowerRef, claudeRef, projectRootRef } = refs;
  if (inFlightRef.current) {
    hasPendingRef.current = true;
    return;
  }
  const projectRoot = projectRootRef.current;
  if (!projectRoot) return;

  inFlightRef.current = true;
  try {
    const slot = await buildSlot(upperRef.current, lowerRef.current, claudeRef.current);
    const current = await window.electronAPI.config.get('canonWorkbenchSessions');
    const base: CanonWorkbenchSessions = isLegacyFlatShape(current)
      ? {}
      : ((current as CanonWorkbenchSessions | null) ?? {});
    await window.electronAPI.config.set('canonWorkbenchSessions', { ...base, [projectRoot]: slot });
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
  const { projectRoot, upperSessionId, lowerSessionId, claudeSessionId } = args;
  const { config } = useConfig();
  const persistEnabled = config?.persistTerminalSessions ?? false;

  // Stable refs — values updated each render, objects stable across renders.
  const inFlightRef = useRef(false);
  const hasPendingRef = useRef(false);
  const upperRef = useRef(upperSessionId);
  upperRef.current = upperSessionId;
  const lowerRef = useRef(lowerSessionId);
  lowerRef.current = lowerSessionId;
  const claudeRef = useRef(claudeSessionId);
  claudeRef.current = claudeSessionId;
  const projectRootRef = useRef(projectRoot);
  projectRootRef.current = projectRoot;
  // Stable container object — same identity across renders; inner refs are mutable.
  const refsRef = useRef<PersistRefs>({
    inFlightRef,
    hasPendingRef,
    upperRef,
    lowerRef,
    claudeRef,
    projectRootRef,
  });

  useEffect(() => {
    if (!persistEnabled || !hasElectronPtyApi() || projectRoot === null) return;
    const timer = setTimeout(() => void persist(refsRef.current), PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [persistEnabled, claudeSessionId, projectRoot]);

  useEffect(() => {
    if (!persistEnabled || !hasElectronPtyApi() || projectRoot === null) return;
    const interval = setInterval(() => void persist(refsRef.current), PERSIST_SAFETY_MS);
    return () => clearInterval(interval);
  }, [persistEnabled, projectRoot]);
}
