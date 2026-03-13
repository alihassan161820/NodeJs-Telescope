// → Watchers/JobWatcher.php
// Captures background job execution (BullMQ, Agenda, etc)

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface JobData {
  name: string;
  job?: string;
  class?: string;
  queue: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  connection?: string;
  duration?: number;
  tries?: number;
  timeout?: number;
  exception?: string;
  error?: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export class JobWatcher extends Watcher {
  readonly type = EntryType.Job;

  register(_telescope: Telescope): void {
    // Job watcher is passive — it's invoked by the queue adapter
    // BullMQ: Worker events, Agenda: job events
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the queue adapter to record a job event */
  recordJob(telescope: Telescope, data: JobData): void {
    this.record(telescope, {
      name: data.name,
      job: data.job ?? data.class ?? data.name,
      queue: data.queue,
      status: data.status,
      connection: data.connection ?? null,
      duration: data.duration ?? 0,
      tries: data.tries ?? null,
      timeout: data.timeout ?? null,
      exception: data.exception ?? data.error ?? null,
      data: data.data ?? data.payload ?? {},
      payload: data.payload ?? data.data ?? {},
    });
  }
}
