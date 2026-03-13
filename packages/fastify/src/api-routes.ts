// Fastify route registration for the Telescope REST API
// Mirrors Laravel Telescope's API controllers — entries CRUD + status toggling

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
 * Authorization preHandler hook factory.
 * Checks the gate function from the telescope config.
 */
function createAuthGate(telescope: Telescope) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      if (telescope.config.gate) {
        const allowed = await telescope.config.gate(request);
        if (!allowed) {
          reply.code(403).send({ error: 'Unauthorized' });
          return;
        }
      }
    } catch (error) {
      console.warn('[Telescope] Gate check error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Registers the Telescope API routes on the Fastify instance.
 * All routes are mounted under {telescopePath}/api.
 */
export async function registerApiRoutes(
  fastify: FastifyInstance,
  telescope: Telescope,
  telescopePath: string,
): Promise<void> {
  const apiPrefix = `${telescopePath}/api`;
  const authGate = createAuthGate(telescope);

  // GET /status — get telescope recording status
  fastify.get(`${apiPrefix}/status`, {
    preHandler: authGate,
    handler: async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        reply.send({ recording: telescope.isRecording() });
      } catch (error) {
        console.warn('[Telescope] Status error:', error);
        reply.code(500).send({ error: 'Internal server error' });
      }
    },
  });

  // POST /status — toggle telescope recording
  fastify.post(`${apiPrefix}/status`, {
    preHandler: authGate,
    handler: async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const { recording } = (request.body ?? {}) as { recording?: boolean };

        if (typeof recording === 'boolean') {
          if (recording) {
            telescope.resume();
          } else {
            telescope.pause();
          }
        }

        reply.send({ recording: telescope.isRecording() });
      } catch (error) {
        console.warn('[Telescope] Status toggle error:', error);
        reply.code(500).send({ error: 'Internal server error' });
      }
    },
  });

  // DELETE /entries — clear all entries
  fastify.delete(`${apiPrefix}/entries`, {
    preHandler: authGate,
    handler: async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const storage = telescope.getStorage();
        if (!storage) {
          reply.code(503).send({ error: 'Storage not available' });
          return;
        }

        await storage.truncate();
        reply.send({ success: true });
      } catch (error) {
        console.warn('[Telescope] Truncate error:', error);
        reply.code(500).send({ error: 'Internal server error' });
      }
    },
  });

  // GET /entries/:id/batch — get all entries in the same batch
  fastify.get<{ Params: { id: string } }>(`${apiPrefix}/entries/:id/batch`, {
    preHandler: authGate,
    handler: async (request, reply): Promise<void> => {
      try {
        const storage = telescope.getStorage();
        if (!storage) {
          reply.code(503).send({ error: 'Storage not available' });
          return;
        }

        const entry = await storage.find(request.params.id);
        if (!entry) {
          reply.code(404).send({ error: 'Entry not found' });
          return;
        }

        const batchEntries = await storage.findByBatchId(entry.batchId);
        reply.send({ entries: batchEntries });
      } catch (error) {
        console.warn('[Telescope] Batch query error:', error);
        reply.code(500).send({ error: 'Internal server error' });
      }
    },
  });

  // POST /replay/:id — replay a captured request
  fastify.post<{ Params: { id: string } }>(`${apiPrefix}/replay/:id`, {
    preHandler: authGate,
    handler: async (request, reply): Promise<void> => {
      try {
        const storage = telescope.getStorage();
        if (!storage) {
          reply.code(503).send({ error: 'Storage not available' });
          return;
        }

        const entry = await storage.find(request.params.id);
        if (!entry) {
          reply.code(404).send({ error: 'Entry not found' });
          return;
        }

        if (entry.type !== EntryType.Request) {
          reply.code(400).send({ error: 'Only request entries can be replayed' });
          return;
        }

        const content = entry.content as Record<string, unknown>;
        const method = String(content['method'] ?? 'GET').toUpperCase();
        const path = String(content['path'] ?? content['url'] ?? '/');
        const headers = (content['headers'] ?? {}) as Record<string, string>;
        const payload = content['payload'];

        const host = request.hostname ?? 'localhost';
        const protocol = request.protocol;
        const targetUrl = `${protocol}://${host}${path}`;

        const fetchOptions: RequestInit = {
          method,
          headers: { ...headers },
        };

        if (payload && method !== 'GET' && method !== 'HEAD') {
          fetchOptions.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
          if (!headers['content-type']) {
            (fetchOptions.headers as Record<string, string>)['content-type'] = 'application/json';
          }
        }

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

        reply.send({
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
        reply.code(500).send({ error: message });
      }
    },
  });

  // GET /:type — list entries by type
  fastify.get<{ Params: { type: string }; Querystring: Record<string, string | undefined> }>(
    `${apiPrefix}/:type`,
    {
      preHandler: authGate,
      handler: async (request, reply): Promise<void> => {
        try {
          const storage = telescope.getStorage();
          if (!storage) {
            reply.code(503).send({ error: 'Storage not available' });
            return;
          }

          const typeParam = request.params.type;
          const entryType = ENTRY_TYPE_MAP[typeParam];
          if (!entryType) {
            reply.code(400).send({ error: `Unknown entry type: ${typeParam}` });
            return;
          }

          const filter: EntryFilter = {
            type: entryType,
          };

          // Pagination support
          const { before, take, tag, familyHash } = request.query;
          if (before) filter.beforeId = before;
          if (take) filter.take = Math.min(parseInt(take, 10) || 50, 100);
          else filter.take = 50;
          if (tag) filter.tag = tag;
          if (familyHash) filter.familyHash = familyHash;

          const result = await storage.query(filter);
          reply.send(result);
        } catch (error) {
          console.warn('[Telescope] Query error:', error);
          reply.code(500).send({ error: 'Internal server error' });
        }
      },
    },
  );

  // GET /:type/:id — get single entry detail
  fastify.get<{ Params: { type: string; id: string } }>(`${apiPrefix}/:type/:id`, {
    preHandler: authGate,
    handler: async (request, reply): Promise<void> => {
      try {
        const storage = telescope.getStorage();
        if (!storage) {
          reply.code(503).send({ error: 'Storage not available' });
          return;
        }

        const entry = await storage.find(request.params.id);
        if (!entry) {
          reply.code(404).send({ error: 'Entry not found' });
          return;
        }

        // Verify the entry type matches the URL segment
        const typeParam = request.params.type;
        const expectedType = ENTRY_TYPE_MAP[typeParam];
        if (expectedType && entry.type !== expectedType) {
          reply.code(404).send({ error: 'Entry not found' });
          return;
        }

        // Fetch related batch entries
        let batch: unknown[] = [];
        try {
          const batchEntries = await storage.findByBatchId(entry.batchId);
          batch = batchEntries.filter((e: { id: string }) => e.id !== entry.id);
        } catch {
          // Batch fetch is non-critical
        }

        reply.send({ entry, batch });
      } catch (error) {
        console.warn('[Telescope] Entry lookup error:', error);
        reply.code(500).send({ error: 'Internal server error' });
      }
    },
  });
}
