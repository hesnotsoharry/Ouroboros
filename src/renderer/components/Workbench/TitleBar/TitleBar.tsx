/**
 * TitleBar — 40px title bar (canon §06).
 *
 * Left → right:
 *   App mark · Project chip · Branch chip · [spacer] · AgentGlobe · [spacer]
 *   · Bell · Settings · WindowControls
 *
 * -webkit-app-region: drag on the bar background; no-drag on every interactive
 * child so clicks reach them.
 *
 * Phase 2 live sources:
 *   - active project: useWorkbenchProjects() — deterministic HSL chip color
 *   - branch name: useGitBranch(projectRoot) — BranchChip hidden when null
 */

import React, { useCallback, useState } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { OPEN_SETTINGS_EVENT } from '../../../hooks/appEventNames';
import { useGitBranch } from '../../../hooks/useGitBranch';
import { Icon } from '../../shared/Icon';
import { useWorkbenchProjects } from '../useWorkbenchProjects';
import { AgentGlobe } from './AgentGlobe';
import { TitleBarBranchDropdown } from './TitleBarBranchDropdown';
import { TitleBarProjectDropdown } from './TitleBarProjectDropdown';
import { BranchChip, ProjectChip } from './TitleChip';
import { WindowControls } from './WindowControls';
import { WorkbenchBell } from './WorkbenchBell';

// ── App mark ─────────────────────────────────────────────────────────────────

function AppMark(): React.ReactElement {
  return (
    <img
      src="/OUROBOROS.png"
      alt="Ouroboros"
      aria-label="Agent IDE"
      width={22}
      height={22}
      style={{ borderRadius: 6, display: 'block', flexShrink: 0 }}
    />
  );
}

// ── Spacer ────────────────────────────────────────────────────────────────────

function Spacer(): React.ReactElement {
  return <div style={{ flex: 1 }} />;
}

// ── Settings button ───────────────────────────────────────────────────────────

interface SettingsButtonProps {
  onClick: () => void;
}

function SettingsButton({ onClick }: SettingsButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      title="Settings"
      onClick={onClick}
      style={
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          marginRight: 6,
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          color: 'var(--ink-3)',
          cursor: 'pointer',
          WebkitAppRegion: 'no-drag',
          flexShrink: 0,
        } as React.CSSProperties
      }
    >
      <Icon name="Settings" size={14} />
    </button>
  );
}

// ── TitleBar ─────────────────────────────────────────────────────────────────

const titleBarStyle = {
  height: 40,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  padding: '0 0 0 12px',
  gap: 8,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.005))',
  borderBottom: '1px solid var(--stroke-inner)',
  position: 'relative',
  zIndex: 5,
  WebkitAppRegion: 'drag',
} as React.CSSProperties;

function useTitleBarDropdowns(): {
  projectOpen: boolean;
  branchOpen: boolean;
  toggleProject: () => void;
  toggleBranch: () => void;
  closeProject: () => void;
  closeBranch: () => void;
} {
  const [projectOpen, setProjectOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const toggleProject = useCallback(() => {
    setProjectOpen((p) => !p);
    setBranchOpen(false);
  }, []);
  const toggleBranch = useCallback(() => {
    setBranchOpen((p) => !p);
    setProjectOpen(false);
  }, []);
  return {
    projectOpen,
    branchOpen,
    toggleProject,
    toggleBranch,
    closeProject: useCallback(() => setProjectOpen(false), []),
    closeBranch: useCallback(() => setBranchOpen(false), []),
  };
}

/**
 * Wave 10.1 — branch chip always renders when a project is active; branch
 * text shows "—" when useGitBranch is null (non-git project or IPC pending/
 * failed). Dropdown only opens when we have a real branch to switch from
 * (a "—" placeholder isn't an actionable dropdown target). Pre-Wave-10.1
 * the chip was hidden entirely on null branch, so non-git projects had no
 * visual acknowledgment of git state in the title bar.
 */
function BranchSection({
  branch,
  branchOpen,
  toggleBranch,
  closeBranch,
}: {
  branch: string | null;
  branchOpen: boolean;
  toggleBranch: () => void;
  closeBranch: () => void;
}): React.ReactElement {
  return (
    <div style={{ position: 'relative' }}>
      <BranchChip branch={branch ?? '—'} onClick={branch ? toggleBranch : undefined} />
      {branchOpen && branch && <TitleBarBranchDropdown onClose={closeBranch} />}
    </div>
  );
}

export function TitleBar(): React.ReactElement {
  const { projectRoot } = useProject();
  const projects = useWorkbenchProjects();
  const { branch } = useGitBranch(projectRoot);
  const { projectOpen, branchOpen, toggleProject, toggleBranch, closeProject, closeBranch } =
    useTitleBarDropdowns();
  const activeProject = projects.find((p) => p.active) ?? projects[0];
  return (
    <div data-testid="workbench-titlebar" style={titleBarStyle}>
      <AppMark />
      {activeProject && (
        <div style={{ position: 'relative' }}>
          <ProjectChip project={activeProject} onClick={toggleProject} />
          {projectOpen && <TitleBarProjectDropdown onClose={closeProject} />}
        </div>
      )}
      {activeProject && (
        <BranchSection
          branch={branch}
          branchOpen={branchOpen}
          toggleBranch={toggleBranch}
          closeBranch={closeBranch}
        />
      )}
      <Spacer />
      <AgentGlobe />
      <Spacer />
      <WorkbenchBell />
      <SettingsButton onClick={dispatchOpenSettings} />
      <WindowControls />
    </div>
  );
}

function dispatchOpenSettings(): void {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}
