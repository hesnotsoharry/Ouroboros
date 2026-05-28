/* eslint-disable security/detect-object-injection -- mock store uses dynamic keys; test context, not runtime input */
/**
 * migrateStaleRoots.test.ts — Unit tests for pruneStaleRoots migration.
 *
 * All tests inject a fake `exists` function and a mock config store so no
 * real filesystem or electron-store is touched.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config module — intercept get/set so tests control the store
// ---------------------------------------------------------------------------

const configStore: Record<string, unknown> = {};

vi.mock('./config', () => ({
  getConfigValue: vi.fn((key: string) => configStore[key]),
  setConfigValue: vi.fn((key: string, value: unknown) => {
    configStore[key] = value;
  }),
}));

// Mock the logger so test output is clean
vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn() },
}));

import { pruneStaleRoots } from './migrateStaleRoots';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExists(existing: string[]): (p: string) => boolean {
  const set = new Set(existing);
  return (p) => set.has(p);
}

// Re-import mocked helpers for assertions
import { getConfigValue, setConfigValue } from './config';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the in-memory config store
  for (const k of Object.keys(configStore)) {
    delete configStore[k];
  }
});

// ---------------------------------------------------------------------------
// 1. Array-of-paths keys: missing dropped, existing kept
// ---------------------------------------------------------------------------

describe('pruneStaleRoots — array-of-paths keys', () => {
  it('drops missing paths from multiRoots and keeps existing', () => {
    configStore['multiRoots'] = ['/exists/a', '/missing/b', '/exists/c'];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists(['/exists/a', '/exists/c']));

    expect(setConfigValue).toHaveBeenCalledWith('multiRoots', ['/exists/a', '/exists/c']);
  });

  it('drops missing paths from recentProjects and keeps existing', () => {
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = ['/gone', '/kept'];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists(['/kept']));

    expect(setConfigValue).toHaveBeenCalledWith('recentProjects', ['/kept']);
  });

  it('drops missing paths from trustedWorkspaces and keeps existing', () => {
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = ['/trusted', '/gone'];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists(['/trusted']));

    expect(setConfigValue).toHaveBeenCalledWith('trustedWorkspaces', ['/trusted']);
  });

  it('does not call setConfigValue when all paths exist', () => {
    configStore['multiRoots'] = ['/a', '/b'];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists(['/a', '/b']));

    const setCalls = (setConfigValue as ReturnType<typeof vi.fn>).mock.calls;
    const multiRootsWrites = setCalls.filter(([k]) => k === 'multiRoots');
    expect(multiRootsWrites).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. sessionsData: records with missing projectRoot dropped, existing kept
// ---------------------------------------------------------------------------

describe('pruneStaleRoots — sessionsData', () => {
  it('drops sessions whose projectRoot does not exist', () => {
    const sessions = [
      { projectRoot: '/exists/proj', id: 's1' },
      { projectRoot: '/gone/proj', id: 's2' },
      { projectRoot: '/exists/proj2', id: 's3' },
    ];
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = sessions;
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists(['/exists/proj', '/exists/proj2']));

    const call = (setConfigValue as ReturnType<typeof vi.fn>).mock.calls.find(
      ([k]) => k === 'sessionsData',
    );
    expect(call).toBeDefined();
    const written = call![1] as Array<{ projectRoot: string }>;
    expect(written.map((s) => s.projectRoot)).toEqual(['/exists/proj', '/exists/proj2']);
  });

  it('keeps sessionsData unchanged when all projectRoots exist', () => {
    const sessions = [{ projectRoot: '/alive', id: 's1' }];
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = sessions;
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists(['/alive']));

    const setCalls = (setConfigValue as ReturnType<typeof vi.fn>).mock.calls;
    expect(setCalls.filter(([k]) => k === 'sessionsData')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Path-keyed objects: missing-path keys dropped, existing kept
// ---------------------------------------------------------------------------

describe('pruneStaleRoots — canonWorkbenchSessions', () => {
  it('drops entries whose key-path does not exist', () => {
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {
      '/alive/proj': { upper: null, lower: null },
      '/gone/proj': { upper: null, lower: null },
    };
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists(['/alive/proj']));

    const call = (setConfigValue as ReturnType<typeof vi.fn>).mock.calls.find(
      ([k]) => k === 'canonWorkbenchSessions',
    );
    expect(call).toBeDefined();
    expect(Object.keys(call![1] as object)).toEqual(['/alive/proj']);
  });
});

describe('pruneStaleRoots — terminalSessionsPerProject', () => {
  it('drops entries whose key-path does not exist, keeps existing', () => {
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {
      '/proj/a': { primary: [], secondary: [] },
      '/proj/dead': { primary: [], secondary: [] },
    };
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists(['/proj/a']));

    const call = (setConfigValue as ReturnType<typeof vi.fn>).mock.calls.find(
      ([k]) => k === 'terminalSessionsPerProject',
    );
    expect(call).toBeDefined();
    expect(Object.keys(call![1] as object)).toEqual(['/proj/a']);
  });
});

// ---------------------------------------------------------------------------
// 4. defaultProjectRoot: cleared when missing, kept when present
// ---------------------------------------------------------------------------

describe('pruneStaleRoots — defaultProjectRoot', () => {
  it('clears defaultProjectRoot when the path does not exist', () => {
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '/old/path';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists([]));

    expect(setConfigValue).toHaveBeenCalledWith('defaultProjectRoot', '');
  });

  it('keeps defaultProjectRoot when the path exists', () => {
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '/current/path';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists(['/current/path']));

    const setCalls = (setConfigValue as ReturnType<typeof vi.fn>).mock.calls;
    expect(setCalls.filter(([k]) => k === 'defaultProjectRoot')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Idempotency: running twice yields the same result
// ---------------------------------------------------------------------------

describe('pruneStaleRoots — idempotency', () => {
  it('produces the same result on second run as on first', () => {
    configStore['multiRoots'] = ['/gone', '/alive'];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    const exists = makeExists(['/alive']);

    // First run — prunes /gone
    pruneStaleRoots(exists);
    expect(configStore['multiRoots']).toEqual(['/alive']);

    vi.clearAllMocks();

    // Second run — nothing to prune, setConfigValue NOT called for multiRoots
    pruneStaleRoots(exists);
    const setCalls = (setConfigValue as ReturnType<typeof vi.fn>).mock.calls;
    expect(setCalls.filter(([k]) => k === 'multiRoots')).toHaveLength(0);
    expect(configStore['multiRoots']).toEqual(['/alive']);
  });
});

// ---------------------------------------------------------------------------
// 6. Defensive: absent / null / empty / malformed key does not throw
// ---------------------------------------------------------------------------

describe('pruneStaleRoots — defensive against bad data', () => {
  it('does not throw when all keys are absent', () => {
    // configStore is empty
    expect(() => pruneStaleRoots(makeExists([]))).not.toThrow();
  });

  it('does not throw when arrays contain non-string elements', () => {
    configStore['multiRoots'] = [null, 42, {}, '/valid'];
    configStore['recentProjects'] = undefined;
    configStore['trustedWorkspaces'] = null;
    configStore['defaultProjectRoot'] = undefined;
    configStore['sessionsData'] = [null, { noProjectRoot: true }, { projectRoot: 42 }];
    configStore['canonWorkbenchSessions'] = 'not-an-object';
    configStore['terminalSessionsPerProject'] = [];
    configStore['terminalSessions'] = [null, { noCwd: true }];

    expect(() => pruneStaleRoots(makeExists(['/valid']))).not.toThrow();
  });

  it('does not throw when getConfigValue throws', () => {
    // Make getConfigValue throw for a specific key
    (getConfigValue as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'multiRoots') throw new Error('store error');
      return configStore[key];
    });

    expect(() => pruneStaleRoots(makeExists([]))).not.toThrow();
  });

  it('handles empty arrays without writing', () => {
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [];

    pruneStaleRoots(makeExists([]));

    // Nothing to prune — setConfigValue should not be called at all
    expect(setConfigValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. terminalSessions — pruned by cwd field
// ---------------------------------------------------------------------------

describe('pruneStaleRoots — terminalSessions', () => {
  it('drops sessions whose cwd does not exist, keeps existing', () => {
    configStore['multiRoots'] = [];
    configStore['recentProjects'] = [];
    configStore['trustedWorkspaces'] = [];
    configStore['defaultProjectRoot'] = '';
    configStore['sessionsData'] = [];
    configStore['canonWorkbenchSessions'] = {};
    configStore['terminalSessionsPerProject'] = {};
    configStore['terminalSessions'] = [
      { cwd: '/alive', title: 'shell', isClaude: false },
      { cwd: '/dead', title: 'claude', isClaude: true },
    ];

    pruneStaleRoots(makeExists(['/alive']));

    const call = (setConfigValue as ReturnType<typeof vi.fn>).mock.calls.find(
      ([k]) => k === 'terminalSessions',
    );
    expect(call).toBeDefined();
    const written = call![1] as Array<{ cwd: string }>;
    expect(written.map((s) => s.cwd)).toEqual(['/alive']);
  });
});
