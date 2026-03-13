import { MongoClient, type Collection, type Db, type Filter } from 'mongodb';
import type {
  StorageRepository,
  TelescopeEntryData,
  EntryFilter,
  PaginatedResult,
  EntryType,
} from '@node-telescope/core';
import { createIndexes } from './schema.js';

/**
 * Shape of documents stored in the telescope_entries collection.
 */
interface EntryDocument {
  _id: string;
  sequence: number;
  batchId: string;
  type: string;
  content: Record<string, unknown>;
  tags: string[];
  familyHash: string | null;
  createdAt: Date;
}

/**
 * Shape of the counter document used for auto-incrementing sequences.
 */
interface CounterDocument {
  _id: string;
  seq: number;
}

/** Default collection names */
const ENTRIES_COLLECTION = 'telescope_entries';
const COUNTERS_COLLECTION = 'telescope_counters';
const COUNTER_ID = 'telescope_entry_sequence';

/**
 * Configuration options for MongoStorage.
 */
export interface MongoStorageOptions {
  /** Database name. Required when passing a connection string. */
  databaseName?: string;

  /** Name of the entries collection. Default: 'telescope_entries' */
  collectionName?: string;

  /** TTL in seconds for auto-pruning. If set, a TTL index is created on createdAt. */
  ttlSeconds?: number;
}

/**
 * MongoDB implementation of the StorageRepository interface.
 *
 * Accepts either a MongoClient instance (caller manages lifecycle) or a
 * connection string (this class creates and owns the client).
 */
export class MongoStorage implements StorageRepository {
  private client: MongoClient;
  private db: Db;
  private collection: Collection<EntryDocument>;
  private counters: Collection<CounterDocument>;
  private ownsClient: boolean;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private collectionName: string;
  private ttlSeconds?: number;

  constructor(clientOrUri: MongoClient | string, options: MongoStorageOptions = {}) {
    const databaseName = options.databaseName ?? 'node_telescope';
    this.collectionName = options.collectionName ?? ENTRIES_COLLECTION;
    this.ttlSeconds = options.ttlSeconds;

    if (typeof clientOrUri === 'string') {
      this.client = new MongoClient(clientOrUri);
      this.ownsClient = true;
    } else {
      this.client = clientOrUri;
      this.ownsClient = false;
    }

    this.db = this.client.db(databaseName);
    this.collection = this.db.collection<EntryDocument>(this.collectionName);
    this.counters = this.db.collection<CounterDocument>(COUNTERS_COLLECTION);
  }

  /* ------------------------------------------------------------------ */
  /*  Lazy initialization                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Ensures the client is connected and indexes are created.
   * Called lazily on the first operation. Thread-safe via shared promise.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }

    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    // Connect the client (no-op if already connected)
    if (this.ownsClient) {
      await this.client.connect();
    }

    await createIndexes(
      this.collection as unknown as Collection,
      this.ttlSeconds,
    );

    this.initialized = true;
  }

  /* ------------------------------------------------------------------ */
  /*  Sequence counter                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Atomically increment and return the next sequence number.
   * Uses findOneAndUpdate with upsert for lock-free auto-increment.
   */
  private async nextSequence(): Promise<number> {
    const result = await this.counters.findOneAndUpdate(
      { _id: COUNTER_ID },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );

    // result is guaranteed non-null with returnDocument: 'after' + upsert
    return result!.seq;
  }

  /**
   * Reserve a batch of consecutive sequence numbers.
   * Atomically increments by `count` and returns the starting sequence.
   */
  private async nextSequenceBatch(count: number): Promise<number> {
    const result = await this.counters.findOneAndUpdate(
      { _id: COUNTER_ID },
      { $inc: { seq: count } },
      { upsert: true, returnDocument: 'after' },
    );

    // After incrementing by `count`, the new value is `startSeq + count - 1 + 1`
    // So startSeq = result.seq - count + 1
    return result!.seq - count + 1;
  }

  /* ------------------------------------------------------------------ */
  /*  store                                                              */
  /* ------------------------------------------------------------------ */

  async store(entry: TelescopeEntryData): Promise<void> {
    await this.ensureInitialized();

    const sequence = await this.nextSequence();

    const doc: EntryDocument = {
      _id: entry.id,
      sequence,
      batchId: entry.batchId,
      type: entry.type,
      content: entry.content,
      tags: entry.tags,
      familyHash: entry.familyHash ?? null,
      createdAt: new Date(entry.createdAt),
    };

    await this.collection.insertOne(doc);
  }

