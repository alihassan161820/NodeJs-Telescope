import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  EntryType,
  type StorageRepository,
  type TelescopeEntryData,
  type EntryFilter,
  type PaginatedResult,
} from '@node-telescope/core';
import { telescopePlugin } from '../src/plugin.js';

// ── Test data factories ──────────────────────────────────────────────

function makeEntry(overrides: Partial<TelescopeEntryData> = {}): TelescopeEntryData {
  return {
    id: overrides.id ?? `entry-${Math.random().toString(36).slice(2, 8)}`,
    batchId: overrides.batchId ?? 'batch-1',
    type: overrides.type ?? EntryType.Request,
    content: overrides.content ?? { method: 'GET', url: '/test' },
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

function createMockStorage(
  initialEntries: TelescopeEntryData[] = [],
): StorageRepository & { entries: TelescopeEntryData[] } {
  const entries = [...initialEntries];
  return {
    entries,
    store: vi.fn(async (entry: TelescopeEntryData) => {
      entries.push(entry);
    }),
    storeBatch: vi.fn(async (batch: TelescopeEntryData[]) => {
      entries.push(...batch);
    }),
    find: vi.fn(async (id: string) => entries.find((e) => e.id === id) ?? null),
    query: vi.fn(async (filter: EntryFilter): Promise<PaginatedResult<TelescopeEntryData>> => {
      let filtered = entries;
      if (filter.type) {
        filtered = filtered.filter((e) => e.type === filter.type);
      }
      const take = filter.take ?? 50;
      const result = filtered.slice(0, take);
      return { entries: result, hasMore: filtered.length > take };
    }),
    findByBatchId: vi.fn(async (batchId: string) => entries.filter((e) => e.batchId === batchId)),
    prune: vi.fn(async () => 0),
    truncate: vi.fn(async () => {
      entries.length = 0;
    }),
    close: vi.fn(async () => {}),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('API routes', () => {
  let app: FastifyInstance;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    // Will be set up per-test via setupApp
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  /** Helper to create a fresh Fastify app with telescope + given entries */
  async function setupApp(
    entries: TelescopeEntryData[] = [],
    config?: { gate?: (req: unknown) => boolean | Promise<boolean> },
  ): Promise<FastifyInstance> {
    mockStorage = createMockStorage(entries);

    app = Fastify();
    await app.register(telescopePlugin, {
      enabled: true,
      storage: mockStorage,
      gate: config?.gate,
    });

    await app.ready();
    return app;
  }

  // ── GET /:type — list entries ──────────────────────────────────

  describe('GET /:type', () => {
    it('should return entries from storage for a valid type', async () => {
      const entries = [
        makeEntry({ id: 'req-1', type: EntryType.Request }),
        makeEntry({ id: 'req-2', type: EntryType.Request }),
      ];
      await setupApp(entries);

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/requests',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries).toHaveLength(2);
      expect(body).toHaveProperty('hasMore');
    });

    it('should return 400 for unknown entry type', async () => {
      await setupApp();

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/unknown-type',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Unknown entry type');
    });

    it('should return 503 when storage is not available', async () => {
      await setupApp();

      // Spy on getStorage to simulate missing storage
      vi.spyOn(app.telescope, 'getStorage').mockReturnValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/requests',
      });

      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBe('Storage not available');
    });

    it('should pass pagination parameters to storage query', async () => {
      await setupApp([makeEntry({ type: EntryType.Request })]);

      await app.inject({
        method: 'GET',
        url: '/__telescope/api/requests?take=10&before=some-id&tag=GET',
      });

      expect(mockStorage.query).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EntryType.Request,
          take: 10,
          beforeId: 'some-id',
          tag: 'GET',
        }),
      );
    });

    it('should cap take at 100', async () => {
      await setupApp([makeEntry({ type: EntryType.Request })]);

      await app.inject({
        method: 'GET',
        url: '/__telescope/api/requests?take=9999',
      });

      expect(mockStorage.query).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should default take to 50', async () => {
      await setupApp([makeEntry({ type: EntryType.Request })]);

      await app.inject({
        method: 'GET',
        url: '/__telescope/api/requests',
      });

      expect(mockStorage.query).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  // ── GET /:type/:id — single entry ─────────────────────────────

  describe('GET /:type/:id', () => {
    it('should return a single entry by id', async () => {
      const entry = makeEntry({ id: 'req-42', type: EntryType.Request });
      await setupApp([entry]);

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/requests/req-42',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entry).toBeDefined();
      expect(body.entry.id).toBe('req-42');
    });

    it('should return 404 for non-existent entry', async () => {
      await setupApp();

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/requests/non-existent',
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 when entry type does not match URL segment', async () => {
      const entry = makeEntry({ id: 'log-1', type: EntryType.Log });
      await setupApp([entry]);

      // Asking for it via /requests but it's actually a log
      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/requests/log-1',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /entries/:id/batch ─────────────────────────────────────

  describe('GET /entries/:id/batch', () => {
    it('should return all entries in the same batch', async () => {
      const entries = [
        makeEntry({ id: 'e1', batchId: 'batch-abc', type: EntryType.Request }),
        makeEntry({ id: 'e2', batchId: 'batch-abc', type: EntryType.Log }),
        makeEntry({ id: 'e3', batchId: 'batch-other', type: EntryType.Request }),
      ];
      await setupApp(entries);

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/entries/e1/batch',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries).toHaveLength(2);
      expect(body.entries.map((e: TelescopeEntryData) => e.id).sort()).toEqual(['e1', 'e2']);
    });

    it('should return 404 for a non-existent entry id', async () => {
      await setupApp();

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/entries/ghost/batch',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── DELETE /entries — clear all ────────────────────────────────

  describe('DELETE /entries', () => {
    it('should call storage.truncate and return success', async () => {
      await setupApp([makeEntry()]);

      const res = await app.inject({
        method: 'DELETE',
        url: '/__telescope/api/entries',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockStorage.truncate).toHaveBeenCalled();
    });

    it('should return 503 when storage is not available', async () => {
      await setupApp([makeEntry()]);

      vi.spyOn(app.telescope, 'getStorage').mockReturnValue(null);

      const res = await app.inject({
        method: 'DELETE',
        url: '/__telescope/api/entries',
      });

      expect(res.statusCode).toBe(503);
    });
  });

  // ── GET /status ────────────────────────────────────────────────

  describe('GET /status', () => {
    it('should return recording: true when telescope is recording', async () => {
      await setupApp();

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/status',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().recording).toBe(true);
    });

    it('should return recording: false when telescope is paused', async () => {
      await setupApp();
      app.telescope.pause();

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/status',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().recording).toBe(false);
    });
  });

  // ── POST /status — toggle recording ───────────────────────────

  describe('POST /status', () => {
    it('should pause recording when { recording: false }', async () => {
      await setupApp();

      const res = await app.inject({
        method: 'POST',
        url: '/__telescope/api/status',
        payload: { recording: false },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().recording).toBe(false);
      expect(app.telescope.isRecording()).toBe(false);
    });

    it('should resume recording when { recording: true }', async () => {
      await setupApp();
      app.telescope.pause();

      const res = await app.inject({
        method: 'POST',
        url: '/__telescope/api/status',
        payload: { recording: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().recording).toBe(true);
      expect(app.telescope.isRecording()).toBe(true);
    });

    it('should return current state when no body is provided', async () => {
      await setupApp();

      const res = await app.inject({
        method: 'POST',
        url: '/__telescope/api/status',
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().recording).toBe(true);
    });
  });

  // ── Auth gate ──────────────────────────────────────────────────

  describe('authorization gate', () => {
    it('should block access when gate returns false', async () => {
      await setupApp([], { gate: () => false });

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/status',
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('Unauthorized');
    });

    it('should allow access when gate returns true', async () => {
      await setupApp([], { gate: () => true });

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/status',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().recording).toBe(true);
    });

    it('should support async gate functions', async () => {
      await setupApp([], { gate: async () => false });

      const res = await app.inject({
        method: 'GET',
        url: '/__telescope/api/status',
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('Unauthorized');
    });

    it('should block all API routes when gate denies', async () => {
      const entries = [makeEntry({ type: EntryType.Request })];
      await setupApp(entries, { gate: () => false });

      const res1 = await app.inject({ method: 'GET', url: '/__telescope/api/requests' });
      const res2 = await app.inject({ method: 'GET', url: '/__telescope/api/status' });
      const res3 = await app.inject({ method: 'DELETE', url: '/__telescope/api/entries' });
      const res4 = await app.inject({
        method: 'POST',
        url: '/__telescope/api/status',
        payload: { recording: false },
      });

      expect(res1.statusCode).toBe(403);
      expect(res2.statusCode).toBe(403);
      expect(res3.statusCode).toBe(403);
      expect(res4.statusCode).toBe(403);
    });
  });
});
