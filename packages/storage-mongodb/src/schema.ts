import type { Collection, IndexDescription } from 'mongodb';

/**
 * MongoDB index definitions for the telescope_entries collection.
 *
 * Index strategy:
 * - Single-field indexes for standalone filter conditions
 * - Compound indexes for the most common query patterns (type + sequence, batchId + sequence)
 * - TTL index on createdAt for optional auto-pruning
 */
const INDEXES: IndexDescription[] = [
  // Single-field indexes
  { key: { type: 1 }, name: 'idx_type' },
  { key: { batchId: 1 }, name: 'idx_batchId' },
  { key: { familyHash: 1 }, name: 'idx_familyHash', sparse: true },
  { key: { tags: 1 }, name: 'idx_tags' },

  // Compound indexes for common query patterns
  // query() typically filters by type and paginates by sequence DESC
  { key: { type: 1, sequence: -1 }, name: 'idx_type_sequence' },
  // findByBatchId() orders by sequence DESC
  { key: { batchId: 1, sequence: -1 }, name: 'idx_batchId_sequence' },

  // createdAt for prune operations (also supports TTL if configured)
  { key: { createdAt: 1 }, name: 'idx_createdAt' },

  // Unique index on the auto-incrementing sequence for cursor pagination
  { key: { sequence: -1 }, name: 'idx_sequence_desc', unique: true },
];

/**
 * Create all required indexes on the telescope_entries collection.
 *
 * Safe to call multiple times — MongoDB's createIndexes is idempotent
 * for indexes with the same key and name.
 *
 * @param collection - The telescope_entries collection
 * @param ttlSeconds - Optional TTL in seconds for auto-pruning via createdAt.
 *                     If provided, a TTL index replaces the plain createdAt index.
 */
export async function createIndexes(
  collection: Collection,
  ttlSeconds?: number,
): Promise<void> {
  const indexes: IndexDescription[] = [...INDEXES];

  // If TTL is requested, replace the plain createdAt index with a TTL index
  if (ttlSeconds !== undefined && ttlSeconds > 0) {
    const createdAtIdx = indexes.findIndex((idx) => idx.name === 'idx_createdAt');
    if (createdAtIdx !== -1) {
      indexes[createdAtIdx] = {
        key: { createdAt: 1 },
        name: 'idx_createdAt_ttl',
        expireAfterSeconds: ttlSeconds,
      };
    }
  }

  await collection.createIndexes(indexes);
}
