// TelescopeDashboardMiddleware — serves the @node-telescope/dashboard static files
// Same CSP headers and SPA catch-all behavior as the Express dashboard-router
// Falls back gracefully if the dashboard package is not installed

import { Injectable, type NestMiddleware, Inject } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Telescope } from '@node-telescope/core';
import { TELESCOPE_INSTANCE } from './telescope.constants.js';

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
].join('; ');

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Telescope Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #1a1a2e; color: #e0e0e0; }
    .container { text-align: center; max-width: 500px; padding: 2rem; }
    h1 { color: #7c3aed; margin-bottom: 1rem; }
    p { line-height: 1.6; color: #a0a0b0; }
    code { background: #2a2a3e; padding: 0.2em 0.5em; border-radius: 4px; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Telescope Dashboard</h1>
    <p>The dashboard package is not installed.</p>
    <p>Install it with:</p>
    <p><code>npm install @node-telescope/dashboard</code></p>
    <p>The Telescope API is still operational at the <code>/api</code> endpoints.</p>
  </div>
</body>
</html>`;

/**
 * Resolves the dashboard package's dist directory.
 * Returns the path to the dist folder, or null if not found.
 */
function resolveDashboardDist(): string | null {
  try {
    // Resolve the package.json to find the package root
    const require = createRequire(import.meta.url);
    const pkgJsonPath = require.resolve('@node-telescope/dashboard/package.json');
    const packageRoot = dirname(pkgJsonPath);

    // The dist directory with index.html should be at {root}/dist
    const distDir = join(packageRoot, 'dist');
    if (existsSync(join(distDir, 'index.html'))) {
      return distDir;
    }

    // Fallback: check package root directly
    if (existsSync(join(packageRoot, 'index.html'))) {
      return packageRoot;
    }

    return null;
  } catch {
    // Package not installed
    return null;
  }
}

@Injectable()
export class TelescopeDashboardMiddleware implements NestMiddleware {
  private readonly dashboardDist: string | null;
  private readonly telescopePath: string;

  constructor(
    @Inject(TELESCOPE_INSTANCE)
    private readonly telescope: Telescope,
  ) {
    this.dashboardDist = resolveDashboardDist();
    this.telescopePath = this.telescope.config.path;
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Only handle requests to the telescope dashboard path
      if (!req.path.startsWith(this.telescopePath)) {
        next();
        return;
      }

      // Skip API routes — those are handled by TelescopeController
      const relativePath = req.path.slice(this.telescopePath.length);
      if (relativePath.startsWith('/api')) {
        next();
        return;
      }

      // Set security headers
      res.setHeader('Content-Security-Policy', CSP_HEADER);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');

      if (!this.dashboardDist) {
        // Dashboard not installed — serve fallback HTML
        res.status(200).type('html').send(FALLBACK_HTML);
        return;
      }

      // Try to serve the static file
      const filePath = relativePath || '/index.html';

      // If the request looks like a file with an extension (not html), try to serve it
      if (filePath.includes('.') && !filePath.endsWith('.html')) {
        const fullPath = join(this.dashboardDist, filePath);
        if (existsSync(fullPath)) {
          res.sendFile(fullPath);
          return;
        }
        res.status(404).send('Not found');
        return;
      }

      // SPA catch-all — serve index.html
      const indexPath = join(this.dashboardDist, 'index.html');
      const html = await readFile(indexPath, 'utf-8');
      res.type('html').send(html);
    } catch (error) {
      console.warn('[Telescope] Dashboard serve error:', error);
      next();
    }
  }
}
