/**
 * ProjectChip — outer-rail project button with agent-status overlays.
 *
 * Extracted from ProjectRail.tsx (Wave N agent-status indicators).
 *
 * Overlays:
 *   ChipBorderOverlay — animated traveling border (working) or solid colored
 *                       border (ready-green / asking-yellow).
 *   NotificationDots  — dots shown when workingCount>0 AND unseen notifications
 *                       exist (yellow dots = asking, green dots = finished, cap 5).
 *   WorkingBadge      — count badge shown only when workingCount>1.
 */

import React from 'react';

import type { ChipBorderMode, ProjectAgentStatusSummary } from '../useProjectAgentStatus';
import type { WorkbenchProject } from '../useWorkbenchProjects';

// ── Inject animated border keyframe once ─────────────────────────────────────

const BORDER_STYLE_ID = '__workbench-chip-border-travel__';

// SVG rect perimeter: 2*(W-2*r) + 2*π*r where W=38, r=11
// = 2*(38-22) + 2*π*11 = 32 + 69.115 ≈ 101.1
const PERIMETER = 101.1;
const SEGMENT = PERIMETER * 0.35;

function injectChipBorderKeyframe(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(BORDER_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = BORDER_STYLE_ID;
  el.textContent = `
    @keyframes chipBorderTravel {
      from { stroke-dashoffset: ${PERIMETER}; }
      to   { stroke-dashoffset: 0; }
    }
  `;
  document.head.appendChild(el);
}

injectChipBorderKeyframe();

// ── ChipBorderOverlay ─────────────────────────────────────────────────────────

interface ChipBorderOverlayProps {
  mode: ChipBorderMode;
}

const BORDER_SVG_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 1,
  overflow: 'visible',
};

function borderStroke(mode: ChipBorderMode): string {
  if (mode === 'working') return 'var(--accent)';
  if (mode === 'ready-green') return 'var(--success)';
  return 'var(--warning)';
}

function buildRectProps(isWorking: boolean, stroke: string): React.SVGProps<SVGRectElement> {
  const base = { x: 0.75, y: 0.75, width: 36.5, height: 36.5, rx: 11, fill: 'none', stroke };
  if (!isWorking) return { ...base, strokeWidth: 2 };
  return {
    ...base,
    strokeWidth: 1.5,
    strokeDasharray: `${SEGMENT} ${PERIMETER - SEGMENT}`,
    style: { animation: 'chipBorderTravel 1.8s linear infinite' },
  };
}

function ChipBorderOverlay({ mode }: ChipBorderOverlayProps): React.ReactElement | null {
  if (mode === 'none') return null;
  const isWorking = mode === 'working';
  const rectProps = buildRectProps(isWorking, borderStroke(mode));
  return (
    <svg viewBox="0 0 38 38" style={BORDER_SVG_STYLE} aria-hidden="true">
      <rect {...rectProps} />
    </svg>
  );
}

// ── NotificationDots ──────────────────────────────────────────────────────────

const DOT_CAP = 5;

const DOTS_ROW_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: 3,
  left: 0,
  right: 0,
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 3,
  pointerEvents: 'none',
  zIndex: 2,
};

const DOT_BASE_STYLE: React.CSSProperties = { width: 5, height: 5, borderRadius: 999, flexShrink: 0 };

interface NotificationDotsProps {
  unseenFinished: number;
  unseenAsking: number;
  workingCount: number;
}

function NotificationDots({
  unseenFinished,
  unseenAsking,
  workingCount,
}: NotificationDotsProps): React.ReactElement | null {
  if (workingCount === 0 || unseenFinished + unseenAsking === 0) return null;
  // Yellow (asking) dots first, then green (finished), capped at DOT_CAP total.
  // TODO: count overflow (show "+N" badge) when total > DOT_CAP
  const yellowCount = Math.min(unseenAsking, DOT_CAP);
  const greenCount = Math.min(unseenFinished, DOT_CAP - yellowCount);
  return (
    <div style={DOTS_ROW_STYLE}>
      {Array.from({ length: yellowCount }).map((_, i) => (
        <span key={`ask-${i}`} style={{ ...DOT_BASE_STYLE, background: 'var(--warning)' }} />
      ))}
      {Array.from({ length: greenCount }).map((_, i) => (
        <span key={`fin-${i}`} style={{ ...DOT_BASE_STYLE, background: 'var(--success)' }} />
      ))}
    </div>
  );
}

