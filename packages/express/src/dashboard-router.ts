// Express Router for serving the Telescope dashboard SPA
// Serves pre-built React static files from @node-telescope/dashboard
// Falls back gracefully if the dashboard package is not installed

import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

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

/**
 * Creates the dashboard router.
 * Serves the pre-built React SPA from @node-telescope/dashboard.
 * Falls back to a "not installed" page if the package is missing.
 */
export function createDashboardRouter(): Router {
  const router = Router();
  const dashboardDist = resolveDashboardDist();

  // Add CSP headers to all dashboard responses
  router.use((_req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Content-Security-Policy', CSP_HEADER);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      next();
    } catch (error) {
      console.warn('[Telescope] CSP header error:', error);
      next();
    }
  });

  if (!dashboardDist) {
    // Dashboard not installed — serve fallback HTML for all routes
    router.get('*', (_req: Request, res: Response) => {
      try {
        res.status(200).type('html').send(FALLBACK_HTML);
      } catch (error) {
        console.warn('[Telescope] Fallback page error:', error);
        res.status(500).send('Internal server error');
      }
    });
    return router;
  }

  // Serve static files from the dashboard dist directory
  try {
    router.use(express.static(dashboardDist, { index: false }));
  } catch {
    // Fallback: if express.static fails for some reason
    console.warn('[Telescope] Could not set up express.static for dashboard assets');
  }

  // SPA catch-all — serve index.html for all non-file routes
  router.get('*', async (req: Request, res: Response) => {
    try {
      // If the request looks like a file with an extension, let it 404 naturally
      if (req.path.includes('.') && !req.path.endsWith('.html')) {
        res.status(404).send('Not found');
        return;
      }

      const indexPath = join(dashboardDist, 'index.html');
      const html = await readFile(indexPath, 'utf-8');
      res.type('html').send(html);
    } catch (error) {
      console.warn('[Telescope] Dashboard serve error:', error);
      res.status(500).send('Error loading dashboard');
    }
  });

  return router;
}
