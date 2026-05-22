/**
 * WorkbenchFilePicker — File quick-open overlay for the canon Workbench shell.
 *
 * Wave 8 Phase 3. Listens for 'agent-ide:open-file-picker' DOM CustomEvent
 * (mirrors WorkbenchCommandPalette's 'agent-ide:command-palette' pattern).
 *
 * Renders the existing CommandPalette/FilePicker.tsx (self-contained fuzzy
 * file search over useProjectFileIndex). When a file is selected, calls
 * onSelectFile(path) which lifts state up to Workbench.tsx to open the modal.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { useProjectOptional } from '../../../contexts/ProjectContext';
import { FilePicker } from '../../CommandPalette/FilePicker';

export const OPEN_FILE_PICKER_EVENT = 'agent-ide:open-file-picker';

export interface WorkbenchFilePickerProps {
  onSelectFile: (filePath: string) => void;
}

export function WorkbenchFilePicker({
  onSelectFile,
}: WorkbenchFilePickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const projectContext = useProjectOptional();
  const projectRoot = projectContext?.projectRoot ?? null;

  const handleOpen = useCallback((): void => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback((): void => {
    setIsOpen(false);
  }, []);

  const handleSelectFile = useCallback(
    (filePath: string): void => {
      setIsOpen(false);
      onSelectFile(filePath);
    },
    [onSelectFile],
  );

  useEffect(() => {
    window.addEventListener(OPEN_FILE_PICKER_EVENT, handleOpen);
    return () => {
      window.removeEventListener(OPEN_FILE_PICKER_EVENT, handleOpen);
    };
  }, [handleOpen]);

  return (
    <FilePicker
      isOpen={isOpen}
      projectRoot={projectRoot}
      onClose={handleClose}
      onSelectFile={handleSelectFile}
    />
  );
}
