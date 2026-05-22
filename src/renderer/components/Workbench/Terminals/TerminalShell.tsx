/**
 * TerminalShell — glass-wrapped terminal container (Wave 2 live upper / mock lower).
 * Canon §08: glass container · radius --r-md · tab bar · tinted-well body.
 * ADR Decision 5: no extra opacity wrapper — canvas opacity is the terminal's job.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { TerminalInstance } from '../../Terminal/TerminalInstance';
import {
  MOCK_CC_PROMPT_PLACEHOLDER,
  MOCK_CC_STATUS_LINE,
  MOCK_CC_TUI_LINES,
  MOCK_SHELL_LINES,
  MOCK_TERM_TABS_LOWER,
  MOCK_TERM_TABS_UPPER,
  MockTerminalLine,
  MockTerminalTab,
  TermLineTone,
} from '../workbenchMockData';

const TONE_VAR: Record<TermLineTone, string> = {
  primary: 'var(--ink)',
  muted: 'var(--ink-3)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  accent: 'var(--accent)',
  purple: 'var(--purple)',
  info: 'var(--info)',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: 4,
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-3)',
  cursor: 'pointer',
};

const termLineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-term, monospace)',
  fontSize: 12,
  lineHeight: 1.55,
  whiteSpace: 'pre',
  minHeight: '1.55em',
};

function TermLineRow({ line }: { line: MockTerminalLine }): React.ReactElement {
  const color = line.tone ? TONE_VAR[line.tone] : 'var(--ink)';
  return <div style={{ ...termLineStyle, color }}>{line.text}</div>;
}

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

function CcCursor(): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 14,
        background: 'var(--ink)',
        opacity: 0.7,
        verticalAlign: 'middle',
      }}
    />
  );
}

/** CC prompt box — glass-soft bg, 1px --stroke-inner, radius --r-md (canon §08). */
function CcPromptBox(): React.ReactElement {
  return (
    <div
      data-testid="cc-prompt-box"
      style={{
        margin: 8,
        padding: '8px 12px',
        background: 'var(--term-prompt-bg)',
        border: '1px solid var(--stroke-inner)',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>{'>'}</span>
      <span
        style={{
          color: 'var(--ink-3)',
          fontFamily: 'var(--font-term, monospace)',
          fontSize: 12,
          flex: 1,
        }}
      >
        {MOCK_CC_PROMPT_PLACEHOLDER}
      </span>
      <CcCursor />
    </div>
  );
}

/** CC status line — mono 11px --ink-3 (canon §08). */
function CcStatusLine(): React.ReactElement {
  return (
    <div
      data-testid="cc-status-line"
      style={{
        padding: '3px 16px 6px',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 11,
        color: 'var(--ink-3)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {MOCK_CC_STATUS_LINE}
    </div>
  );
}

/** Body for the upper (CC) terminal: mock TUI lines + prompt box + status. */
function CcBody(): React.ReactElement {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 4px', minHeight: 0 }}>
        {MOCK_CC_TUI_LINES.map((line, i) => (
          <TermLineRow key={i} line={line} />
        ))}
      </div>
      <CcPromptBox />
      <CcStatusLine />
    </div>
  );
}

/** Body for the lower (shell) terminal: raw mock shell lines + $ cursor. */
function ShellBody(): React.ReactElement {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 14px', minHeight: 0 }}>
      {MOCK_SHELL_LINES.map((line, i) => (
        <TermLineRow key={i} line={line} />
      ))}
      <div
        data-testid="shell-prompt-line"
        style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: 6,
          fontFamily: 'var(--font-term, monospace)',
          fontSize: 12,
          lineHeight: 1.55,
          gap: 4,
        }}
      >
        <span style={{ color: 'var(--success)' }}>$ </span>
        <CcCursor />
      </div>
    </div>
  );
}

export type TerminalKind = 'cc' | 'shell';

interface TerminalShellProps {
  kind: TerminalKind;
  /** flex grow value — parent CenterPane controls the 62/38 split via this. */
  flex: number;
  /** When provided, renders a live <TerminalInstance>; pty must be pre-spawned. */
  sessionId?: string;
  /** Forwarded to <TerminalInstance> visibility toggle. Defaults to true. */
  isActive?: boolean;
}

/** Canon §08 tinted well: --term-bg panel + --term-inset shadow. */
const WELL_STYLE: React.CSSProperties = {
  flex: 1, minHeight: 0, position: 'relative',
  display: 'flex', flexDirection: 'column',
  background: 'var(--term-bg)', boxShadow: 'var(--term-inset)',
  fontFamily: 'var(--font-term, monospace)',
};

/** Live xterm body. flex:1+minHeight:0 = non-zero height at mount (fit-timing). No opacity wrapper (ADR 5). */
function LiveBody({ sessionId, isActive }: { sessionId: string; isActive: boolean }): React.ReactElement {
  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <TerminalInstance sessionId={sessionId} isActive={isActive} />
    </div>
  );
}

const SHELL_OUTER: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--stroke-inner)',
};

/**
 * TerminalShell — glass container + tab bar + tinted-well body.
 *
 * kind="cc"    → upper terminal (Claude Code TUI)
 * kind="shell" → lower terminal (raw shell)
 *
 * When sessionId is provided the live xterm mounts; otherwise the static mock
 * body renders (lower frame this phase — ADR Decision 6).
 */
export function TerminalShell({ kind, flex, sessionId, isActive }: TerminalShellProps): React.ReactElement {
  const tabs = kind === 'cc' ? MOCK_TERM_TABS_UPPER : MOCK_TERM_TABS_LOWER;
  const body = sessionId !== undefined
    ? <LiveBody sessionId={sessionId} isActive={isActive ?? true} />
    : kind === 'cc' ? <CcBody /> : <ShellBody />;
  return (
    <div
      data-testid={kind === 'cc' ? 'terminal-shell-upper' : 'terminal-shell-lower'}
      style={{ ...SHELL_OUTER, flex }}
    >
      <TabBar tabs={tabs} />
      <div style={WELL_STYLE}>{body}</div>
    </div>
  );
}
