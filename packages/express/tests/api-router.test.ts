import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Express } from 'express';
import request from 'supertest';
import {
  Telescope,
  EntryType,
  type StorageRepository,
  type TelescopeEntryData,
  type EntryFilter,
  type PaginatedResult,
} from '@node-telescope/core';
import { createApiRouter } from '../src/api-router.js';

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

describe('createApiRouter', () => {
  let app: Express;
  let telescope: Telescope;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    telescope = new Telescope({ enabled: true });
    telescope.start();
  });

  afterEach(async () => {
    await telescope.stop();
  });

  /** Helper to mount the API router on a fresh Express app with given entries */
  function setupApp(entries: TelescopeEntryData[] = [], config?: { gate?: (req: unknown) => boolean | Promise<boolean> }) {
    if (config?.gate) {
      // Recreate telescope with gate
      telescope = new Telescope({ enabled: true, gate: config.gate });
      telescope.start();
    }
    mockStorage = createMockStorage(entries);
    telescope.setStorage(mockStorage);

    app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(telescope));
    return app;
  }

  // ── GET /:type — list entries ──────────────────────────────────────

  describe('GET /:type', () => {
    it('should return entries from storage for a valid type', async () => {
      const entries = [
        makeEntry({ id: 'req-1', type: EntryType.Request }),
        makeEntry({ id: 'req-2', type: EntryType.Request }),
      ];
      setupApp(entries);

      const res = await request(app).get('/api/requests').expect(200);

      expect(res.body.entries).toHaveLength(2);
      expect(res.body).toHaveProperty('hasMore');
    });

    it('should return 400 for unknown entry type', async () => {
      setupApp();

      const res = await request(app).get('/api/unknown-type').expect(400);

      expect(res.body.error).toContain('Unknown entry type');
    });

    it('should return 503 when storage is not available', async () => {
      telescope = new Telescope({ enabled: true });
      telescope.start();
      // Do NOT set storage

      app = express();
      app.use(express.json());
      app.use('/api', createApiRouter(telescope));

      const res = await request(app).get('/api/requests').expect(503);

      expect(res.body.error).toBe('Storage not available');
    });

    it('should pass pagination parameters to storage query', async () => {
      setupApp([makeEntry({ type: EntryType.Request })]);

      await request(app)
        .get('/api/requests?take=10&before=some-id&tag=GET')
        .expect(200);

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
      setupApp([makeEntry({ type: EntryType.Request })]);

      await request(app).get('/api/requests?take=9999').expect(200);

      expect(mockStorage.query).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should default take to 50', async () => {
      setupApp([makeEntry({ type: EntryType.Request })]);

      await request(app).get('/api/requests').expect(200);

      expect(mockStorage.query).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  // ── GET /:type/:id — single entry ─────────────────────────────────

  describe('GET /:type/:id', () => {
    it('should return a single entry by id', async () => {
      const entry = makeEntry({ id: 'req-42', type: EntryType.Request });
      setupApp([entry]);

      const res = await request(app).get('/api/requests/req-42').expect(200);

      expect(res.body.entry).toBeDefined();
      expect(res.body.entry.id).toBe('req-42');
    });

    it('should return 404 for non-existent entry', async () => {
      setupApp();

      await request(app).get('/api/requests/non-existent').expect(404);
    });

    it('should return 404 when entry type does not match URL segment', async () => {
      const entry = makeEntry({ id: 'log-1', type: EntryType.Log });
      setupApp([entry]);

      // Asking for it via /requests but it's actually a log
      await request(app).get('/api/requests/log-1').expect(404);
    });
  });

  // ── GET /entries/:id/batch ─────────────────────────────────────────

  describe('GET /entries/:id/batch', () => {
    it('should return all entries in the same batch', async () => {
      const entries = [
        makeEntry({ id: 'e1', batchId: 'batch-abc', type: EntryType.Request }),
        makeEntry({ id: 'e2', batchId: 'batch-abc', type: EntryType.Log }),
        makeEntry({ id: 'e3', batchId: 'batch-other', type: EntryType.Request }),
      ];
      setupApp(entries);

      const res = await request(app).get('/api/entries/e1/batch').expect(200);

      expect(res.body.entries).toHaveLength(2);
      expect(res.body.entries.map((e: TelescopeEntryData) => e.id).sort()).toEqual(['e1', 'e2']);
    });

    it('should return 404 for a non-existent entry id', async () => {
      setupApp();

      await request(app).get('/api/entries/ghost/batch').expect(404);
    });
  });

  // ── DELETE /entries — clear all ────────────────────────────────────

  describe('DELETE /entries', () => {
    it('should call storage.truncate and return success', async () => {
      setupApp([makeEntry()]);

      const res = await request(app).delete('/api/entries').expect(200);

      expect(res.body.success).toBe(true);
      expect(mockStorage.truncate).toHaveBeenCalled();
    });

    it('should return 503 when storage is not available', async () => {
      telescope = new Telescope({ enabled: true });
      telescope.start();

      app = express();
      app.use(express.json());
      app.use('/api', createApiRouter(telescope));

      await request(app).delete('/api/entries').expect(503);
    });
  });

  // ── GET /status ────────────────────────────────────────────────────

  describe('GET /status', () => {
    it('should return recording: true when telescope is recording', async () => {
      setupApp();

      const res = await request(app).get('/api/status').expect(200);

      expect(res.body.recording).toBe(true);
    });

    it('should return recording: false when telescope is paused', async () => {
      setupApp();
      telescope.pause();

      const res = await request(app).get('/api/status').expect(200);

      expect(res.body.recording).toBe(false);
    });
  });

  // ── POST /status — toggle recording ───────────────────────────────

  describe('POST /status', () => {
    it('should pause recording when { recording: false }', async () => {
      setupApp();

      const res = await request(app)
        .post('/api/status')
        .send({ recording: false })
        .expect(200);

      expect(res.body.recording).toBe(false);
      expect(telescope.isRecording()).toBe(false);
    });

    it('should resume recording when { recording: true }', async () => {
      setupApp();
      telescope.pause();

      const res = await request(app)
        .post('/api/status')
        .send({ recording: true })
        .expect(200);

      expect(res.body.recording).toBe(true);
      expect(telescope.isRecording()).toBe(true);
    });

    it('should return current state when no body is provided', async () => {
      setupApp();

      const res = await request(app)
        .post('/api/status')
        .send({})
        .expect(200);

      expect(res.body.recording).toBe(true);
    });
  });

  // ── Auth gate ──────────────────────────────────────────────────────

  describe('authorization gate', () => {
    it('should block access when gate returns false', async () => {
      setupApp([], { gate: () => false });

      const res = await request(app).get('/api/status').expect(403);

      expect(res.body.error).toBe('Unauthorized');
    });

    it('should allow access when gate returns true', async () => {
      setupApp([], { gate: () => true });

      const res = await request(app).get('/api/status').expect(200);

      expect(res.body.recording).toBe(true);
    });

    it('should support async gate functions', async () => {
      setupApp([], { gate: async () => false });

      const res = await request(app).get('/api/status').expect(403);

      expect(res.body.error).toBe('Unauthorized');
    });

    it('should block all API routes when gate denies', async () => {
      const entries = [makeEntry({ type: EntryType.Request })];
      setupApp(entries, { gate: () => false });

      await request(app).get('/api/requests').expect(403);
      await request(app).get('/api/status').expect(403);
      await request(app).delete('/api/entries').expect(403);
      await request(app).post('/api/status').send({ recording: false }).expect(403);
    });
  });
});
