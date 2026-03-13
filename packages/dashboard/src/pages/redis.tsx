import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

export function RedisPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('redis');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Command',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 font-mono text-xs truncate block max-w-lg">
          {truncate(String(entry.content.command ?? ''), 80)}
        </span>
      ),
    },
    {
      header: 'Connection',
      className: 'w-32',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-400 text-xs">
          {entry.content.connection ? String(entry.content.connection) : '--'}
        </span>
      ),
    },
    {
      header: 'Duration',
      className: 'w-24',
      render: (entry: TelescopeEntry) =>
        entry.content.duration != null ? (
          <span className="text-gray-400 text-xs">
            {Number(entry.content.duration).toFixed(2)}ms
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
      onRowClick={(entry) => navigate(`/redis/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
