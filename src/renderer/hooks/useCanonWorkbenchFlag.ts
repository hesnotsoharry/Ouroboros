/**
 * useCanonWorkbenchFlag — reads the canon-workbench experimental feature flag.
 *
 * Reads `config.layout.canonWorkbench` once on mount via `getAll()`.
 * The Settings → Appearance toggle writes the value via config.set; a re-mount
 * (or page reload after save) picks up the new value.
 *
 * No live DOM event needed — this flag is settings-driven, not command-palette-driven.
 * The Settings draft/save flow in useSettingsDraft persists the change; InnerApp
 * re-evaluates the flag on the next render after config updates.
 */

import { useEffect, useState } from 'react';

function hasElectronAPI(): boolean {
  return typeof window !== 'undefined' && 'electronAPI' in window;
}

// Exported for testing — stable pure async reader.
export async function readCanonWorkbenchFlag(): Promise<boolean> {
  if (!hasElectronAPI()) return false;
  try {
    const cfg = await window.electronAPI.config.getAll();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (cfg as any)?.layout?.canonWorkbench === true;
  } catch {
    return false;
  }
}

export const __testing = { readCanonWorkbenchFlag };

export function useCanonWorkbenchFlag(): boolean {
  const [flagOn, setFlagOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readCanonWorkbenchFlag().then((v) => {
      if (!cancelled) setFlagOn(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return flagOn;
}
