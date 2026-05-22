/**
 * WorkbenchCommandPalette — Command palette host for the canon Workbench shell.
 *
 * Wave 7 Phase 2. Mirrors PaletteOverlay in InnerAppLayout.overlays.tsx:
 * wires useCommandPalette() (open/close state + event listener) and
 * useCommandRegistry() (commands + execute) into <CommandPalette />.
 *
 * The palette opens via:
 *   (a) The TitleBar Ctrl-K pill (dispatches 'agent-ide:command-palette')
 *   (b) The existing Ctrl+Shift+P keybind (handled inside useCommandPalette)
 *   (c) Any caller dispatching 'agent-ide:command-palette' on window
 *
 * No workbench-specific context dependencies — self-contained.
 */

import React from 'react';

import { CommandPalette } from '../../CommandPalette/CommandPalette';
import { useCommandPalette } from '../../CommandPalette/useCommandPalette';
import { useCommandRegistry } from '../../CommandPalette/useCommandRegistry';

export function WorkbenchCommandPalette(): React.ReactElement {
  const { isOpen, close } = useCommandPalette();
  const { commands, recentIds, execute } = useCommandRegistry();

  return (
    <CommandPalette
      isOpen={isOpen}
      onClose={close}
      commands={commands}
      recentIds={recentIds}
      onExecute={execute}
    />
  );
}
