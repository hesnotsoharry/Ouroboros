/**
 * useProgressSubscriptions.ts — Subscribes to IPC progress events and feeds
 * them into the toast/notification system as progress notifications.
 *
 * Currently handles:
 * - CLAUDE.md generation (claudeMd:statusChange)
 *
 * Wave 100 Phase H: contextLayer:progress subscription removed
 * (ContextLayerAPI cut along with the context-layer module).
 */

import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';

import { useToastContext } from '../contexts/ToastContext';

type ToastCtx = ReturnType<typeof useToastContext>;

function buildClaudeMdSummary(results: Array<{ status: string }>): {
  summary: string;
  type: 'warning' | 'success';
} {
  const created = results.filter((r) => r.status === 'created').length;
  const updated = results.filter((r) => r.status === 'updated').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const parts: string[] = [];
  if (created > 0) parts.push(`${created} created`);
  if (updated > 0) parts.push(`${updated} updated`);
  if (errors > 0) parts.push(`${errors} errors`);
  return {
    summary: parts.length > 0 ? parts.join(', ') : 'No changes',
    type: errors > 0 ? 'warning' : 'success',
  };
}

function useClaudeMdProgress(ctx: ToastCtx): void {
  const idRef = useRef<string | null>(null);
  const { startProgress, updateProgress, completeProgress } = ctx;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => {
    const api = window.electronAPI?.claudeMd;
    if (!api?.onStatusChange) return;
    return api.onStatusChange((status) => {
      handleClaudeMdStatus(status, idRef, ctxRef.current);
    });
  }, [startProgress, updateProgress, completeProgress]);
}

function handleClaudeMdStatus(
  status: {
    running: boolean;
    progress?: { completed: number; total: number };
    currentDir?: string;
    lastRun?: { results?: Array<{ status: string }> };
  },
  idRef: MutableRefObject<string | null>,
  ctx: ToastCtx,
): void {
  if (status.running) {
    if (!idRef.current)
      idRef.current = ctx.startProgress('Generating CLAUDE.md files', {
        total: status.progress?.total ?? 0,
      });
    if (status.progress)
      ctx.updateProgress(idRef.current, {
        completed: status.progress.completed,
        total: status.progress.total,
        currentItem: status.currentDir,
      });
  } else if (idRef.current) {
    const results = status.lastRun?.results;
    if (results) {
      const { summary, type } = buildClaudeMdSummary(results);
      ctx.completeProgress(idRef.current, summary, type);
    } else ctx.completeProgress(idRef.current, 'Completed');
    idRef.current = null;
  }
}

export function useProgressSubscriptions(): void {
  const ctx = useToastContext();
  useClaudeMdProgress(ctx);
}
