import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Express } from 'express';
import request from 'supertest';
import { unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Telescope, EntryType, getContext } from '@node-telescope/core';
import { SqliteStorage } from '@node-telescope/storage-sqlite';
import { createMiddleware } from '../../src/middleware.js';
import { createApiRouter } from '../../src/api-router.js';

describe('Express integration (real storage)', () => {
  let app: Express;
  let telescope: Telescope;
  let storage: SqliteStorage;
  let dbPath: string;

  beforeEach(() => {
    // Create a unique temp file for each test
    dbPath = join(tmpdir(), `telescope-test-${randomUUID()}.sqlite`);
    storage = new SqliteStorage(dbPath);

    telescope = new Telescope({ enabled: true });
    telescope.start();
    telescope.setStorage(storage);

    app = express();
    app.use(express.json());

    // Mount telescope middleware + API
    app.use(createMiddleware(telescope));
    app.use('/__telescope/api', createApiRouter(telescope));

    // Sample app routes
    app.get('/users', (_req, res) => {
      res.json([{ id: 1, name: 'Alice' }]);
    });

    app.post('/users', (req, res) => {
      res.status(201).json({ id: 2, ...req.body });
    });

    app.get('/fail', (_req, res) => {
      res.status(500).json({ error: 'Internal error' });
    });

    app.post('/login', (req, res) => {
      res.json({ success: true, user: req.body['username'] });
    });

    app.get('/with-context', (_req, res) => {
      const ctx = getContext();
      res.json({ batchId: ctx?.batchId });
    });
  });

  afterEach(async () => {
    await telescope.stop();
    // Clean up the database file
    try {
      if (existsSync(dbPath)) {
        unlinkSync(dbPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  /** Wait a bit for the async fire-and-forget store to complete */
  async function waitForStorage(ms = 100): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  // ── Basic recording ────────────────────────────────────────────────

  it('should record a GET request', async () => {
    await request(app).get('/users').expect(200);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    expect(result.entries).toHaveLength(1);

    const entry = result.entries[0]!;
    expect(entry.content['method']).toBe('GET');
    expect(entry.content['url']).toBe('/users');
    expect(entry.content['responseStatus']).toBe(200);
  });

  it('should record a POST request with body', async () => {
    await request(app).post('/users').send({ name: 'Bob' }).expect(201);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    expect(result.entries).toHaveLength(1);

    const entry = result.entries[0]!;
    expect(entry.content['method']).toBe('POST');
    expect(entry.content['payload']).toEqual({ name: 'Bob' });
    expect(entry.content['responseStatus']).toBe(201);
  });

  it('should record multiple requests', async () => {
    await request(app).get('/users').expect(200);
    await request(app).post('/users').send({ name: 'Charlie' }).expect(201);
    await request(app).get('/fail').expect(500);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    expect(result.entries).toHaveLength(3);
  });

  // ── Request/response data correctness ──────────────────────────────

  it('should capture the full request/response data correctly', async () => {
    await request(app)
      .post('/users')
      .set('X-Trace-Id', 'trace-abc')
      .send({ name: 'Dave' })
      .expect(201);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    const entry = result.entries[0]!;

    // Request data
    expect(entry.content['method']).toBe('POST');
    expect(entry.content['url']).toBe('/users');
    expect(entry.content['path']).toBe('/users');
    expect(entry.content['payload']).toEqual({ name: 'Dave' });

    // Headers (trace header should be present, not masked)
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['x-trace-id']).toBe('trace-abc');

    // Response
    expect(entry.content['responseStatus']).toBe(201);
    const response = entry.content['response'] as Record<string, unknown>;
    expect(response['id']).toBe(2);
    expect(response['name']).toBe('Dave');

    // Duration should be non-negative
    expect(typeof entry.content['duration']).toBe('number');
    expect(entry.content['duration'] as number).toBeGreaterThanOrEqual(0);
  });

  it('should capture response headers', async () => {
    app.get('/custom-header', (_req, res) => {
      res.set('X-Custom-Resp', 'resp-val');
      res.json({ ok: true });
    });

    await request(app).get('/custom-header').expect(200);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    const entry = result.entries[0]!;
    const resHeaders = entry.content['responseHeaders'] as Record<string, string>;
    expect(resHeaders['x-custom-resp']).toBe('resp-val');
  });

  // ── PII masking end-to-end ─────────────────────────────────────────

  it('should mask sensitive headers (authorization, cookie)', async () => {
    await request(app)
      .get('/users')
      .set('Authorization', 'Bearer secret-jwt')
      .set('Cookie', 'session=abc')
      .expect(200);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    const entry = result.entries[0]!;
    const headers = entry.content['headers'] as Record<string, string>;
    expect(headers['authorization']).toBe('********');
    expect(headers['cookie']).toBe('********');
  });

  it('should mask sensitive body fields (password, token, secret)', async () => {
    await request(app)
      .post('/login')
      .send({ username: 'alice', password: 'hunter2', token: 'xyz' })
      .expect(200);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    const entry = result.entries[0]!;
    const payload = entry.content['payload'] as Record<string, unknown>;
    expect(payload['username']).toBe('alice');
    expect(payload['password']).toBe('********');
    expect(payload['token']).toBe('********');
  });

  // ── API retrieval ──────────────────────────────────────────────────

  it('should list recorded entries via the API', async () => {
    await request(app).get('/users').expect(200);
    await request(app).get('/fail').expect(500);
    await waitForStorage();

    const res = await request(app).get('/__telescope/api/requests').expect(200);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(2);
  });

  it('should fetch a single entry by id via the API', async () => {
    await request(app).get('/users').expect(200);
    await waitForStorage();

    // First, list entries to get the id
    const listRes = await request(app).get('/__telescope/api/requests').expect(200);
    // Filter to find non-telescope entries
    const userEntry = listRes.body.entries.find(
      (e: { content: Record<string, unknown> }) => e.content['url'] === '/users',
    );
    expect(userEntry).toBeDefined();

    // Now fetch by id
    const detailRes = await request(app)
      .get(`/__telescope/api/requests/${userEntry.id}`)
      .expect(200);
    expect(detailRes.body.entry.id).toBe(userEntry.id);
    expect(detailRes.body.entry.content['method']).toBe('GET');
  });

  it('should clear all entries via DELETE /entries', async () => {
    await request(app).get('/users').expect(200);
    await waitForStorage();

    // Confirm entries exist
    let result = await storage.query({ type: EntryType.Request });
    expect(result.entries.length).toBeGreaterThan(0);

    // Clear via API
    await request(app).delete('/__telescope/api/entries').expect(200);

    // Verify cleared
    result = await storage.query({ type: EntryType.Request });
    expect(result.entries).toHaveLength(0);
  });

  it('should report and toggle recording status via the API', async () => {
    // Initially recording
    let res = await request(app).get('/__telescope/api/status').expect(200);
    expect(res.body.recording).toBe(true);

    // Pause
    res = await request(app)
      .post('/__telescope/api/status')
      .send({ recording: false })
      .expect(200);
    expect(res.body.recording).toBe(false);

    // Resume
    res = await request(app)
      .post('/__telescope/api/status')
      .send({ recording: true })
      .expect(200);
    expect(res.body.recording).toBe(true);
  });

  // ── Batch correlation ──────────────────────────────────────────────

  it('should assign a batchId to every recorded entry', async () => {
    await request(app).get('/users').expect(200);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    const entry = result.entries[0]!;
    expect(entry.batchId).toBeDefined();
    expect(entry.batchId.length).toBeGreaterThan(0);
  });

  it('should correlate entries from the same request via batchId', async () => {
    let capturedBatchId: string | undefined;

    app.get('/correlated', (_req, res) => {
      const ctx = getContext();
      capturedBatchId = ctx?.batchId;
      res.json({ ok: true });
    });

    await request(app).get('/correlated').expect(200);
    await waitForStorage();

    expect(capturedBatchId).toBeDefined();

    // The entry recorded for this request should share the same batchId
    const result = await storage.query({ type: EntryType.Request });
    const entry = result.entries.find(
      (e) => (e.content['url'] as string) === '/correlated',
    );
    expect(entry).toBeDefined();
    expect(entry!.batchId).toBe(capturedBatchId);
  });

  it('should give different requests different batchIds', async () => {
    await request(app).get('/users').expect(200);
    await request(app).get('/fail').expect(500);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    expect(result.entries).toHaveLength(2);

    const batchIds = result.entries.map((e) => e.batchId);
    expect(batchIds[0]).not.toBe(batchIds[1]);
  });

  it('should retrieve batch entries via the API', async () => {
    await request(app).get('/users').expect(200);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    const entry = result.entries.find(
      (e) => (e.content['url'] as string) === '/users',
    );
    expect(entry).toBeDefined();

    const batchRes = await request(app)
      .get(`/__telescope/api/entries/${entry!.id}/batch`)
      .expect(200);

    expect(batchRes.body.entries).toBeInstanceOf(Array);
    expect(batchRes.body.entries.length).toBeGreaterThanOrEqual(1);
    // All entries in the batch should share the same batchId
    for (const batchEntry of batchRes.body.entries) {
      expect(batchEntry.batchId).toBe(entry!.batchId);
    }
  });

  // ── Telescope paths are not recorded ───────────────────────────────

  it('should not record telescope API requests as entries', async () => {
    // First make a real request so there's something to list
    await request(app).get('/users').expect(200);
    await waitForStorage();

    // Now hit the telescope API
    await request(app).get('/__telescope/api/requests').expect(200);
    await request(app).get('/__telescope/api/status').expect(200);
    await waitForStorage();

    // Only the original /users request should be recorded
    const result = await storage.query({ type: EntryType.Request });
    const urls = result.entries.map((e) => e.content['url'] as string);
    expect(urls.filter((u) => u.includes('__telescope'))).toHaveLength(0);
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  it('should handle requests with query parameters', async () => {
    app.get('/search', (req, res) => {
      res.json({ q: req.query['q'] });
    });

    await request(app).get('/search?q=telescope&limit=10').expect(200);
    await waitForStorage();

    const result = await storage.query({ type: EntryType.Request });
    const entry = result.entries.find(
      (e) => (e.content['path'] as string) === '/search',
    );
    expect(entry).toBeDefined();
    expect(entry!.content['url']).toBe('/search?q=telescope&limit=10');
    const query = entry!.content['query'] as Record<string, unknown>;
    expect(query['q']).toBe('telescope');
    expect(query['limit']).toBe('10');
  });

  it('should still function correctly when paused and resumed', async () => {
    // Record one request
    await request(app).get('/users').expect(200);
    await waitForStorage();

    // Pause — new requests should NOT be recorded
    telescope.pause();
    await request(app).get('/fail').expect(500);
    await waitForStorage();

    let result = await storage.query({ type: EntryType.Request });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.content['url']).toBe('/users');

    // Resume — new requests should be recorded again
    telescope.resume();
    await request(app).get('/fail').expect(500);
    await waitForStorage();

    result = await storage.query({ type: EntryType.Request });
    expect(result.entries).toHaveLength(2);
  });
});
