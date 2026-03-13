// Fastify plugin — captures request/response data and feeds it to the Telescope core engine
// Uses Fastify hooks (NOT middleware) following Fastify v5 best practices

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { Telescope, TelescopeConfig, StorageRepository } from '@node-telescope/core';
import { Telescope as TelescopeClass, runWithContext, getContext, HeaderFilter, EntryType } from '@node-telescope/core';
import type { RequestWatcher } from '@node-telescope/core';
import { registerApiRoutes } from './api-routes.js';
import { registerDashboardRoutes } from './dashboard.js';
import { createWebSocketServer } from './websocket.js';

const MAX_RESPONSE_BODY_SIZE = 64 * 1024; // 64 KB — don't store huge responses

declare module 'fastify' {
  interface FastifyInstance {
    telescope: Telescope;
  }
}

/**
 * Tries to auto-resolve and instantiate @node-telescope/storage-sqlite.
 * Returns the storage instance or null if the package is not installed.
 */
async function autoResolveStorage(config: TelescopeConfig): Promise<unknown> {
  try {
    const { SqliteStorage } = await import('@node-telescope/storage-sqlite');
    const storage = new SqliteStorage(config.databasePath);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Main Fastify plugin for Node-Telescope.
 *
 * Usage:
 * ```ts
 * import { telescopePlugin } from '@node-telescope/fastify';
 * await app.register(telescopePlugin);
 * ```
 *
 * Registers:
 * - Request/response monitoring hooks
 * - Telescope REST API routes (at {path}/api)
 * - Dashboard SPA (at {path})
 * - WebSocket server (at {path}/ws) for real-time updates
 */
async function telescopePluginFn(
  fastify: FastifyInstance,
  opts: TelescopeConfig,
): Promise<void> {
  const instance = new TelescopeClass(opts);
  const telescopePath = instance.config.path;

  // Auto-resolve storage if none provided
  if (!opts?.storage) {
    try {
      const storage = await autoResolveStorage(instance.config);
      if (storage) {
        instance.setStorage(storage as StorageRepository);
      } else {
        console.warn(
          '[Telescope] No storage configured. Install @node-telescope/storage-sqlite for automatic setup.',
        );
      }
    } catch (error) {
      console.warn('[Telescope] Storage auto-resolve error:', error);
    }
  } else {
    instance.setStorage(opts.storage);
  }

  // Start telescope — register watchers, begin recording
  instance.start();

  // Decorate the Fastify instance so other plugins/routes can access telescope
  fastify.decorate('telescope', instance);

  // Set up request/response capture hooks
  const headerFilter = new HeaderFilter(instance.config.hiddenRequestHeaders);

  // We use a symbol on the request to store per-request capture state
  // This avoids polluting the request object's public API
  const kTelescopeState = Symbol('telescopeState');

  interface TelescopeRequestState {
    startTime: number;
    responseChunks: Buffer[];
    responseBodySize: number;
    runInContext: boolean;
  }

  // onRequest hook — wraps each request in AsyncLocalStorage context
  fastify.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done) => {
    try {
      // Skip telescope's own paths
      const urlPath = request.url.split('?')[0] ?? request.url;
      if (instance.shouldIgnorePath(urlPath)) {
        done();
        return;
      }

      // Skip if telescope is not recording
      if (!instance.isRecording()) {
        done();
        return;
      }

      // Run the rest of the request inside an AsyncLocalStorage context
      runWithContext(() => {
        const context = getContext();
        const startTime = context?.startTime ?? performance.now();

        // Store state on the request object
        (request as unknown as Record<symbol, TelescopeRequestState>)[kTelescopeState] = {
          startTime,
          responseChunks: [],
          responseBodySize: 0,
          runInContext: true,
        };

        done();
      });
    } catch (error) {
      // NEVER crash the host app
      console.warn('[Telescope] onRequest hook error:', error);
      done();
    }
  });

  // onSend hook — capture the response body payload before it is sent
  fastify.addHook('onSend', (request: FastifyRequest, _reply: FastifyReply, payload: unknown, done) => {
    try {
      const state = (request as unknown as Record<symbol, TelescopeRequestState | undefined>)[kTelescopeState];
      if (!state) {
        done(null, payload);
        return;
      }

      if (payload && state.responseBodySize < MAX_RESPONSE_BODY_SIZE) {
        let buf: Buffer;
        if (Buffer.isBuffer(payload)) {
          buf = payload;
        } else if (typeof payload === 'string') {
          buf = Buffer.from(payload);
        } else {
          // For streams or other payloads, skip capture
          done(null, payload);
          return;
        }

        state.responseBodySize += buf.length;
        if (state.responseBodySize <= MAX_RESPONSE_BODY_SIZE) {
          state.responseChunks.push(buf);
        }
      }
    } catch {
      // Never crash the host app
    }
    done(null, payload);
  });

  // onResponse hook — record the completed request/response pair
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    try {
      const state = (request as unknown as Record<symbol, TelescopeRequestState | undefined>)[kTelescopeState];
      if (!state) {
        done();
        return;
      }

      const requestWatcher = instance.watchers.get<RequestWatcher>(EntryType.Request);
      if (!requestWatcher) {
        done();
        return;
      }

      const duration = performance.now() - state.startTime;

      // Parse response body
      let responseBody: unknown = null;
      try {
        const raw = Buffer.concat(state.responseChunks).toString('utf-8');
        const contentType = reply.getHeader('content-type');
        if (typeof contentType === 'string' && contentType.includes('application/json')) {
          responseBody = JSON.parse(raw);
        } else {
          responseBody = raw;
        }
      } catch {
        responseBody = '[unparseable]';
      }

      // Filter sensitive request headers
      const filteredHeaders = headerFilter.filter(
        request.headers as Record<string, string | string[] | undefined>,
      );

      // Capture response headers
      const rawResponseHeaders = reply.getHeaders();
      const responseHeaders: Record<string, string | string[] | undefined> = {};
      for (const [key, value] of Object.entries(rawResponseHeaders)) {
        if (typeof value === 'number') {
          responseHeaders[key] = String(value);
        } else if (Array.isArray(value)) {
          responseHeaders[key] = value.map(String);
        } else {
          responseHeaders[key] = value as string | undefined;
        }
      }

      // Extract path and query from the URL
      const urlParts = request.url.split('?');
      const path = urlParts[0] ?? request.url;
      const query = request.query as Record<string, unknown> ?? {};

      requestWatcher.recordRequest(instance, {
        method: request.method,
        url: request.url,
        path,
        headers: filteredHeaders,
        body: request.body ?? null,
        query,
        ip: request.ip || request.socket?.remoteAddress || 'unknown',
        responseStatus: reply.statusCode,
        responseHeaders,
        responseBody,
        duration: Math.round(duration * 100) / 100,
        memory: process.memoryUsage().heapUsed,
      });
    } catch (error) {
      console.warn('[Telescope] Error recording request:', error);
    }

    done();
  });

  // Register API routes under {path}/api
  await registerApiRoutes(fastify, instance, telescopePath);

  // Register dashboard routes under {path}
  await registerDashboardRoutes(fastify, telescopePath);

  // Set up WebSocket on the underlying server
  let wsSetup = false;
  fastify.addHook('onReady', (done) => {
    try {
      if (!wsSetup && fastify.server) {
        wsSetup = true;
        createWebSocketServer(instance, fastify.server, telescopePath);
      }
    } catch (error) {
      console.warn('[Telescope] WebSocket setup error:', error);
    }
    done();
  });

  // Clean up when Fastify closes
  fastify.addHook('onClose', async (_instance) => {
    try {
      await instance.stop();
    } catch (error) {
      console.warn('[Telescope] Shutdown error:', error);
    }
  });
}

/**
 * Fastify plugin wrapped with fastify-plugin for proper encapsulation.
 * This ensures decorators and hooks are visible to the parent context.
 */
export const telescopePlugin = fp(telescopePluginFn, {
  fastify: '>=5.0.0',
  name: '@node-telescope/fastify',
});
