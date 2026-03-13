// Express middleware — captures request/response data and feeds it to the Telescope core engine
// Mirrors Laravel Telescope's request lifecycle: context creation → capture → record

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Telescope } from '@node-telescope/core';
import { runWithContext, getContext, HeaderFilter, EntryType } from '@node-telescope/core';
import type { RequestWatcher } from '@node-telescope/core';

const MAX_RESPONSE_BODY_SIZE = 64 * 1024; // 64 KB — don't store huge responses

/**
 * Creates the main Telescope middleware for Express.
 * Wraps each request in an AsyncLocalStorage context, captures request/response data,
 * and records it via the RequestWatcher.
 */
export function createMiddleware(telescope: Telescope): RequestHandler {
  const headerFilter = new HeaderFilter(telescope.config.hiddenRequestHeaders);

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Skip telescope's own paths
      if (telescope.shouldIgnorePath(req.path)) {
        next();
        return;
      }

      // Skip if telescope is not recording
      if (!telescope.isRecording()) {
        next();
        return;
      }

      // Run the rest of the request inside an AsyncLocalStorage context
      runWithContext(() => {
        const context = getContext();
        const startTime = context?.startTime ?? performance.now();

        // Capture response body by monkey-patching res.write and res.end
        const chunks: Buffer[] = [];
        let responseBodySize = 0;

        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);

        res.write = function telescopeWrite(
          chunk: unknown,
          ...args: unknown[]
        ): boolean {
          try {
            if (chunk && responseBodySize < MAX_RESPONSE_BODY_SIZE) {
              const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
              responseBodySize += buf.length;
              if (responseBodySize <= MAX_RESPONSE_BODY_SIZE) {
                chunks.push(buf);
              }
            }
          } catch {
            // Never crash the host app
          }
          return originalWrite(chunk, ...(args as []));
        } as typeof res.write;

        res.end = function telescopeEnd(
          chunk?: unknown,
          ...args: unknown[]
        ): Response {
          try {
            if (chunk && responseBodySize < MAX_RESPONSE_BODY_SIZE) {
              const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
              responseBodySize += buf.length;
              if (responseBodySize <= MAX_RESPONSE_BODY_SIZE) {
                chunks.push(buf);
              }
            }
          } catch {
            // Never crash the host app
          }
          return originalEnd(chunk, ...(args as []));
        } as typeof res.end;

        // Record on response finish
        res.on('finish', () => {
          try {
            const requestWatcher = telescope.watchers.get<RequestWatcher>(EntryType.Request);
            if (!requestWatcher) return;

            const duration = performance.now() - startTime;

            // Parse response body
            let responseBody: unknown = null;
            try {
              const raw = Buffer.concat(chunks).toString('utf-8');
              const contentType = res.getHeader('content-type');
              if (typeof contentType === 'string' && contentType.includes('application/json')) {
                responseBody = JSON.parse(raw);
              } else {
                responseBody = raw;
              }
            } catch {
              responseBody = '[unparseable]';
            }

            // Filter sensitive headers
            const filteredHeaders = headerFilter.filter(
              req.headers as Record<string, string | string[] | undefined>,
            );

            // Capture response headers
            const rawResponseHeaders = res.getHeaders();
            const responseHeaders: Record<string, string | string[] | undefined> = {};
            for (const [key, value] of Object.entries(rawResponseHeaders)) {
              if (typeof value === 'number') {
                responseHeaders[key] = String(value);
              } else {
                responseHeaders[key] = value;
              }
            }

            requestWatcher.recordRequest(telescope, {
              method: req.method,
              url: req.originalUrl || req.url,
              path: req.path,
              headers: filteredHeaders,
              body: req.body ?? null,
              query: (req.query as Record<string, unknown>) ?? {},
              ip: req.ip || req.socket?.remoteAddress || 'unknown',
              responseStatus: res.statusCode,
              responseHeaders,
              responseBody,
              duration: Math.round(duration * 100) / 100,
              memory: process.memoryUsage().heapUsed,
            });
          } catch (error) {
            console.warn('[Telescope] Error recording request:', error);
          }
        });

        next();
      });
    } catch (error) {
      // NEVER crash the host app — pass through on any telescope error
      console.warn('[Telescope] Middleware error:', error);
      next();
    }
  };
}
