import { describe, it, expect } from 'vitest';
import { PostgresStorage } from '../src/postgres-storage.js';
import { buildInitializationSQL, SCHEMA_VERSION } from '../src/schema.js';

describe('PostgresStorage (unit)', () => {
  describe('constructor', () => {
    it('accepts a connection string and creates a pool internally', () => {
      // We cannot easily verify pool creation without connecting,
      // but we can verify the constructor does not throw.
      const storage = new PostgresStorage('postgresql://localhost:5432/test');
      expect(storage).toBeInstanceOf(PostgresStorage);
      // Clean up the pool without connecting
      // pool.end() is safe to call even if never connected
      void storage.close();
    });

    it('accepts a PoolConfig object', () => {
      const storage = new PostgresStorage({
        host: 'localhost',
        port: 5432,
        database: 'test',
      });
      expect(storage).toBeInstanceOf(PostgresStorage);
      void storage.close();
    });
  });

  describe('StorageRepository interface', () => {
    it('implements all required methods', () => {
      const storage = new PostgresStorage('postgresql://localhost:5432/test');

      expect(typeof storage.store).toBe('function');
      expect(typeof storage.storeBatch).toBe('function');
      expect(typeof storage.find).toBe('function');
      expect(typeof storage.query).toBe('function');
      expect(typeof storage.findByBatchId).toBe('function');
      expect(typeof storage.prune).toBe('function');
      expect(typeof storage.truncate).toBe('function');
      expect(typeof storage.close).toBe('function');

      void storage.close();
    });
  });

  describe('SCHEMA_VERSION', () => {
    it('is a positive integer', () => {
      expect(SCHEMA_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    });
  });

  describe('buildInitializationSQL', () => {
    const sql = buildInitializationSQL();

    it('generates SQL that creates the telescope_entries table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS telescope_entries');
    });

    it('generates SQL that creates the telescope_entries_tags table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS telescope_entries_tags');
    });

    it('generates SQL that creates the telescope_schema_version table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS telescope_schema_version');
    });

    it('uses BIGSERIAL for the sequence column', () => {
      expect(sql).toContain('BIGSERIAL');
    });

    it('uses JSONB for the content column', () => {
      expect(sql).toContain('JSONB');
    });

    it('uses TIMESTAMPTZ for the created_at column', () => {
      expect(sql).toContain('TIMESTAMPTZ');
    });

    it('includes a foreign key from tags to entries', () => {
      expect(sql).toContain(
        'FOREIGN KEY (entry_id) REFERENCES telescope_entries(id) ON DELETE CASCADE',
      );
    });

    it('creates indexes on type, batch_id, created_at, family_hash, and tag', () => {
      expect(sql).toContain('idx_telescope_entries_type');
      expect(sql).toContain('idx_telescope_entries_batch_id');
      expect(sql).toContain('idx_telescope_entries_created_at');
      expect(sql).toContain('idx_telescope_entries_family_hash');
      expect(sql).toContain('idx_telescope_entries_tags_tag');
      expect(sql).toContain('idx_telescope_entries_tags_entry_id');
    });

    it('uses TEXT PRIMARY KEY for the id column', () => {
      expect(sql).toContain('id          TEXT         PRIMARY KEY');
    });

    it('creates a composite primary key on (entry_id, tag)', () => {
      expect(sql).toContain('PRIMARY KEY (entry_id, tag)');
    });
  });

  describe('storeBatch with empty array', () => {
    it('returns immediately without connecting to the database', async () => {
      // Creating the storage with a bogus URL -- storeBatch([]) should
      // return before any database interaction occurs.
      const storage = new PostgresStorage('postgresql://localhost:1/bogus');
      await expect(storage.storeBatch([])).resolves.toBeUndefined();
      void storage.close();
    });
  });
});
