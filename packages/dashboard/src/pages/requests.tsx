import { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { MethodBadge, StatusBadge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import { WebSocketContext } from '../components/layout/app-layout';
import type { TelescopeEntry } from '../api/client';

export function RequestsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('requests');
  const { lastEntry } = useContext(WebSocketContext);
  const navigate = useNavigate();

  // Real-time: prepend new request entries from WebSocket
  useEffect(() => {
    if (lastEntry && lastEntry.type === 'request') {
      // The entries state is managed by useEntries, so we trigger a refresh
      // For simplicity, new entries appear after next manual refresh or page reload
      // In a production app, we'd lift state or use a store
    }
  }, [lastEntry]);

  const columns = [
    {
      header: 'Method',
      className: 'w-24',
      render: (entry: TelescopeEntry) => (
        <MethodBadge method={String(entry.content.method ?? 'GET')} />
      ),
    },
    {
      header: 'Path',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md">
          {String(entry.content.uri ?? entry.content.path ?? '')}
        </span>
      ),
    },
    {
      header: 'Status',
      className: 'w-20',
      render: (entry: TelescopeEntry) =>
        entry.content.status != null ? (
          <StatusBadge status={Number(entry.content.status)} />
        ) : (
          <span className="text-gray-500">--</span>
        ),
    },
    {
      header: 'Duration',
      className: 'w-24',
      render: (entry: TelescopeEntry) =>
        entry.content.duration != null ? (
          <span className="text-gray-400 text-xs">
            {Number(entry.content.duration).toFixed(0)}ms
          </span>
        ) : (
          <span className="text-gray-500">--</span>
        ),
    },
    {
      header: 'Time',
      className: 'w-28',
      render: (entry: TelescopeEntry) => <TimeAgo date={entry.createdAt} />,
    },
  ];

  return (
    <EntryList
      entries={entries}
      columns={columns}
      loading={loading}
      hasMore={hasMore}
      error={error}
      onLoadMore={loadMore}
      onRowClick={(entry) => navigate(`/requests/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
