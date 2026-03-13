// → Watchers/ScheduleWatcher.php
// Captures scheduled task execution

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface ScheduleData {
  name: string;
  command?: string;
  expression: string;
  status?: string;
  duration?: number;
  timezone?: string;
  nextDue?: string;
  output?: string;
  exception?: string;
}

export class ScheduleWatcher extends Watcher {
  readonly type = EntryType.Schedule;

  register(_telescope: Telescope): void {
    // Schedule watcher is passive — it's invoked by the scheduler adapter
    // node-cron, bull repeatable jobs, Agenda scheduled jobs
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the scheduler adapter to record a scheduled task execution */
  recordSchedule(telescope: Telescope, data: ScheduleData): void {
    this.record(telescope, {
      name: data.name,
      command: data.command ?? data.name,
      expression: data.expression,
      status: data.status ?? null,
      duration: data.duration ?? 0,
      timezone: data.timezone ?? null,
      nextDue: data.nextDue ?? null,
      output: data.output ?? null,
      exception: data.exception ?? null,
    });
  }
}
