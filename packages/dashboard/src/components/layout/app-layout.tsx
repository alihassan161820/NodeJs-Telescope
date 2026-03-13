import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useWebSocket } from '../../hooks/use-websocket';
import { createContext } from 'react';
import type { TelescopeEntry } from '../../api/client';

export interface WebSocketContextValue {
  connected: boolean;
  lastEntry: TelescopeEntry | null;
}

export const WebSocketContext = createContext<WebSocketContextValue>({
  connected: false,
  lastEntry: null,
});

export function AppLayout() {
  const { connected, lastEntry } = useWebSocket();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, lastEntry }}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar connected={connected} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onRefresh={handleRefresh} />
          <main className="flex-1 overflow-auto p-6" key={refreshKey}>
            <Outlet />
          </main>
        </div>
      </div>
    </WebSocketContext.Provider>
  );
}
