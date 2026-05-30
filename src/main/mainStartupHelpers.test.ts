/**
 * mainStartupHelpers.test.ts — Smoke tests for bootstrap helpers extracted
 * from mainStartup.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockCrashReporterStart,
  mockAppSetName,
  mockAppCommandLineAppendSwitch,
} = vi.hoisted(() => ({
  mockCrashReporterStart: vi.fn(),
  mockAppSetName: vi.fn(),
  mockAppCommandLineAppendSwitch: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    setName: mockAppSetName,
    commandLine: { appendSwitch: mockAppCommandLineAppendSwitch },
    isPackaged: false,
  },
  crashReporter: {
    start: mockCrashReporterStart,
  },
}));

// editProvenance mock removed in Wave 101 Phase 4 (provenance store deleted)
// jsonlRetention mock removed in Wave 101 Phase 6 (scheduleJsonlRetentionPurge deleted)

vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { bootstrapApp, bootstrapCrashReporter } from './mainStartupHelpers';

// ─── bootstrapCrashReporter ───────────────────────────────────────────────────

describe('bootstrapCrashReporter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts the crash reporter with uploadToServer false', () => {
    bootstrapCrashReporter();
    expect(mockCrashReporterStart).toHaveBeenCalledOnce();
    expect(mockCrashReporterStart).toHaveBeenCalledWith(
      expect.objectContaining({ uploadToServer: false }),
    );
  });

  it('enables compression', () => {
    bootstrapCrashReporter();
    expect(mockCrashReporterStart).toHaveBeenCalledWith(
      expect.objectContaining({ compress: true }),
    );
  });
});

// ─── bootstrapApp ─────────────────────────────────────────────────────────────

describe('bootstrapApp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets the app name to Ouroboros', () => {
    bootstrapApp();
    expect(mockAppSetName).toHaveBeenCalledWith('Ouroboros');
  });

  it('appends disable-gpu-sandbox command-line switch', () => {
    bootstrapApp();
    expect(mockAppCommandLineAppendSwitch).toHaveBeenCalledWith('disable-gpu-sandbox');
  });

  it('appends no-sandbox switch when app is not packaged', () => {
    bootstrapApp();
    expect(mockAppCommandLineAppendSwitch).toHaveBeenCalledWith('no-sandbox');
  });
});

// closeEditProvenance test removed in Wave 101 Phase 4 (provenance store deleted)
// scheduleJsonlRetentionPurge tests removed in Wave 101 Phase 6 (function deleted)
