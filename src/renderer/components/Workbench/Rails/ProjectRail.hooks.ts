/**
 * ProjectRail.hooks — shared hooks for ProjectRail and its sub-modules.
 */

import React, { useEffect } from 'react';

/** Closes (via onClose) when user clicks outside ref or presses Escape. */
export function useCloseOnOutsideOrEsc(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onMouse = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, active, onClose]);
}
