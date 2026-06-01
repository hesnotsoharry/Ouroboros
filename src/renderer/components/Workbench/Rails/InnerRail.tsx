/**
 * InnerRail — 256 px wide inner rail (canon §07, dual mode).
 *
 * Top: command-palette button.
 * Header: add-project button.
 * Running section: live sessions from useWorkbenchAgentData.
 * Files section (scrollable, flex 1): live file tree via WorkbenchFileTree.
 *
 * BranchFooter and InnerRailProjectDropdown were removed (titlebar owns both).
 * RunningSectionHeader was removed per user request.
 */

import React from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { Icon } from '../../shared/Icon';
import { iconBtnStyle, SectionLabel } from './InnerRail.parts';
import { InnerRailAddProjectButton } from './InnerRailAddProjectButton';
import { WorkbenchFileTree } from './WorkbenchFileTree';

const RAIL_STYLE: React.CSSProperties = {
  width: 256,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(14, 16, 26, 0.32)',
  backdropFilter: 'var(--blur-soft)',
  WebkitBackdropFilter: 'var(--blur-soft)',
  borderRight: '1px solid var(--stroke-faint)',
};

interface InnerRailProps {
  /** Accepted for compatibility with the Workbench caller; no longer consumed —
   * the collapse-to-unified trigger was removed with the Running section. */
  onCollapse?: () => void;
  onSelectFile?: (path: string) => void;
}

export function InnerRail({ onSelectFile }: InnerRailProps): React.ReactElement {
  return (
    <div data-testid="workbench-innerrail" style={RAIL_STYLE}>
      <CommandPaletteButton />
      <InnerRailHeader />
      <div style={{ height: 1, background: 'var(--stroke-faint)', margin: '0 10px' }} />
      <FilesSection onSelectFile={onSelectFile} />
    </div>
  );
}

// ── Command palette button ────────────────────────────────────────────────────

const PALETTE_BTN_STYLE: React.CSSProperties = {
  width: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 8px',
  background: 'var(--surface-inset, rgba(255,255,255,0.03))',
  border: '1px solid var(--stroke-inner)',
  borderRadius: 6,
  color: 'var(--ink-3)',
  cursor: 'pointer',
  fontSize: 11,
};

const PALETTE_LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  color: 'var(--ink-4)',
  fontFamily: 'var(--font-sans)',
};

const PALETTE_KBD_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--ink-4)',
};

function dispatchCommandPalette(): void {
  window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
}

function CommandPaletteButton(): React.ReactElement {
  return (
    <div style={{ padding: '8px 10px 0', flexShrink: 0 }}>
      <button type="button" title="Command palette (Ctrl K)" onClick={dispatchCommandPalette} style={PALETTE_BTN_STYLE}>
        <Icon name="Search" size={12} />
        <span style={PALETTE_LABEL_STYLE}>Search commands…</span>
        <span style={PALETTE_KBD_STYLE}>Ctrl K</span>
      </button>
    </div>
  );
}

// ── Project header ────────────────────────────────────────────────────────────

function InnerRailHeader(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 10px 4px',
        flexShrink: 0,
      }}
    >
      <InnerRailAddProjectButton />
    </div>
  );
}


// ── Files section ─────────────────────────────────────────────────────────────

function FilesSectionHeader(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
        padding: '0 8px',
      }}
    >
      <SectionLabel>Files</SectionLabel>
      <div style={{ display: 'flex', gap: 2 }}>
        <button
          title="Search files"
          style={iconBtnStyle}
          onClick={() => window.dispatchEvent(new CustomEvent('agent-ide:open-file-picker'))}
        >
          <Icon name="Search" size={11} />
        </button>
        <button title="New file" onClick={() => undefined} style={iconBtnStyle}>
          <Icon name="Plus" size={11} />
        </button>
      </div>
    </div>
  );
}

function FilesSection({
  onSelectFile,
}: {
  onSelectFile?: (path: string) => void;
}): React.ReactElement {
  const { projectRoot } = useProject();
  return (
    <div style={{ flex: 1, padding: '10px 6px', overflowY: 'auto', minHeight: 0 }}>
      <FilesSectionHeader />
      {projectRoot !== null && projectRoot !== '' && (
        <WorkbenchFileTree rootPath={projectRoot} onSelectFile={onSelectFile} />
      )}
    </div>
  );
}
