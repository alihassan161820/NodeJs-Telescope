// WebSocket server for real-time entry broadcasting
// Connects to Telescope's EventEmitter to push new entries to dashboard clients

import { WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { Telescope } from '@node-telescope/core';
import type { TelescopeEntryData } from '@node-telescope/core';
import type WebSocket from 'ws';

/**
 * Creates a WebSocket server that broadcasts new Telescope entries to connected clients.
 * Attaches to the HTTP server's upgrade event to handle WebSocket connections at the given path.
 */
export function createWebSocketServer(
  telescope: Telescope,
  server: HttpServer,
  path: string,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade requests for the telescope WebSocket path
  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers['host'] || 'localhost'}`);
      const wsPath = path.endsWith('/ws') ? path : `${path}/ws`;

      if (url.pathname === wsPath) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
      // If the path doesn't match, let other handlers deal with it — don't destroy the socket
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
  wss.on('connection', (ws: WebSocket) => {
    try {
      // Send a welcome message
      ws.send(JSON.stringify({ type: 'connected', message: 'Telescope WebSocket connected' }));
    } catch (error) {
      console.warn('[Telescope] WebSocket welcome error:', error);
    }

    ws.on('error', (error) => {
      console.warn('[Telescope] WebSocket client error:', error);
    });
  });

  // Listen for new telescope entries and broadcast to all connected clients
  const entryHandler = (entry: TelescopeEntryData): void => {
    try {
      if (wss.clients.size === 0) return;

      const message = JSON.stringify({ type: 'entry', data: entry });

      for (const client of wss.clients) {
        if (client.readyState === 1 /* WebSocket.OPEN */) {
          try {
            client.send(message);
          } catch {
            // Individual client send failure — skip silently
          }
        }
      }
    } catch (error) {
      console.warn('[Telescope] WebSocket broadcast error:', error);
    }
  };

  telescope.on('entry', entryHandler);

  // Clean up when the WebSocket server closes
  wss.on('close', () => {
    try {
      telescope.off('entry', entryHandler);
    } catch {
      // Already cleaned up
    }
  });

  return wss;
}
