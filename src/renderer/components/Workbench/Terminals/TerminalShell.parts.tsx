/**
 * TerminalShell sub-components — tab bar parts extracted for lint compliance.
 * Consumed exclusively by TerminalShell.tsx.
 *
 * Wave 12 Phase 4: live tab wiring. Rename is uncontrolled (ADR D3).
 */

import React, { useCallback, useRef } from 'react';

import { Icon } from '../../shared/Icon';
import { useTabItemHandlers } from './TerminalShell.tabitem';
import { type TabState } from './useWorkbenchTabs';

// ── Shared styles ─────────────────────────────────────────────────────────────

export const ICON_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: 4,
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-3)',
  cursor: 'pointer',
};

// ── TabActiveIndicator ────────────────────────────────────────────────────────

export function TabActiveIndicator(): React.ReactElement {
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

// ── RenameInput ───────────────────────────────────────────────────────────────

export interface RenameInputProps {
  tabId: string;
  currentLabel: string;
  onCommit: (id: string, label: string) => void;
  onCancel: () => void;
}

interface RenameHandlersArgs {
  tabId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  cancelledRef: React.MutableRefObject<boolean>;
  onCommit: (id: string, label: string) => void;
  onCancel: () => void;
}

function useRenameHandlers({
  tabId,
  inputRef,
  cancelledRef,
  onCommit,
  onCancel,
}: RenameHandlersArgs) {
  const commit = useCallback(() => {
    if (cancelledRef.current) return;
    const val = inputRef.current?.value ?? '';
    const trimmed = val.trim();
    if (trimmed.length > 0) onCommit(tabId, trimmed);
    onCancel();
  }, [tabId, inputRef, cancelledRef, onCommit, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        cancelledRef.current = true;
        onCancel();
      }
    },
    [commit, onCancel, cancelledRef],
  );

  const handleBlur = useCallback(() => {
    if (!cancelledRef.current) commit();
  }, [commit, cancelledRef]);

  return { handleKeyDown, handleBlur };
}

export function RenameInput({
  tabId,
  currentLabel,
  onCommit,
  onCancel,
}: RenameInputProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const { handleKeyDown, handleBlur } = useRenameHandlers({
    tabId,
    inputRef,
    cancelledRef,
    onCommit,
    onCancel,
  });
  return (
    <input
      ref={inputRef}
      data-testid={`terminal-tab-rename-input-${tabId}`}
      defaultValue={currentLabel}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      autoFocus
      style={{
        background: 'transparent',
        border: 'none',
        outline: '1px solid var(--accent)',
        color: 'var(--ink)',
        fontSize: 11,
        fontFamily: 'var(--font-ui, system-ui)',
        width: 80,
        padding: '0 2px',
      }}
    />
  );
}

// ── TabItem ───────────────────────────────────────────────────────────────────

export interface TabItemProps {
  tab: TabState;
  isActive: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, label: string) => void;
}

const TAB_LABEL_STYLE: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const TAB_CLOSE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 14,
  height: 14,
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-4)',
  cursor: 'pointer',
  flexShrink: 0,
  padding: 0,
  borderRadius: 2,
};

const TAB_BASE_STYLE: Omit<React.CSSProperties, 'color'> = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: '100%',
  padding: '0 8px 0 12px',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'var(--font-ui, system-ui)',
  flexShrink: 0,
  maxWidth: 140,
};

interface TabLabelAreaProps {
  tab: TabState;
  renaming: boolean;
  onCommit: (id: string, label: string) => void;
  onCancel: () => void;
}

function TabLabelArea({ tab, renaming, onCommit, onCancel }: TabLabelAreaProps): React.ReactElement {
  if (renaming) {
    return <RenameInput tabId={tab.id} currentLabel={tab.label} onCommit={onCommit} onCancel={onCancel} />;
  }
  return <span style={TAB_LABEL_STYLE} title={tab.label}>{tab.label}</span>;
}

export function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
  onRename,
}: TabItemProps): React.ReactElement {
  const { renaming, handleDoubleClick, handleCommit, handleCancel, handleClose } =
    useTabItemHandlers(tab, onClose, onRename);
  const tabStyle: React.CSSProperties = { ...TAB_BASE_STYLE, color: isActive ? 'var(--ink)' : 'var(--ink-3)' };
  return (
    <div
      data-testid={`terminal-tab-${tab.id}`}
      onClick={() => onActivate(tab.id)}
      onDoubleClick={handleDoubleClick}
      style={tabStyle}
    >
      <TabLabelArea tab={tab} renaming={renaming} onCommit={handleCommit} onCancel={handleCancel} />
      <button
        data-testid={`terminal-tab-close-${tab.id}`}
        onClick={handleClose}
        title="Close tab"
        style={TAB_CLOSE_STYLE}
      >
        ×
      </button>
      {isActive && <TabActiveIndicator />}
    </div>
  );
}

// ── TabBarControls ────────────────────────────────────────────────────────────

export interface TabBarControlsProps {
  frame: 'upper' | 'lower';
  onMaximize: () => void;
}

export function TabBarControls({ frame, onMaximize }: TabBarControlsProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 6, flexShrink: 0 }}>
      <button title="Split — coming in a future wave" style={ICON_BTN_STYLE}>
        <Icon name="Split" size={12} />
      </button>
      <button
        data-testid={`terminal-maximize-${frame}`}
        title="Maximize"
        style={ICON_BTN_STYLE}
        onClick={onMaximize}
      >
        <Icon name="Maximize" size={12} />
      </button>
    </div>
  );
}

// ── TabNewButton ──────────────────────────────────────────────────────────────

export interface TabNewButtonProps {
  frame: 'upper' | 'lower';
  onAddTab: () => void;
}

export function TabNewButton({ frame, onAddTab }: TabNewButtonProps): React.ReactElement {
  return (
    <button
      data-testid={`terminal-tabbar-new-${frame}`}
      onClick={onAddTab}
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

// ── TabBar ────────────────────────────────────────────────────────────────────

export interface TabBarProps {
  tabs: TabState[];
  activeTabId: string | null;
  frame: 'upper' | 'lower';
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onAddTab: () => void;
  onMaximize: () => void;
}

const TAB_BAR_OUTER: React.CSSProperties = {
  height: 30,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'stretch',
  background: 'rgba(255,255,255,0.02)',
  borderBottom: '1px solid var(--stroke-faint)',
  position: 'relative',
};

const TAB_LIST_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
};

export function TabBar({
  tabs,
  activeTabId,
  frame,
  onActivate,
  onClose,
  onRename,
  onAddTab,
  onMaximize,
}: TabBarProps): React.ReactElement {
  return (
    <div style={TAB_BAR_OUTER}>
      <div style={TAB_LIST_STYLE}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={onActivate}
            onClose={onClose}
            onRename={onRename}
          />
        ))}
        <TabNewButton frame={frame} onAddTab={onAddTab} />
        <div style={{ flex: 1 }} />
      </div>
      <TabBarControls frame={frame} onMaximize={onMaximize} />
    </div>
  );
}
