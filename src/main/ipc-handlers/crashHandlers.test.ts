import fs from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/userData'),
    getVersion: vi.fn().mockReturnValue('0.0.0'),
  },
  ipcMain: { handle: vi.fn() },
  shell: { openPath: vi.fn().mockResolvedValue('') },
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
    stat: vi.fn().mockResolvedValue({ mtime: new Date() }),
    unlink: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../utils', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock('../crashReporterStorage', () => ({
  getCrashReportDirPath: vi.fn().mockReturnValue('/tmp/crashReports'),
}));

vi.mock('../logger', () => ({
  default: { error: vi.fn() },
}));

import { ipcMain } from 'electron';

import { registerCrashLogHandlers } from './crashHandlers';

// Helper: extract a registered handler by channel name from ipcMain.handle mock calls.
function getHandler(channel: string): ((...args: unknown[]) => Promise<unknown>) | undefined {
  const handleMock = vi.mocked(ipcMain.handle);
  const call = handleMock.mock.calls.find(([ch]) => ch === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('registerCrashLogHandlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear();
    vi.mocked(fs.readdir).mockResolvedValue([] as never);
    vi.mocked(fs.readFile).mockResolvedValue('' as never);
    vi.mocked(fs.stat).mockResolvedValue({ mtime: new Date() } as never);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers all six crash/log channels', () => {
    const channels: string[] = [];
    registerCrashLogHandlers(channels);
    expect(channels).toContain('app:getCrashLogs');
    expect(channels).toContain('app:getCrashLogCount');
    expect(channels).toContain('app:clearCrashLogs');
    expect(channels).toContain('app:openCrashLogDir');
    expect(channels).toContain('platform:openCrashReportsDir');
    expect(channels).toContain('app:logError');
    expect(ipcMain.handle).toHaveBeenCalledTimes(6);
  });

  describe('app:getCrashLogCount', () => {
    it('returns the correct count of .log files without reading file contents', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'crash-1.log',
        'crash-2.log',
        'crash-3.log',
        'not-a-log.txt',
      ] as never);

      const channels: string[] = [];
      registerCrashLogHandlers(channels);
      const handler = getHandler('app:getCrashLogCount');
      expect(handler).toBeDefined();

      const result = (await handler!({} as never)) as { success: boolean; count: number };

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('returns count of 0 when no .log files exist', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['readme.txt'] as never);

      const channels: string[] = [];
      registerCrashLogHandlers(channels);
      const handler = getHandler('app:getCrashLogCount');

      const result = (await handler!({} as never)) as { success: boolean; count: number };

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('returns failure when readdir throws', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('permission denied') as never);

      const channels: string[] = [];
      registerCrashLogHandlers(channels);
      const handler = getHandler('app:getCrashLogCount');

      const result = (await handler!({} as never)) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe('permission denied');
    });
  });

  describe('pruneCrashLogs (via writeCrashLog / registration)', () => {
    it('retains newest CRASH_LOG_RETENTION files and unlinks the rest', async () => {
      // Build 55 log files with distinct mtimes; newest 50 should survive.
      const allFiles = Array.from(
        { length: 55 },
        (_, i) => `crash-${String(i).padStart(3, '0')}.log`,
      );
      vi.mocked(fs.readdir).mockResolvedValue(allFiles as never);
      vi.mocked(fs.stat).mockImplementation((filePath: unknown) => {
        // Use regex to extract basename — path.join uses backslashes on Windows.
        const name = String(filePath).replace(/.*[/\\]/, '');
        const idx = parseInt(name.replace('crash-', '').replace('.log', ''), 10);
        // Higher index = newer mtime (index 54 is newest).
        return Promise.resolve({ mtime: new Date(1_000_000 + idx * 1000) }) as never;
      });

      const channels: string[] = [];
      registerCrashLogHandlers(channels);

      // Allow the fire-and-forget prune (from registration) to complete.
      // Multiple ticks needed: readdir → 55 stat() promises → unlink promises.
      await vi.waitFor(() => {
        expect(vi.mocked(fs.unlink).mock.calls.length).toBeGreaterThan(0);
      });

      // 55 files, keep newest 50 (indices 5-54), delete oldest 5 (indices 0-4).
      const unlinkedNames = vi
        .mocked(fs.unlink)
        .mock.calls.map((c) => String(c[0]).replace(/.*[/\\]/, ''));
      expect(unlinkedNames).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(unlinkedNames).toContain(`crash-${String(i).padStart(3, '0')}.log`);
      }
    });

    it('does not call unlink when file count is within retention limit', async () => {
      const files = Array.from({ length: 50 }, (_, i) => `crash-${i}.log`);
      vi.mocked(fs.readdir).mockResolvedValue(files as never);

      const channels: string[] = [];
      registerCrashLogHandlers(channels);

      // Give the fire-and-forget prune time to complete (readdir + early return).
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });
});
