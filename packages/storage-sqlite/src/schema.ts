import type Database from 'better-sqlite3';

/**
 * Schema version — bump this when the schema changes.
 * Used to track migrations in the future.
 */
export const SCHEMA_VERSION = 1;

const CREATE_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS telescope_entries (
    sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
    id          TEXT NOT NULL UNIQUE,
    batch_id    TEXT NOT NULL,
    type        TEXT NOT NULL,
    content     TEXT NOT NULL,
    tags        TEXT NOT NULL DEFAULT '[]',
    family_hash TEXT,
    created_at  TEXT NOT NULL
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
 * - sequence: cursor-based pagination via beforeId lookups
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
 * Initialize the database schema. Creates tables and indexes if they don't exist.
 * Safe to call multiple times — all statements use IF NOT EXISTS.
 */
export function initializeSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(CREATE_ENTRIES_TABLE);
  db.exec(CREATE_ENTRIES_TAGS_TABLE);
  db.exec(CREATE_SCHEMA_VERSION_TABLE);

  for (const index of INDEXES) {
    db.exec(index);
  }

  // Insert schema version if the table is empty
  const row = db.prepare('SELECT version FROM telescope_schema_version LIMIT 1').get() as
    | { version: number }
    | undefined;

  if (!row) {
    db.prepare('INSERT INTO telescope_schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
  }
}
