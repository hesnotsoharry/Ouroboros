/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { diffReviewReducer } from './diffReviewState';
import type { DiffReviewState, ProjectReview, ReviewHunk } from './types';

const PROJECT_ROOT = '/proj';

function makeHunk(id: string, decision: ReviewHunk['decision'] = 'pending'): ReviewHunk {
  return {
    id,
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldCount: 1,
    newStart: 1,
    newCount: 1,
    lines: ['+line'],
    rawPatch: `patch-${id}`,
    decision,
  };
}

function makeProject(hunks: ReviewHunk[], overrides: Partial<ProjectReview> = {}): ProjectReview {
  return {
    projectRoot: PROJECT_ROOT,
    projectLabel: 'proj',
    sessionId: 's1',
    snapshotHash: 'abc',
    files: [{ filePath: '/proj/a.ts', relativePath: 'a.ts', status: 'modified', hunks }],
    loading: false,
    error: null,
    lastAcceptedBatch: null,
    staleFiles: [],
    stalePendingOp: null,
    ...overrides,
  };
}

function openedState(
  hunks: ReviewHunk[],
  projectOverrides: Partial<ProjectReview> = {},
): DiffReviewState {
  return {
    activeProjectRoot: PROJECT_ROOT,
    projects: [makeProject(hunks, projectOverrides)],
  };
}

function activeProject(state: DiffReviewState | null): ProjectReview | undefined {
  return state?.projects.find((p) => p.projectRoot === state.activeProjectRoot);
}

describe('diffReviewReducer — rollback', () => {
  it('canRollback is false on fresh state (lastAcceptedBatch is null)', () => {
    const state = openedState([makeHunk('h1')]);
    expect(activeProject(state)?.lastAcceptedBatch).toBeNull();
  });

  it('CAPTURE_BATCH sets lastAcceptedBatch on the correct project', () => {
    const state = openedState([makeHunk('h1')]);
    const next = diffReviewReducer(state, {
      type: 'CAPTURE_BATCH',
      projectRoot: PROJECT_ROOT,
      hunkIds: ['h1'],
    });
    expect(activeProject(next)?.lastAcceptedBatch).toEqual(['h1']);
  });

  it('ROLLBACK_LAST_BATCH moves accepted hunks back to pending', () => {
    const state = openedState([makeHunk('h1', 'accepted'), makeHunk('h2', 'pending')], {
      lastAcceptedBatch: ['h1'],
    });
    const next = diffReviewReducer(state, {
      type: 'ROLLBACK_LAST_BATCH',
      projectRoot: PROJECT_ROOT,
    });
    expect(activeProject(next)?.files[0].hunks[0].decision).toBe('pending');
    expect(activeProject(next)?.files[0].hunks[1].decision).toBe('pending');
  });

  it('ROLLBACK_LAST_BATCH clears lastAcceptedBatch after rollback', () => {
    const state = openedState([makeHunk('h1', 'accepted')], { lastAcceptedBatch: ['h1'] });
    const next = diffReviewReducer(state, {
      type: 'ROLLBACK_LAST_BATCH',
      projectRoot: PROJECT_ROOT,
    });
    expect(activeProject(next)?.lastAcceptedBatch).toBeNull();
  });

  it('ROLLBACK_LAST_BATCH is a no-op when lastAcceptedBatch is null', () => {
    const state = openedState([makeHunk('h1', 'accepted')]);
    const next = diffReviewReducer(state, {
      type: 'ROLLBACK_LAST_BATCH',
      projectRoot: PROJECT_ROOT,
    });
    expect(activeProject(next)?.files[0].hunks[0].decision).toBe('accepted');
    expect(activeProject(next)?.lastAcceptedBatch).toBeNull();
  });

  it('ROLLBACK_LAST_BATCH is a no-op when lastAcceptedBatch is empty', () => {
    const state = openedState([makeHunk('h1', 'accepted')], { lastAcceptedBatch: [] });
    const next = diffReviewReducer(state, {
      type: 'ROLLBACK_LAST_BATCH',
      projectRoot: PROJECT_ROOT,
    });
    expect(activeProject(next)?.files[0].hunks[0].decision).toBe('accepted');
  });

  it('canRollback is true after CAPTURE_BATCH with non-empty ids', () => {
    const state = openedState([makeHunk('h1')]);
    const next = diffReviewReducer(state, {
      type: 'CAPTURE_BATCH',
      projectRoot: PROJECT_ROOT,
      hunkIds: ['h1'],
    });
    expect((activeProject(next)?.lastAcceptedBatch?.length ?? 0) > 0).toBe(true);
  });

  it('accept then reject clears lastAcceptedBatch (reject passes empty hunkIds)', () => {
    const state = openedState([makeHunk('h1'), makeHunk('h2')]);
    const afterAccept = diffReviewReducer(state, {
      type: 'CAPTURE_BATCH',
      projectRoot: PROJECT_ROOT,
      hunkIds: ['h1'],
    });
    const afterReject = diffReviewReducer(afterAccept, {
      type: 'CAPTURE_BATCH',
      projectRoot: PROJECT_ROOT,
      hunkIds: [],
    });
    expect(activeProject(afterReject)?.lastAcceptedBatch).toEqual([]);
  });

  it('ROLLBACK_LAST_BATCH does not affect hunks not in batch', () => {
    const state = openedState([makeHunk('h1', 'accepted'), makeHunk('h2', 'accepted')], {
      lastAcceptedBatch: ['h1'],
    });
    const next = diffReviewReducer(state, {
      type: 'ROLLBACK_LAST_BATCH',
      projectRoot: PROJECT_ROOT,
    });
    expect(activeProject(next)?.files[0].hunks[0].decision).toBe('pending');
    expect(activeProject(next)?.files[0].hunks[1].decision).toBe('accepted');
  });
});

