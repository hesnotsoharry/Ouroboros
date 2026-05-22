/**
 * PermissionCard — canon §13 permission card primitive (ADR D4: no AgentMonitor imports).
 * Token contract: zero hardcoded hex. Testid contract: permission-approve / always / deny.
 * Style constants live in ./PermissionCard.styles (keeps this file under the 300-line cap).
 */

import React from 'react';

import type { ApprovalRequest } from '../../../types/electron';
import {
  ACTION_ROW_STYLE,
  ALWAYS_BTN_STYLE,
  APPROVE_BTN_STYLE,
  BADGE_STYLE,
  CARD_BASE_STYLE,
  COMMAND_PREVIEW_STYLE,
  DENY_BTN_STYLE,
  ELAPSED_STYLE,
  HEADER_STYLE,
  PREVIEW_STYLE,
  REASON_INPUT_STYLE,
  REASON_LABEL_STYLE,
  REASON_ROW_STYLE,
  SESSION_LABEL_STYLE,
  SIDEBAR_ACTION_ROW_STYLE,
  SIDEBAR_ACTION_STACK_STYLE,
  SIDEBAR_ALWAYS_BTN_STYLE,
  SIDEBAR_APPROVE_BTN_STYLE,
  SIDEBAR_DENY_BTN_STYLE,
  TITLE_STYLE,
  TOOL_NAME_STYLE,
  WARNING_TILE_STYLE,
} from './PermissionCard.styles';
import { usePermissionRejectFlow } from './usePermissionRejectFlow';

const MAX_PREVIEW_LEN = 80;