// ── WorkingBadge ──────────────────────────────────────────────────────────────

interface WorkingBadgeProps {
  count: number;
}

function WorkingBadge({ count }: WorkingBadgeProps): React.ReactElement {
  return (
    <span
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 14,
        height: 14,
        borderRadius: 7,
        background: 'var(--accent)',
        color: 'var(--text-on-accent)',
        fontSize: 9,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 3px',
        zIndex: 3,
        pointerEvents: 'none',
        lineHeight: '1',
      }}
    >
      {count}
    </span>
  );
}

// ── Shared chip style helpers (copied from ProjectRail for co-location) ───────

function chipStyle(color: string, active: boolean): React.CSSProperties {
  return {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 11,
    // color is data-derived HSL — sanctioned exception per renderer color rule.
    background: active ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'rgba(255,255,255,0.04)',
    border: active ? '1px solid var(--stroke-strong)' : '1px solid var(--stroke-faint)',
    color: active ? '#0a0b14' : 'var(--ink-2)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 150ms',
    boxShadow: active ? `0 6px 18px -4px ${color}90, var(--inset-hi, none)` : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  };
}

function ActiveIndicator({ color }: { color: string }): React.ReactElement {
  return (
    <span
      style={{
        position: 'absolute',
        left: -10,
        top: 6,
        bottom: 6,
        width: 3,
        borderRadius: 999,
        // color is data-derived HSL — sanctioned exception per renderer color rule.
        background: color,
        boxShadow: `0 0 10px ${color}`,
      }}
    />
  );
}

const CHIP_WRAPPER_STYLE: React.CSSProperties = {
  position: 'relative',
  flexShrink: 0,
};

const REMOVE_BTN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 1,
  right: 1,
  width: 14,
  height: 14,
  borderRadius: 3,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.45)',
  border: 'none',
  color: 'var(--ink)',
  cursor: 'pointer',
  fontSize: 9,
  lineHeight: '1',
  fontWeight: 700,
  zIndex: 1,
};

/** Inline-X shown only on stale chips (exists: false). Wave 14 D1 safety affordance. */
function StaleRemoveButton({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}): React.ReactElement {
  return (
    <button
      aria-label={`Remove ${name}`}
      data-testid={`remove-project-${name}`}
      style={REMOVE_BTN_STYLE}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      ×
    </button>
  );
}

// ── ProjectChip ───────────────────────────────────────────────────────────────

export interface ProjectChipProps {
  project: WorkbenchProject;
  agentStatus: ProjectAgentStatusSummary;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRemove: () => void;
}

function ChipInnerButton({
  name, initial, color, active, onClick,
}: { name: string; initial: string; color: string; active: boolean; onClick: () => void }): React.ReactElement {
  const style: React.CSSProperties = { ...chipStyle(color, active), position: 'static', flexShrink: undefined };
  return (
    <button aria-label={name} onClick={onClick} style={style}>
      {initial}
      {active && <ActiveIndicator color={color} />}
    </button>
  );
}

export function ProjectChip({
  project,
  agentStatus,
  onClick,
  onContextMenu,
  onRemove,
}: ProjectChipProps): React.ReactElement {
  const { name, initial, color, active, exists } = project;
  const { workingCount, unseenFinished, unseenAsking, borderMode } = agentStatus;
  const wrapperStyle = exists ? CHIP_WRAPPER_STYLE : { ...CHIP_WRAPPER_STYLE, opacity: 0.5 };

  return (
    <div
      style={wrapperStyle}
      data-testid={`project-chip-${name}`}
      title={name}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <ChipInnerButton name={name} initial={initial} color={color} active={active} onClick={onClick} />
      <ChipBorderOverlay mode={borderMode} />
      {workingCount > 1 && <WorkingBadge count={workingCount} />}
      {workingCount > 0 && (
        <NotificationDots
          unseenFinished={unseenFinished}
          unseenAsking={unseenAsking}
          workingCount={workingCount}
        />
      )}
      {!exists && <StaleRemoveButton name={name} onRemove={onRemove} />}
    </div>
  );
}
