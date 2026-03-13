import type { Pool } from 'pg';

/**
 * Schema version -- bump this when the schema changes.
 * Used to track migrations in the future.
 */
export const SCHEMA_VERSION = 1;

const CREATE_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS telescope_entries (
    sequence    BIGSERIAL    NOT NULL UNIQUE,
    id          TEXT         PRIMARY KEY,
    batch_id    TEXT         NOT NULL,
    type        TEXT         NOT NULL,
    content     JSONB        NOT NULL,
    tags        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    family_hash TEXT,
    created_at  TIMESTAMPTZ  NOT NULL
  )
`;

const CREATE_ENTRIES_TAGS_TABLE = `
  CREATE TABLE IF NOT EXISTS telescope_entries_tags (
    entry_id TEXT NOT NULL,
    tag      TEXT NOT NULL,
    PRIMARY KEY (entry_id, tag),
    FOREIGN KEY (entry_id) REFERENCES telescope_entries(id) ON DELETE CASCADE
  )
`;

const CREATE_SCHEMA_VERSION_TABLE = `
  CREATE TABLE IF NOT EXISTS telescope_schema_version (
    version INTEGER NOT NULL
  )
`;

/**
 * Indexes for common query patterns:
 * - type: filter by entry type
 * - batch_id: group entries by batch
 * - family_hash: find related entries
 * - created_at: prune old entries
 * - tag: filter by tag in the tags table
 */
const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_telescope_entries_type ON telescope_entries(type)`,
  `CREATE INDEX IF NOT EXISTS idx_telescope_entries_batch_id ON telescope_entries(batch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_telescope_entries_family_hash ON telescope_entries(family_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_telescope_entries_created_at ON telescope_entries(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_telescope_entries_tags_tag ON telescope_entries_tags(tag)`,
  `CREATE INDEX IF NOT EXISTS idx_telescope_entries_tags_entry_id ON telescope_entries_tags(entry_id)`,
];

/**
 * Build the full initialization SQL as a single string.
 * Exported for unit-testing the generated DDL without a live database.
 */
export function buildInitializationSQL(): string {
  const statements = [
    CREATE_ENTRIES_TABLE,
    CREATE_ENTRIES_TAGS_TABLE,
    CREATE_SCHEMA_VERSION_TABLE,
    ...INDEXES,
  ];
  return statements.map((s) => `${s.trim()};`).join('\n');
}

/**
 * Initialize the database schema. Creates tables and indexes if they don't exist.
 * Safe to call multiple times -- all statements use IF NOT EXISTS.
 */
export async function initializeSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(CREATE_ENTRIES_TABLE);
    await client.query(CREATE_ENTRIES_TAGS_TABLE);
    await client.query(CREATE_SCHEMA_VERSION_TABLE);

    for (const index of INDEXES) {
      await client.query(index);
    }

    // Insert schema version if the table is empty
    const result = await client.query<{ version: number }>(
      'SELECT version FROM telescope_schema_version LIMIT 1',
    );

    if (result.rows.length === 0) {
      await client.query(
        'INSERT INTO telescope_schema_version (version) VALUES ($1)',
        [SCHEMA_VERSION],
      );
    }
  } finally {
    client.release();
  }
}
