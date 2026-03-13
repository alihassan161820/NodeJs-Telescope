// Shared types for Node-Telescope
// All config optional with sensible defaults — mirrors Laravel Telescope's zero-config approach

import type { EntryType } from './entry-type.js';
import type { IncomingEntry } from './incoming-entry.js';
import type { StorageRepository } from './contracts/storage-repository.js';

export interface TelescopeConfig {
  /** Enable/disable Telescope. Default: NODE_ENV !== 'production' */
  enabled?: boolean;

  /** Dashboard path prefix. Default: '/__telescope' */
  path?: string;

  /** Storage implementation. Default: SqliteStorage (from @node-telescope/storage-sqlite) */
  storage?: StorageRepository;

  /** Watchers to register. Default: all available watchers */
  watchers?: WatcherConfig[];

  /** Request paths to ignore. Default: ['/__telescope'] */
  ignorePaths?: string[];

  /** Authorization gate — return true to allow dashboard access. Default: () => true */
  gate?: (req: unknown) => boolean | Promise<boolean>;

  /** Filter which entries get recorded. Default: all entries recorded */
  recordingFilter?: (entry: IncomingEntry) => boolean;

  /** Request headers to mask before storage. Default: ['authorization', 'cookie', 'set-cookie'] */
  hiddenRequestHeaders?: string[];

  /** Request/response body fields to mask. Default: ['password', 'token', 'secret', 'credit_card'] */
  hiddenRequestParameters?: string[];

  /** Auto-prune entries older than this many hours. Default: 24 */
  pruneHours?: number;

  /** Database file path for SQLite storage. Default: './telescope.sqlite' */
  databasePath?: string;
}

export interface WatcherConfig {
  /** Watcher class to register */
  type: EntryType;

  /** Enable/disable this watcher. Default: true */
  enabled?: boolean;

  /** Watcher-specific options */
  options?: Record<string, unknown>;
}

export interface TelescopeEntryData {
  id: string;
  batchId: string;
  type: EntryType;
  content: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  familyHash?: string;
}

export interface EntryFilter {
  type?: EntryType;
  batchId?: string;
  tag?: string;
  beforeId?: string;
  take?: number;
  familyHash?: string;
}

export interface PaginatedResult<T> {
  entries: T[];
  hasMore: boolean;
}

export const DEFAULT_CONFIG: Required<
  Pick<
    TelescopeConfig,
    | 'enabled'
    | 'path'
    | 'ignorePaths'
    | 'hiddenRequestHeaders'
    | 'hiddenRequestParameters'
    | 'pruneHours'
    | 'databasePath'
  >
> = {
  enabled: process.env['NODE_ENV'] !== 'production',
  path: '/__telescope',
  ignorePaths: ['/__telescope'],
  hiddenRequestHeaders: ['authorization', 'cookie', 'set-cookie'],
  hiddenRequestParameters: ['password', 'token', 'secret', 'credit_card'],
  pruneHours: 24,
  databasePath: './telescope.sqlite',
};
