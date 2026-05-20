/**
 * CompletionDot.tsx — Wave 99 Phase 4
 *
 * Shared presentational dot for agent-completion indicators on terminal
 * surfaces (dock tabs + inner-rail terminal rows).
 *
 * Renders nothing when status is undefined (no unseen completion).
 * Color tokens: bg-status-success (complete) / bg-status-error (error).
 * No hex values — renderer color rule honored.
 */

import React from 'react';

import type { SessionStatus } from '../../../hooks/useAgentCompletionIndicators';

export interface CompletionDotProps {
  /** Only 'complete' and 'error' render a dot; 'running' and undefined render nothing. */
  status: SessionStatus | undefined;
  /** Optional extra class names for positioning. */
  className?: string;
}

export function CompletionDot({
  status,
  className = '',
}: CompletionDotProps): React.ReactElement | null {
  if (status !== 'complete' && status !== 'error') return null;
  const colorCls = status === 'complete' ? 'bg-status-success' : 'bg-status-error';
  const testId =
    status === 'complete' ? 'terminal-completion-dot-complete' : 'terminal-completion-dot-error';
  return (
    <span
      className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${colorCls} ${className}`}
      aria-label={status === 'complete' ? 'Agent finished' : 'Agent errored'}
      data-testid={testId}
    />
  );
}