describe('diffReviewReducer — OPEN multi-project', () => {
  it('OPEN on null state creates a single project entry', () => {
    const next = diffReviewReducer(null, {
      type: 'OPEN',
      sessionId: 'sess',
      snapshotHash: 'hash1',
      projectRoot: '/proj-a',
    });
    expect(next?.projects).toHaveLength(1);
    expect(next?.projects[0].projectRoot).toBe('/proj-a');
    expect(next?.activeProjectRoot).toBe('/proj-a');
  });

  it('OPEN with new projectRoot appends without changing activeProjectRoot', () => {
    const state = openedState([makeHunk('h1')]);
    const next = diffReviewReducer(state, {
      type: 'OPEN',
      sessionId: 'sess2',
      snapshotHash: 'hash2',
      projectRoot: '/proj-b',
    });
    expect(next?.projects).toHaveLength(2);
    expect(next?.activeProjectRoot).toBe(PROJECT_ROOT);
  });

  it('OPEN with same projectRoot replaces the existing entry', () => {
    const state = openedState([makeHunk('h1')]);
    const next = diffReviewReducer(state, {
      type: 'OPEN',
      sessionId: 'sess-new',
      snapshotHash: 'hash-new',
      projectRoot: PROJECT_ROOT,
    });
    expect(next?.projects).toHaveLength(1);
    expect(next?.projects[0].snapshotHash).toBe('hash-new');
    expect(next?.projects[0].sessionId).toBe('sess-new');
  });

  it('CLOSE returns null regardless of how many projects are open', () => {
    const state = openedState([makeHunk('h1')]);
    const next = diffReviewReducer(state, { type: 'CLOSE' });
    expect(next).toBeNull();
  });

  it('CLOSE_PROJECT removes the project and returns null when last one gone', () => {
    const state = openedState([makeHunk('h1')]);
    const next = diffReviewReducer(state, {
      type: 'CLOSE_PROJECT',
      projectRoot: PROJECT_ROOT,
    });
    expect(next).toBeNull();
  });

  it('CLOSE_PROJECT with multiple projects removes only the target', () => {
    const state: DiffReviewState = {
      activeProjectRoot: PROJECT_ROOT,
      projects: [
        makeProject([makeHunk('h1')]),
        makeProject([makeHunk('h2')], { projectRoot: '/proj-b', projectLabel: 'proj-b' }),
      ],
    };
    const next = diffReviewReducer(state, {
      type: 'CLOSE_PROJECT',
      projectRoot: '/proj-b',
    });
    expect(next?.projects).toHaveLength(1);
    expect(next?.projects[0].projectRoot).toBe(PROJECT_ROOT);
  });
});
