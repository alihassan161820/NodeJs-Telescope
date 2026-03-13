import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';

interface HeaderProps {
  onRefresh?: () => void;
}

const pageTitles: Record<string, string> = {
  '/requests': 'Requests',
  '/exceptions': 'Exceptions',
  '/queries': 'Queries',
  '/logs': 'Logs',
  '/models': 'Models',
  '/events': 'Events',
  '/jobs': 'Jobs',
  '/mail': 'Mail',
  '/notifications': 'Notifications',
  '/cache': 'Cache',
  '/redis': 'Redis',
  '/gates': 'Gates',
  '/http-client': 'HTTP Client',
  '/commands': 'Commands',
  '/schedules': 'Schedule',
  '/dumps': 'Dumps',
  '/batches': 'Batches',
  '/views': 'Views',
};

function getPageTitle(pathname: string): string {
  // Check exact matches first
  if (pageTitles[pathname]) return pageTitles[pathname];

  // Check detail pages — extract the segment before the ID
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const listPath = `/${segments[0]}`;
    const listTitle = pageTitles[listPath];
    if (listTitle) return `${listTitle} Details`;
  }

  return 'Dashboard';
}

export function Header({ onRefresh }: HeaderProps) {
  const location = useLocation();
  const [recording, setRecording] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [clearing, setClearing] = useState(false);

  const title = getPageTitle(location.pathname);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await api.getStatus();
      setRecording(status.recording);
    } catch {
      // Failed to fetch status — keep current state
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleToggleRecording = async () => {
    try {
      setToggling(true);
      const status = await api.setStatus(!recording);
      setRecording(status.recording);
    } catch {
      // Failed to toggle — keep current state
    } finally {
      setToggling(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all entries?')) return;
    try {
      setClearing(true);
      await api.clearEntries();
      onRefresh?.();
    } catch {
      // Failed to clear
    } finally {
      setClearing(false);
    }
  };

  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-gray-100">{title}</h2>

      <div className="flex items-center gap-3">
        {/* Recording toggle */}
        <button
          onClick={handleToggleRecording}
          disabled={toggling}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            recording
              ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          } disabled:opacity-50`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              recording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'
            }`}
          />
          {recording ? 'Recording' : 'Paused'}
        </button>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </button>

        {/* Clear all button */}
        <button
          onClick={handleClear}
          disabled={clearing}
          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors disabled:opacity-50"
          title="Clear all entries"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </header>
  );
}
