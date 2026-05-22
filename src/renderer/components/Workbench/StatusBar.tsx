/**
 * StatusBar — 24px bottom bar (canon §10).
 *
 * Left → right:
 *   [Branch + adds/dels] · [Sparkle + model] · [context used/max] ·
 *   [tests-passing pill]  ── flex spacer ──
 *   [cost] · [clock] · [connection dot]
 *
 * All data from workbenchMockData — static Wave 1. Wave 3 wires live data.
 */

import React from 'react';

import { Icon } from '../shared/Icon';
import {
  MOCK_BRANCH,
  MOCK_CONTEXT_STATS,
  MOCK_STATUS_BAR,
} from './workbenchMockData';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Format a raw token count as a compact string: 42800 → "42.8k". */
function formatTokens(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Format a cost in USD: 0.087 → "$0.09". */
function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

// ── slot separator ────────────────────────────────────────────────────────────

const SEP = (
  <span aria-hidden style={{ color: 'var(--ink-4)' }}>
    ·
  </span>
);

// ── left group (branch / model / context / tests) ────────────────────────────

function LeftSlots(): React.ReactElement {
  const usedStr = formatTokens(MOCK_CONTEXT_STATS.usedTokens);
  const maxStr = formatTokens(MOCK_CONTEXT_STATS.maxTokens);

  return (
    <>
      {/* Slot 1 — branch */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon name="Branch" size={11} style={{ color: 'var(--ink-3)' }} />
        <span style={{ color: 'var(--ink-2)' }}>{MOCK_BRANCH.name}</span>
        <span style={{ color: 'var(--success)' }}>+{MOCK_BRANCH.adds}</span>
        <span style={{ color: 'var(--error)' }}>−{MOCK_BRANCH.dels}</span>
      </span>

      {SEP}

      {/* Slot 2 — model */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon name="Sparkle" size={11} style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--ink-2)' }}>{MOCK_CONTEXT_STATS.model}</span>
      </span>

      {SEP}

      {/* Slot 3 — context */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--ink-2)' }}>{usedStr}</span>
        <span>/ {maxStr} ctx</span>
      </span>

      {SEP}

      {/* Slot 4 — tests-passing pill */}
      <span style={{ color: 'var(--success)' }}>
        ● {MOCK_STATUS_BAR.testsPassing} tests passing
      </span>
    </>
  );
}

// ── right group (cost / clock / connection) ───────────────────────────────────

function RightSlots(): React.ReactElement {
  return (
    <>
      {/* Slot 5 — cost */}
      <span style={{ color: 'var(--ink-2)' }}>
        {formatCost(MOCK_CONTEXT_STATS.costUsd)}
      </span>

      {SEP}

      {/* Slot 6 — clock (static mock string this wave) */}
      <span>{MOCK_STATUS_BAR.clock}</span>

      {SEP}

      {/* Slot 7 — connection */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--success)',
            boxShadow: '0 0 6px var(--success)',
            flexShrink: 0,
          }}
        />
        connected
      </span>
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
  return (
    <div data-testid="workbench-statusbar" style={rootStyle}>
      <LeftSlots />
      <span style={{ flex: 1 }} />
      <RightSlots />
    </div>
  );
}