function extractCommandPreview(input: Record<string, unknown>): string {
  const salient =
    (input['command'] as string | undefined) ??
    (input['file_path'] as string | undefined) ??
    (input['path'] as string | undefined) ??
    (input['query'] as string | undefined);
  if (salient != null) {
    const str = String(salient);
    return str.length > MAX_PREVIEW_LEN ? str.slice(0, MAX_PREVIEW_LEN) + '…' : str;
  }
  const keys = Object.keys(input);
  if (keys.length === 0) return '(no input)';
  const key = keys[0];
  const snippet = `${key}: ${String(input[key])}`;
  return snippet.length > MAX_PREVIEW_LEN ? snippet.slice(0, MAX_PREVIEW_LEN) + '…' : snippet;
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${Math.max(0, sec)}s`;
  return `${Math.floor(sec / 60)}m ${(sec % 60).toString().padStart(2, '0')}s`;
}

interface CardHeaderProps {
  sessionId: string;
  queuedCount: number;
  elapsedSec: number;
}

function CardHeader({ sessionId, queuedCount, elapsedSec }: CardHeaderProps): React.ReactElement {
  return (
    <div style={HEADER_STYLE}>
      <div style={WARNING_TILE_STYLE} aria-hidden="true">
        ⚠
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={TITLE_STYLE}>Permission required</div>
        <div style={SESSION_LABEL_STYLE} title={sessionId}>
          {sessionId.slice(0, 8)}
        </div>
      </div>
      {queuedCount > 0 && <div style={BADGE_STYLE}>+{queuedCount} queued</div>}
      <div style={ELAPSED_STYLE}>{formatElapsed(elapsedSec)}</div>
    </div>
  );
}

function CommandPreview({ request }: { request: ApprovalRequest }): React.ReactElement {
  const preview = extractCommandPreview(request.toolInput);
  return (
    <div style={PREVIEW_STYLE}>
      <div style={TOOL_NAME_STYLE}>{request.toolName}</div>
      <div style={COMMAND_PREVIEW_STYLE} title={preview}>
        {preview}
      </div>
    </div>
  );
}

interface RejectReasonInputProps {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function RejectReasonInput({
  value,
  onChange,
  onConfirm,
  onCancel,
}: RejectReasonInputProps): React.ReactElement {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') onConfirm();
    else if (e.key === 'Escape') onCancel();
  }
  return (
    <div style={REASON_ROW_STYLE}>
      <label style={REASON_LABEL_STYLE}>Reason (optional)</label>
      <input
        autoFocus
        style={REASON_INPUT_STYLE}
        type="text"
        value={value}
        placeholder="Why are you denying this?"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

interface ActionButtonsProps {
  toolName: string;
  showRejectInput: boolean;
  onApprove: () => void;
  onAlwaysAllow: () => void;
  onDenyClick: () => void;
}

function SidebarSecondaryRow(
  p: Pick<ActionButtonsProps, 'toolName' | 'showRejectInput' | 'onAlwaysAllow' | 'onDenyClick'>,
): React.ReactElement {
  return (
    <div style={SIDEBAR_ACTION_ROW_STYLE}>
      <button
        data-testid="permission-sidebar-always"
        style={SIDEBAR_ALWAYS_BTN_STYLE}
        onClick={p.onAlwaysAllow}
        title={`Always allow ${p.toolName} (A)`}
        type="button"
      >
        Always {p.toolName} (A)
      </button>
      <button
        data-testid="permission-sidebar-deny"
        style={SIDEBAR_DENY_BTN_STYLE}
        onClick={p.onDenyClick}
        title="Deny (N or Esc)"
        type="button"
      >
        {p.showRejectInput ? 'Confirm deny' : 'Deny (N)'}
      </button>
    </div>
  );
}

/** canon §13b sidebar layout: full-width Approve, then Always + Deny side-by-side. */
function SidebarActionButtons({
  toolName,
  showRejectInput,
  onApprove,
  onAlwaysAllow,
  onDenyClick,
}: ActionButtonsProps): React.ReactElement {
  return (
    <div style={SIDEBAR_ACTION_STACK_STYLE}>
      <button
        data-testid="permission-sidebar-approve"
        style={SIDEBAR_APPROVE_BTN_STYLE}
        onClick={onApprove}
        title="Approve (Y or Enter)"
        type="button"
      >
        Approve (Y)
      </button>
      <SidebarSecondaryRow
        toolName={toolName}
        showRejectInput={showRejectInput}
        onAlwaysAllow={onAlwaysAllow}
        onDenyClick={onDenyClick}
      />
    </div>
  );
}

/** canon §13a overlay layout: Approve, Always, Deny side-by-side. */
function OverlayActionButtons({
  toolName,
  showRejectInput,
  onApprove,
  onAlwaysAllow,
  onDenyClick,
}: ActionButtonsProps): React.ReactElement {
  return (
    <div style={ACTION_ROW_STYLE}>
      <button
        data-testid="permission-approve"
        style={APPROVE_BTN_STYLE}
        onClick={onApprove}
        title="Approve (Y or Enter)"
        type="button"
      >
        Approve (Y)
      </button>
      <button
        data-testid="permission-always"
        style={ALWAYS_BTN_STYLE}
        onClick={onAlwaysAllow}
        title={`Always allow ${toolName} (A)`}
        type="button"
      >
        Always {toolName} (A)
      </button>
      <button
        data-testid="permission-deny"
        style={DENY_BTN_STYLE}
        onClick={onDenyClick}
        title="Deny (N or Esc)"
        type="button"
      >
        {showRejectInput ? 'Confirm deny' : 'Deny (N)'}
      </button>
    </div>
  );
}

interface ActionRowProps {
  toolName: string;
  showRejectInput: boolean;
  variant: 'overlay' | 'sidebar';
  onApprove: () => void;
  onAlwaysAllow: () => void;
  onDenyClick: () => void;
}

function ActionRow(props: ActionRowProps): React.ReactElement {
  const { variant, ...rest } = props;
  return variant === 'sidebar' ? (
    <SidebarActionButtons {...rest} />
  ) : (
    <OverlayActionButtons {...rest} />
  );
}

export interface PermissionCardProps {
  request: ApprovalRequest;
  queuedCount: number;
  elapsedSec: number;
  variant?: 'overlay' | 'sidebar';
  onApprove: () => void;
  onAlwaysAllow: () => void;
  onDeny: (reason?: string) => void;
}

export function PermissionCard({
  request,
  queuedCount,
  elapsedSec,
  variant = 'overlay',
  onApprove,
  onAlwaysAllow,
  onDeny,
}: PermissionCardProps): React.ReactElement {
  const {
    showRejectInput,
    rejectReason,
    setRejectReason,
    handleDenyClick,
    handleConfirmReject,
    handleCancelReject,
  } = usePermissionRejectFlow(onDeny);
  return (
    <div style={CARD_BASE_STYLE}>
      <CardHeader sessionId={request.sessionId} queuedCount={queuedCount} elapsedSec={elapsedSec} />
      <CommandPreview request={request} />
      {showRejectInput && (
        <RejectReasonInput
          value={rejectReason}
          onChange={setRejectReason}
          onConfirm={handleConfirmReject}
          onCancel={handleCancelReject}
        />
      )}
      <ActionRow
        toolName={request.toolName}
        showRejectInput={showRejectInput}
        variant={variant}
        onApprove={onApprove}
        onAlwaysAllow={onAlwaysAllow}
        onDenyClick={handleDenyClick}
      />
    </div>
  );
}
