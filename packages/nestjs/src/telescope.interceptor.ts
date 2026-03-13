// TelescopeInterceptor — NestJS interceptor that captures request/response data
// Equivalent to the Express middleware: wraps each request in AsyncLocalStorage context,
// captures response body via tap operator, and records via RequestWatcher

import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import {
  type Telescope,
  runWithContext,
  getContext,
  HeaderFilter,
  EntryType,
  IncomingEntry,
} from '@node-telescope/core';
import { TELESCOPE_INSTANCE } from './telescope.constants.js';

const MAX_RESPONSE_BODY_SIZE = 64 * 1024; // 64 KB

@Injectable()
export class TelescopeInterceptor implements NestInterceptor {
  private readonly headerFilter: HeaderFilter;

  constructor(
    @Inject(TELESCOPE_INSTANCE)
    private readonly telescope: Telescope,
  ) {
    this.headerFilter = new HeaderFilter(this.telescope.config.hiddenRequestHeaders);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only handle HTTP requests
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    // Skip telescope's own paths
    const requestPath = req.path || req.url;
    if (this.telescope.shouldIgnorePath(requestPath)) {
      return next.handle();
    }

    // Skip if telescope is not recording
    if (!this.telescope.isRecording()) {
      return next.handle();
    }

    // Run the rest of the request inside an AsyncLocalStorage context
    return new Observable<unknown>((subscriber) => {
      runWithContext(() => {
        const ctx = getContext();
        const startTime = ctx?.startTime ?? performance.now();
        const batchId = ctx?.batchId ?? '';

        // Monkey-patch res.write and res.end to capture response body
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
            // Verify the request watcher is registered
            if (!this.telescope.watchers.has(EntryType.Request)) return;

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
            const filteredHeaders = this.headerFilter.filter(
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

            // Create the entry manually with the captured batchId
            // (the finish event may fire outside the AsyncLocalStorage context)
            const entry = new IncomingEntry(EntryType.Request, {
              method: req.method,
              url: req.originalUrl || req.url,
              path: req.path,
              headers: filteredHeaders,
              payload: req.body ?? null,
              query: (req.query as Record<string, unknown>) ?? {},
              ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
              responseStatus: res.statusCode,
              responseHeaders,
              response: responseBody,
              duration: Math.round(duration * 100) / 100,
              memory: process.memoryUsage().heapUsed,
            });
            entry.setBatchId(batchId);
            this.telescope.recordEntry(entry);
          } catch (error) {
            console.warn('[Telescope] Error recording request:', error);
          }
        });

        // Subscribe to the next handler within the context
        next.handle().pipe(
          tap({
            error: () => {
              // Error is still recorded via res 'finish' event
            },
          }),
        ).subscribe(subscriber);
      });
    });
  }
}
