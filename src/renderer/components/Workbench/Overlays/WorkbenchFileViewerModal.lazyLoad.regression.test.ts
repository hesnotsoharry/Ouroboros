/**
 * Wave 11 Phase 1 — lazy-load regression guard (frozen).
 *
 * Workbench/CLAUDE.md (lines 344-357) documents the load-bearing gotcha:
 *
 *   The FileViewer modal MUST stay lazy (React.lazy). FileViewer statically
 *   pulls Monaco + pdfjs, whose module-init touches browser APIs jsdom lacks
 *   (`document.queryCommandSupported`, `DOMMatrix`, `CSS.escape`). A static
 *   import would land Monaco/pdfjs in the Workbench shell's module graph,
 *   crashing EVERY test that renders <Workbench/> at import time (0 tests
 *   collected) — and bloat the main renderer chunk. Wave 8 P3 regressed
 *   exactly this once, then fixed it.
 *
 * Wave 11 P1 adds file-tree click → modal wiring. The implementer MUST NOT
 * touch WorkbenchFileViewerModal.tsx; the wiring lives entirely in the
 * sibling components and prop chain. This test is the regression guard
 * against accidental conversion of the lazy import back to static.
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 1
 * implementer MAY NOT modify this test.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const MODAL_SOURCE_PATH = path.resolve(__dirname, 'WorkbenchFileViewerModal.tsx');

describe('Wave 11 P1 — WorkbenchFileViewerModal lazy-load gotcha (regression guard)', () => {
  const source = fs.readFileSync(MODAL_SOURCE_PATH, 'utf8');

  it('imports FileViewer via React.lazy + dynamic import, NOT a static import', () => {
    // Required pattern: React.lazy(() => import('../../FileViewer/FileViewer').then(...))
    // The implementer can change the .then() shape (e.g., name-export normalization)
    // but the React.lazy + dynamic-import pair MUST be present.
    expect(source).toMatch(/React\.lazy\s*\(/);
    expect(source).toMatch(/import\s*\(\s*['"][.\/]+FileViewer\/FileViewer['"]\s*\)/);
  });

  it('does NOT contain a static top-level import of FileViewer', () => {
    // Static import would look like: import { FileViewer } from '../../FileViewer/FileViewer'
    // or: import FileViewer from '../../FileViewer/FileViewer'
    // The dynamic import inside React.lazy is the only permitted reference.
    const staticImportLines = source
      .split('\n')
      .filter(
        (line) =>
          /^\s*import\s/.test(line) &&
          /FileViewer\/FileViewer/.test(line) &&
          !/React\.lazy/.test(line),
      );
    expect(staticImportLines).toEqual([]);
  });

  it('renders FileViewer under <Suspense> so the lazy chunk has a fallback', () => {
    // Suspense is React's idiom for rendering placeholder content while a lazy
    // component resolves. Required when React.lazy is used; missing Suspense
    // throws "A React component suspended while rendering, but no fallback UI".
    expect(source).toMatch(/<Suspense\b/);
    expect(source).toMatch(/fallback\s*=/);
  });
});
