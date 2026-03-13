import Database from 'better-sqlite3';
import type {
  StorageRepository,
  TelescopeEntryData,
  EntryFilter,
  PaginatedResult,
  EntryType,
} from '@node-telescope/core';
import { initializeSchema } from './schema.js';

/**
 * Row shape stored in the telescope_entries table.
 * Column names use snake_case to follow SQLite / Laravel conventions.
 */
interface EntryRow {
  sequence: number;
  id: string;
  batch_id: string;
  type: string;
  content: string;
  tags: string;
  family_hash: string | null;
  created_at: string;
}

/**
 * SQLite implementation of the StorageRepository interface.
 *
 * Uses better-sqlite3 which is fully synchronous, but every method returns
 * a Promise so the class satisfies the async StorageRepository contract.
 */
export class SqliteStorage implements StorageRepository {
  private db: Database.Database;

  constructor(filePath: string = './telescope.sqlite') {
    this.db = new Database(filePath);
    initializeSchema(this.db);
  }

  /* ------------------------------------------------------------------ */
  /*  store                                                              */
  /* ------------------------------------------------------------------ */

  async store(entry: TelescopeEntryData): Promise<void> {
    const insertEntry = this.db.prepare(`
      INSERT INTO telescope_entries (id, batch_id, type, content, tags, family_hash, created_at)
      VALUES (@id, @batch_id, @type, @content, @tags, @family_hash, @created_at)
    `);

    const insertTag = this.db.prepare(`
      INSERT OR IGNORE INTO telescope_entries_tags (entry_id, tag)
      VALUES (@entry_id, @tag)
    `);

    const transaction = this.db.transaction((e: TelescopeEntryData) => {
      insertEntry.run({
        id: e.id,
        batch_id: e.batchId,
        type: e.type,
        content: JSON.stringify(e.content),
        tags: JSON.stringify(e.tags),
        family_hash: e.familyHash ?? null,
        created_at: e.createdAt,
      });

      for (const tag of e.tags) {
        insertTag.run({ entry_id: e.id, tag });
      }
    });

    transaction(entry);
  }

  /* ------------------------------------------------------------------ */
  /*  storeBatch                                                         */
  /* ------------------------------------------------------------------ */

  async storeBatch(entries: TelescopeEntryData[]): Promise<void> {
    if (entries.length === 0) return;

    const insertEntry = this.db.prepare(`
      INSERT INTO telescope_entries (id, batch_id, type, content, tags, family_hash, created_at)
      VALUES (@id, @batch_id, @type, @content, @tags, @family_hash, @created_at)
    `);

    const insertTag = this.db.prepare(`
      INSERT OR IGNORE INTO telescope_entries_tags (entry_id, tag)
      VALUES (@entry_id, @tag)
    `);

    const transaction = this.db.transaction((batch: TelescopeEntryData[]) => {
      for (const e of batch) {
        insertEntry.run({
          id: e.id,
          batch_id: e.batchId,
          type: e.type,
          content: JSON.stringify(e.content),
          tags: JSON.stringify(e.tags),
          family_hash: e.familyHash ?? null,
          created_at: e.createdAt,
        });

        for (const tag of e.tags) {
          insertTag.run({ entry_id: e.id, tag });
        }
      }
    });

    transaction(entries);
  }

  /* ------------------------------------------------------------------ */
  /*  find                                                               */
  /* ------------------------------------------------------------------ */

  async find(id: string): Promise<TelescopeEntryData | null> {
    const row = this.db
      .prepare('SELECT * FROM telescope_entries WHERE id = ?')
      .get(id) as EntryRow | undefined;

    if (!row) return null;

    return this.rowToEntry(row);
  }

  /* ------------------------------------------------------------------ */
  /*  query                                                              */
  /* ------------------------------------------------------------------ */

  async query(filter: EntryFilter): Promise<PaginatedResult<TelescopeEntryData>> {
    const take = filter.take ?? 50;
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};
    let needsTagJoin = false;

