import { Pool } from 'pg';
import type { PoolConfig } from 'pg';
import type {
  StorageRepository,
  TelescopeEntryData,
  EntryFilter,
  PaginatedResult,
  EntryType,
} from '@node-telescope/core';
import { initializeSchema } from './schema.js';

/**
 * Row shape returned from the telescope_entries table.
 * Column names use snake_case following PostgreSQL conventions.
 */
interface EntryRow {
  sequence: string; // BIGSERIAL comes back as string from pg driver
  id: string;
  batch_id: string;
  type: string;
  content: Record<string, unknown>; // JSONB is auto-parsed by pg driver
  tags: string[]; // JSONB is auto-parsed by pg driver
  family_hash: string | null;
  created_at: Date; // TIMESTAMPTZ comes back as Date from pg driver
}

/**
 * PostgreSQL implementation of the StorageRepository interface.
 *
 * Uses the `pg` library with connection pooling. Accepts either a pg.Pool
 * instance or a connection string; if a string is provided, a new Pool is
 * created internally.
 */
export class PostgresStorage implements StorageRepository {
  private pool: Pool;
  private ownsPool: boolean;
  private initialized = false;

  constructor(poolOrConnectionString: Pool | string | PoolConfig) {
    if (typeof poolOrConnectionString === 'string') {
      this.pool = new Pool({ connectionString: poolOrConnectionString });
      this.ownsPool = true;
    } else if (poolOrConnectionString instanceof Pool) {
      this.pool = poolOrConnectionString;
      this.ownsPool = false;
    } else {
      this.pool = new Pool(poolOrConnectionString);
      this.ownsPool = true;
    }
  }

  /**
   * Ensure the schema has been initialized. Called lazily on first operation.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initializeSchema(this.pool);
    this.initialized = true;
  }

  /* ------------------------------------------------------------------ */
  /*  store                                                              */
  /* ------------------------------------------------------------------ */

  async store(entry: TelescopeEntryData): Promise<void> {
    await this.ensureInitialized();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO telescope_entries (id, batch_id, type, content, tags, family_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.id,
          entry.batchId,
          entry.type,
          JSON.stringify(entry.content),
          JSON.stringify(entry.tags),
          entry.familyHash ?? null,
          entry.createdAt,
        ],
      );

