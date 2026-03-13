import { useState, useEffect, useCallback, useRef } from 'react';
import type { TelescopeEntry } from '../api/client';

interface UseWebSocketResult {
  connected: boolean;
  lastEntry: TelescopeEntry | null;
}

export function useWebSocket(): UseWebSocketResult {
  const [connected, setConnected] = useState(false);
  const [lastEntry, setLastEntry] = useState<TelescopeEntry | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/__telescope/ws`);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as { type: string; data: TelescopeEntry };
        if (message.type === 'entry') {
          setLastEntry(message.data);
        }
      } catch {
        // Invalid message — ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect with exponential backoff
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connected, lastEntry };
}
