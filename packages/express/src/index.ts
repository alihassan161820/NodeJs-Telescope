// @node-telescope/express — Express adapter for Node-Telescope
// ONE LINE integration: app.use(telescope())

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Server as HttpServer } from 'node:http';
import type { TelescopeConfig, StorageRepository } from '@node-telescope/core';
import { Telescope } from '@node-telescope/core';
import { createMiddleware } from './middleware.js';
import { createApiRouter } from './api-router.js';
import { createDashboardRouter } from './dashboard-router.js';
import { createWebSocketServer } from './websocket.js';

// Re-export individual pieces for advanced users
export { createMiddleware } from './middleware.js';
export { createApiRouter } from './api-router.js';
export { createDashboardRouter } from './dashboard-router.js';
export { createWebSocketServer } from './websocket.js';

// Re-export core types for convenience
export type { TelescopeConfig } from '@node-telescope/core';
export { Telescope } from '@node-telescope/core';

/**
 * Tries to auto-resolve and instantiate @node-telescope/storage-sqlite.
 * Returns the storage instance or null if the package is not installed.
 */
async function autoResolveStorage(config: TelescopeConfig): Promise<unknown> {
  try {
    // Dynamic import — only resolves if the package is installed
    const { SqliteStorage } = await import('@node-telescope/storage-sqlite');
    const storage = new SqliteStorage(config.databasePath);
    return storage;
  } catch {
    // Package not installed — that's fine, storage is optional
    return null;
  }
}

/**
 * Attaches WebSocket server to the HTTP server once it starts listening.
 * Hooks into the server via the Express app.
 */
function setupWebSocket(telescope: Telescope, path: string): void {
  // We need to find the HTTP server. Express doesn't directly expose it,
  // so we hook into the middleware to detect the server from the request.
  let wsSetup = false;

  const serverDetector = (_req: { socket?: { server?: HttpServer } }): void => {
    try {
      if (wsSetup) return;
      const server = _req?.socket?.server as HttpServer | undefined;
      if (server) {
        wsSetup = true;
        createWebSocketServer(telescope, server, path);
      }
    } catch (error) {
      console.warn('[Telescope] WebSocket setup error:', error);
    }
  };

  // Store the detector so the middleware can call it
  (telescope as unknown as Record<string, unknown>)['_wsServerDetector'] = serverDetector;
}

/**
 * Creates the complete Telescope middleware stack for Express.
 *
 * Usage:
 * ```ts
 * import { telescope } from '@node-telescope/express';
 * app.use(telescope());
 * ```
 *
 * Returns an array of Express middleware/routers that handles:
 * - Request/response monitoring
 * - Telescope REST API (at {path}/api)
 * - Dashboard SPA (at {path})
 * - WebSocket server (at {path}/ws) for real-time updates
 */
export function telescope(config?: TelescopeConfig): Router {
  const instance = new Telescope(config);
  const telescopePath = instance.config.path;

  // Auto-resolve storage if none provided
  if (!config?.storage) {
    autoResolveStorage(instance.config)
      .then((storage) => {
        if (storage) {
          instance.setStorage(storage as StorageRepository);
        } else {
          console.warn(
            '[Telescope] No storage configured. Install @node-telescope/storage-sqlite for automatic setup.',
          );
        }
      })
      .catch((error) => {
        console.warn('[Telescope] Storage auto-resolve error:', error);
      });
  } else {
    instance.setStorage(config.storage);
  }

  // Start telescope — register watchers, begin recording
  instance.start();

  // Build the middleware stack
  const middleware = createMiddleware(instance);
  const apiRouter = createApiRouter(instance);
  const dashboardRouter = createDashboardRouter();

  // Set up WebSocket detection
  setupWebSocket(instance, telescopePath);

  // Single router that encapsulates everything — works with app.use(telescope())
  // in both Express 4 and Express 5 without spreading
  const root = Router();

  // WebSocket server detection — runs on every request until server is found
  root.use((req, _res, next) => {
    try {
      const detector = (instance as unknown as Record<string, unknown>)['_wsServerDetector'] as
        | ((req: unknown) => void)
        | undefined;
      if (detector) {
        detector(req);
      }
    } catch {
      // Never crash the host app
    }
    next();
  });

  // Request monitoring middleware (runs on every non-telescope request)
  root.use(middleware);

  // Mount API routes under {path}/api
  root.use(`${telescopePath}/api`, apiRouter);

  // Mount dashboard under {path}
  root.use(telescopePath, dashboardRouter);

  return root;
}

export default telescope;
