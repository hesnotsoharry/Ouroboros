/**
 * DiffReviewHeaderStats.tsx — Stats display for the diff review header bar.
 *
 * Extracted from DiffReviewPanelSections.tsx (Wave 95 Phase G lint cleanup)
 * to satisfy the ESLint max-lines (300) cap.
 */

import React from 'react';

import type { DiffReviewStats } from './DiffReviewPanelState';

function ReviewStat({
  count,
  color,
  label,
}: {
  count: number;
  color: string;
  label: string;
}): React.ReactElement | null {
  if (count === 0) return null;
  return (
    <span style={{ color, fontSize: '0.75rem' }}>
      {count} {label}
    </span>
  );
}

export function DiffReviewHeaderStats({
  stats,
}: {
  stats: DiffReviewStats;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Diff Review</span>
      <span style={{ color: 'var(--status-success)' }}>+{stats.added}</span>
      <span style={{ color: 'var(--status-error)' }}>-{stats.removed}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        {stats.decidedHunks}/{stats.totalHunks} hunks decided
      </span>
      <ReviewStat count={stats.acceptedHunks} color="var(--status-success)" label="accepted" />
      <ReviewStat count={stats.rejectedHunks} color="var(--status-error)" label="rejected" />
    </div>
  );
}
