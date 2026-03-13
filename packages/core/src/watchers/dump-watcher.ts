// → Watchers/DumpWatcher.php
// Captures dump/debug output (like Laravel's dump())

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface DumpData {
  dump: unknown;
  content?: unknown;
  file?: string;
  line?: number;
}

export class DumpWatcher extends Watcher {
  readonly type = EntryType.Dump;

  register(_telescope: Telescope): void {
    // Dump watcher is passive — it's invoked by a dump() helper function
    // provided by the framework adapter or user code
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the dump helper to record debug output */
  recordDump(telescope: Telescope, data: DumpData): void {
    this.record(telescope, {
      dump: data.dump,
      content: data.content ?? data.dump,
      file: data.file ?? null,
      line: data.line ?? null,
    });
  }
}
