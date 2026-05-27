/**
 * configMigrations.test.ts — unit tests for one-shot config migrations.
 *
 * Uses vitest's module mocking to intercept ensureStore so the tests run
 * in Node (no Electron, no real electron-store on disk).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ensureStore before importing the module under test
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
let mockStoreData: Record<string, unknown> = {};

vi.mock('./configStoreLazy', () => ({
  ensureStore: () => ({
    get: mockGet,
    set: mockSet,
    delete: mockDelete,
    get store() { return mockStoreData; },
  }),
}));

import { migrateChatPrimary, migrateChatSurface } from './configMigrations';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migrateChatPrimary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when layout is absent', () => {
    mockGet.mockReturnValue(undefined);
    migrateChatPrimary();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('no-ops when layout.chatPrimary is false', () => {
    mockGet.mockReturnValue({ presets: { v2: true }, chatPrimary: false, immersiveChat: false });
    migrateChatPrimary();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('no-ops when layout.chatPrimary is absent (already migrated)', () => {
    mockGet.mockReturnValue({ presets: { v2: true }, immersiveChat: true });
    migrateChatPrimary();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('sets immersiveChat=true and removes chatPrimary when chatPrimary===true', () => {
    mockGet.mockReturnValue({ presets: { v2: true }, chatPrimary: true, immersiveChat: false });
    migrateChatPrimary();
    expect(mockSet).toHaveBeenCalledOnce();
    const [key, value] = mockSet.mock.calls[0] as [string, Record<string, unknown>];
    expect(key).toBe('layout');
    expect(value).not.toHaveProperty('chatPrimary');
    expect(value.immersiveChat).toBe(true);
    expect(value.presets).toEqual({ v2: true });
  });

  it('preserves all other layout keys during migration', () => {
    mockGet.mockReturnValue({
      presets: { v2: true },
      chatPrimary: true,
      dragAndDrop: true,
      mobilePrimary: false,
    });
    migrateChatPrimary();
    const [, value] = mockSet.mock.calls[0] as [string, Record<string, unknown>];
    expect(value.dragAndDrop).toBe(true);
    expect(value.mobilePrimary).toBe(false);
  });

  it('is idempotent — calling twice with already-migrated config is a no-op on second call', () => {
    // First call: chatPrimary present → migrate
    mockGet.mockReturnValueOnce({ chatPrimary: true });
    migrateChatPrimary();
    expect(mockSet).toHaveBeenCalledOnce();

    // Second call: simulate post-migration state (chatPrimary gone)
    mockGet.mockReturnValueOnce({ immersiveChat: true });
    migrateChatPrimary();
    expect(mockSet).toHaveBeenCalledOnce(); // still only once total
  });
});

describe('migrateChatSurface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreData = {};
  });

  it('no-ops when no legacy chat keys are present', () => {
    mockStoreData = { terminal: true };
    mockGet.mockReturnValue(undefined);
    migrateChatSurface();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('deletes agentChatSettings when present', () => {
    mockStoreData = { agentChatSettings: { defaultProvider: 'claude-code' } };
    mockGet.mockReturnValue(undefined);
    migrateChatSurface();
    expect(mockDelete).toHaveBeenCalledWith('agentChatSettings');
  });

  it('deletes contextLayer when present', () => {
    mockStoreData = { contextLayer: { enabled: true } };
    mockGet.mockReturnValue(undefined);
    migrateChatSurface();
    expect(mockDelete).toHaveBeenCalledWith('contextLayer');
  });

  it('removes agentChat sub-key from modelSlots when present', () => {
    mockStoreData = {};
    mockGet.mockReturnValue({ terminal: 'claude-code:sonnet', agentChat: 'claude-code:opus', claudeMdGeneration: '' });
    migrateChatSurface();
    const [key, value] = mockSet.mock.calls[0] as [string, Record<string, unknown>];
    expect(key).toBe('modelSlots');
    expect(value).not.toHaveProperty('agentChat');
    expect(value.terminal).toBe('claude-code:sonnet');
  });

  it('no-ops modelSlots when agentChat sub-key is absent', () => {
    mockStoreData = {};
    mockGet.mockReturnValue({ terminal: 'claude-code:sonnet', claudeMdGeneration: '' });
    migrateChatSurface();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('is idempotent — already-migrated config produces no writes', () => {
    mockStoreData = { terminal: true, modelSlots: { terminal: '' } };
    mockGet.mockReturnValue({ terminal: '' });
    migrateChatSurface();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
