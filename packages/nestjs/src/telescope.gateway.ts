// TelescopeGateway — WebSocket server for real-time entry broadcasting
// Uses the ws library directly (NOT @nestjs/websockets) to keep dependencies minimal
// Listens for telescope 'entry' events and broadcasts to connected clients

import { Injectable, Inject, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { Telescope, TelescopeEntryData } from '@node-telescope/core';
import { TELESCOPE_INSTANCE } from './telescope.constants.js';

@Injectable()
export class TelescopeGateway implements OnModuleInit, OnModuleDestroy {
  private wss: WebSocketServer | null = null;
  private entryHandler: ((entry: TelescopeEntryData) => void) | null = null;

  constructor(
    @Inject(TELESCOPE_INSTANCE)
    private readonly telescope: Telescope,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit(): void {
    try {
      this.setupWebSocketServer();
    } catch (error) {
      console.warn('[Telescope] WebSocket setup error:', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.entryHandler) {
        this.telescope.off('entry', this.entryHandler);
        this.entryHandler = null;
      }

      if (this.wss) {
        // Close all client connections
        for (const client of this.wss.clients) {
          try {
            client.close();
          } catch {
            // Client already closed
          }
        }

        await new Promise<void>((resolve) => {
          this.wss!.close(() => resolve());
        });
        this.wss = null;
      }
    } catch (error) {
      console.warn('[Telescope] WebSocket cleanup error:', error);
    }
  }

  private setupWebSocketServer(): void {
    const httpAdapter = this.httpAdapterHost?.httpAdapter;
    if (!httpAdapter) {
      console.warn('[Telescope] No HTTP adapter found — WebSocket server not started');
      return;
    }

    const server = httpAdapter.getHttpServer() as HttpServer;
    if (!server) {
      console.warn('[Telescope] No HTTP server found — WebSocket server not started');
      return;
    }

    const telescopePath = this.telescope.config.path;
    const wsPath = `${telescopePath}/ws`;

    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP upgrade requests for the telescope WebSocket path
    server.on('upgrade', (request, socket, head) => {
      try {
        const url = new URL(
          request.url || '',
          `http://${request.headers['host'] || 'localhost'}`,
        );

        if (url.pathname === wsPath) {
          this.wss!.handleUpgrade(request, socket, head, (ws) => {
            this.wss!.emit('connection', ws, request);
          });
        }
        // If the path doesn't match, let other handlers deal with it
      } catch (error) {
        console.warn('[Telescope] WebSocket upgrade error:', error);
        try {
          socket.destroy();
        } catch {
          // Socket already destroyed
        }
      }
    });

    // Handle new WebSocket connections
    this.wss.on('connection', (ws: WebSocket) => {
      try {
        ws.send(
          JSON.stringify({ type: 'connected', message: 'Telescope WebSocket connected' }),
        );
      } catch (error) {
        console.warn('[Telescope] WebSocket welcome error:', error);
      }

      ws.on('error', (error) => {
        console.warn('[Telescope] WebSocket client error:', error);
      });
    });

    // Listen for new telescope entries and broadcast to all connected clients
    this.entryHandler = (entry: TelescopeEntryData): void => {
      try {
        if (!this.wss || this.wss.clients.size === 0) return;

        const message = JSON.stringify({ type: 'entry', data: entry });

        for (const client of this.wss.clients) {
          if (client.readyState === 1 /* WebSocket.OPEN */) {
            try {
              client.send(message);
            } catch {
              // Individual client send failure
            }
          }
        }
      } catch (error) {
        console.warn('[Telescope] WebSocket broadcast error:', error);
      }
    };

    this.telescope.on('entry', this.entryHandler);
  }
}
