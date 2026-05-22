/**
 * TerminalShell — glass-wrapped terminal container (Wave 2 both frames live).
 * Canon §08: glass container · radius --r-md · tab bar · tinted-well body.
 * ADR Decision 5: no extra opacity wrapper — canvas opacity is the terminal's job.
 * ADR Decision 6: one live plain-shell pty per frame; tab bar stays as single-tab
 * affordance; multi-tab management and CC auto-launch deferred to Wave 3.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { TerminalInstance } from '../../Terminal/TerminalInstance';
import {
  MOCK_TERM_TABS_LOWER,
  MOCK_TERM_TABS_UPPER,
  MockTerminalTab,
} from '../workbenchMockData';

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: 4,
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-3)',
  cursor: 'pointer',
};

function TabStatusDot({ status }: { status: MockTerminalTab['status'] }): React.ReactElement {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: status === 'running' ? 'var(--success)' : 'var(--ink-4)',
        boxShadow: status === 'running' ? '0 0 6px var(--success)' : 'none',
        flexShrink: 0,
      }}
    />
  );
}

function TabActiveIndicator(): React.ReactElement {
  return (
    <span
      style={{
        position: 'absolute',
        bottom: -1,
        left: 0,
        right: 0,
        height: 2,
        background: 'var(--accent)',
        boxShadow: '0 0 10px var(--accent)',
        borderRadius: 1,
      }}
    />
  );
}

function TabItem({ tab }: { tab: MockTerminalTab }): React.ReactElement {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: '100%',
        padding: '0 12px',
        cursor: 'pointer',
        color: tab.active ? 'var(--ink)' : 'var(--ink-3)',
        fontSize: 11,
        fontFamily: 'var(--font-ui, system-ui)',
        flexShrink: 0,
      }}
    >
      <TabStatusDot status={tab.status} />
      <span>{tab.label}</span>
      {tab.active && <TabActiveIndicator />}
    </div>
  );
}

function TabBarControls(): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 6, flexShrink: 0 }}>
      <button title="Split" style={iconBtnStyle}>
        <Icon name="Split" size={12} />
      </button>
      <button title="Maximize" style={iconBtnStyle}>
        <Icon name="Maximize" size={12} />
      </button>
    </div>
  );
}

function TabNewButton(): React.ReactElement {
  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 8px',
        height: '100%',
        background: 'transparent',
        border: 'none',
        color: 'var(--ink-4)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
      title="New tab"
    >
      <Icon name="Plus" size={12} />
    </button>
  );
}

function TabBar({ tabs }: { tabs: MockTerminalTab[] }): React.ReactElement {
  return (
    <div
      style={{
        height: 30,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid var(--stroke-faint)',
        position: 'relative',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0, overflow: 'hidden' }}
      >
        {tabs.map((tab) => (
          <TabItem key={tab.id} tab={tab} />
        ))}
        <TabNewButton />
        <div style={{ flex: 1 }} />
      </div>
      <TabBarControls />
    </div>
  );
}

export type TerminalKind = 'cc' | 'shell';

interface TerminalShellProps {
  kind: TerminalKind;
  /** flex grow value — parent CenterPane controls the 62/38 split via this. */
  flex: number;
  /** Live pty session id. Must be pre-spawned before this component mounts. */
  sessionId: string;
  /** Forwarded to <TerminalInstance> visibility toggle. */
  isActive: boolean;
}

/** Canon §08 tinted well: --term-bg panel + --term-inset shadow. */
const WELL_STYLE: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--term-bg)',
  boxShadow: 'var(--term-inset)',
  fontFamily: 'var(--font-term, monospace)',
};

const SHELL_OUTER: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--stroke-inner)',
};

/**
 * TerminalShell — glass container + tab bar + tinted-well live terminal body.
 *
 * kind="cc"    → upper terminal (Claude Code TUI — plain shell this wave, Wave 3 auto-launch)
 * kind="shell" → lower terminal (raw shell)
 *
 * sessionId is required — both frames are live as of Wave 2 Phase 2.
 * No extra opacity wrapper around <TerminalInstance> (ADR Decision 5).
 */
export function TerminalShell({
  kind,
  flex,
  sessionId,
  isActive,
}: TerminalShellProps): React.ReactElement {
  const tabs = kind === 'cc' ? MOCK_TERM_TABS_UPPER : MOCK_TERM_TABS_LOWER;
  return (
    <div
      data-testid={kind === 'cc' ? 'terminal-shell-upper' : 'terminal-shell-lower'}
      style={{ ...SHELL_OUTER, flex }}
    >
      <TabBar tabs={tabs} />
      <div style={WELL_STYLE}>
        {/* flex:1+minHeight:0 = non-zero height at mount (fit-timing). No opacity wrapper (ADR 5). */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <TerminalInstance sessionId={sessionId} isActive={isActive} />
        </div>
      </div>
    </div>
  );
}
