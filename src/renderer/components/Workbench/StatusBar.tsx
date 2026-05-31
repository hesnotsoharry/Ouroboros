/**
 * StatusBar — 24px bottom bar (canon §10).
 *
 * Left → right:
 *   [Branch name] · [Sparkle + model] · [context used/max] ·
 *   [tests-passing pill]  ── flex spacer ──
 *   [cost] · [clock] · [connection dot]
 *
 * Phase 2 live sources:
 *   - branch name: useGitBranch(projectRoot) — +adds/−dels deferred to follow-up
 *   - clock: local useState + setInterval(1 s) cleared on unmount
 *
 * Remaining mock (Phase 3): model, tokens, cost.
 */

import React, { useEffect, useState } from 'react';

import { useProject } from '../../contexts/ProjectContext';
import { useGitBranch } from '../../hooks/useGitBranch';
import { Icon } from '../shared/Icon';
import { useWorkbenchAgentData } from './useWorkbenchAgentData';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Format a raw token count as a compact string: 42800 → "42.8k". */
function formatTokens(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Format a Date as HH:MM:SS using local time. */
function formatClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── slot separator ────────────────────────────────────────────────────────────

const SEP = (
  <span aria-hidden style={{ color: 'var(--ink-4)' }}>
    ·
  </span>
);

// ── live clock ────────────────────────────────────────────────────────────────

function useLiveClock(): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return formatClock(now);
}

// ── left group (branch / model / context / tests) ────────────────────────────

function BranchSlot({ branch }: { branch: string | null }): React.ReactElement | null {
  if (!branch) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon name="Branch" size={11} style={{ color: 'var(--ink-3)' }} />
      <span style={{ color: 'var(--ink-2)' }}>{branch}</span>
    </span>
  );
}

function LeftSlots({ branch }: { branch: string | null }): React.ReactElement {
  const { contextStats } = useWorkbenchAgentData();
  const usedStr = formatTokens(contextStats.usedTokens);
  const maxStr = formatTokens(contextStats.maxTokens);

  return (
    <>
      {/* Slot 1 — branch name (live); hidden when not a git repo */}
      <BranchSlot branch={branch} />

      {branch && SEP}

      {/* Slot 2 — model (live Phase 3) */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon name="Sparkle" size={11} style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--ink-2)' }}>{contextStats.model}</span>
      </span>

      {SEP}

      {/* Slot 3 — context (live Phase 3) */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--ink-2)' }}>{usedStr}</span>
        <span>/ {maxStr} ctx</span>
      </span>

    </>
  );
}

// ── right group (cost / clock / connection) ───────────────────────────────────

function RightSlots(): React.ReactElement {
  const clock = useLiveClock();
  return (
    <>
      {/* Slot 6 — clock (live) */}
      <span>{clock}</span>
    </>
  );
}

// ── root ──────────────────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  height: 24,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 10,
  fontSize: 11,
  color: 'var(--ink-3)',
  // Opaque scrim — opacity-only black, allowed per renderer rule.
  background: 'rgba(0,0,0,0.25)',
  borderTop: '1px solid var(--stroke-faint)',
};

export function StatusBar(): React.ReactElement {
  const { projectRoot } = useProject();
  const { branch } = useGitBranch(projectRoot);

  return (
    <div data-testid="workbench-statusbar" style={rootStyle}>
      <LeftSlots branch={branch} />
      <span style={{ flex: 1 }} />
      <RightSlots />
    </div>
  );
}
