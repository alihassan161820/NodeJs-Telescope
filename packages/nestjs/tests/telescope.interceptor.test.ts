import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { Controller, Get, Post, Body, type INestApplication } from '@nestjs/common';
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
import { TelescopeModule } from '../src/telescope.module.js';
import { TELESCOPE_INSTANCE } from '../src/telescope.constants.js';

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
      entries: [...entries],
      hasMore: false,
    })),
    findByBatchId: vi.fn(async (batchId: string) => entries.filter((e) => e.batchId === batchId)),
    prune: vi.fn(async () => 0),
    truncate: vi.fn(async () => {
      entries.length = 0;
    }),
    close: vi.fn(async () => {}),
  };
}

// ── Test controllers ──────────────────────────────────────────────────

@Controller()
class TestAppController {
  @Get('hello')
  hello() {
    return { message: 'world' };
  }

  @Post('echo')
  echo(@Body() body: unknown) {
    return { received: body };
  }

  @Get('error-route')
  errorRoute() {
    // We return a 500 via NestJS HttpException in a real app, but
    // for simplicity we just return a body with a specific property
    return { error: 'something broke' };
  }

  @Get('text-response')
  textResponse() {
    return 'plain text body';
  }

  @Get('context-check')
  contextCheck() {
    const ctx = getContext();
    return { hasBatchId: !!ctx?.batchId, batchId: ctx?.batchId };
  }
}

