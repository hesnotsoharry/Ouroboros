/**
 * CenterPane — vertical split of two terminal frames (Wave 1, static mock).
 *
 * Upper terminal (CC, ~62% = flex 1.55) + 10px gap + lower terminal (shell, ~38% = flex 1).
 * Transparent column, 10px padding, as per canon §02 + §08.
 *
 * NO xterm. NO live hooks. Static mock content only — Wave 2 mounts xterm.
 */

import React from 'react';

import { TerminalShell } from './TerminalShell';

/**
 * CenterPane — the centre column of the workbench.
 *
 * Renders a vertical split:
 *   - Upper TerminalShell (kind="cc",    flex=1.55 ≈ 62%)
 *   - Static divider bar (non-functional, Wave 2+ adds drag)
 *   - Lower TerminalShell (kind="shell", flex=1    ≈ 38%)
 *
 * Carries data-testid="workbench-terminals" so the Phase 1 Workbench test
 * continues to resolve on the CenterPane root (spec requirement).
 */
export function CenterPane(): React.ReactElement {
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
      <TerminalShell kind="cc" flex={1.55} />

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
