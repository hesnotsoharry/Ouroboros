/**
 * ProjectStatusDot — corner completion indicator for OuterProjectRail icons.
 * Green for 'complete', red for 'error'. Uses design tokens only (no hex).
 */

import React from 'react';

const STATUS_DOT: Record<'complete' | 'error', string> = {
  complete: 'bg-status-success',
  error: 'bg-status-error',
};

const STATUS_LABEL: Record<'complete' | 'error', string> = {
  complete: 'finished',
  error: 'error',
};

export function ProjectStatusDot({ status }: { status: 'complete' | 'error' }): React.ReactElement {
  return (
    <span
      aria-label={STATUS_LABEL[status]}
      data-testid={`project-status-dot-${status}`}
      className={`absolute right-0.5 top-0.5 h-2 w-2 rounded-full ring-1 ring-surface-panel ${STATUS_DOT[status]}`}
    />
  );
}
