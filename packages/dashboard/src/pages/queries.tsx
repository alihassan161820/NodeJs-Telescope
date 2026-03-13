import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

function truncateSQL(sql: string, maxLen = 60): string {
  if (sql.length <= maxLen) return sql;
  return sql.slice(0, maxLen) + '...';
}

export function QueriesPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('queries');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Query',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 font-mono text-xs truncate block max-w-md">
          {truncateSQL(String(entry.content.sql ?? ''), 80)}
        </span>
      ),
    },
    {
      header: 'Connection',
      className: 'w-32',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-400 text-xs">
          {String(entry.content.connection ?? '--')}
        </span>
      ),
    },
    {
      header: 'Duration',
      className: 'w-28',
      render: (entry: TelescopeEntry) => {
        const duration = entry.content.duration != null ? Number(entry.content.duration) : null;
        const isSlow = Boolean(entry.content.slow);
        return (
          <div className="flex items-center gap-2">
            {duration != null ? (
              <span className={`text-xs ${isSlow ? 'text-red-400' : 'text-gray-400'}`}>
                {duration.toFixed(1)}ms
              </span>
            ) : (
              <span className="text-gray-500">--</span>
            )}
            {isSlow && <Badge variant="error">slow</Badge>}
          </div>
        );
      },
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
      onRowClick={(entry) => navigate(`/queries/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
