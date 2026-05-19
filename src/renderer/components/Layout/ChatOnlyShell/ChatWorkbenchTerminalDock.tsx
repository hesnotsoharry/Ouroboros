/**
 * ChatWorkbenchTerminalDock — Wave 89 Phase 1 refactor.
 * Wave 89 Phase 4c: per-slot collapse affordance; dock-wide close button removed.
 *
 * Two-slot stacked dock replacing the single-terminal dock from Wave 46/88.
 * - Top slot ('primary'): Wave 90 home for interactive claude; generic terminal here.
 * - Bottom slot ('secondary'): dev shell.
 * - Sibling-resizable horizontal divider between slots (useDockSlotHeights).
 * - Dock-as-whole still resizes against the body top edge via the existing
 *   fixed-edge useResizable mode (unchanged from Wave 88).
 * - Both slot heights persist via dockPersistenceSchema's terminalDockSlots key.
 * - Per-slot collapsed state persists via terminalDockSlotsCollapsed key.
 *
 * Phase 4c: onClose prop removed — dock is permanent in terminal-first mode.
 * DockHeader and DockCloseButton removed; per-slot ▾/▴ buttons replace them.
 * When a slot is collapsed the divider is a no-op (collapsed slot height = 28px,
 * sibling fills remainder via computeSlotDisplayHeights).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useProjectTerminalsContext } from '../../../contexts/ProjectTerminalsContext';
import { useResizable } from '../useResizable';
import { DockSlot } from './DockSlot';
import { computeSlotDisplayHeights, useDockSlotHeights } from './useDockSlotHeights';

// ---------------------------------------------------------------------------
// useSectionHeight — ResizeObserver that tracks the dock section's rendered px
// height. Returns 0 until the first measurement; computeSlotDisplayHeights
// treats 0 as "pre-measurement" and returns raw stored heights unchanged.
// ---------------------------------------------------------------------------

function useSectionHeight(ref: React.RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return; // jsdom / SSR — leave at 0, parent falls back to persisted heights
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeight(Math.round(entry.contentRect.height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

// ---------------------------------------------------------------------------
// Legacy migration (pre-Wave-88 localStorage key — kept from Wave 88)
// ---------------------------------------------------------------------------

const LEGACY_DOCK_STORAGE_KEY = 'agent-ide:chat-workbench-terminal-dock';
const TERMINAL_DEFAULT_SIZE = 280;
const TERMINAL_MIN_SIZE = 120;
const TERMINAL_MAX_SIZE = 600;

function runLegacyDockHeightMigration(
  currentSizes: ReturnType<typeof useResizable>['sizes'],
  applySizes: ReturnType<typeof useResizable>['applySizes'],
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(LEGACY_DOCK_STORAGE_KEY);
    if (!raw) return;
    window.localStorage.removeItem(LEGACY_DOCK_STORAGE_KEY);
    const parsed = JSON.parse(raw) as { height?: unknown };
    const legacyHeight = parsed.height;
    if (
      typeof legacyHeight === 'number' &&
      Number.isFinite(legacyHeight) &&
      legacyHeight >= TERMINAL_MIN_SIZE &&
      legacyHeight <= TERMINAL_MAX_SIZE &&
      currentSizes.terminal === TERMINAL_DEFAULT_SIZE
    ) {
      applySizes({ ...currentSizes, terminal: legacyHeight });
    }
  } catch {
    try {
      window.localStorage.removeItem(LEGACY_DOCK_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Slot divider (sibling resize between primary and secondary)
// ---------------------------------------------------------------------------

function SlotDivider({
  onPointerDown,
}: {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}): React.ReactElement {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize between terminal slots"
      className="h-1 shrink-0 cursor-ns-resize bg-transparent transition-colors hover:bg-interactive-accent"
      onPointerDown={onPointerDown}
      data-testid="dock-slot-divider"
    />
  );
}

// ---------------------------------------------------------------------------
// Active session tracking (for tool bridge routing)
// ---------------------------------------------------------------------------

function useActiveSlotSession(): {
  primarySessionId: string | null;
  secondarySessionId: string | null;
  onPrimarySessionChange: (id: string | null) => void;
  onSecondarySessionChange: (id: string | null) => void;
} {
  const [primarySessionId, setPrimarySessionId] = useState<string | null>(null);
  const [secondarySessionId, setSecondarySessionId] = useState<string | null>(null);
  const onPrimarySessionChange = useCallback((id: string | null) => {
    setPrimarySessionId(id);
  }, []);
  const onSecondarySessionChange = useCallback((id: string | null) => {
    setSecondarySessionId(id);
  }, []);
  return { primarySessionId, secondarySessionId, onPrimarySessionChange, onSecondarySessionChange };
}

// ---------------------------------------------------------------------------
// Public component props
// ---------------------------------------------------------------------------

export interface ChatWorkbenchTerminalDockProps {
  /** Called whenever the active dock session changes (for tool bridge). */
  onActiveSessionChange?: (sessionId: string | null) => void;
}

// ---------------------------------------------------------------------------
// useSecondarySlotVisible — derives whether the secondary slot should render.
// Reads secondary session count from context (avoids prop-drilling).
// ---------------------------------------------------------------------------

/**
 * Secondary slot is visible when it has at least one session (even if collapsed)
 * OR when it is not collapsed (user explicitly expanded an empty slot).
 * When collapsed AND empty the slot renders at 0px — fully hidden.
 */
export function useSecondarySlotVisible(secondaryCollapsed: boolean): boolean {
  const terminals = useProjectTerminalsContext();
  const hasSessions = terminals.secondary.sessions.length > 0;
  return !secondaryCollapsed || hasSessions;
}

