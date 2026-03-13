// → Storage/EntryQueryOptions.php
// Builds query filter objects for storage lookups

import type { EntryType } from '../entry-type.js';
import type { EntryFilter } from '../types.js';

export class EntryQueryOptions {
  private filter: EntryFilter = {};

  /** Filter by entry type */
  ofType(type: EntryType): this {
    this.filter.type = type;
    return this;
  }

  /** Filter by batch ID */
  withBatchId(batchId: string): this {
    this.filter.batchId = batchId;
    return this;
  }

  /** Filter by tag */
  withTag(tag: string): this {
    this.filter.tag = tag;
    return this;
  }

  /** Cursor-based pagination: entries before this ID */
  before(id: string): this {
    this.filter.beforeId = id;
    return this;
  }

  /** Limit number of results */
  take(count: number): this {
    this.filter.take = count;
    return this;
  }

  /** Filter by family hash */
  withFamilyHash(hash: string): this {
    this.filter.familyHash = hash;
    return this;
  }

  /** Build the filter object */
  build(): EntryFilter {
    return { ...this.filter };
  }
}
