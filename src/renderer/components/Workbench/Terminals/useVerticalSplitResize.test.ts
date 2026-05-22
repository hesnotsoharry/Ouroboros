/**
 * Tests for useVerticalSplitResize.
 *
 * Unit: computeSplitRatio pure helper — clamped fraction for all boundary inputs.
 * Integration: CenterPane persist-on-drag-end / restore-on-remount contract.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readSplitRatio, writeSplitRatio } from './CenterPane';
import { computeSplitRatio, useVerticalSplitResize } from './useVerticalSplitResize';

// ── Unit: computeSplitRatio ──────────────────────────────────────────────────

function makeRect(top: number, height: number): DOMRect {
  return {
    top,
    height,
    left: 0,
    right: 0,
    bottom: top + height,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

describe('computeSplitRatio', () => {
  it('returns 0.5 for a pointer exactly at midpoint of a 400px container', () => {
    const rect = makeRect(0, 400);
    expect(computeSplitRatio(200, rect)).toBe(0.5);
  });

  it('returns the clamped minimum (0.15) when pointer is above the container', () => {
    const rect = makeRect(100, 400);
    // clientY=50 → raw = (50-100)/400 = -0.125 → clamped to 0.15
    expect(computeSplitRatio(50, rect)).toBe(0.15);
  });

  it('returns the clamped maximum (0.85) when pointer is below the container', () => {
    const rect = makeRect(0, 400);
    // clientY=500 → raw = 500/400 = 1.25 → clamped to 0.85
    expect(computeSplitRatio(500, rect)).toBe(0.85);
  });

  it('returns the exact fraction when within bounds (top-biased)', () => {
    const rect = makeRect(0, 1000);
    // clientY=200 → raw = 0.2 → within [0.15, 0.85]
    expect(computeSplitRatio(200, rect)).toBe(0.2);
  });

  it('returns the exact fraction when within bounds (bottom-biased)', () => {
    const rect = makeRect(0, 1000);
    // clientY=800 → raw = 0.8 → within [0.15, 0.85]
    expect(computeSplitRatio(800, rect)).toBe(0.8);
  });

  it('clamps at 0.15 exactly on the lower boundary', () => {
    const rect = makeRect(0, 1000);
    expect(computeSplitRatio(150, rect)).toBe(0.15);
  });

  it('clamps at 0.85 exactly on the upper boundary', () => {
    const rect = makeRect(0, 1000);
    expect(computeSplitRatio(850, rect)).toBe(0.85);
  });
});

// ── Integration: persist on drag-end / restore on remount ───────────────────

describe('readSplitRatio', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the persisted ratio when config contains a number', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      config: {
        getAll: vi.fn().mockResolvedValue({ layout: { workbenchTerminalSplit: 0.4 } }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
    };
    const ratio = await readSplitRatio();
    expect(ratio).toBe(0.4);
  });

  it('returns the default 0.62 when the key is absent from config', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      config: {
        getAll: vi.fn().mockResolvedValue({ layout: {} }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
    };
    const ratio = await readSplitRatio();
    expect(ratio).toBe(0.62);
  });

  it('returns the default 0.62 when getAll throws', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      config: {
        getAll: vi.fn().mockRejectedValue(new Error('IPC error')),
        set: vi.fn(),
      },
    };
    const ratio = await readSplitRatio();
    expect(ratio).toBe(0.62);
  });
});

describe('writeSplitRatio', () => {
  beforeEach(() => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      config: {
        getAll: vi.fn().mockResolvedValue({ layout: { canonWorkbench: true } }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls config.set("layout", ...) with the new ratio merged into existing layout', async () => {
    await writeSplitRatio(0.35);
    const configMock = (
      window as unknown as { electronAPI: { config: { set: ReturnType<typeof vi.fn> } } }
    ).electronAPI.config.set;
    expect(configMock).toHaveBeenCalledWith(
      'layout',
      expect.objectContaining({ workbenchTerminalSplit: 0.35, canonWorkbench: true }),
    );
  });

  it('does NOT call config.set when getAll throws (best-effort, no crash)', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      config: {
        getAll: vi.fn().mockRejectedValue(new Error('IPC error')),
        set: vi.fn(),
      },
    };
    await expect(writeSplitRatio(0.5)).resolves.toBeUndefined();
    const configMock = (
      window as unknown as { electronAPI: { config: { set: ReturnType<typeof vi.fn> } } }
    ).electronAPI.config.set;
    expect(configMock).not.toHaveBeenCalled();
  });
});

// ── Integration: useVerticalSplitResize hook — persist fires on drag-end only ─

describe('useVerticalSplitResize — persist on drag-end, not per move', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes onCommit once on pointerup with the final ratio, never on pointermove', () => {
    const containerRef = {
      current: { getBoundingClientRect: () => makeRect(0, 400) },
    } as unknown as React.RefObject<HTMLDivElement>;
    const onCommit = vi.fn();

    const { result } = renderHook(() =>
      useVerticalSplitResize({ initialRatio: 0.62, onCommit, containerRef }),
    );

    const fakeTarget = { setPointerCapture: vi.fn() };
    act(() => {
      result.current.handlePointerDown({
        preventDefault: vi.fn(),
        pointerId: 1,
        target: fakeTarget,
      } as unknown as React.PointerEvent);
    });

    // Simulate three pointermove events
    act(() => {
      document.dispatchEvent(new PointerEvent('pointermove', { clientY: 100, bubbles: true }));
      document.dispatchEvent(new PointerEvent('pointermove', { clientY: 150, bubbles: true }));
      document.dispatchEvent(new PointerEvent('pointermove', { clientY: 200, bubbles: true }));
    });

    // onCommit must NOT have been called yet
    expect(onCommit).not.toHaveBeenCalled();

    // Simulate pointerup — this is where commit fires
    act(() => {
      document.dispatchEvent(new PointerEvent('pointerup', { clientY: 200, bubbles: true }));
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0.5); // 200/400 = 0.5
  });
});

// ── Regression: async config restore must reach the rendered ratio ───────────
// CenterPane seeds initialRatio at the default, then updates it once readSplitRatio
// resolves. useState ignores a changed initial arg on re-render, so the hook must
// sync the late value (when not dragging) or the persisted split is silently lost.
describe('useVerticalSplitResize — late-arriving initialRatio (config restore)', () => {
  it('applies an initialRatio that changes after first render', () => {
    const containerRef = {
      current: { getBoundingClientRect: () => makeRect(0, 400) },
    } as unknown as React.RefObject<HTMLDivElement>;
    const onCommit = vi.fn();

    const { result, rerender } = renderHook(
      ({ initialRatio }) => useVerticalSplitResize({ initialRatio, onCommit, containerRef }),
      { initialProps: { initialRatio: 0.62 } },
    );
    expect(result.current.ratio).toBe(0.62);

    // Async config restore resolves → CenterPane passes the persisted ratio.
    rerender({ initialRatio: 0.4 });
    expect(result.current.ratio).toBe(0.4);
  });
});
