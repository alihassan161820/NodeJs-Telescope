// → Watchers/RedisWatcher.php
// Captures Redis commands

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface RedisData {
  command: string;
  connection: string;
  duration: number;
  parameters?: string[];
  args?: string[];
  result?: unknown;
}

export class RedisWatcher extends Watcher {
  readonly type = EntryType.Redis;

  register(_telescope: Telescope): void {
    // Redis watcher is passive — it's invoked by the Redis client adapter
    // ioredis: monitor command, node-redis: command hooks
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the Redis adapter to record a Redis command */
  recordRedis(telescope: Telescope, data: RedisData): void {
    this.record(telescope, {
      command: data.command,
      connection: data.connection,
      duration: data.duration,
      parameters: data.parameters ?? data.args ?? [],
      result: data.result ?? null,
    });
  }
}
