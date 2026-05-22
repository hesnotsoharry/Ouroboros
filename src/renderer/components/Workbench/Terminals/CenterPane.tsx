/**
 * CenterPane — vertical split of two live terminal frames (Wave 2, both live).
 *
 * Upper terminal (CC, ~62% = flex 1.55) + 10px gap + lower terminal (shell, ~38% = flex 1).
 * Transparent column, 10px padding, as per canon §02 + §08.
 *
 * Wave 2 Phase 2: both frames are live xterm terminals bound to workbench-owned ptys.
 * Both frames are always visible (isActive=true) — this is a vertical split, not tab-stacking.
 * xterm handles click-to-focus natively; we do not need mutual exclusion here.
 * Phase 3 wires the divider drag.
 */

import React from 'react';

import { TerminalShell } from './TerminalShell';
import { useWorkbenchTerminals } from './useWorkbenchTerminals';

/**
 * CenterPane — the centre column of the workbench.
 *
 * Renders a vertical split:
 *   - Upper TerminalShell (kind="cc",    flex=1.55 ≈ 62%) — live xterm
 *   - Static divider bar (non-functional, Phase 3 wires drag)
 *   - Lower TerminalShell (kind="shell", flex=1    ≈ 38%) — live xterm
 *
 * Both frames use isActive=true because both are simultaneously visible.
 * isActive=false (→ visibility:hidden) is for tab-stacking, not for split panes.
 *
 * Carries data-testid="workbench-terminals" so tests resolve on the CenterPane root.
 */
export function CenterPane(): React.ReactElement {
  const { upperSessionId, lowerSessionId } = useWorkbenchTerminals();
  return (
    <div
      data-testid="workbench-terminals"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 10,
        gap: 0,
      }}
    >
      <TerminalShell kind="cc" flex={1.55} sessionId={upperSessionId} isActive />

      {/* Static resize divider — visual only this phase; drag logic in Phase 3 */}
      <div
        aria-hidden="true"
        style={{
          height: 10,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'row-resize',
        }}
      >
        <div
          style={{
            width: 32,
            height: 3,
            borderRadius: 999,
            background: 'var(--stroke-faint)',
          }}
        />
      </div>

      <TerminalShell kind="shell" flex={1} sessionId={lowerSessionId} isActive />
    </div>
  );
}