    if (filter.type) {
      conditions.push('e.type = @type');
      params['type'] = filter.type;
    }

    if (filter.batchId) {
      conditions.push('e.batch_id = @batch_id');
      params['batch_id'] = filter.batchId;
    }

    if (filter.familyHash) {
      conditions.push('e.family_hash = @family_hash');
      params['family_hash'] = filter.familyHash;
    }

    if (filter.tag) {
      needsTagJoin = true;
      conditions.push('t.tag = @tag');
      params['tag'] = filter.tag;
    }

    if (filter.beforeId) {
      // Cursor pagination: get the sequence of the cursor entry,
      // then fetch entries with a lower sequence number.
      const cursorRow = this.db
        .prepare('SELECT sequence FROM telescope_entries WHERE id = ?')
        .get(filter.beforeId) as { sequence: number } | undefined;

      if (cursorRow) {
        conditions.push('e.sequence < @before_sequence');
        params['before_sequence'] = cursorRow.sequence;
      }
    }

    const joinClause = needsTagJoin
      ? 'INNER JOIN telescope_entries_tags t ON e.id = t.entry_id'
      : '';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch take + 1 to determine hasMore
    const sql = `
      SELECT DISTINCT e.*
      FROM telescope_entries e
      ${joinClause}
      ${whereClause}
      ORDER BY e.sequence DESC
      LIMIT @limit
    `;

    params['limit'] = take + 1;

    const rows = this.db.prepare(sql).all(params) as EntryRow[];

    const hasMore = rows.length > take;
    const resultRows = hasMore ? rows.slice(0, take) : rows;

    return {
      entries: resultRows.map((row) => this.rowToEntry(row)),
      hasMore,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  findByBatchId                                                      */
  /* ------------------------------------------------------------------ */

  async findByBatchId(batchId: string): Promise<TelescopeEntryData[]> {
    const rows = this.db
      .prepare('SELECT * FROM telescope_entries WHERE batch_id = ? ORDER BY sequence DESC')
      .all(batchId) as EntryRow[];

    return rows.map((row) => this.rowToEntry(row));
  }

  /* ------------------------------------------------------------------ */
  /*  prune                                                              */
  /* ------------------------------------------------------------------ */

  async prune(before: Date): Promise<number> {
    const isoString = before.toISOString();

    // Delete tags first (FK cascade should handle this, but be explicit)
    this.db
      .prepare(
        `DELETE FROM telescope_entries_tags WHERE entry_id IN (
          SELECT id FROM telescope_entries WHERE created_at < ?
        )`,
      )
      .run(isoString);

    const result = this.db
      .prepare('DELETE FROM telescope_entries WHERE created_at < ?')
      .run(isoString);

    return result.changes;
  }

  /* ------------------------------------------------------------------ */
  /*  truncate                                                           */
  /* ------------------------------------------------------------------ */

  async truncate(type?: EntryType): Promise<void> {
    if (type) {
      this.db
        .prepare(
          `DELETE FROM telescope_entries_tags WHERE entry_id IN (
            SELECT id FROM telescope_entries WHERE type = ?
          )`,
        )
        .run(type);

      this.db.prepare('DELETE FROM telescope_entries WHERE type = ?').run(type);
    } else {
      this.db.prepare('DELETE FROM telescope_entries_tags').run();
      this.db.prepare('DELETE FROM telescope_entries').run();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  close                                                              */
  /* ------------------------------------------------------------------ */

  async close(): Promise<void> {
    this.db.close();
  }

  /* ------------------------------------------------------------------ */
  /*  private helpers                                                    */
  /* ------------------------------------------------------------------ */

  private rowToEntry(row: EntryRow): TelescopeEntryData {
    return {
      id: row.id,
      batchId: row.batch_id,
      type: row.type as EntryType,
      content: JSON.parse(row.content) as Record<string, unknown>,
      tags: JSON.parse(row.tags) as string[],
      createdAt: row.created_at,
      ...(row.family_hash ? { familyHash: row.family_hash } : {}),
    };
  }
}