describe('TelescopeInterceptor', () => {
  let app: INestApplication;
  let mockStorage: ReturnType<typeof createMockStorage>;
  let telescope: Telescope;

  beforeEach(async () => {
    mockStorage = createMockStorage();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TelescopeModule.forRoot({
          enabled: true,
          storage: mockStorage,
        }),
      ],
      controllers: [TestAppController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    telescope = moduleRef.get<Telescope>(TELESCOPE_INSTANCE);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  /** Wait for the async fire-and-forget store to complete */
  async function waitForStorage(ms = 150): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  // ── Basic request recording ─────────────────────────────────────────

  it('should record a GET request', async () => {
    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    expect(mockStorage.entries.length).toBeGreaterThanOrEqual(1);
    const entry = mockStorage.entries.find((e) => (e.content['url'] as string) === '/hello');
    expect(entry).toBeDefined();
    expect(entry!.type).toBe(EntryType.Request);
    expect(entry!.content['method']).toBe('GET');
  });

  it('should record a POST request with body', async () => {
    const body = { name: 'telescope', version: 1 };
    await request(app.getHttpServer())
      .post('/echo')
      .send(body)
      .expect(201);
    await waitForStorage();

    const entry = mockStorage.entries.find((e) => (e.content['url'] as string) === '/echo');
    expect(entry).toBeDefined();
    expect(entry!.content['method']).toBe('POST');
    const payload = entry!.content['payload'] as Record<string, unknown>;
    expect(payload['name']).toBe('telescope');
    expect(payload['version']).toBe(1);
  });

  // ── Response capture ────────────────────────────────────────────────

  it('should capture response status code', async () => {
    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    const entry = mockStorage.entries.find((e) => (e.content['url'] as string) === '/hello');
    expect(entry).toBeDefined();
    expect(entry!.content['responseStatus']).toBe(200);
  });

  it('should capture JSON response body', async () => {
    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    const entry = mockStorage.entries.find((e) => (e.content['url'] as string) === '/hello');
    expect(entry).toBeDefined();
    const responseBody = entry!.content['response'] as Record<string, unknown>;
    expect(responseBody).toEqual({ message: 'world' });
  });

  it('should capture response headers', async () => {
    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    const entry = mockStorage.entries.find((e) => (e.content['url'] as string) === '/hello');
    expect(entry).toBeDefined();
    const resHeaders = entry!.content['responseHeaders'] as Record<string, string>;
    expect(resHeaders['content-type']).toContain('application/json');
  });

  // ── Request headers ─────────────────────────────────────────────────

  it('should capture request headers', async () => {
    await request(app.getHttpServer())
      .get('/hello')
      .set('X-Custom-Header', 'test-value')
      .expect(200);
    await waitForStorage();

    const entry = mockStorage.entries.find((e) => (e.content['url'] as string) === '/hello');
    expect(entry).toBeDefined();
    const headers = entry!.content['headers'] as Record<string, string>;
    expect(headers['x-custom-header']).toBe('test-value');
  });

  it('should mask authorization header', async () => {
    await request(app.getHttpServer())
      .get('/hello')
      .set('Authorization', 'Bearer super-secret-token')
      .expect(200);
    await waitForStorage();

    const entry = mockStorage.entries.find((e) => (e.content['url'] as string) === '/hello');
    expect(entry).toBeDefined();
    const headers = entry!.content['headers'] as Record<string, string>;
    expect(headers['authorization']).toBe('********');
  });

  it('should mask cookie header', async () => {
    await request(app.getHttpServer())
      .get('/hello')
      .set('Cookie', 'session=abc123')
      .expect(200);
    await waitForStorage();

    const entry = mockStorage.entries.find((e) => (e.content['url'] as string) === '/hello');
    expect(entry).toBeDefined();
    const headers = entry!.content['headers'] as Record<string, string>;
    expect(headers['cookie']).toBe('********');
  });

  // ── Skip telescope paths ───────────────────────────────────────────

  it('should skip requests to /__telescope paths', async () => {
    await request(app.getHttpServer()).get('/__telescope/api/status').expect(200);
    await waitForStorage();

    // Only telescope API responses should exist, no recorded entries for telescope paths
    const telescopeEntries = mockStorage.entries.filter(
      (e) => (e.content['url'] as string).includes('__telescope'),
    );
    expect(telescopeEntries).toHaveLength(0);
  });

  // ── Paused recording ───────────────────────────────────────────────

  it('should not record when telescope is paused', async () => {
    telescope.pause();

    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    const appEntries = mockStorage.entries.filter(
      (e) => (e.content['url'] as string) === '/hello',
    );
    expect(appEntries).toHaveLength(0);
  });

  it('should resume recording after being un-paused', async () => {
    telescope.pause();

    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    const entriesBefore = mockStorage.entries.filter(
      (e) => (e.content['url'] as string) === '/hello',
    );
    expect(entriesBefore).toHaveLength(0);

    telescope.resume();

    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    const entriesAfter = mockStorage.entries.filter(
      (e) => (e.content['url'] as string) === '/hello',
    );
    expect(entriesAfter).toHaveLength(1);
  });

  // ── AsyncLocalStorage context ──────────────────────────────────────

  it('should run request within AsyncLocalStorage context', async () => {
    const res = await request(app.getHttpServer()).get('/context-check').expect(200);

    expect(res.body.hasBatchId).toBe(true);
    expect(res.body.batchId).toBeDefined();
    expect(typeof res.body.batchId).toBe('string');
    // UUID format
    expect(res.body.batchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should set matching batchId on recorded entry', async () => {
    const res = await request(app.getHttpServer()).get('/context-check').expect(200);
    const { batchId } = res.body;
    await waitForStorage();

    const entry = mockStorage.entries.find(
      (e) => (e.content['url'] as string) === '/context-check',
    );
    expect(entry).toBeDefined();
    expect(entry!.batchId).toBe(batchId);
  });

  // ── Duration tracking ──────────────────────────────────────────────

  it('should record a non-negative duration', async () => {
    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    const entry = mockStorage.entries.find((e) => (e.content['url'] as string) === '/hello');
    expect(entry).toBeDefined();
    expect(typeof entry!.content['duration']).toBe('number');
    expect(entry!.content['duration'] as number).toBeGreaterThanOrEqual(0);
  });

  // ── Error resilience ───────────────────────────────────────────────

  it('should never throw even if storage.store throws', async () => {
    mockStorage.store = vi.fn(async () => {
      throw new Error('Storage write failure');
    });

    const res = await request(app.getHttpServer()).get('/hello');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'world' });
  });

  // ── API endpoints (via TelescopeController) ─────────────────────────

  it('should report recording status via GET api/status', async () => {
    const res = await request(app.getHttpServer())
      .get('/__telescope/api/status')
      .expect(200);
    expect(res.body.recording).toBe(true);
  });

  it('should toggle recording status via POST api/status', async () => {
    // Pause
    let res = await request(app.getHttpServer())
      .post('/__telescope/api/status')
      .send({ recording: false })
      .expect(201);
    expect(res.body.recording).toBe(false);

    // Resume
    res = await request(app.getHttpServer())
      .post('/__telescope/api/status')
      .send({ recording: true })
      .expect(201);
    expect(res.body.recording).toBe(true);
  });

  it('should list entries via GET api/:type', async () => {
    // First make a request to record
    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    const res = await request(app.getHttpServer())
      .get('/__telescope/api/requests')
      .expect(200);
    expect(res.body.entries).toBeInstanceOf(Array);
  });

  it('should clear entries via DELETE api/entries', async () => {
    // Record something first
    await request(app.getHttpServer()).get('/hello').expect(200);
    await waitForStorage();

    expect(mockStorage.entries.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .delete('/__telescope/api/entries')
      .expect(200);

    expect(mockStorage.entries).toHaveLength(0);
  });
});
