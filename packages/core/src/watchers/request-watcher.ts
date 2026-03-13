// → Watchers/RequestWatcher.php
// Captures HTTP request/response data
// Note: The actual middleware hook is in the Express/NestJS adapter packages
// This watcher provides the recording logic that adapters call

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface RequestData {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, unknown>;
  ip?: string;
  responseStatus?: number;
  responseHeaders?: Record<string, string | string[] | undefined>;
  responseBody?: unknown;
  duration?: number;
  memory?: number;
}

export class RequestWatcher extends Watcher {
  readonly type = EntryType.Request;

  register(_telescope: Telescope): void {
    // Request watcher is passive — it's invoked by the framework adapter middleware
    // No global hooks needed here
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the framework adapter to record a request/response pair */
  recordRequest(telescope: Telescope, data: RequestData): void {
    this.record(telescope, {
      method: data.method,
      url: data.url,
      path: data.path,
      headers: data.headers,
      payload: data.body ?? null,
      query: data.query ?? {},
      ipAddress: data.ip ?? 'unknown',
      responseStatus: data.responseStatus ?? 0,
      responseHeaders: data.responseHeaders ?? {},
      response: data.responseBody ?? null,
      duration: data.duration ?? 0,
      memory: data.memory ?? 0,
    });
  }
}
