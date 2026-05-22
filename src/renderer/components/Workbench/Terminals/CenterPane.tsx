/**
 * CenterPane — vertical split of two terminal frames (Wave 2, upper live).
 *
 * Upper terminal (CC, ~62% = flex 1.55) + 10px gap + lower terminal (shell, ~38% = flex 1).
 * Transparent column, 10px padding, as per canon §02 + §08.
 *
 * Wave 2 Phase 1: upper frame is a live xterm bound to a workbench-owned pty.
 * Lower frame stays static mock — live in Phase 2.
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
 *   - Lower TerminalShell (kind="shell", flex=1    ≈ 38%) — mock this phase
 *
 * Carries data-testid="workbench-terminals" so the Phase 1 Workbench test
 * continues to resolve on the CenterPane root (spec requirement).
 */
export function CenterPane(): React.ReactElement {
  const { upperSessionId } = useWorkbenchTerminals();
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

      {/* Static resize divider — visual only this wave; drag logic in Wave 2 */}
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

      <TerminalShell kind="shell" flex={1} />
    </div>
  );
}
