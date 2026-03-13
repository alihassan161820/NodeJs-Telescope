// → Watchers/CacheWatcher.php
// Captures cache operations

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface CacheData {
  type: 'hit' | 'miss' | 'set' | 'forget' | 'flush';
  command?: string;
  key: string;
  value?: unknown;
  expiration?: number;
  duration?: number;
  tags?: string[];
}

export class CacheWatcher extends Watcher {
  readonly type = EntryType.Cache;

  register(_telescope: Telescope): void {
    // Cache watcher is passive — it's invoked by the cache adapter
    // Redis, Memcached, node-cache, etc.
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the cache adapter to record a cache operation */
  recordCache(telescope: Telescope, data: CacheData): void {
    this.record(telescope, {
      type: data.type,
      command: data.command ?? data.type,
      key: data.key,
      value: data.value ?? null,
      expiration: data.expiration ?? null,
      duration: data.duration ?? 0,
      tags: data.tags ?? [],
    });
  }
}
