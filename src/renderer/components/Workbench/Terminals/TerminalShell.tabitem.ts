/**
 * useTabItemHandlers — extracted hook for TabItem event handling.
 * Separate file to keep TerminalShell.parts.tsx under the 300-line limit.
 * Wave 12 Phase 4.
 */

import React, { useCallback, useState } from 'react';

import { type TabState } from './useWorkbenchTabs';

export interface TabItemHandlers {
  renaming: boolean;
  handleDoubleClick: () => void;
  handleCommit: (id: string, label: string) => void;
  handleCancel: () => void;
  handleClose: (e: React.MouseEvent) => void;
}

export function useTabItemHandlers(
  tab: TabState,
  onClose: (id: string) => void,
  onRename: (id: string, label: string) => void,
): TabItemHandlers {
  const [renaming, setRenaming] = useState(false);
  const handleDoubleClick = useCallback(() => setRenaming(true), []);
  const handleCommit = useCallback(
    (id: string, label: string) => {
      onRename(id, label);
      setRenaming(false);
    },
    [onRename],
  );
  const handleCancel = useCallback(() => setRenaming(false), []);
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(tab.id);
    },
    [onClose, tab.id],
  );
  return { renaming, handleDoubleClick, handleCommit, handleCancel, handleClose };
}
