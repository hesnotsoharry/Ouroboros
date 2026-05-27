/**
 * useDashboardData — fetches global cost rollup and per-thread breakdowns.
 *
 * Manages time-range state, IPC calls, and loading/error tracking
 * for the UsageDashboard panel.
 */

import type { GlobalCostRollupRecord, ThreadCostRollupRecord } from '@shared/types/agentChatResults';
import { useCallback, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimeRangeKey = '7d' | '30d' | 'all';

export interface DashboardData {
  rollup: GlobalCostRollupRecord | null;
  threads: ThreadCostRollupRecord[];
  loading: boolean;
  error: string | null;
  timeRange: TimeRangeKey;
  setTimeRange: (range: TimeRangeKey) => void;
  refresh: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardData(): DashboardData {
  // Wave 100: agentChat API removed. UsageDashboard data source is gone.
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('all');
  const refresh = useCallback(() => { /* no-op: data source removed */ }, []);
  return {
    rollup: null,
    threads: [],
    loading: false,
    error: 'Usage data unavailable — chat surface removed.',
    timeRange,
    setTimeRange,
    refresh,
  };
}
