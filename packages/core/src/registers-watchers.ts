// → RegistersWatchers.php
// Watcher registration and management mixin

import type { EntryType } from './entry-type.js';
import type { Telescope } from './telescope.js';
import type { Watcher } from './watchers/watcher.js';
import type { WatcherConfig } from './types.js';

export class WatcherRegistry {
  private watchers = new Map<EntryType, Watcher>();

  /** Register a watcher instance */
  register(telescope: Telescope, watcher: Watcher, config?: WatcherConfig): void {
    if (config?.enabled === false) return;

    try {
      watcher.register(telescope);
      this.watchers.set(watcher.type, watcher);
    } catch (error) {
      console.warn(`[Telescope] Failed to register ${watcher.type} watcher:`, error);
    }
  }

  /** Get a registered watcher by type */
  get<T extends Watcher>(type: EntryType): T | undefined {
    return this.watchers.get(type) as T | undefined;
  }

  /** Check if a watcher type is registered */
  has(type: EntryType): boolean {
    return this.watchers.has(type);
  }

  /** Unregister all watchers and clean up */
  unregisterAll(): void {
    for (const [type, watcher] of this.watchers) {
      try {
        watcher.unregister();
      } catch (error) {
        console.warn(`[Telescope] Failed to unregister ${type} watcher:`, error);
      }
    }
    this.watchers.clear();
  }

  /** Get all registered watcher types */
  registeredTypes(): EntryType[] {
    return Array.from(this.watchers.keys());
  }
}
