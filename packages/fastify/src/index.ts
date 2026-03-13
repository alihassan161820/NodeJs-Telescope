// @node-telescope/fastify — Fastify plugin adapter for Node-Telescope
// ONE LINE integration: await app.register(telescopePlugin)

export { telescopePlugin } from './plugin.js';
export { registerApiRoutes } from './api-routes.js';
export { registerDashboardRoutes } from './dashboard.js';
export { createWebSocketServer } from './websocket.js';

// Re-export core types for convenience
export type { TelescopeConfig } from '@node-telescope/core';
export { Telescope } from '@node-telescope/core';

// Default export for simple usage
export { telescopePlugin as default } from './plugin.js';
