// Express Router for the Telescope REST API
// Mirrors Laravel Telescope's API controllers — entries CRUD + status toggling

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Telescope } from '@node-telescope/core';
import { EntryType } from '@node-telescope/core';
import type { EntryFilter } from '@node-telescope/core';

/** Map URL segment names to EntryType enum values */
const ENTRY_TYPE_MAP: Record<string, EntryType> = {
  requests: EntryType.Request,
  exceptions: EntryType.Exception,
  queries: EntryType.Query,
  logs: EntryType.Log,
  models: EntryType.Model,
  events: EntryType.Event,
  jobs: EntryType.Job,
  mail: EntryType.Mail,
  notifications: EntryType.Notification,
  cache: EntryType.Cache,
  redis: EntryType.Redis,
  gates: EntryType.Gate,
  'http-client': EntryType.HttpClient,
  commands: EntryType.Command,
  schedule: EntryType.Schedule,
  schedules: EntryType.Schedule,
  dumps: EntryType.Dump,
  batches: EntryType.Batch,
  views: EntryType.View,
};

/**
 * Creates the Telescope API router.
 * Provides REST endpoints for querying, viewing, and managing telescope entries.
 */
export function createApiRouter(telescope: Telescope): Router {
  const router = Router();

  // Authorization middleware — checks the gate function from config
  router.use(async (req: Request, res: Response, next) => {
    try {
      if (telescope.config.gate) {
        const allowed = await telescope.config.gate(req);
        if (!allowed) {
          res.status(403).json({ error: 'Unauthorized' });
          return;
        }
      }
      next();
    } catch (error) {
      console.warn('[Telescope] Gate check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /status — get telescope recording status
  router.get('/status', (_req: Request, res: Response) => {
    try {
      res.json({ recording: telescope.isRecording() });
    } catch (error) {
      console.warn('[Telescope] Status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /status — toggle telescope recording
  router.post('/status', (req: Request, res: Response) => {
    try {
      const { recording } = req.body as { recording?: boolean };

      if (typeof recording === 'boolean') {
        if (recording) {
          telescope.resume();
        } else {
          telescope.pause();
        }
      }

      res.json({ recording: telescope.isRecording() });
    } catch (error) {
      console.warn('[Telescope] Status toggle error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /entries — clear all entries
  router.delete('/entries', async (_req: Request, res: Response) => {
    try {
      const storage = telescope.getStorage();
      if (!storage) {
        res.status(503).json({ error: 'Storage not available' });
        return;
      }

      await storage.truncate();
      res.json({ success: true });
    } catch (error) {
      console.warn('[Telescope] Truncate error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /entries/:id/batch — get all entries in the same batch
  router.get('/entries/:id/batch', async (req: Request, res: Response) => {
    try {
      const storage = telescope.getStorage();
      if (!storage) {
        res.status(503).json({ error: 'Storage not available' });
        return;
      }

      const entry = await storage.find(req.params['id'] as string);
      if (!entry) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }

      const batchEntries = await storage.findByBatchId(entry.batchId);
      res.json({ entries: batchEntries });
    } catch (error) {
      console.warn('[Telescope] Batch query error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /replay/:id — replay a captured request
  router.post('/replay/:id', async (req: Request, res: Response) => {
    try {
      const storage = telescope.getStorage();
      if (!storage) {
        res.status(503).json({ error: 'Storage not available' });
        return;
      }

      const entry = await storage.find(req.params['id'] as string);
      if (!entry) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }

      if (entry.type !== EntryType.Request) {
        res.status(400).json({ error: 'Only request entries can be replayed' });
        return;
      }

      const content = entry.content as Record<string, unknown>;
      const method = String(content['method'] ?? 'GET').toUpperCase();
      const path = String(content['path'] ?? content['url'] ?? '/');
      const headers = (content['headers'] ?? {}) as Record<string, string>;
      const payload = content['payload'];

      // Build the target URL from the original request
      const host = req.get('host') ?? 'localhost';
      const protocol = req.protocol;
      const targetUrl = `${protocol}://${host}${path}`;

      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method,
        headers: {
          ...headers,
          // Remove host header (will be set by fetch) and telescope-internal headers
          host: undefined as unknown as string,
        },
      };

      // Add body for non-GET/HEAD methods
      if (payload && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
        if (!headers['content-type']) {
          (fetchOptions.headers as Record<string, string>)['content-type'] = 'application/json';
        }
      }

      // Remove problematic headers
      const skipHeaders = ['host', 'connection', 'content-length', 'transfer-encoding'];
      for (const h of skipHeaders) {
        delete (fetchOptions.headers as Record<string, string>)[h];
      }

      const response = await fetch(targetUrl, fetchOptions);
      let responseBody: unknown;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      res.json({
        success: true,
        replay: {
          method,
          url: targetUrl,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        },
      });
    } catch (error) {
      console.warn('[Telescope] Replay error:', error);
      const message = error instanceof Error ? error.message : 'Replay failed';
      res.status(500).json({ error: message });
    }
  });

  // GET /:type — list entries by type
  router.get('/:type', async (req: Request, res: Response) => {
    try {
      const storage = telescope.getStorage();
      if (!storage) {
        res.status(503).json({ error: 'Storage not available' });
        return;
      }

      const typeParam = req.params['type'] as string;
      const entryType = ENTRY_TYPE_MAP[typeParam];
      if (!entryType) {
        res.status(400).json({ error: `Unknown entry type: ${typeParam}` });
        return;
      }

      const filter: EntryFilter = {
        type: entryType,
      };

      // Pagination support
      const { before, take, tag, familyHash } = req.query as Record<string, string | undefined>;
      if (before) filter.beforeId = before;
      if (take) filter.take = Math.min(parseInt(take, 10) || 50, 100);
      else filter.take = 50;
      if (tag) filter.tag = tag;
      if (familyHash) filter.familyHash = familyHash;

      const result = await storage.query(filter);
      res.json(result);
    } catch (error) {
      console.warn('[Telescope] Query error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /:type/:id — get single entry detail
  router.get('/:type/:id', async (req: Request, res: Response) => {
    try {
      const storage = telescope.getStorage();
      if (!storage) {
        res.status(503).json({ error: 'Storage not available' });
        return;
      }

      const entry = await storage.find(req.params['id'] as string);
      if (!entry) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }

      // Verify the entry type matches the URL segment
      const typeParam = req.params['type'] as string;
      const expectedType = ENTRY_TYPE_MAP[typeParam];
      if (expectedType && entry.type !== expectedType) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }

      // Fetch related batch entries
      let batch: unknown[] = [];
      try {
        const batchEntries = await storage.findByBatchId(entry.batchId);
        // Exclude the current entry from the batch list
        batch = batchEntries.filter((e: { id: string }) => e.id !== entry.id);
      } catch {
        // Batch fetch is non-critical
      }

      res.json({ entry, batch });
    } catch (error) {
      console.warn('[Telescope] Entry lookup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
