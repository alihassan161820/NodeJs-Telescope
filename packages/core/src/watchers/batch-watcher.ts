// → Watchers/BatchWatcher.php
// Captures batch job operations

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface BatchData {
  name: string;
  totalJobs: number;
  pendingJobs: number;
  failedJobs: number;
  completedJobs?: number;
  processedJobs?: number;
  progress?: number;
  options?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export class BatchWatcher extends Watcher {
  readonly type = EntryType.Batch;

  register(_telescope: Telescope): void {
    // Batch watcher is passive — it's invoked by the batch job adapter
    // BullMQ: flow producer, custom batch processors
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the batch adapter to record a batch job operation */
  recordBatch(telescope: Telescope, data: BatchData): void {
    this.record(telescope, {
      name: data.name,
      totalJobs: data.totalJobs,
      pendingJobs: data.pendingJobs,
      failedJobs: data.failedJobs,
      completedJobs: data.completedJobs ?? 0,
      processedJobs: data.processedJobs ?? data.completedJobs ?? 0,
      progress: data.progress ?? 0,
      options: data.options ?? {},
      data: data.data ?? {},
    });
  }
}
