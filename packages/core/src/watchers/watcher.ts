// → Watchers/Watcher.php (base class)
// Abstract base for all telescope watchers — Observer pattern

import type { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { IncomingEntry } from '../incoming-entry.js';
import { getBatchId } from '../context.js';

export abstract class Watcher {
  abstract readonly type: EntryType;

  /** Register this watcher with the telescope instance */
  abstract register(telescope: Telescope): void;

  /** Unregister/cleanup this watcher */
  abstract unregister(): void;

  /** Create and record an entry through the telescope instance */
  protected record(telescope: Telescope, content: Record<string, unknown>): void {
    const entry = new IncomingEntry(this.type, content);
    entry.setBatchId(getBatchId());
    telescope.recordEntry(entry);
  }
}
