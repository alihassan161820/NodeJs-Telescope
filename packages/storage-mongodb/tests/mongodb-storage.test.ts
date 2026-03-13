import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { MongoClient } from 'mongodb';
import { MongoStorage } from '../src/mongodb-storage.js';
import type { TelescopeEntryData } from '@node-telescope/core';
import { EntryType } from '@node-telescope/core';

const TEST_MONGODB_URL = process.env['TEST_MONGODB_URL'];
const TEST_DB_NAME = 'node_telescope_test';

function createEntry(overrides: Partial<TelescopeEntryData> = {}): TelescopeEntryData {
  return {
    id: `entry-${Math.random().toString(36).slice(2, 8)}`,
    batchId: 'batch-001',
    type: EntryType.Request,
    content: { method: 'GET', path: '/' },
    tags: ['GET', 'status:200'],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe.skipIf(!TEST_MONGODB_URL)('MongoStorage (integration)', () => {
  let storage: MongoStorage;
  let client: MongoClient;

  beforeEach(async () => {
    // Use a shared client so we can clean up between tests
    client = new MongoClient(TEST_MONGODB_URL!);
    await client.connect();

    // Drop the test database to start clean
    await client.db(TEST_DB_NAME).dropDatabase();

    storage = new MongoStorage(client, {
      databaseName: TEST_DB_NAME,
    });
  });

  afterAll(async () => {
    if (storage) {
      await storage.close();
    }
    if (client) {
      // Clean up the test database
      await client.db(TEST_DB_NAME).dropDatabase();
      await client.close();
    }
  });

  it('stores and retrieves a single entry', async () => {
    const entry = createEntry({ id: 'test-1' });
    await storage.store(entry);

    const found = await storage.find('test-1');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('test-1');
    expect(found?.type).toBe(EntryType.Request);
    expect(found?.content).toEqual({ method: 'GET', path: '/' });
    expect(found?.tags).toEqual(['GET', 'status:200']);
  });

  it('returns null for non-existent entry', async () => {
    const found = await storage.find('non-existent');
    expect(found).toBeNull();
  });

  it('stores batch of entries', async () => {
    const entries = [
      createEntry({ id: 'batch-1' }),
      createEntry({ id: 'batch-2' }),
      createEntry({ id: 'batch-3' }),
    ];

    await storage.storeBatch(entries);

    const found1 = await storage.find('batch-1');
    const found2 = await storage.find('batch-2');
    const found3 = await storage.find('batch-3');

    expect(found1).not.toBeNull();
    expect(found2).not.toBeNull();
    expect(found3).not.toBeNull();
  });

  it('handles empty batch gracefully', async () => {
    await storage.storeBatch([]);
    const result = await storage.query({});
    expect(result.entries.length).toBe(0);
  });

  it('queries entries by type', async () => {
    await storage.store(createEntry({ id: 'req-1', type: EntryType.Request }));
    await storage.store(createEntry({ id: 'log-1', type: EntryType.Log }));
    await storage.store(createEntry({ id: 'req-2', type: EntryType.Request }));

    const result = await storage.query({ type: EntryType.Request });
    expect(result.entries.length).toBe(2);
    expect(result.entries.every((e) => e.type === EntryType.Request)).toBe(true);
  });

  it('queries entries by tag', async () => {
    await storage.store(createEntry({ id: 'tag-1', tags: ['alpha', 'beta'] }));
    await storage.store(createEntry({ id: 'tag-2', tags: ['beta', 'gamma'] }));
    await storage.store(createEntry({ id: 'tag-3', tags: ['gamma'] }));

    const result = await storage.query({ tag: 'beta' });
    expect(result.entries.length).toBe(2);
  });

  it('queries with cursor-based pagination', async () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      createEntry({ id: `page-${i}` }),
    );
    for (const entry of entries) {
      await storage.store(entry);
    }

    // First page
    const page1 = await storage.query({ take: 2 });
    expect(page1.entries.length).toBe(2);
    expect(page1.hasMore).toBe(true);

    // Second page using cursor
    const lastId = page1.entries[page1.entries.length - 1]?.id;
    const page2 = await storage.query({ take: 2, beforeId: lastId });
    expect(page2.entries.length).toBe(2);
    expect(page2.hasMore).toBe(true);

    // Third page
    const lastId2 = page2.entries[page2.entries.length - 1]?.id;
    const page3 = await storage.query({ take: 2, beforeId: lastId2 });
    expect(page3.entries.length).toBe(1);
    expect(page3.hasMore).toBe(false);
  });

  it('finds entries by batch ID', async () => {
    await storage.store(createEntry({ id: 'b1-1', batchId: 'batch-A' }));
    await storage.store(createEntry({ id: 'b1-2', batchId: 'batch-A' }));
    await storage.store(createEntry({ id: 'b2-1', batchId: 'batch-B' }));

    const batchA = await storage.findByBatchId('batch-A');
    expect(batchA.length).toBe(2);
    expect(batchA.every((e) => e.batchId === 'batch-A')).toBe(true);
  });

  it('prunes entries older than given date', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const newDate = new Date().toISOString();

    await storage.store(createEntry({ id: 'old-1', createdAt: oldDate }));
    await storage.store(createEntry({ id: 'new-1', createdAt: newDate }));

    const pruneDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pruned = await storage.prune(pruneDate);

    expect(pruned).toBe(1);
    expect(await storage.find('old-1')).toBeNull();
    expect(await storage.find('new-1')).not.toBeNull();
  });

  it('truncates all entries', async () => {
    await storage.store(createEntry({ id: 't-1' }));
    await storage.store(createEntry({ id: 't-2' }));

    await storage.truncate();

    const result = await storage.query({});
    expect(result.entries.length).toBe(0);
  });

  it('truncates entries by type', async () => {
    await storage.store(createEntry({ id: 'tr-1', type: EntryType.Request }));
    await storage.store(createEntry({ id: 'tr-2', type: EntryType.Log }));

    await storage.truncate(EntryType.Request);

    const result = await storage.query({});
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]?.type).toBe(EntryType.Log);
  });

  it('stores and retrieves family hash', async () => {
    await storage.store(createEntry({ id: 'fh-1', familyHash: 'abc123' }));

    const found = await storage.find('fh-1');
    expect(found?.familyHash).toBe('abc123');
  });

  it('handles entries with no tags', async () => {
    await storage.store(createEntry({ id: 'notags', tags: [] }));

    const found = await storage.find('notags');
    expect(found?.tags).toEqual([]);
  });

  it('returns entries in reverse-sequence order', async () => {
    await storage.store(createEntry({ id: 'order-1' }));
    await storage.store(createEntry({ id: 'order-2' }));
    await storage.store(createEntry({ id: 'order-3' }));

    const result = await storage.query({});
    expect(result.entries[0]?.id).toBe('order-3');
    expect(result.entries[2]?.id).toBe('order-1');
  });
});
