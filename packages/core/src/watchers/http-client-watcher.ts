// → Watchers/HttpClientWatcher.php
// Captures outgoing HTTP requests (fetch, axios, etc)

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface HttpClientData {
  method: string;
  url: string;
  headers?: Record<string, string>;
  status?: number;
  statusCode?: number;
  payload?: unknown;
  responseHeaders?: Record<string, string>;
  response?: unknown;
  responseBody?: unknown;
  duration: number;
}

export class HttpClientWatcher extends Watcher {
  readonly type = EntryType.HttpClient;

  register(_telescope: Telescope): void {
    // HTTP client watcher is passive — it's invoked by the HTTP client adapter
    // axios: interceptors, fetch: wrapper/monkey-patch
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the HTTP client adapter to record an outgoing HTTP request */
  recordHttpClient(telescope: Telescope, data: HttpClientData): void {
    this.record(telescope, {
      method: data.method,
      url: data.url,
      uri: data.url,
      headers: data.headers ?? {},
      status: data.status ?? data.statusCode ?? 0,
      payload: data.payload ?? null,
      responseHeaders: data.responseHeaders ?? {},
      response: data.response ?? data.responseBody ?? null,
      duration: data.duration,
    });
  }
}
