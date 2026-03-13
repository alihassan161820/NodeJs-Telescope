import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Telescope } from '../src/telescope.js';
import { IncomingEntry } from '../src/incoming-entry.js';
import { EntryType } from '../src/entry-type.js';
import type { StorageRepository } from '../src/contracts/storage-repository.js';
import type { TelescopeEntryData, PaginatedResult } from '../src/types.js';

function createMockStorage(): StorageRepository {
  return {
    store: vi.fn().mockResolvedValue(undefined),
    storeBatch: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(null),
    query: vi.fn().mockResolvedValue({ entries: [], hasMore: false } satisfies PaginatedResult<TelescopeEntryData>),
    findByBatchId: vi.fn().mockResolvedValue([]),
    prune: vi.fn().mockResolvedValue(0),
    truncate: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Telescope', () => {
  let telescope: Telescope;
  let mockStorage: StorageRepository;

  beforeEach(() => {
    telescope = new Telescope({ enabled: true });
    mockStorage = createMockStorage();
    telescope.setStorage(mockStorage);
  });

  afterEach(async () => {
    await telescope.stop();
  });

  it('records entries to storage', async () => {
    const entry = new IncomingEntry(EntryType.Request, { method: 'GET', path: '/' });
    entry.setBatchId('test-batch');

    telescope.recordEntry(entry);

    // Wait for async storage call
    await new Promise((r) => setTimeout(r, 10));

    expect(mockStorage.store).toHaveBeenCalledOnce();
    const storedData = (mockStorage.store as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as TelescopeEntryData;
    expect(storedData.type).toBe(EntryType.Request);
    expect(storedData.content['method']).toBe('GET');
  });

  it('auto-extracts tags on entries', async () => {
    const entry = new IncomingEntry(EntryType.Request, {
      method: 'POST',
      responseStatus: 404,
      path: '/missing',
    });
    entry.setBatchId('test-batch');

    telescope.recordEntry(entry);

    await new Promise((r) => setTimeout(r, 10));

    const storedData = (mockStorage.store as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as TelescopeEntryData;
    expect(storedData.tags).toContain('POST');
    expect(storedData.tags).toContain('status:404');
    expect(storedData.tags).toContain('error');
  });

  it('masks sensitive data before storage', async () => {
    const entry = new IncomingEntry(EntryType.Request, {
      method: 'POST',
      password: 'secret123',
      token: 'jwt-abc',
      username: 'alice',
    });
    entry.setBatchId('test-batch');

    telescope.recordEntry(entry);

    await new Promise((r) => setTimeout(r, 10));

    const storedData = (mockStorage.store as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as TelescopeEntryData;
    expect(storedData.content['password']).toBe('********');
    expect(storedData.content['token']).toBe('********');
    expect(storedData.content['username']).toBe('alice');
  });

  it('emits entry event for WebSocket', () => {
    const listener = vi.fn();
    telescope.on('entry', listener);

    const entry = new IncomingEntry(EntryType.Log, { level: 'info', message: 'test' });
    entry.setBatchId('test-batch');

    telescope.recordEntry(entry);

    expect(listener).toHaveBeenCalledOnce();
  });

  it('respects recording filter', async () => {
    telescope = new Telescope({
      enabled: true,
      recordingFilter: (e) => e.type !== EntryType.Log,
    });
    telescope.setStorage(mockStorage);

    const logEntry = new IncomingEntry(EntryType.Log, { level: 'debug' });
    logEntry.setBatchId('test');
    telescope.recordEntry(logEntry);

    const reqEntry = new IncomingEntry(EntryType.Request, { method: 'GET' });
    reqEntry.setBatchId('test');
    telescope.recordEntry(reqEntry);

    await new Promise((r) => setTimeout(r, 10));

    expect(mockStorage.store).toHaveBeenCalledOnce();
    const storedData = (mockStorage.store as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as TelescopeEntryData;
    expect(storedData.type).toBe(EntryType.Request);
  });

  it('does not record when paused', () => {
    telescope.pause();

    const entry = new IncomingEntry(EntryType.Request, { method: 'GET' });
    entry.setBatchId('test');
    telescope.recordEntry(entry);

    expect(mockStorage.store).not.toHaveBeenCalled();
  });

  it('resumes recording after pause', async () => {
    telescope.pause();
    telescope.resume();

    const entry = new IncomingEntry(EntryType.Request, { method: 'GET' });
    entry.setBatchId('test');
    telescope.recordEntry(entry);

    await new Promise((r) => setTimeout(r, 10));

    expect(mockStorage.store).toHaveBeenCalledOnce();
  });

  it('does not record when disabled', () => {
    telescope = new Telescope({ enabled: false });
    telescope.setStorage(mockStorage);

    const entry = new IncomingEntry(EntryType.Request, { method: 'GET' });
    telescope.recordEntry(entry);

    expect(mockStorage.store).not.toHaveBeenCalled();
  });

  it('ignores telescope paths', () => {
    expect(telescope.shouldIgnorePath('/__telescope')).toBe(true);
    expect(telescope.shouldIgnorePath('/__telescope/api/requests')).toBe(true);
    expect(telescope.shouldIgnorePath('/api/users')).toBe(false);
  });

  it('never throws from recordEntry', () => {
    const brokenStorage = createMockStorage();
    (brokenStorage.store as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));
    telescope.setStorage(brokenStorage);

    // Should not throw
    const entry = new IncomingEntry(EntryType.Request, { method: 'GET' });
    entry.setBatchId('test');
    expect(() => telescope.recordEntry(entry)).not.toThrow();
  });
});