      for (const tag of entry.tags) {
        await client.query(
          `INSERT INTO telescope_entries_tags (entry_id, tag)
           VALUES ($1, $2)
           ON CONFLICT (entry_id, tag) DO NOTHING`,
          [entry.id, tag],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  storeBatch                                                         */
  /* ------------------------------------------------------------------ */

  async storeBatch(entries: TelescopeEntryData[]): Promise<void> {
    if (entries.length === 0) return;

    await this.ensureInitialized();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const entry of entries) {
        await client.query(
          `INSERT INTO telescope_entries (id, batch_id, type, content, tags, family_hash, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            entry.id,
            entry.batchId,
            entry.type,
            JSON.stringify(entry.content),
            JSON.stringify(entry.tags),
            entry.familyHash ?? null,
            entry.createdAt,
          ],
        );

        for (const tag of entry.tags) {
          await client.query(
            `INSERT INTO telescope_entries_tags (entry_id, tag)
             VALUES ($1, $2)
             ON CONFLICT (entry_id, tag) DO NOTHING`,
            [entry.id, tag],
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  find                                                               */
  /* ------------------------------------------------------------------ */

  async find(id: string): Promise<TelescopeEntryData | null> {
    await this.ensureInitialized();

    const result = await this.pool.query<EntryRow>(
      'SELECT * FROM telescope_entries WHERE id = $1',
      [id],
    );

    const row = result.rows[0];
    if (!row) return null;

    return this.rowToEntry(row);
  }

  /* ------------------------------------------------------------------ */
  /*  query                                                              */
  /* ------------------------------------------------------------------ */

  async query(filter: EntryFilter): Promise<PaginatedResult<TelescopeEntryData>> {
    await this.ensureInitialized();

    const take = filter.take ?? 50;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    let needsTagJoin = false;

    if (filter.type) {
      conditions.push(`e.type = $${paramIndex++}`);
      params.push(filter.type);
    }

    if (filter.batchId) {
      conditions.push(`e.batch_id = $${paramIndex++}`);
      params.push(filter.batchId);
    }

    if (filter.familyHash) {
      conditions.push(`e.family_hash = $${paramIndex++}`);
      params.push(filter.familyHash);
    }

    if (filter.tag) {
      needsTagJoin = true;
      conditions.push(`t.tag = $${paramIndex++}`);
      params.push(filter.tag);
    }

    if (filter.beforeId) {
      // Cursor pagination: get the sequence of the cursor entry,
      // then fetch entries with a lower sequence number.
      const cursorResult = await this.pool.query<{ sequence: string }>(
        'SELECT sequence FROM telescope_entries WHERE id = $1',
        [filter.beforeId],
      );

      const cursorRow = cursorResult.rows[0];
      if (cursorRow) {
        conditions.push(`e.sequence < $${paramIndex++}`);
        params.push(cursorRow.sequence);
      }
    }

    const joinClause = needsTagJoin
      ? 'INNER JOIN telescope_entries_tags t ON e.id = t.entry_id'
      : '';

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch take + 1 to determine hasMore
    params.push(take + 1);

    const sql = `
      SELECT DISTINCT e.*
      FROM telescope_entries e
      ${joinClause}
      ${whereClause}
      ORDER BY e.sequence DESC
      LIMIT $${paramIndex}
    `;

    const result = await this.pool.query<EntryRow>(sql, params);

    const rows = result.rows;
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
    await this.ensureInitialized();

    const result = await this.pool.query<EntryRow>(
      'SELECT * FROM telescope_entries WHERE batch_id = $1 ORDER BY sequence DESC',
      [batchId],
    );

    return result.rows.map((row) => this.rowToEntry(row));
  }

  /* ------------------------------------------------------------------ */
  /*  prune                                                              */
  /* ------------------------------------------------------------------ */

  async prune(before: Date): Promise<number> {
    await this.ensureInitialized();

    const isoString = before.toISOString();

    // Delete tags first (FK cascade should handle this, but be explicit)
    await this.pool.query(
      `DELETE FROM telescope_entries_tags WHERE entry_id IN (
        SELECT id FROM telescope_entries WHERE created_at < $1
      )`,
      [isoString],
    );

    const result = await this.pool.query(
      'DELETE FROM telescope_entries WHERE created_at < $1',
      [isoString],
    );

    return result.rowCount ?? 0;
  }

  /* ------------------------------------------------------------------ */
  /*  truncate                                                           */
  /* ------------------------------------------------------------------ */

  async truncate(type?: EntryType): Promise<void> {
    await this.ensureInitialized();

    if (type) {
      await this.pool.query(
        `DELETE FROM telescope_entries_tags WHERE entry_id IN (
          SELECT id FROM telescope_entries WHERE type = $1
        )`,
        [type],
      );

      await this.pool.query(
        'DELETE FROM telescope_entries WHERE type = $1',
        [type],
      );
    } else {
      // Use TRUNCATE for full table clear -- faster than DELETE
      // Must truncate tags first due to FK constraint
      await this.pool.query('TRUNCATE TABLE telescope_entries_tags');
      await this.pool.query('TRUNCATE TABLE telescope_entries CASCADE');
    }
  }

  /* ------------------------------------------------------------------ */
  /*  close                                                              */
  /* ------------------------------------------------------------------ */

  async close(): Promise<void> {
    if (this.ownsPool) {
      await this.pool.end();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  private helpers                                                    */
  /* ------------------------------------------------------------------ */

  private rowToEntry(row: EntryRow): TelescopeEntryData {
    // pg driver auto-parses JSONB columns, but handle string fallback
    const content =
      typeof row.content === 'string'
        ? (JSON.parse(row.content as unknown as string) as Record<string, unknown>)
        : row.content;

    const tags =
      typeof row.tags === 'string'
        ? (JSON.parse(row.tags as unknown as string) as string[])
        : (row.tags as string[]);

    // pg driver returns TIMESTAMPTZ as Date; convert back to ISO string
    const createdAt =
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at);

    return {
      id: row.id,
      batchId: row.batch_id,
      type: row.type as EntryType,
      content,
      tags,
      createdAt,
      ...(row.family_hash ? { familyHash: row.family_hash } : {}),
    };
  }
}
