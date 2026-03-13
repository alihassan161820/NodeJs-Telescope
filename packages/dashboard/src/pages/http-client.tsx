import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { MethodBadge, StatusBadge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

export function HttpClientPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('http-client');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Method',
      className: 'w-24',
      render: (entry: TelescopeEntry) => (
        <MethodBadge method={String(entry.content.method ?? 'GET')} />
      ),
    },
    {
      header: 'URL',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-lg text-xs font-mono">
          {truncate(String(entry.content.uri ?? entry.content.url ?? ''), 80)}
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
      onRowClick={(entry) => navigate(`/http-client/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
