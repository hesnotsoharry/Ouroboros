/**
 * hooksLifecycleHandlers.test.ts — Unit tests for new hook lifecycle handlers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

// mockOnCwdChanged + mockOnFileChanged + contextLayerController mock removed in Wave 100 Phase F
// (contextLayer calls were deleted from hooksLifecycleHandlers)
// mockGraphOnFileChange removed in Wave 22 (codebaseGraph deleted)
// codebaseGraph/graphControllerSupport mock removed in Wave 22 (codebaseGraph deleted)
// editProvenance mock removed in Wave 101 Phase 4 (provenance store deleted)

vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import {
  enrichFromPermissionRequest,
  handleConfigChange,
  handleCwdChanged,
  handleFileChanged,
} from './hooksLifecycleHandlers';
import log from './logger';

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
  // editProvenance.markUserEdit removed in Wave 101 Phase 4 (provenance store deleted)
  // handleFileChanged is now a no-op; kept for future extension.

  it('runs without throwing for an external file change', () => {
    expect(() => handleFileChanged({ data: { file: '/some/file.ts' } })).not.toThrow();
  });

  it('runs without throwing for an internal file change', () => {
    expect(() => handleFileChanged({ internal: true, data: { file: '/some/file.ts' } })).not.toThrow();
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

  it('logs the permission_request with session, tool, and permissionType', () => {
    enrichFromPermissionRequest({
      sessionId: 'sess1',
      toolName: 'Bash',
      data: { permissionType: 'shell_exec' },
    });
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining('permission_request session=sess1'),
    );
  });

  it('runs without throwing when toolName and data are absent', () => {
    expect(() =>
      enrichFromPermissionRequest({ sessionId: 'sess2', toolName: undefined }),
    ).not.toThrow();
  });
});
