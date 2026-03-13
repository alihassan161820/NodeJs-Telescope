// → IncomingEntry.php
// Represents a single telescope entry before it's persisted to storage

import { randomUUID } from 'node:crypto';
import type { EntryType } from './entry-type.js';
import type { TelescopeEntryData } from './types.js';

export class IncomingEntry {
  readonly id: string;
  readonly type: EntryType;
  readonly content: Record<string, unknown>;
  readonly createdAt: string;
  tags: string[];
  batchId: string;
  familyHash?: string;

  constructor(type: EntryType, content: Record<string, unknown>) {
    this.id = randomUUID();
    this.type = type;
    this.content = content;
    this.createdAt = new Date().toISOString();
    this.tags = [];
    this.batchId = '';
  }

  /** Add tags to this entry */
  addTags(tags: string[]): this {
    for (const tag of tags) {
      if (!this.tags.includes(tag)) {
        this.tags.push(tag);
      }
    }
    return this;
  }

  /** Set the batch ID for request correlation */
  setBatchId(batchId: string): this {
    this.batchId = batchId;
    return this;
  }

  /** Set the family hash for grouping similar entries */
  setFamilyHash(hash: string): this {
    this.familyHash = hash;
    return this;
  }

  /** Convert to a plain data object for storage */
  toData(): TelescopeEntryData {
    return {
      id: this.id,
      batchId: this.batchId,
      type: this.type,
      content: this.content,
      tags: this.tags,
      createdAt: this.createdAt,
      familyHash: this.familyHash,
    };
  }
}
