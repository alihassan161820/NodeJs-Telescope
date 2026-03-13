// @node-telescope/nestjs — NestJS module adapter for Node-Telescope
// Usage: TelescopeModule.forRoot() or TelescopeModule.forRootAsync()

// Main module
export { TelescopeModule } from './telescope.module.js';

// Interceptor (for advanced users who want to register it manually)
export { TelescopeInterceptor } from './telescope.interceptor.js';

// Controller (for advanced routing customization)
export { TelescopeController } from './telescope.controller.js';

// Guard
export { TelescopeAuthGuard } from './telescope.guard.js';

// WebSocket gateway
export { TelescopeGateway } from './telescope.gateway.js';

// Dashboard middleware
export { TelescopeDashboardMiddleware } from './telescope.dashboard.js';

// Injection tokens
export { TELESCOPE_OPTIONS, TELESCOPE_INSTANCE } from './telescope.constants.js';

// Interfaces
export type {
  TelescopeModuleOptions,
  TelescopeModuleAsyncOptions,
  TelescopeOptionsFactory,
} from './telescope.interfaces.js';

// Re-export core types for convenience
export type { TelescopeConfig } from '@node-telescope/core';
export { Telescope } from '@node-telescope/core';
