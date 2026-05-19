/**
 * useEditorHunkDecorations — applies per-hunk gutter decorations to a Monaco
 * editor when a DiffReview is active for the currently open file.
 *
 * Exported helpers (`buildHunkDecorations`, `findHunkAtLine`) are pure so they
 * can be tested without a real editor instance.
 *
 * Wave 95 Phase G: updated to find files across multi-project state and
 * pass projectRoot to acceptHunk/rejectHunk.
 */
import * as monaco from 'monaco-editor';
import { type MutableRefObject, useEffect, useMemo, useRef } from 'react';

import { useDiffReview } from '../DiffReview';
import type { DiffReviewContextValue } from '../DiffReview/DiffReviewManager';
import type { ReviewHunk } from '../DiffReview/types';

// ─── CSS class applied to Monaco's glyph margin for each pending hunk ────────
export const HUNK_GUTTER_CLASS = 'ouroboros-hunk-gutter';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface HunkDecoration {
  hunk: ReviewHunk;
  anchorLine: number;
  fileIdx: number;
  hunkIdx: number;
  /** Project that owns this file — needed for projectRoot-scoped action calls. */
  projectRoot: string;
}

export interface UseEditorHunkDecorationsResult {
  decorations: HunkDecoration[];
  diffReview: DiffReviewContextValue;
}

// ─── Pure helpers (exported for tests) ────────────────────────────────────────

/** Converts pending hunks to decoration descriptors (fileIdx defaults to 0). */
export function buildHunkDecorations(hunks: ReviewHunk[]): HunkDecoration[] {
  const result: HunkDecoration[] = [];
  for (let i = 0; i < hunks.length; i += 1) {
    const hunk = hunks[i];
    if (!hunk || hunk.decision !== 'pending') continue;
    result.push({ hunk, anchorLine: hunk.newStart, fileIdx: 0, hunkIdx: i, projectRoot: '' });
  }
  return result;
}

/**
 * Returns the HunkDecoration whose hunk range contains `line`, or null.
 * Deleted hunks (newCount=0) occupy exactly 1 line at newStart.
 */
export function findHunkAtLine(decs: HunkDecoration[], line: number): HunkDecoration | null {
  for (const dec of decs) {
    const end = dec.hunk.newCount > 0 ? dec.anchorLine + dec.hunk.newCount - 1 : dec.anchorLine;
    if (line >= dec.anchorLine && line <= end) return dec;
  }
  return null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildForFile(hunks: ReviewHunk[], fileIdx: number, projectRoot: string): HunkDecoration[] {
  const result: HunkDecoration[] = [];
  for (let i = 0; i < hunks.length; i += 1) {
    const hunk = hunks[i];
    if (!hunk || hunk.decision !== 'pending') continue;
    result.push({ hunk, anchorLine: hunk.newStart, fileIdx, hunkIdx: i, projectRoot });
  }
  return result;
}

function toMonacoDecs(decs: HunkDecoration[]): monaco.editor.IModelDeltaDecoration[] {
  return decs.map((d) => ({
    range: new monaco.Range(d.anchorLine, 1, d.anchorLine, 1),
    options: {
      isWholeLine: true,
      glyphMarginClassName: HUNK_GUTTER_CLASS,
      stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    },
  }));
}

function bindKeyboard(
  editor: monaco.editor.IStandaloneCodeEditor,
  getD: () => HunkDecoration[],
  review: DiffReviewContextValue,
): monaco.IDisposable[] {
  const run = (key: number, action: (d: HunkDecoration) => void): monaco.IDisposable =>
    editor.addAction({
      id: key === monaco.KeyCode.KeyY ? 'ouroboros-hunk-accept' : 'ouroboros-hunk-reject',
      label: key === monaco.KeyCode.KeyY ? 'Accept Hunk' : 'Reject Hunk',
      keybindings: [monaco.KeyMod.Alt | key],
      run: () => {
        const line = editor.getPosition()?.lineNumber ?? 0;
        const d = findHunkAtLine(getD(), line);
        if (d) action(d);
      },
    });
  return [
    run(monaco.KeyCode.KeyY, (d) => review.acceptHunk(d.projectRoot, d.fileIdx, d.hunkIdx)),
    run(monaco.KeyCode.KeyN, (d) => review.rejectHunk(d.projectRoot, d.fileIdx, d.hunkIdx)),
  ];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface FileLocation {
  fileIdx: number;
  projectRoot: string;
  project: { files: { hunks: ReviewHunk[] }[] };
}

function findFileLocation(
  state: ReturnType<typeof useDiffReview>['state'],
  filePath: string,
): FileLocation | null {
  if (!state) return null;
  for (const project of state.projects) {
    const idx = project.files.findIndex((f) => f.filePath === filePath);
    if (idx >= 0) return { fileIdx: idx, projectRoot: project.projectRoot, project };
  }
  return null;
}

export function useEditorHunkDecorations(
  editorRef: MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  filePath: string,
): UseEditorHunkDecorationsResult {
  const diffReview = useDiffReview();
  const idsRef = useRef<string[]>([]);
  const decsRef = useRef<HunkDecoration[]>([]);
  const state = diffReview.state;

  const fileLocation = useMemo(() => findFileLocation(state, filePath), [filePath, state]);
  const hunks = useMemo(
    () => (fileLocation ? (fileLocation.project.files[fileLocation.fileIdx]?.hunks ?? []) : []),
    [fileLocation],
  );
  const editor = editorRef.current;

  useEffect(() => {
    if (!editor) return;
    const decs =
      hunks.length > 0 && fileLocation
        ? buildForFile(hunks, fileLocation.fileIdx, fileLocation.projectRoot)
        : [];
    decsRef.current = decs;
    idsRef.current = editor.deltaDecorations(idsRef.current, toMonacoDecs(decs));
    return () => {
      idsRef.current = editor.deltaDecorations(idsRef.current, []);
    };
  }, [editor, fileLocation, hunks]);

  useEffect(() => {
    if (!editor) return;
    const disposables = bindKeyboard(editor, () => decsRef.current, diffReview);
    return () => {
      disposables.forEach((d) => d.dispose());
    };
  }, [editor, diffReview]);

  return { decorations: decsRef.current, diffReview };
}
