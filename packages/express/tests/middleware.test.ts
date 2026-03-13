import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Express } from 'express';
import request from 'supertest';
import {
  Telescope,
  EntryType,
  getContext,
  type StorageRepository,
  type TelescopeEntryData,
  type EntryFilter,
  type PaginatedResult,
} from '@node-telescope/core';
import { createMiddleware } from '../src/middleware.js';

/** Minimal mock storage that tracks stored entries */
function createMockStorage(): StorageRepository & { entries: TelescopeEntryData[] } {
  const entries: TelescopeEntryData[] = [];
  return {
    entries,
    store: vi.fn(async (entry: TelescopeEntryData) => {
      entries.push(entry);
    }),
    storeBatch: vi.fn(async (batch: TelescopeEntryData[]) => {
      entries.push(...batch);
    }),
    find: vi.fn(async (id: string) => entries.find((e) => e.id === id) ?? null),
    query: vi.fn(async (_filter: EntryFilter): Promise<PaginatedResult<TelescopeEntryData>> => ({
      entries: [],
      hasMore: false,
    })),
    findByBatchId: vi.fn(async (batchId: string) => entries.filter((e) => e.batchId === batchId)),
    prune: vi.fn(async () => 0),
    truncate: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
}

describe('createMiddleware', () => {
  let app: Express;
  let telescope: Telescope;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    telescope = new Telescope({ enabled: true });
    telescope.start();
    mockStorage = createMockStorage();
    telescope.setStorage(mockStorage);

    app = express();
    app.use(express.json());

    const middleware = createMiddleware(telescope);
    app.use(middleware);

    // Test routes
    app.get('/hello', (_req, res) => {
      res.json({ message: 'world' });
    });

    app.post('/echo', (req, res) => {
      res.json({ received: req.body });
    });

    app.get('/error-route', (_req, res) => {
      res.status(500).json({ error: 'something broke' });
    });

    app.get('/text-response', (_req, res) => {
      res.type('text/plain').send('plain text body');
    });
  });

  afterEach(async () => {
    await telescope.stop();
  });

  // ── Skips telescope paths ──────────────────────────────────────────
  it('should skip requests to /__telescope paths', async () => {
    // The telescope defaults to ignorePaths: ['/__telescope']
    app.get('/__telescope/api/requests', (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get('/__telescope/api/requests').expect(200);

    // Give async store a tick to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(0);
  });

  it('should skip requests to /__telescope sub-paths', async () => {
    app.get('/__telescope/some/deep/path', (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get('/__telescope/some/deep/path').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(0);
  });

  // ── Paused recording ───────────────────────────────────────────────
  it('should not record when telescope is paused', async () => {
    telescope.pause();

    await request(app).get('/hello').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(0);
  });

  it('should resume recording after being un-paused', async () => {
    telescope.pause();
    await request(app).get('/hello').expect(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockStorage.entries).toHaveLength(0);

    telescope.resume();
    await request(app).get('/hello').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(1);
  });

  // ── Request data capture ───────────────────────────────────────────
  it('should capture request method and url', async () => {
    await request(app).get('/hello').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(1);
    const entry = mockStorage.entries[0]!;
    expect(entry.type).toBe(EntryType.Request);
    expect(entry.content['method']).toBe('GET');
    expect(entry.content['url']).toBe('/hello');
  });

  it('should capture request path', async () => {
    await request(app).get('/hello?foo=bar').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['path']).toBe('/hello');
  });

  it('should capture request headers', async () => {
    await request(app)
      .get('/hello')
      .set('X-Custom-Header', 'test-value')
      .expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['x-custom-header']).toBe('test-value');
  });

  it('should capture request body for POST', async () => {
    const body = { name: 'telescope', version: 1 };
    await request(app).post('/echo').send(body).expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['method']).toBe('POST');
    const payload = entry.content['payload'] as Record<string, unknown>;
    expect(payload['name']).toBe('telescope');
    expect(payload['version']).toBe(1);
  });

  // ── Response data capture ──────────────────────────────────────────
  it('should capture response status code', async () => {
    await request(app).get('/hello').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['responseStatus']).toBe(200);
  });

  it('should capture 5xx response status', async () => {
    await request(app).get('/error-route').expect(500);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['responseStatus']).toBe(500);
  });

  it('should capture JSON response body', async () => {
    await request(app).get('/hello').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const responseBody = entry.content['response'] as Record<string, unknown>;
    expect(responseBody).toEqual({ message: 'world' });
  });

  it('should capture text response body as string', async () => {
    await request(app).get('/text-response').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['response']).toBe('plain text body');
  });

  it('should capture response headers', async () => {
    app.get('/with-headers', (_req, res) => {
      res.set('X-Custom-Response', 'hello');
      res.json({ ok: true });
    });

    await request(app).get('/with-headers').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const resHeaders = entry.content['responseHeaders'] as Record<string, string>;
    expect(resHeaders['x-custom-response']).toBe('hello');
  });

  // ── Sensitive header masking ───────────────────────────────────────
  it('should mask authorization header', async () => {
    await request(app)
      .get('/hello')
      .set('Authorization', 'Bearer super-secret-token')
      .expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['authorization']).toBe('********');
  });

  it('should mask cookie header', async () => {
    await request(app)
      .get('/hello')
      .set('Cookie', 'session=abc123')
      .expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['cookie']).toBe('********');
  });

  it('should not mask non-sensitive headers', async () => {
    await request(app)
      .get('/hello')
      .set('X-Request-Id', 'req-123')
      .expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['x-request-id']).toBe('req-123');
  });

  // ── AsyncLocalStorage context ──────────────────────────────────────
  it('should run request within AsyncLocalStorage context (batchId is set)', async () => {
    let capturedBatchId: string | undefined;

    app.get('/context-check', (_req, res) => {
      const ctx = getContext();
      capturedBatchId = ctx?.batchId;
      res.json({ hasBatchId: !!ctx?.batchId });
    });

    await request(app).get('/context-check').expect(200);

    expect(capturedBatchId).toBeDefined();
    expect(typeof capturedBatchId).toBe('string');
    // UUID format: 8-4-4-4-12
    expect(capturedBatchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should set matching batchId on recorded entry', async () => {
    let capturedBatchId: string | undefined;

    app.get('/batch-match', (_req, res) => {
      const ctx = getContext();
      capturedBatchId = ctx?.batchId;
      res.json({ ok: true });
    });

    await request(app).get('/batch-match').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(1);
    const entry = mockStorage.entries[0]!;
    expect(entry.batchId).toBe(capturedBatchId);
  });

  // ── Error resilience ───────────────────────────────────────────────
  it('should never throw even if storage.store throws', async () => {
    mockStorage.store = vi.fn(async () => {
      throw new Error('Storage write failure');
    });

    const res = await request(app).get('/hello');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'world' });
  });

  it('should never throw even if telescope internals error', async () => {
    // Forcibly break the watcher
    vi.spyOn(telescope.watchers, 'get').mockImplementation(() => {
      throw new Error('watcher explosion');
    });

    const res = await request(app).get('/hello');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'world' });
  });

  // ── Duration tracking ──────────────────────────────────────────────
  it('should record a non-negative duration', async () => {
    await request(app).get('/hello').expect(200);
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(typeof entry.content['duration']).toBe('number');
    expect(entry.content['duration'] as number).toBeGreaterThanOrEqual(0);
  });
});
