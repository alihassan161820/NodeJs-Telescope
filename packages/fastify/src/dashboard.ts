// Fastify route registration for serving the Telescope dashboard SPA
// Serves pre-built React static files from @node-telescope/dashboard
// Falls back gracefully if the dashboard package is not installed

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createRequire } from 'node:module';
import { join, dirname, extname } from 'node:path';
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

/** MIME types for static dashboard assets */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

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
 * Registers the dashboard routes on the Fastify instance.
 * Serves the pre-built React SPA from @node-telescope/dashboard.
 * Falls back to a "not installed" page if the package is missing.
 */
export async function registerDashboardRoutes(
  fastify: FastifyInstance,
  telescopePath: string,
): Promise<void> {
  const dashboardDist = resolveDashboardDist();

  const setSecurityHeaders = (reply: FastifyReply): void => {
    reply
      .header('Content-Security-Policy', CSP_HEADER)
      .header('X-Content-Type-Options', 'nosniff')
      .header('X-Frame-Options', 'DENY');
  };

  if (!dashboardDist) {
    // Dashboard not installed — serve fallback HTML for all dashboard routes
    const serveFallback = async (_request: FastifyRequest, reply: FastifyReply) => {
      setSecurityHeaders(reply);
      reply.type('text/html').send(FALLBACK_HTML);
    };

    fastify.get(telescopePath, serveFallback);
    fastify.get(`${telescopePath}/*`, serveFallback);
    return;
  }

  // Dashboard installed — serve static files and SPA catch-all from a single wildcard route
  const serveHandler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      setSecurityHeaders(reply);

      const urlPath = request.url.split('?')[0] ?? request.url;
      const relPath = urlPath.slice(telescopePath.length) || '/';

      // Try to serve a static file if the path has an extension
      const ext = extname(relPath);
      if (ext && ext !== '.html') {
        const filePath = join(dashboardDist, relPath);
        if (existsSync(filePath)) {
          const content = await readFile(filePath);
          const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
          reply.type(mime).send(content);
          return;
        }
        reply.code(404).send('Not found');
        return;
      }

      // SPA catch-all — serve index.html
      const indexPath = join(dashboardDist, 'index.html');
      const html = await readFile(indexPath, 'utf-8');
      reply.type('text/html').send(html);
    } catch (error) {
      console.warn('[Telescope] Dashboard serve error:', error);
      reply.code(500).send('Error loading dashboard');
    }
  };

  fastify.get(telescopePath, serveHandler);
  fastify.get(`${telescopePath}/*`, serveHandler);
}
