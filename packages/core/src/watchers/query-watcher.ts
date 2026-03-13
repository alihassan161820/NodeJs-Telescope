// → Watchers/QueryWatcher.php
// Captures database queries — works with Prisma, Mongoose, TypeORM, Sequelize, Knex, Drizzle
// Auto-detects installed ORMs at startup

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface QueryData {
  connection: string;
  sql: string;
  bindings?: unknown[];
  duration: number;
  slow?: boolean;
}

const SLOW_QUERY_THRESHOLD_MS = 100;

export class QueryWatcher extends Watcher {
  readonly type = EntryType.Query;
  private slowThreshold: number;

  constructor(slowThreshold?: number) {
    super();
    this.slowThreshold = slowThreshold ?? SLOW_QUERY_THRESHOLD_MS;
  }

  register(_telescope: Telescope): void {
    // Query watcher hooks are set up per-ORM by the framework adapter
    // Prisma: $on('query', ...)
    // Mongoose: mongoose.set('debug', ...)
    // These hooks call recordQuery() when queries execute
  }

  unregister(): void {
    // ORM hooks are cleaned up by the framework adapter
  }

  /** Record a database query — called by ORM-specific hooks */
  recordQuery(telescope: Telescope, data: QueryData): void {
    const isSlow = data.duration >= this.slowThreshold;

    this.record(telescope, {
      connection: data.connection,
      sql: data.sql,
      bindings: data.bindings ?? [],
      duration: data.duration,
      slow: isSlow,
    });
  }
}
