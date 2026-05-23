/**
 * useWorkbenchSessionPersist — debounced writer for canon workbench sessions (Wave 9).
 *
 * Mirrors the legacy `persistCurrentSessions` cadence (750ms debounce + 30s safety
 * interval) from useTerminalSessions.sync.ts, scoped to the canon shell's two fixed
 * frames. Writes `canonWorkbenchSessions` to electron-store Store A on every relevant
 * change (claudeSessionId capture, cwd change, periodic safety tick).
 *
 * Short-circuits when `persistTerminalSessions` is false — no getCwd, no config.set.
 * Does NOT block on shutdown; same constraint as the legacy writer (ADR D5).
 *
 * Store boundary: writes to electron-store Store A only (config.set). ADR D5.
 */

import type { CanonWorkbenchSessions } from '@main/configTypes';
import { useEffect, useRef } from 'react';

import { useConfig } from '../../../hooks/useConfig';

const PERSIST_DEBOUNCE_MS = 750;
const PERSIST_SAFETY_MS = 30_000;

export interface UseWorkbenchSessionPersistArgs {
  upperSessionId: string;
  lowerSessionId: string;
  claudeSessionId: string | null;
}

function hasElectronPtyApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.electronAPI?.pty?.getCwd) &&
    Boolean(window.electronAPI?.config?.set)
  );
}

interface PersistRefs {
  inFlightRef: React.MutableRefObject<boolean>;
  hasPendingRef: React.MutableRefObject<boolean>;
  upperRef: React.MutableRefObject<string>;
  lowerRef: React.MutableRefObject<string>;
  claudeRef: React.MutableRefObject<string | null>;
}

async function buildPayload(
  upperSessionId: string,
  lowerSessionId: string,
  claudeSessionId: string | null,
): Promise<CanonWorkbenchSessions> {
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
  const { inFlightRef, hasPendingRef, upperRef, lowerRef, claudeRef } = refs;
  if (inFlightRef.current) {
    hasPendingRef.current = true;
    return;
  }
  inFlightRef.current = true;
  try {
    const payload = await buildPayload(upperRef.current, lowerRef.current, claudeRef.current);
    await window.electronAPI.config.set('canonWorkbenchSessions', payload);
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
  const { upperSessionId, lowerSessionId, claudeSessionId } = args;
  const { config } = useConfig();
  const persistEnabled = config?.persistTerminalSessions ?? false;

  const inFlightRef = useRef(false);
  const hasPendingRef = useRef(false);

  // Stable refs so effect closures see latest values without re-subscribing.
  const upperRef = useRef(upperSessionId);
  upperRef.current = upperSessionId;
  const lowerRef = useRef(lowerSessionId);
  lowerRef.current = lowerSessionId;
  const claudeRef = useRef(claudeSessionId);
  claudeRef.current = claudeSessionId;

  // Debounced write — fires 750ms after claudeSessionId changes.
  useEffect(() => {
    if (!persistEnabled || !hasElectronPtyApi()) return;
    const refs: PersistRefs = { inFlightRef, hasPendingRef, upperRef, lowerRef, claudeRef };
    const timer = setTimeout(() => {
      void persist(refs);
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [persistEnabled, claudeSessionId]);

  // Safety interval — fires every 30s even without claudeSessionId changes.
  useEffect(() => {
    if (!persistEnabled || !hasElectronPtyApi()) return;
    const refs: PersistRefs = { inFlightRef, hasPendingRef, upperRef, lowerRef, claudeRef };
    const interval = setInterval(() => {
      void persist(refs);
    }, PERSIST_SAFETY_MS);
    return () => clearInterval(interval);
  }, [persistEnabled]);
}
