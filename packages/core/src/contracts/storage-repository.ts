// → Contracts/EntriesRepository.php
// Storage interface — Strategy pattern for pluggable storage backends

import type { TelescopeEntryData, EntryFilter, PaginatedResult } from '../types.js';
import type { EntryType } from '../entry-type.js';

export interface StorageRepository {
  /** Store a single entry */
  store(entry: TelescopeEntryData): Promise<void>;

  /** Store multiple entries in a batch */
  storeBatch(entries: TelescopeEntryData[]): Promise<void>;

  /** Find a single entry by ID */
  find(id: string): Promise<TelescopeEntryData | null>;

  /** Query entries with filters and pagination */
  query(filter: EntryFilter): Promise<PaginatedResult<TelescopeEntryData>>;

  /** Get all entries sharing the same batch ID */
  findByBatchId(batchId: string): Promise<TelescopeEntryData[]>;

  /** Prune entries older than the given date. Returns count of pruned entries. */
  prune(before: Date): Promise<number>;

  /** Delete all entries, optionally filtered by type */
  truncate(type?: EntryType): Promise<void>;

  /** Close the storage connection */
  close(): Promise<void>;
}
