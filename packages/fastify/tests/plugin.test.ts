import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  Telescope,
  EntryType,
  getContext,
  type StorageRepository,
  type TelescopeEntryData,
  type EntryFilter,
  type PaginatedResult,
} from '@node-telescope/core';
import { telescopePlugin } from '../src/plugin.js';

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

describe('telescopePlugin', () => {
  let app: FastifyInstance;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(async () => {
    mockStorage = createMockStorage();

    app = Fastify();

    // Register the telescope plugin with our mock storage
    await app.register(telescopePlugin, {
      enabled: true,
      storage: mockStorage,
    });

    // Test routes
    app.get('/hello', async () => {
      return { message: 'world' };
    });

    app.post('/echo', async (request) => {
      return { received: request.body };
    });

    app.get('/error-route', async (_request, reply) => {
      reply.code(500);
      return { error: 'something broke' };
    });

    app.get('/text-response', async (_request, reply) => {
      reply.type('text/plain');
      return 'plain text body';
    });

    app.get('/with-headers', async (_request, reply) => {
      reply.header('x-custom-response', 'hello');
      return { ok: true };
    });

    app.get('/context-check', async () => {
      const ctx = getContext();
      contextCheckBatchId = ctx?.batchId;
      return { hasBatchId: !!ctx?.batchId };
    });

    app.get('/batch-match', async () => {
      const ctx = getContext();
      batchMatchBatchId = ctx?.batchId;
      return { ok: true };
    });

    await app.ready();
  });

  // Shared variables for context tests
  let contextCheckBatchId: string | undefined;
  let batchMatchBatchId: string | undefined;

  afterEach(async () => {
    await app.close();
  });

  // ── Plugin registration ─────────────────────────────────────────
  it('should register successfully and decorate fastify with telescope', () => {
    expect(app.telescope).toBeDefined();
    expect(app.telescope).toBeInstanceOf(Telescope);
  });

  // ── Skips telescope paths ───────────────────────────────────────
  it('should skip requests to /__telescope paths', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/__telescope/api/status',
    });

    // The telescope API route should respond
    expect(res.statusCode).toBe(200);

    // Give async store a tick to complete
    await new Promise((r) => setTimeout(r, 50));

    // No entries should have been recorded for telescope's own paths
    expect(mockStorage.entries).toHaveLength(0);
  });

  it('should skip requests to /__telescope sub-paths', async () => {
    await app.inject({
      method: 'GET',
      url: '/__telescope/api/requests',
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(0);
  });

  // ── Paused recording ────────────────────────────────────────────
  it('should not record when telescope is paused', async () => {
    app.telescope.pause();

    await app.inject({ method: 'GET', url: '/hello' });
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(0);
  });

  it('should resume recording after being un-paused', async () => {
    app.telescope.pause();
    await app.inject({ method: 'GET', url: '/hello' });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockStorage.entries).toHaveLength(0);

    app.telescope.resume();
    await app.inject({ method: 'GET', url: '/hello' });
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(1);
  });

  // ── Request data capture ────────────────────────────────────────
  it('should capture request method and url', async () => {
    await app.inject({ method: 'GET', url: '/hello' });
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(1);
    const entry = mockStorage.entries[0]!;
    expect(entry.type).toBe(EntryType.Request);
    expect(entry.content['method']).toBe('GET');
    expect(entry.content['url']).toBe('/hello');
  });

  it('should capture request path', async () => {
    await app.inject({ method: 'GET', url: '/hello?foo=bar' });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['path']).toBe('/hello');
  });

  it('should capture request headers', async () => {
    await app.inject({
      method: 'GET',
      url: '/hello',
      headers: { 'x-custom-header': 'test-value' },
    });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['x-custom-header']).toBe('test-value');
  });

  it('should capture request body for POST', async () => {
    const body = { name: 'telescope', version: 1 };
    await app.inject({
      method: 'POST',
      url: '/echo',
      payload: body,
      headers: { 'content-type': 'application/json' },
    });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['method']).toBe('POST');
    const payload = entry.content['payload'] as Record<string, unknown>;
    expect(payload['name']).toBe('telescope');
    expect(payload['version']).toBe(1);
  });

  // ── Response data capture ───────────────────────────────────────
  it('should capture response status code', async () => {
    await app.inject({ method: 'GET', url: '/hello' });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['responseStatus']).toBe(200);
  });

  it('should capture 5xx response status', async () => {
    await app.inject({ method: 'GET', url: '/error-route' });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['responseStatus']).toBe(500);
  });

  it('should capture JSON response body', async () => {
    await app.inject({ method: 'GET', url: '/hello' });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const responseBody = entry.content['response'] as Record<string, unknown>;
    expect(responseBody).toEqual({ message: 'world' });
  });

  it('should capture text response body as string', async () => {
    await app.inject({ method: 'GET', url: '/text-response' });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(entry.content['response']).toBe('plain text body');
  });

  it('should capture response headers', async () => {
    await app.inject({ method: 'GET', url: '/with-headers' });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const resHeaders = entry.content['responseHeaders'] as Record<string, string>;
    expect(resHeaders['x-custom-response']).toBe('hello');
  });

  // ── Sensitive header masking ────────────────────────────────────
  it('should mask authorization header', async () => {
    await app.inject({
      method: 'GET',
      url: '/hello',
      headers: { authorization: 'Bearer super-secret-token' },
    });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['authorization']).toBe('********');
  });

  it('should mask cookie header', async () => {
    await app.inject({
      method: 'GET',
      url: '/hello',
      headers: { cookie: 'session=abc123' },
    });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['cookie']).toBe('********');
  });

  it('should not mask non-sensitive headers', async () => {
    await app.inject({
      method: 'GET',
      url: '/hello',
      headers: { 'x-request-id': 'req-123' },
    });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['x-request-id']).toBe('req-123');
  });

  // ── AsyncLocalStorage context ───────────────────────────────────
  it('should run request within AsyncLocalStorage context (batchId is set)', async () => {
    contextCheckBatchId = undefined;

    await app.inject({ method: 'GET', url: '/context-check' });

    expect(contextCheckBatchId).toBeDefined();
    expect(typeof contextCheckBatchId).toBe('string');
    // UUID format: 8-4-4-4-12
    expect(contextCheckBatchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should set matching batchId on recorded entry', async () => {
    batchMatchBatchId = undefined;

    await app.inject({ method: 'GET', url: '/batch-match' });
    await new Promise((r) => setTimeout(r, 50));

    expect(mockStorage.entries).toHaveLength(1);
    const entry = mockStorage.entries[0]!;
    expect(entry.batchId).toBe(batchMatchBatchId);
  });

  // ── Error resilience ────────────────────────────────────────────
  it('should never throw even if storage.store throws', async () => {
    mockStorage.store = vi.fn(async () => {
      throw new Error('Storage write failure');
    });

    const res = await app.inject({ method: 'GET', url: '/hello' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ message: 'world' });
  });

  it('should never throw even if telescope internals error', async () => {
    // Forcibly break the watcher
    vi.spyOn(app.telescope.watchers, 'get').mockImplementation(() => {
      throw new Error('watcher explosion');
    });

    const res = await app.inject({ method: 'GET', url: '/hello' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ message: 'world' });
  });

  // ── Duration tracking ───────────────────────────────────────────
  it('should record a non-negative duration', async () => {
    await app.inject({ method: 'GET', url: '/hello' });
    await new Promise((r) => setTimeout(r, 50));

    const entry = mockStorage.entries[0]!;
    expect(typeof entry.content['duration']).toBe('number');
    expect(entry.content['duration'] as number).toBeGreaterThanOrEqual(0);
  });
});
