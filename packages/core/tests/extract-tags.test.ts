import { describe, it, expect } from 'vitest';
import { IncomingEntry } from '../src/incoming-entry.js';
import { EntryType } from '../src/entry-type.js';
import { extractTags } from '../src/extract-tags.js';

describe('extractTags', () => {
  it('extracts request tags: method, status, path', () => {
    const entry = new IncomingEntry(EntryType.Request, {
      method: 'GET',
      responseStatus: 200,
      path: '/api/users',
    });

    const tags = extractTags(entry);

    expect(tags).toContain('GET');
    expect(tags).toContain('status:200');
    expect(tags).toContain('uri:/api/users');
  });

  it('adds error tags for 4xx/5xx status', () => {
    const entry = new IncomingEntry(EntryType.Request, {
      method: 'POST',
      responseStatus: 500,
      path: '/api/crash',
    });

    const tags = extractTags(entry);

    expect(tags).toContain('error');
    expect(tags).toContain('server-error');
    expect(tags).toContain('status:500');
  });

  it('extracts exception tags: class name', () => {
    const entry = new IncomingEntry(EntryType.Exception, {
      class: 'TypeError',
    });

    const tags = extractTags(entry);

    expect(tags).toContain('TypeError');
  });

  it('extracts log tags: level', () => {
    const entry = new IncomingEntry(EntryType.Log, { level: 'error' });

    const tags = extractTags(entry);

    expect(tags).toContain('error');
  });

  it('extracts query tags: connection and slow', () => {
    const entry = new IncomingEntry(EntryType.Query, {
      connection: 'prisma',
      slow: true,
    });

    const tags = extractTags(entry);

    expect(tags).toContain('prisma');
    expect(tags).toContain('slow');
  });
});