  /* ------------------------------------------------------------------ */
  /*  storeBatch                                                         */
  /* ------------------------------------------------------------------ */

  async storeBatch(entries: TelescopeEntryData[]): Promise<void> {
    if (entries.length === 0) return;

    await this.ensureInitialized();

    const startSeq = await this.nextSequenceBatch(entries.length);

    const docs: EntryDocument[] = entries.map((entry, i) => ({
      _id: entry.id,
      sequence: startSeq + i,
      batchId: entry.batchId,
      type: entry.type,
      content: entry.content,
      tags: entry.tags,
      familyHash: entry.familyHash ?? null,
      createdAt: new Date(entry.createdAt),
    }));

    await this.collection.insertMany(docs, { ordered: false });
  }

  /* ------------------------------------------------------------------ */
  /*  find                                                               */
  /* ------------------------------------------------------------------ */

  async find(id: string): Promise<TelescopeEntryData | null> {
    await this.ensureInitialized();

    const doc = await this.collection.findOne({ _id: id });
    if (!doc) return null;

    return this.documentToEntry(doc);
  }

  /* ------------------------------------------------------------------ */
  /*  query                                                              */
  /* ------------------------------------------------------------------ */

  async query(filter: EntryFilter): Promise<PaginatedResult<TelescopeEntryData>> {
    await this.ensureInitialized();

    const take = filter.take ?? 50;
    const mongoFilter: Filter<EntryDocument> = {};

    if (filter.type) {
      mongoFilter.type = filter.type;
    }

    if (filter.batchId) {
      mongoFilter.batchId = filter.batchId;
    }

    if (filter.familyHash) {
      mongoFilter.familyHash = filter.familyHash;
    }

    if (filter.tag) {
      mongoFilter.tags = filter.tag;
    }

    // Cursor-based pagination: find the sequence of the cursor entry,
    // then fetch entries with a lower sequence number.
    if (filter.beforeId) {
      const cursorDoc = await this.collection.findOne(
        { _id: filter.beforeId },
        { projection: { sequence: 1 } },
      );

      if (cursorDoc) {
        mongoFilter.sequence = { $lt: cursorDoc.sequence };
      }
    }

    // Fetch take + 1 to determine hasMore
    const docs = await this.collection
      .find(mongoFilter)
      .sort({ sequence: -1 })
      .limit(take + 1)
      .toArray();

    const hasMore = docs.length > take;
    const resultDocs = hasMore ? docs.slice(0, take) : docs;

    return {
      entries: resultDocs.map((doc) => this.documentToEntry(doc)),
      hasMore,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  findByBatchId                                                      */
  /* ------------------------------------------------------------------ */

  async findByBatchId(batchId: string): Promise<TelescopeEntryData[]> {
    await this.ensureInitialized();

    const docs = await this.collection
      .find({ batchId })
      .sort({ sequence: -1 })
      .toArray();

    return docs.map((doc) => this.documentToEntry(doc));
  }

  /* ------------------------------------------------------------------ */
  /*  prune                                                              */
  /* ------------------------------------------------------------------ */

  async prune(before: Date): Promise<number> {
    await this.ensureInitialized();

    const result = await this.collection.deleteMany({
      createdAt: { $lt: before },
    });

    return result.deletedCount;
  }

  /* ------------------------------------------------------------------ */
  /*  truncate                                                           */
  /* ------------------------------------------------------------------ */

  async truncate(type?: EntryType): Promise<void> {
    await this.ensureInitialized();

    if (type) {
      await this.collection.deleteMany({ type });
    } else {
      await this.collection.deleteMany({});
    }
  }

  /* ------------------------------------------------------------------ */
  /*  close                                                              */
  /* ------------------------------------------------------------------ */

  async close(): Promise<void> {
    if (this.ownsClient) {
      await this.client.close();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  private helpers                                                    */
  /* ------------------------------------------------------------------ */

  private documentToEntry(doc: EntryDocument): TelescopeEntryData {
    return {
      id: doc._id,
      batchId: doc.batchId,
      type: doc.type as EntryType,
      content: doc.content,
      tags: doc.tags,
      createdAt: doc.createdAt.toISOString(),
      ...(doc.familyHash ? { familyHash: doc.familyHash } : {}),
    };
  }
}
