// → Telescope.php
// Main entry point — registers watchers, manages entry lifecycle, coordinates storage

import { EventEmitter } from 'node:events';
import type { StorageRepository } from './contracts/storage-repository.js';
import type { TelescopeConfig, TelescopeEntryData } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import type { IncomingEntry } from './incoming-entry.js';
import { extractTags } from './extract-tags.js';
import { DataMasker } from './security/data-masker.js';
import { WatcherRegistry } from './registers-watchers.js';
import { RequestWatcher } from './watchers/request-watcher.js';
import { ExceptionWatcher } from './watchers/exception-watcher.js';
import { LogWatcher } from './watchers/log-watcher.js';
import { QueryWatcher } from './watchers/query-watcher.js';
import { ModelWatcher } from './watchers/model-watcher.js';
import { EventWatcher } from './watchers/event-watcher.js';
import { JobWatcher } from './watchers/job-watcher.js';
import { MailWatcher } from './watchers/mail-watcher.js';
import { NotificationWatcher } from './watchers/notification-watcher.js';
import { CacheWatcher } from './watchers/cache-watcher.js';
import { RedisWatcher } from './watchers/redis-watcher.js';
import { GateWatcher } from './watchers/gate-watcher.js';
import { HttpClientWatcher } from './watchers/http-client-watcher.js';
import { CommandWatcher } from './watchers/command-watcher.js';
import { ScheduleWatcher } from './watchers/schedule-watcher.js';
import { DumpWatcher } from './watchers/dump-watcher.js';
import { BatchWatcher } from './watchers/batch-watcher.js';
import { ViewWatcher } from './watchers/view-watcher.js';

export class Telescope extends EventEmitter {
  readonly config: Required<
    Pick<
      TelescopeConfig,
      'enabled' | 'path' | 'ignorePaths' | 'hiddenRequestHeaders' | 'hiddenRequestParameters' | 'pruneHours' | 'databasePath'
    >
  > &
    TelescopeConfig;

  readonly watchers: WatcherRegistry;
  private storage: StorageRepository | null = null;
  private dataMasker: DataMasker;
  private recording = true;
  private pruneInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: TelescopeConfig = {}) {
    super();

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.watchers = new WatcherRegistry();
    this.dataMasker = new DataMasker(this.config.hiddenRequestParameters);
  }

  /** Set the storage backend */
  setStorage(storage: StorageRepository): void {
    this.storage = storage;
  }

  /** Get the storage backend */
  getStorage(): StorageRepository | null {
    return this.storage;
  }

  /** Start telescope — register default watchers and begin recording */
  start(): void {
    if (!this.config.enabled) return;

    // All available watchers
    const allWatchers = [
      new RequestWatcher(),
      new ExceptionWatcher(),
      new LogWatcher(),
      new QueryWatcher(),
      new ModelWatcher(),
      new EventWatcher(),
      new JobWatcher(),
      new MailWatcher(),
      new NotificationWatcher(),
      new CacheWatcher(),
      new RedisWatcher(),
      new GateWatcher(),
      new HttpClientWatcher(),
      new CommandWatcher(),
      new ScheduleWatcher(),
      new DumpWatcher(),
      new BatchWatcher(),
      new ViewWatcher(),
    ];

    // Build watcher config map for selective enable/disable
    const watcherConfigs = new Map(
      (this.config.watchers ?? []).map((w) => [w.type, w]),
    );

    // Register watchers — all enabled by default unless config says otherwise
    for (const watcher of allWatchers) {
      const config = watcherConfigs.get(watcher.type);
      this.watchers.register(this, watcher, config);
    }

    // Start auto-pruning
    this.startPruning();
  }

  /** Stop telescope — unregister all watchers, stop pruning, close storage */
  async stop(): Promise<void> {
    this.watchers.unregisterAll();
    this.stopPruning();

    if (this.storage) {
      await this.storage.close();
    }
  }

  /** Record an entry — the central pipeline: tag → filter → mask → store → emit */
  recordEntry(entry: IncomingEntry): void {
    if (!this.recording || !this.config.enabled) return;

    try {
      // 1. Extract auto-tags
      const autoTags = extractTags(entry);
      entry.addTags(autoTags);

      // 2. Apply recording filter
      if (this.config.recordingFilter && !this.config.recordingFilter(entry)) {
        return;
      }

      // 3. Mask sensitive data
      const maskedContent = this.dataMasker.mask(entry.content);
      const entryData: TelescopeEntryData = {
        ...entry.toData(),
        content: maskedContent,
      };

      // 4. Store asynchronously (fire-and-forget — never block the host app)
      if (this.storage) {
        this.storage.store(entryData).catch((error) => {
          console.warn('[Telescope] Storage error:', error);
        });
      }

      // 5. Emit event for real-time subscribers (WebSocket)
      this.emit('entry', entryData);
    } catch (error) {
      // NEVER crash the host app
      console.warn('[Telescope] Error recording entry:', error);
    }
  }

  /** Pause recording */
  pause(): void {
    this.recording = false;
  }

  /** Resume recording */
  resume(): void {
    this.recording = true;
  }

  /** Check if recording is active */
  isRecording(): boolean {
    return this.recording && this.config.enabled;
  }

  /** Check if a path should be ignored */
  shouldIgnorePath(path: string): boolean {
    return this.config.ignorePaths.some((ignorePath) => {
      if (ignorePath.endsWith('*')) {
        return path.startsWith(ignorePath.slice(0, -1));
      }
      return path === ignorePath || path.startsWith(`${ignorePath}/`);
    });
  }

  private startPruning(): void {
    if (this.config.pruneHours <= 0) return;

    // Prune every hour
    const ONE_HOUR = 60 * 60 * 1000;
    this.pruneInterval = setInterval(() => {
      if (!this.storage) return;

      const before = new Date(Date.now() - this.config.pruneHours * ONE_HOUR);
      this.storage.prune(before).catch((error) => {
        console.warn('[Telescope] Prune error:', error);
      });
    }, ONE_HOUR);

    // Don't prevent process exit
    if (this.pruneInterval.unref) {
      this.pruneInterval.unref();
    }
  }

  private stopPruning(): void {
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
  }
}
