// @node-telescope/core — Public API exports
// 0 runtime dependencies — Node.js built-ins only

// Main engine
export { Telescope } from './telescope.js';

// Entry system
export { IncomingEntry } from './incoming-entry.js';
export { EntryType } from './entry-type.js';
export { extractTags } from './extract-tags.js';

// Contracts
export type { StorageRepository } from './contracts/storage-repository.js';
export type { Clearable } from './contracts/clearable.js';
export type { Prunable } from './contracts/prunable.js';

// Watchers
export { Watcher } from './watchers/watcher.js';
export { RequestWatcher } from './watchers/request-watcher.js';
export type { RequestData } from './watchers/request-watcher.js';
export { ExceptionWatcher } from './watchers/exception-watcher.js';
export { LogWatcher } from './watchers/log-watcher.js';
export { QueryWatcher } from './watchers/query-watcher.js';
export type { QueryData } from './watchers/query-watcher.js';
export { ModelWatcher } from './watchers/model-watcher.js';
export type { ModelData } from './watchers/model-watcher.js';
export { EventWatcher } from './watchers/event-watcher.js';
export type { EventData } from './watchers/event-watcher.js';
export { JobWatcher } from './watchers/job-watcher.js';
export type { JobData } from './watchers/job-watcher.js';
export { MailWatcher } from './watchers/mail-watcher.js';
export type { MailData } from './watchers/mail-watcher.js';
export { NotificationWatcher } from './watchers/notification-watcher.js';
export type { NotificationData } from './watchers/notification-watcher.js';
export { CacheWatcher } from './watchers/cache-watcher.js';
export type { CacheData } from './watchers/cache-watcher.js';
export { RedisWatcher } from './watchers/redis-watcher.js';
export type { RedisData } from './watchers/redis-watcher.js';
export { GateWatcher } from './watchers/gate-watcher.js';
export type { GateData } from './watchers/gate-watcher.js';
export { HttpClientWatcher } from './watchers/http-client-watcher.js';
export type { HttpClientData } from './watchers/http-client-watcher.js';
export { CommandWatcher } from './watchers/command-watcher.js';
export type { CommandData } from './watchers/command-watcher.js';
export { ScheduleWatcher } from './watchers/schedule-watcher.js';
export type { ScheduleData } from './watchers/schedule-watcher.js';
export { DumpWatcher } from './watchers/dump-watcher.js';
export type { DumpData } from './watchers/dump-watcher.js';
export { BatchWatcher } from './watchers/batch-watcher.js';
export type { BatchData } from './watchers/batch-watcher.js';
export { ViewWatcher } from './watchers/view-watcher.js';
export type { ViewData } from './watchers/view-watcher.js';

// Storage utilities
export { EntryQueryOptions } from './storage/entry-query-options.js';

// Security
export { DataMasker } from './security/data-masker.js';
export { HeaderFilter } from './security/header-filter.js';

// Context
export { runWithContext, getContext, getBatchId, getElapsedMs } from './context.js';
export type { TelescopeContext } from './context.js';

// Types
export type {
  TelescopeConfig,
  WatcherConfig,
  TelescopeEntryData,
  EntryFilter,
  PaginatedResult,
} from './types.js';
export { DEFAULT_CONFIG } from './types.js';

// Watcher registry
export { WatcherRegistry } from './registers-watchers.js';
