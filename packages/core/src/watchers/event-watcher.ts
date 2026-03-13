// → Watchers/EventWatcher.php
// Captures application events

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface EventData {
  name: string;
  event?: string;
  listeners: string[];
  broadcast?: boolean;
  broadcaster?: string;
  payload?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export class EventWatcher extends Watcher {
  readonly type = EntryType.Event;

  register(_telescope: Telescope): void {
    // Event watcher is passive — it's invoked by the framework adapter
    // The adapter wraps EventEmitter or a custom event bus
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the framework adapter to record an application event */
  recordEvent(telescope: Telescope, data: EventData): void {
    this.record(telescope, {
      name: data.name,
      event: data.event ?? data.name,
      listeners: data.listeners,
      broadcast: data.broadcast ?? false,
      broadcaster: data.broadcaster ?? null,
      payload: data.payload ?? data.data ?? {},
      data: data.data ?? data.payload ?? {},
    });
  }
}
