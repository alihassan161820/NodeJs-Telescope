// → Watchers/ModelWatcher.php
// Captures ORM model events (created, updated, deleted)

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface ModelData {
  model: string;
  class?: string;
  action: 'created' | 'updated' | 'deleted';
  key?: string | number;
  changes?: Record<string, unknown>;
  original?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

export class ModelWatcher extends Watcher {
  readonly type = EntryType.Model;

  register(_telescope: Telescope): void {
    // Model watcher is passive — it's invoked by the ORM adapter hooks
    // Prisma: middleware, Mongoose: pre/post hooks, TypeORM: subscribers
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the ORM adapter to record a model event */
  recordModel(telescope: Telescope, data: ModelData): void {
    this.record(telescope, {
      model: data.model,
      class: data.class ?? data.model,
      action: data.action,
      key: data.key ?? null,
      changes: data.changes ?? {},
      original: data.original ?? {},
      attributes: data.attributes ?? {},
    });
  }
}
