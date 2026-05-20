/**
 * InlineTitleEdit.tsx — Wave 95 Phase A
 *
 * Shared inline-edit input for tab/row titles. Used by:
 *  - DockSlotTabs.tsx (dock-slot tab double-click rename)
 *  - InnerSidebarTerminals.row.tsx (inner-rail right-click Rename)
 *
 * Semantics:
 *  - Enter / blur commits IF the trimmed value is non-empty AND differs
 *    from `initial`; otherwise cancels (no-op rename).
 *  - Escape always cancels.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface InlineTitleEditProps {
  initial: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
  testId: string;
  className?: string;
}

export function InlineTitleEdit({
  initial,
  onCommit,
  onCancel,
  testId,
  className,
}: InlineTitleEditProps): React.ReactElement {
  const [draft, setDraft] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus + select-all on mount so a single backspace clears the whole name
  // (matches FileTree's InlineEditInput pattern). autoFocus alone only places
  // the cursor; it does not select existing text.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  const commit = useCallback(() => {
    const n = draft.trim();
    if (n && n !== initial) onCommit(n);
    else onCancel();
  }, [draft, initial, onCommit, onCancel]);
  const onKey = useInlineEditKeydown(commit, onCancel);
  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKey}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      className={className ?? 'flex-1 bg-transparent text-xs outline-none'}
      data-testid={testId}
    />
  );
}

function useInlineEditKeydown(
  onSubmit: () => void,
  onCancel: () => void,
): (e: React.KeyboardEvent) => void {
  return useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [onSubmit, onCancel],
  );
}
