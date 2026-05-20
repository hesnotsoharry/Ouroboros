/**
 * DockSlotTabs.parts — extracted sub-components for DockSlotTabs.
 *
 * Moved here to keep DockSlotTabs.tsx under the ESLint max-lines cap (300).
 * TabTitleContent is the editable/static title area rendered inside each tab button.
 */

import React from 'react';

import { InlineTitleEdit } from './InlineTitleEdit';

// ---------------------------------------------------------------------------
// TabTitleContent
// ---------------------------------------------------------------------------

/** Renders the editable/static title area of a tab. */
export function TabTitleContent({
  sessionId,
  title,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  sessionId: string;
  title: string;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (t: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  if (editing) {
    return (
      <InlineTitleEdit
        initial={title}
        onCommit={onCommit}
        onCancel={onCancel}
        testId={`dock-slot-tab-title-${sessionId}`}
        className="max-w-[80px] bg-transparent text-xs outline-none"
      />
    );
  }
  return (
    <span
      className="max-w-[80px] truncate"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      data-testid={`dock-slot-tab-title-${sessionId}`}
    >
      {title}
    </span>
  );
}