// ---------------------------------------------------------------------------
// useDockState — all hook wiring extracted so ChatWorkbenchTerminalDock ≤40 lines
//
// Wave 89 Phase 4b: DockResizeHandle removed (no chat sibling to resize against;
// the dock now fills the full main area via flex-1). sizes / startResize /
// handleDockResizePointerDown are no longer needed here.
// Wave 89 Phase 4c: slotsCollapsed + toggleSlotCollapsed added.
// ---------------------------------------------------------------------------

interface DockState {
  primaryHeight: number;
  secondaryHeight: number;
  primaryCollapsed: boolean;
  secondaryCollapsed: boolean;
  sectionRef: React.RefObject<HTMLElement | null>;
  measuredHeight: number;
  handleDividerPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPrimarySessionChange: (id: string | null) => void;
  onSecondarySessionChange: (id: string | null) => void;
  togglePrimaryCollapsed: () => void;
  toggleSecondaryCollapsed: () => void;
}

// Extracted to keep useDockState under 40 lines.
function useCollapseToggles(toggleSlotCollapsed: (slot: 'primary' | 'secondary') => void): {
  togglePrimaryCollapsed: () => void;
  toggleSecondaryCollapsed: () => void;
} {
  const togglePrimaryCollapsed = useCallback(
    () => toggleSlotCollapsed('primary'),
    [toggleSlotCollapsed],
  );
  const toggleSecondaryCollapsed = useCallback(
    () => toggleSlotCollapsed('secondary'),
    [toggleSlotCollapsed],
  );
  return { togglePrimaryCollapsed, toggleSecondaryCollapsed };
}

function useDockState(onActiveSessionChange?: (id: string | null) => void): DockState {
  const { sizes, startSiblingResize, applySizes } = useResizable();
  const { slotHeights, slotsCollapsed, toggleSlotCollapsed, buildSiblingOpts } =
    useDockSlotHeights();
  const { primarySessionId, secondarySessionId, onPrimarySessionChange, onSecondarySessionChange } =
    useActiveSlotSession();
  const { togglePrimaryCollapsed, toggleSecondaryCollapsed } =
    useCollapseToggles(toggleSlotCollapsed);
  const sectionRef = useRef<HTMLElement | null>(null);
  const measuredHeight = useSectionHeight(sectionRef);
  useEffect(() => {
    onActiveSessionChange?.(primarySessionId ?? secondarySessionId);
  }, [primarySessionId, secondarySessionId, onActiveSessionChange]);

  const migrationRef = useRef({ sizes, applySizes });
  useEffect(() => {
    runLegacyDockHeightMigration(migrationRef.current.sizes, migrationRef.current.applySizes);
  }, []);

  const handleDividerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (slotsCollapsed.primary || slotsCollapsed.secondary) return;
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      startSiblingResize(buildSiblingOpts(measuredHeight, event.clientY));
    },
    [measuredHeight, startSiblingResize, buildSiblingOpts, slotsCollapsed],
  );

  const d = computeSlotDisplayHeights(slotHeights, slotsCollapsed, measuredHeight);
  return {
    primaryHeight: d.primary, secondaryHeight: d.secondary,
    primaryCollapsed: slotsCollapsed.primary, secondaryCollapsed: slotsCollapsed.secondary,
    sectionRef, measuredHeight, handleDividerPointerDown,
    onPrimarySessionChange, onSecondarySessionChange,
    togglePrimaryCollapsed, toggleSecondaryCollapsed,
  };
}

// ---------------------------------------------------------------------------
// ChatWorkbenchTerminalDock
// ---------------------------------------------------------------------------

interface SecondarySlotProps {
  height: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onActiveSessionChange: (id: string | null) => void;
  handleDividerPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

function SecondarySlot({
  height,
  collapsed,
  onToggleCollapse,
  onActiveSessionChange,
  handleDividerPointerDown,
}: SecondarySlotProps): React.ReactElement {
  return (
    <>
      <SlotDivider onPointerDown={handleDividerPointerDown} />
      <DockSlot
        slot="secondary"
        height={height}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onActiveSessionChange={onActiveSessionChange}
      />
    </>
  );
}

export function ChatWorkbenchTerminalDock({
  onActiveSessionChange,
}: ChatWorkbenchTerminalDockProps): React.ReactElement {
  const ds = useDockState(onActiveSessionChange);
  const showSecondarySlot = useSecondarySlotVisible(ds.secondaryCollapsed);
  // Phase E: when secondary is hidden, primary takes full measured section
  // height. Fallback to ds.primaryHeight while measuredHeight is 0 (pre-measure).
  const primaryH = !showSecondarySlot && ds.measuredHeight > 0 ? ds.measuredHeight : ds.primaryHeight;
  return (
    <section
      ref={ds.sectionRef}
      className="flex flex-1 flex-col border-t border-border-semantic bg-surface-panel/95"
      data-testid="chat-workbench-terminal-dock"
    >
      <DockSlot
        slot="primary"
        height={primaryH}
        collapsed={ds.primaryCollapsed}
        onToggleCollapse={ds.togglePrimaryCollapsed}
        onActiveSessionChange={ds.onPrimarySessionChange}
        onShowSecondarySlot={showSecondarySlot ? undefined : ds.toggleSecondaryCollapsed}
      />
      {showSecondarySlot && (
        <SecondarySlot
          height={ds.secondaryHeight}
          collapsed={ds.secondaryCollapsed}
          onToggleCollapse={ds.toggleSecondaryCollapsed}
          onActiveSessionChange={ds.onSecondarySessionChange}
          handleDividerPointerDown={ds.handleDividerPointerDown}
        />
      )}
    </section>
  );
}
