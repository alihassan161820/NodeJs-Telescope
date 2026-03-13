import { describe, it, expect } from 'vitest';
import { runWithContext, getContext, getBatchId, getElapsedMs } from '../src/context.js';

describe('context', () => {
  it('provides batch ID within context', () => {
    runWithContext(() => {
      const ctx = getContext();
      expect(ctx).toBeDefined();
      expect(ctx?.batchId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  it('returns undefined outside context', () => {
    expect(getContext()).toBeUndefined();
  });

  it('getBatchId returns context batchId when available', () => {
    runWithContext(() => {
      const batchId = getBatchId();
      const ctx = getContext();
      expect(batchId).toBe(ctx?.batchId);
    });
  });

  it('getBatchId returns a new UUID when not in context', () => {
    const batchId = getBatchId();
    expect(batchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('tracks elapsed time', async () => {
    await runWithContext(async () => {
      await new Promise((r) => setTimeout(r, 10));
      const elapsed = getElapsedMs();
      expect(elapsed).toBeGreaterThan(5);
    });
  });

  it('different contexts have different batch IDs', () => {
    let batchId1 = '';
    let batchId2 = '';

    runWithContext(() => {
      batchId1 = getBatchId();
    });

    runWithContext(() => {
      batchId2 = getBatchId();
    });

    expect(batchId1).not.toBe(batchId2);
  });
});
