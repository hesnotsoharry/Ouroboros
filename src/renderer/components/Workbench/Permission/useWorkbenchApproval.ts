/**
 * useWorkbenchApproval — selector hook wrapping useApprovalContext().
 *
 * Selects the current request (requests[0]), computes derived state, and binds
 * the three resolvers to the current request's identifiers. Owns the ONLY
 * keydown handler for the workbench permission UI (ADR D3) — registered once
 * via window-level listener, active only while a request is pending.
 *
 * Presentation components must NOT bind their own keydown listeners.
 */

import { useCallback, useEffect } from 'react';

import { useApprovalContext } from '../../../contexts/ApprovalContext';
import type { ApprovalRequest } from '../../../types/electron';

export interface WorkbenchApprovalState {
  current: ApprovalRequest | null;
  pendingCount: number;
  queuedCount: number;
  elapsedSec: number;
  approve: () => void;
  deny: (reason?: string) => void;
  alwaysAllow: () => void;
}

function computeElapsedSec(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / 1000);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

/**
 * Registers the single window-level keydown handler for the current request.
 * Returns the cleanup function for useEffect.
 */
function makeKeyHandler(
  current: import('../../../types/electron').ApprovalRequest | null,
  onApprove: () => void,
  onAlwaysAllow: () => void,
  onDeny: () => void,
): (() => void) | undefined {
  if (!current) return undefined;

  function onKeyDown(event: KeyboardEvent): void {
    if (isEditableTarget(event.target)) return;
    const { key } = event;
    if (key === 'y' || key === 'Y' || key === 'Enter') {
      onApprove();
    } else if (key === 'a' || key === 'A') {
      onAlwaysAllow();
    } else if (key === 'n' || key === 'N' || key === 'Escape') {
      onDeny();
    }
  }

  window.addEventListener('keydown', onKeyDown);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
  };
}

export function useWorkbenchApproval(): WorkbenchApprovalState {
  const ctx = useApprovalContext();
  const { pendingCount, requests, approve, reject, alwaysAllow } = ctx;

  const current = requests.length > 0 ? requests[0] : null;
  const queuedCount = Math.max(0, pendingCount - 1);
  const elapsedSec = current ? computeElapsedSec(current.timestamp) : 0;

  const handleApprove = useCallback(() => {
    if (!current) return;
    approve(current.requestId);
  }, [current, approve]);

  const handleDeny = useCallback(
    (reason?: string) => {
      if (!current) return;
      reject(current.requestId, reason);
    },
    [current, reject],
  );

  const handleAlwaysAllow = useCallback(() => {
    if (!current) return;
    alwaysAllow(current.requestId, current.sessionId, current.toolName);
  }, [current, alwaysAllow]);

  useEffect(
    () => makeKeyHandler(current, handleApprove, handleAlwaysAllow, handleDeny),
    [current, handleApprove, handleDeny, handleAlwaysAllow],
  );

  return {
    current,
    pendingCount,
    queuedCount,
    elapsedSec,
    approve: handleApprove,
    deny: handleDeny,
    alwaysAllow: handleAlwaysAllow,
  };
}
