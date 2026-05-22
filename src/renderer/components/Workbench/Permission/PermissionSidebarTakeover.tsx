/**
 * PermissionSidebarTakeover — canon §13b sidebar NOW-panel takeover.
 *
 * Pure presentation wrapper: receives approval state as props from
 * AgentSidebar (which calls useWorkbenchApproval once). Does NOT call
 * useWorkbenchApproval() itself — the hook may only be called once per
 * render tree to avoid registering a second keydown handler (ADR D3).
 *
 * The caller (AgentSidebar) owns the dim: panels 2–5 are wrapped at 0.7
 * opacity by the parent; this component renders at full opacity inside the
 * NOW slot.
 */

import React from 'react';

import type { ApprovalRequest } from '../../../types/electron';
import { PermissionCard } from './PermissionCard';

export interface PermissionSidebarTakeoverProps {
  request: ApprovalRequest;
  queuedCount: number;
  elapsedSec: number;
  onApprove: () => void;
  onAlwaysAllow: () => void;
  onDeny: (reason?: string) => void;
}

export function PermissionSidebarTakeover({
  request,
  queuedCount,
  elapsedSec,
  onApprove,
  onAlwaysAllow,
  onDeny,
}: PermissionSidebarTakeoverProps): React.ReactElement {
  return (
    <div data-testid="permission-sidebar">
      <PermissionCard
        request={request}
        queuedCount={queuedCount}
        elapsedSec={elapsedSec}
        variant="sidebar"
        onApprove={onApprove}
        onAlwaysAllow={onAlwaysAllow}
        onDeny={onDeny}
      />
    </div>
  );
}
