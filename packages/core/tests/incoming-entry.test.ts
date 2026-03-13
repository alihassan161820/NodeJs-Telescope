import { describe, it, expect } from 'vitest';
import { IncomingEntry } from '../src/incoming-entry.js';
import { EntryType } from '../src/entry-type.js';

describe('IncomingEntry', () => {
  it('creates an entry with a UUID id', () => {
    const entry = new IncomingEntry(EntryType.Request, { method: 'GET' });

    expect(entry.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(entry.type).toBe(EntryType.Request);
    expect(entry.content).toEqual({ method: 'GET' });
    expect(entry.tags).toEqual([]);
    expect(entry.batchId).toBe('');
  });

  it('adds tags without duplicates', () => {
    const entry = new IncomingEntry(EntryType.Log, { level: 'info' });

    entry.addTags(['info', 'app']);
    entry.addTags(['info', 'debug']);

    expect(entry.tags).toEqual(['info', 'app', 'debug']);
  });

  it('sets batch ID', () => {
    const entry = new IncomingEntry(EntryType.Query, { sql: 'SELECT 1' });
    entry.setBatchId('batch-123');

    expect(entry.batchId).toBe('batch-123');
  });

  it('sets family hash', () => {
    const entry = new IncomingEntry(EntryType.Query, { sql: 'SELECT 1' });
    entry.setFamilyHash('hash-abc');

    expect(entry.familyHash).toBe('hash-abc');
  });

  it('converts to data object', () => {
    const entry = new IncomingEntry(EntryType.Exception, { message: 'fail' });
    entry.setBatchId('batch-456');
    entry.addTags(['Error']);

    const data = entry.toData();

    expect(data.id).toBe(entry.id);
    expect(data.batchId).toBe('batch-456');
    expect(data.type).toBe(EntryType.Exception);
    expect(data.content).toEqual({ message: 'fail' });
    expect(data.tags).toEqual(['Error']);
    expect(data.createdAt).toBeTruthy();
  });
});
