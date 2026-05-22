/**
 * useWorkbenchAgentData.diff.ts — diff-review subscription + FileDiff → MockDiffHunk mapping.
 *
 * Wave 4 Phase 3: subscribe to `diff_review_ready` agent events, fetch the
 * parsed diff via `window.electronAPI.git.diffReview`, and store the result in
 * hook-local state. Returns the latest FileDiff[] and the derived MockDiffHunk
 * for LatestHunk.
 *
 * ADR D3: ephemeral state only — no AgentSession/reducer/SQLite change.
 * ADR D5: piggybacks on enableTerminalDiffReview; subscribes unconditionally,
 *         guards inside the callback (mirrors useDiffReviewTrigger lines 24-43).
 */

import { useEffect, useState } from 'react';

import { useClaudeCliSettings } from '../../hooks/useClaudeCliSettings';
import type { DiffReviewReadyEvent } from '../../types/electron-agent-events';
import type { FileDiff } from '../../types/electron-git';
import type { MockDiffHunk, MockDiffLine } from './workbenchMockData';

// ── FileDiff → MockDiffHunk mapping ─────────────────────────────────────────

/**
 * Maps a raw unified-diff line (with prefix char intact) to a MockDiffLine.
 * `n` is the new-file line number: increments on 'add' and 'ctx', not on 'del'.
 */
function mapRawLine(raw: string, lineCounter: { n: number }): MockDiffLine {
  const prefix = raw[0];
  let type: MockDiffLine['type'];
  if (prefix === '+') {
    type = 'add';
  } else if (prefix === '-') {
    type = 'del';
  } else {
    type = 'ctx';
  }
  const n = lineCounter.n;
  if (type !== 'del') lineCounter.n++;
  return { type, n, text: raw.slice(1) };
}

/**
 * Derives a MockDiffHunk from the first file + first hunk in the FileDiff[].
 * Returns undefined when the array is empty or has no hunks.
 */
export function deriveLatestHunk(files: FileDiff[]): MockDiffHunk | undefined {
  const file = files[0];
  if (!file) return undefined;
  const hunk = file.hunks[0];
  if (!hunk) return undefined;
  const counter = { n: hunk.newStart };
  const lines = hunk.lines.map((raw) => mapRawLine(raw, counter));
  return { file: file.relativePath, startLine: hunk.newStart, lines };
}

// ── Per-file adds/dels computation ──────────────────────────────────────────

export interface FileDiffBadge {
  relativePath: string;
  adds: number;
  dels: number;
}

/**
 * Computes per-file add/del counts from all hunks in a FileDiff.
 * Lines starting with '+' count as adds; '-' count as dels.
 */
function badgeForFile(fd: FileDiff): FileDiffBadge {
  let adds = 0;
  let dels = 0;
  for (const hunk of fd.hunks) {
    for (const line of hunk.lines) {
      if (line[0] === '+') adds++;
      else if (line[0] === '-') dels++;
    }
  }
  return { relativePath: fd.relativePath, adds, dels };
}

/**
 * Builds a lookup map from relativePath → FileDiffBadge for O(1) row enrichment.
 */
export function buildBadgeMap(files: FileDiff[]): Map<string, FileDiffBadge> {
  const map = new Map<string, FileDiffBadge>();
  for (const fd of files) {
    map.set(fd.relativePath, badgeForFile(fd));
  }
  return map;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface DiffState {
  latestFiles: FileDiff[];
}

/**
 * useDiffReviewState — subscribes to `diff_review_ready` agent events and
 * fetches the parsed FileDiff[] on each event (guarded by enableTerminalDiffReview).
 *
 * Subscribe unconditionally; guard INSIDE the callback (ADR D5 / useDiffReviewTrigger pattern).
 * Single subscription; cleanup is symmetric (StrictMode-safe).
 */
export function useDiffReviewState(): DiffState {
  const [latestFiles, setLatestFiles] = useState<FileDiff[]>([]);
  const { enableTerminalDiffReview } = useClaudeCliSettings();

  useEffect(() => {
    if (!window.electronAPI?.hooks?.onAgentEvent) return;

    return window.electronAPI.hooks.onAgentEvent((raw: unknown) => {
      const e = raw as Partial<DiffReviewReadyEvent>;
      if (e.type !== 'diff_review_ready') return;
      if (!enableTerminalDiffReview) return;
      if (!e.projectRoot || !e.snapshotHash) return;

      void window.electronAPI.git
        .diffReview(e.projectRoot, e.snapshotHash, e.filePaths)
        .then((result) => {
          if (result.success && result.files) {
            setLatestFiles(result.files);
          }
        });
    });
  }, [enableTerminalDiffReview]);

  return { latestFiles };
}
