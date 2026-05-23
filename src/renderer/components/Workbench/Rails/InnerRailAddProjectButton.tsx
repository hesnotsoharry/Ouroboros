/**
 * InnerRailAddProjectButton — mirrors the outer rail's AddProjectButton handler.
 *
 * Opens a native folder picker via window.electronAPI.files.selectFolder(),
 * then calls addProjectRoot(chosenPath). Cancellation is a no-op.
 */

import React, { useCallback } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { Icon } from '../../shared/Icon';

const BUTTON_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  padding: 0,
  borderRadius: 6,
  background: 'transparent',
  border: '1px dashed var(--stroke-inner)',
  color: 'var(--ink-4)',
  cursor: 'pointer',
  flexShrink: 0,
};

export function InnerRailAddProjectButton(): React.ReactElement {
  const { addProjectRoot } = useProject();

  const handleClick = useCallback(async () => {
    if (!window.electronAPI?.files?.selectFolder) return;
    const result = await window.electronAPI.files.selectFolder();
    if (result.success && result.path) {
      addProjectRoot(result.path);
    }
  }, [addProjectRoot]);

  return (
    <button
      title="Add project"
      onClick={() => void handleClick()}
      style={BUTTON_STYLE}
      data-testid="innerrail-add-project-btn"
    >
      <Icon name="Plus" size={11} />
    </button>
  );
}
