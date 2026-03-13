// AsyncLocalStorage-based request context propagation
// Node.js equivalent of Laravel's request lifecycle — correlates all entries via batchId

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface TelescopeContext {
  batchId: string;
  startTime: number;
}

const storage = new AsyncLocalStorage<TelescopeContext>();

/** Run a function within a telescope context (one per request) */
export function runWithContext<T>(fn: () => T): T {
  const context: TelescopeContext = {
    batchId: randomUUID(),
    startTime: performance.now(),
  };
  return storage.run(context, fn);
}

/** Get the current telescope context (returns undefined if not in a request) */
export function getContext(): TelescopeContext | undefined {
  return storage.getStore();
}

/** Get the current batch ID, or generate a standalone one if not in a request context */
export function getBatchId(): string {
  const context = getContext();
  return context?.batchId ?? randomUUID();
}

/** Get request elapsed time in ms, or 0 if not in a request context */
export function getElapsedMs(): number {
  const context = getContext();
  if (!context) return 0;
  return performance.now() - context.startTime;
}
