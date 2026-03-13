import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MongoStorage } from '../src/mongodb-storage.js';

/**
 * Unit tests for MongoStorage that do NOT require a real MongoDB instance.
 * These verify constructor behavior, interface compliance, and basic mock interactions.
 */

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockCollection() {
  return {
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    insertMany: vi.fn().mockResolvedValue({ acknowledged: true, insertedCount: 0 }),
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
      toArray: vi.fn().mockResolvedValue([]),
    }),
    deleteMany: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 0 }),
    createIndexes: vi.fn().mockResolvedValue([]),
  };
}

function createMockCountersCollection() {
  return {
    findOneAndUpdate: vi.fn().mockResolvedValue({ _id: 'telescope_entry_sequence', seq: 1 }),
    createIndexes: vi.fn().mockResolvedValue([]),
  };
}

function createMockDb(entriesCol: ReturnType<typeof createMockCollection>, countersCol: ReturnType<typeof createMockCountersCollection>) {
  return {
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === 'telescope_counters') return countersCol;
      return entriesCol;
    }),
  };
}

function createMockClient(db: ReturnType<typeof createMockDb>) {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    db: vi.fn().mockReturnValue(db),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MongoStorage (unit)', () => {
  let mockEntriesCol: ReturnType<typeof createMockCollection>;
  let mockCountersCol: ReturnType<typeof createMockCountersCollection>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockClient: ReturnType<typeof createMockClient>;
  let storage: MongoStorage;

  beforeEach(() => {
    mockEntriesCol = createMockCollection();
    mockCountersCol = createMockCountersCollection();
    mockDb = createMockDb(mockEntriesCol, mockCountersCol);
    mockClient = createMockClient(mockDb);

    // Cast mock to MongoClient — we only test the interface surface
    storage = new MongoStorage(mockClient as any, {
      databaseName: 'test_db',
    });
  });

  describe('constructor', () => {
    it('accepts a MongoClient instance', () => {
      expect(storage).toBeDefined();
      expect(mockClient.db).toHaveBeenCalledWith('test_db');
    });

    it('accepts a connection string and creates a client internally', () => {
      // This only tests that the constructor does not throw.
      // The actual MongoClient will be created but never connected in unit tests.
      const stringStorage = new MongoStorage('mongodb://localhost:27017', {
        databaseName: 'test_db',
      });
      expect(stringStorage).toBeDefined();
    });

    it('uses default database name when not provided', () => {
      const defaultStorage = new MongoStorage(mockClient as any);
      expect(mockClient.db).toHaveBeenCalledWith('node_telescope');
      expect(defaultStorage).toBeDefined();
    });
  });

  describe('interface compliance', () => {
    it('implements store method', () => {
      expect(typeof storage.store).toBe('function');
    });

    it('implements storeBatch method', () => {
      expect(typeof storage.storeBatch).toBe('function');
    });

    it('implements find method', () => {
      expect(typeof storage.find).toBe('function');
    });

    it('implements query method', () => {
      expect(typeof storage.query).toBe('function');
    });

    it('implements findByBatchId method', () => {
      expect(typeof storage.findByBatchId).toBe('function');
    });

    it('implements prune method', () => {
      expect(typeof storage.prune).toBe('function');
    });

    it('implements truncate method', () => {
      expect(typeof storage.truncate).toBe('function');
    });

    it('implements close method', () => {
      expect(typeof storage.close).toBe('function');
    });
  });

  describe('store', () => {
    it('calls insertOne on the entries collection', async () => {
      await storage.store({
        id: 'test-1',
        batchId: 'batch-1',
        type: 'request' as any,
        content: { method: 'GET' },
        tags: ['tag1'],
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      expect(mockCountersCol.findOneAndUpdate).toHaveBeenCalled();
      expect(mockEntriesCol.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'test-1',
          batchId: 'batch-1',
          type: 'request',
          content: { method: 'GET' },
          tags: ['tag1'],
        }),
      );
    });
  });

  describe('storeBatch', () => {
    it('calls insertMany for multiple entries', async () => {
      await storage.storeBatch([
        {
          id: 'b-1',
          batchId: 'batch-1',
          type: 'request' as any,
          content: {},
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'b-2',
          batchId: 'batch-1',
          type: 'log' as any,
          content: {},
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]);

      expect(mockCountersCol.findOneAndUpdate).toHaveBeenCalled();
      expect(mockEntriesCol.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ _id: 'b-1' }),
          expect.objectContaining({ _id: 'b-2' }),
        ]),
        { ordered: false },
      );
    });

    it('skips insertMany for empty array', async () => {
      await storage.storeBatch([]);
      expect(mockEntriesCol.insertMany).not.toHaveBeenCalled();
    });
  });

  describe('find', () => {
    it('returns null when document is not found', async () => {
      mockEntriesCol.findOne.mockResolvedValue(null);

      const result = await storage.find('nonexistent');
      expect(result).toBeNull();
      expect(mockEntriesCol.findOne).toHaveBeenCalledWith({ _id: 'nonexistent' });
    });

    it('converts document to TelescopeEntryData', async () => {
      mockEntriesCol.findOne.mockResolvedValue({
        _id: 'test-1',
        sequence: 1,
        batchId: 'batch-1',
        type: 'request',
        content: { method: 'GET' },
        tags: ['tag1'],
        familyHash: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });

      const result = await storage.find('test-1');
      expect(result).toEqual({
        id: 'test-1',
        batchId: 'batch-1',
        type: 'request',
        content: { method: 'GET' },
        tags: ['tag1'],
        createdAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('includes familyHash when present', async () => {
      mockEntriesCol.findOne.mockResolvedValue({
        _id: 'test-fh',
        sequence: 1,
        batchId: 'batch-1',
        type: 'request',
        content: {},
        tags: [],
        familyHash: 'abc123',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });

      const result = await storage.find('test-fh');
      expect(result?.familyHash).toBe('abc123');
    });
  });

  describe('query', () => {
    it('returns empty results with hasMore false', async () => {
      const result = await storage.query({});
      expect(result).toEqual({ entries: [], hasMore: false });
    });
  });

  describe('prune', () => {
    it('calls deleteMany with date filter', async () => {
      mockEntriesCol.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 5 });

      const before = new Date('2024-01-01T00:00:00.000Z');
      const result = await storage.prune(before);

      expect(result).toBe(5);
      expect(mockEntriesCol.deleteMany).toHaveBeenCalledWith({
        createdAt: { $lt: before },
      });
    });
  });

  describe('truncate', () => {
    it('deletes all entries when no type specified', async () => {
      await storage.truncate();
      expect(mockEntriesCol.deleteMany).toHaveBeenCalledWith({});
    });

    it('deletes only entries of specified type', async () => {
      await storage.truncate('request' as any);
      expect(mockEntriesCol.deleteMany).toHaveBeenCalledWith({ type: 'request' });
    });
  });

  describe('close', () => {
    it('does not close client when it was provided externally', async () => {
      await storage.close();
      // The mock client was passed in, so close should NOT be called
      expect(mockClient.close).not.toHaveBeenCalled();
    });
  });
});
