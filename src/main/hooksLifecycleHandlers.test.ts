/**
 * hooksLifecycleHandlers.test.ts — Unit tests for new hook lifecycle handlers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

// mockOnCwdChanged + mockOnFileChanged + contextLayerController mock removed in Wave 100 Phase F
// (contextLayer calls were deleted from hooksLifecycleHandlers)
// mockGraphOnFileChange removed in Wave 22 (codebaseGraph deleted)
// codebaseGraph/graphControllerSupport mock removed in Wave 22 (codebaseGraph deleted)

const mockMarkUserEdit = vi.fn();

vi.mock('./orchestration/editProvenance', () => ({
  getEditProvenanceStore: () => ({ markUserEdit: mockMarkUserEdit }),
}));

vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import {
  clearPermissionContext,
  enrichFromPermissionRequest,
  getPermissionContext,
  handleConfigChange,
  handleCwdChanged,
  handleFileChanged,
} from './hooksLifecycleHandlers';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleCwdChanged', () => {
  let sessionCwdMap: Map<string, string>;

  beforeEach(() => {
    sessionCwdMap = new Map();
    vi.clearAllMocks();
  });

  // contextLayer onCwdChanged notification removed in Wave 100 Phase F

  it('updates sessionCwdMap from payload.cwd', () => {
    handleCwdChanged(sessionCwdMap, { sessionId: 'abc', cwd: '/foo/bar' });
    expect(sessionCwdMap.get('abc')).toBe('/foo/bar');
  });

  it('prefers data.cwd over payload.cwd', () => {
    handleCwdChanged(sessionCwdMap, {
      sessionId: 'abc',
      cwd: '/old',
      data: { cwd: '/new' },
    });
    expect(sessionCwdMap.get('abc')).toBe('/new');
  });

  it('does nothing when no cwd is available', () => {
    handleCwdChanged(sessionCwdMap, { sessionId: 'abc' });
    expect(sessionCwdMap.size).toBe(0);
  });
});

describe('handleFileChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // contextLayer onFileChanged notification removed in Wave 100 Phase F
  // (graph notification already removed in Wave 22 when codebaseGraph was deleted)

  it('schedules edit provenance marking for external file changes with a file path', async () => {
    handleFileChanged({ data: { file: '/some/file.ts' } });
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockMarkUserEdit).toHaveBeenCalledWith('/some/file.ts');
  });

  it('skips provenance marking for internal sessions', async () => {
    handleFileChanged({ internal: true, data: { file: '/some/file.ts' } });
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockMarkUserEdit).not.toHaveBeenCalled();
  });
});

describe('handleConfigChange', () => {
  it('runs without throwing', () => {
    expect(() => handleConfigChange('session-123')).not.toThrow();
  });
});

describe('enrichFromPermissionRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs without throwing for a minimal payload', () => {
    expect(() => enrichFromPermissionRequest({ sessionId: 'abc' })).not.toThrow();
  });

  it('stores context in the cache when data and toolName are provided', () => {
    enrichFromPermissionRequest({
      sessionId: 'sess1',
      toolName: 'Bash',
      data: { permissionType: 'shell_exec', matchedRule: 'allow-bash' },
    });
    const ctx = getPermissionContext('sess1', 'Bash');
    expect(ctx).toMatchObject({
      permissionType: 'shell_exec',
      matchedRule: 'allow-bash',
    });
  });

  it('getPermissionContext evicts on first read', () => {
    enrichFromPermissionRequest({
      sessionId: 'sess2',
      toolName: 'Write',
      data: { permissionType: 'file_write' },
    });
    // First read returns the value
    const first = getPermissionContext('sess2', 'Write');
    expect(first?.permissionType).toBe('file_write');
    // Second read returns undefined (evicted)
    const second = getPermissionContext('sess2', 'Write');
    expect(second).toBeUndefined();
  });

  it('clearPermissionContext removes the entry before it is read', () => {
    enrichFromPermissionRequest({
      sessionId: 'sess3',
      toolName: 'Edit',
      data: { permissionType: 'file_edit' },
    });
    clearPermissionContext('sess3', 'Edit');
    expect(getPermissionContext('sess3', 'Edit')).toBeUndefined();
  });
});
