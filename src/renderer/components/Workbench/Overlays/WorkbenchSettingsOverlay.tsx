/**
 * WorkbenchSettingsOverlay — Settings modal host for the canon Workbench shell.
 *
 * Wave 7 Phase 1. Mirrors ChatOnlySettingsOverlay: listens for
 * OPEN_SETTINGS_EVENT (dispatched by the TitleBar Settings cog) and mounts
 * the shared SettingsModal. The modal creates its own portal inside
 * document.body, so no stacking-context issues with the workbench z-indexes.
 *
 * Settings is self-contained (useConfig, useSettingsDraft) — no workbench-
 * specific context dependencies.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { OPEN_SETTINGS_EVENT } from '../../../hooks/appEventNames';
import { SettingsModal } from '../../Settings/SettingsModal';

export function WorkbenchSettingsOverlay(): React.ReactElement {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback((): void => {
    setOpen(true);
  }, []);

  const handleClose = useCallback((): void => {
    setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_SETTINGS_EVENT, handleOpen);
    return () => {
      window.removeEventListener(OPEN_SETTINGS_EVENT, handleOpen);
    };
  }, [handleOpen]);

  return <SettingsModal isOpen={open} onClose={handleClose} />;
}
