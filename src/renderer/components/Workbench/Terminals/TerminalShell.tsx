/**
 * TerminalShell — glass-wrapped terminal container (Wave 2 both frames live).
 * Canon §08: glass container · radius --r-md · tab bar · tinted-well body.
 * ADR Decision 5: no extra opacity wrapper — canvas opacity is the terminal's job.
 *
 * Wave 12 Phase 4: live tab wiring via useWorkbenchTabs. MOCK_TERM_TABS_* removed.
 * Sub-components (TabBar, TabItem, RenameInput, etc.) live in TerminalShell.parts.tsx.
 * Rename input is uncontrolled (ADR D3) — defaultValue + ref-based commit on Enter/blur.
 */

import React, { useCallback } from 'react';

import { TerminalInstance } from '../../Terminal/TerminalInstance';
import { type ActiveWorkbenchFrame, useActiveWorkbenchFrame } from '../useActiveWorkbenchFrame';
import { TabBar } from './TerminalShell.parts';
import { useWorkbenchTabsContext } from './WorkbenchTabsProvider';

export type TerminalKind = 'cc' | 'shell';

interface TerminalShellProps {
  kind: TerminalKind;
  /** flex grow value — parent CenterPane controls the 62/38 split via this. */
  flex: number;
  /** Live pty session id. Must be pre-spawned before this component mounts. */
  sessionId: string;
  /** Forwarded to <TerminalInstance> visibility toggle. */
  isActive: boolean;
  /** Called when the Maximize button is clicked in this frame's tab bar. */
  onMaximize?: () => void;
  /** Optional inline style overrides — used by CenterPane for display:none on maximize. */
  style?: React.CSSProperties;
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

function TerminalWell({
  sessionId,
  isActive,
}: {
  sessionId: string;
  isActive: boolean;
}): React.ReactElement {
  return (
    <div style={WELL_STYLE}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <TerminalInstance sessionId={sessionId} isActive={isActive} />
      </div>
    </div>
  );
}

/** Canon §08 glass container + live tab bar + tinted-well terminal. Wave 12 Phase 4: live tabs. */
export function TerminalShell({
  kind,
  flex,
  sessionId,
  isActive,
  onMaximize,
  style: styleProp,
}: TerminalShellProps): React.ReactElement {
  const thisFrame: ActiveWorkbenchFrame = kind === 'cc' ? 'upper' : 'lower';
  const { setActiveFrame } = useActiveWorkbenchFrame();
  const { tabs, activeTabId, addTab, closeTab, renameTab, setActiveTab } =
    useWorkbenchTabsContext(thisFrame);
  const handleMouseDown = useCallback(() => setActiveFrame(thisFrame), [setActiveFrame, thisFrame]);
  const handleAddTab = useCallback(() => addTab({ kind }), [addTab, kind]);
  const handleMaximize = useCallback(() => onMaximize?.(), [onMaximize]);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeSessionId = activeTab?.sessionId ?? sessionId;
  return (
    <div
      data-testid={kind === 'cc' ? 'terminal-shell-upper' : 'terminal-shell-lower'}
      onMouseDown={handleMouseDown}
      style={{ ...SHELL_OUTER, flex, ...styleProp }}
    >
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        frame={thisFrame}
        onActivate={setActiveTab}
        onClose={closeTab}
        onRename={renameTab}
        onAddTab={handleAddTab}
        onMaximize={handleMaximize}
      />
      <TerminalWell sessionId={activeSessionId} isActive={isActive} />
    </div>
  );
}
