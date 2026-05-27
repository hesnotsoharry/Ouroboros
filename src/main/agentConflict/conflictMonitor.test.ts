/**
 * conflictMonitor.test.ts — Unit tests for ConflictMonitor.
 *
 * Tests symbol-overlap detection, file-only fallback when graph is cold,
 * debounce correctness, dismiss persistence + reset on new symbol,
 * and cross-root isolation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Stub logger ───────────────────────────────────────────────────────────────
vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// codebaseGraph/graphControllerSupport mock removed in Wave 22 (codebaseGraph deleted)
// isGraphHot and computeSymbols are now always-false/always-[] stubs

import { ConflictMonitor, createConflictMonitor } from './conflictMonitor';

describe('ConflictMonitor — file-only fallback', () => {
  let monitor: ConflictMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = createConflictMonitor();
  });

  afterEach(() => {
    monitor.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('emits warning-severity file-only conflict when graph is cold', async () => {
    const snapshots: unknown[] = [];
    monitor.on('snapshot', (s) => snapshots.push(s));

    monitor.recordEdit('root1', 'sessA', 'src/foo.ts');
    monitor.recordEdit('root1', 'sessB', 'src/foo.ts');

    await vi.runAllTimersAsync();

    expect(snapshots.length).toBeGreaterThan(0);
    const snap = snapshots[snapshots.length - 1] as {
      reports: Array<{ fileOnly: boolean; severity: string }>;
    };
    expect(snap.reports).toHaveLength(1);
    expect(snap.reports[0].fileOnly).toBe(true);
    expect(snap.reports[0].severity).toBe('warning');
  });

  it('no conflict when same session edits the same file', async () => {
    const snapshots: unknown[] = [];
    monitor.on('snapshot', (s) => snapshots.push(s));

    monitor.recordEdit('root1', 'sessA', 'src/foo.ts');
    monitor.recordEdit('root1', 'sessA', 'src/foo.ts');

    await vi.runAllTimersAsync();

    const snap = snapshots[snapshots.length - 1] as { reports: unknown[] } | undefined;
    expect(snap?.reports ?? []).toHaveLength(0);
  });
});

// Symbol-level detection tests removed in Wave 22: codebaseGraph was deleted,
// isGraphHot always returns false and computeSymbols always returns [].
// The monitor now always operates in file-only mode (tests in the file-only
// fallback describe block above cover the surviving behavior).

describe('ConflictMonitor — cross-root isolation', () => {
  let monitor: ConflictMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = createConflictMonitor();
  });

  afterEach(() => {
    monitor.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not report conflict across different project roots', async () => {
    const snapshots: unknown[] = [];
    monitor.on('snapshot', (s) => snapshots.push(s));

    monitor.recordEdit('root1', 'sessA', 'src/foo.ts');
    monitor.recordEdit('root2', 'sessB', 'src/foo.ts');

    await vi.runAllTimersAsync();

    const snap = snapshots[snapshots.length - 1] as { reports: unknown[] } | undefined;
    expect(snap?.reports ?? []).toHaveLength(0);
  });
});

describe('ConflictMonitor — dismiss', () => {
  let monitor: ConflictMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = createConflictMonitor();
  });

  afterEach(() => {
    monitor.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('suppresses reports after dismiss', async () => {
    const snapshots: unknown[] = [];
    monitor.on('snapshot', (s) => snapshots.push(s));

    monitor.recordEdit('root1', 'sessA', 'src/foo.ts');
    monitor.recordEdit('root1', 'sessB', 'src/foo.ts');
    await vi.runAllTimersAsync();

    monitor.dismiss('sessA', 'sessB');

    snapshots.length = 0;
    monitor.recordEdit('root1', 'sessA', 'src/bar.ts');
    await vi.runAllTimersAsync();

    const snap = snapshots[snapshots.length - 1] as { reports: unknown[] } | undefined;
    expect(snap?.reports ?? []).toHaveLength(0);
  });

  it('re-shows report when a new overlapping file is touched after dismiss', async () => {
    const snapshots: unknown[] = [];
    monitor.on('snapshot', (s) => snapshots.push(s));

    monitor.recordEdit('root1', 'sessA', 'src/foo.ts');
    monitor.recordEdit('root1', 'sessB', 'src/foo.ts');
    await vi.runAllTimersAsync();

    monitor.dismiss('sessA', 'sessB');

    // Touch a NEW file that overlaps with sessB
    monitor.recordEdit('root1', 'sessA', 'src/baz.ts');
    monitor.recordEdit('root1', 'sessB', 'src/baz.ts');
    await vi.runAllTimersAsync();

    const snap = snapshots[snapshots.length - 1] as { reports: unknown[] };
    // Dismiss should be cleared because both sides touched a new overlapping file
    expect(snap.reports.length).toBeGreaterThan(0);
  });
});

describe('ConflictMonitor — debounce', () => {
  it('does not fire before debounce window elapses', async () => {
    vi.useFakeTimers();

    const monitor = createConflictMonitor();
    const snapshots: unknown[] = [];
    monitor.on('snapshot', (s) => snapshots.push(s));

    monitor.recordEdit('root1', 'sessA', 'src/foo.ts');
    monitor.recordEdit('root1', 'sessB', 'src/foo.ts');

    // Advance only 100ms — still within 200ms debounce
    await vi.advanceTimersByTimeAsync(100);
    expect(snapshots).toHaveLength(0);

    // Now advance past the debounce
    await vi.advanceTimersByTimeAsync(200);
    expect(snapshots.length).toBeGreaterThan(0);

    monitor.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });
});
