import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

export function BatchesPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('batches');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Batch',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md font-mono text-xs">
          {String(entry.content.name ?? entry.content.id ?? entry.id)}
        </span>
      ),
    },
    {
      header: 'Total',
      className: 'w-20',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-300 text-xs">
          {entry.content.totalJobs != null ? String(entry.content.totalJobs) : '--'}
        </span>
      ),
    },
    {
      header: 'Pending',
      className: 'w-20',
      render: (entry: TelescopeEntry) => {
        const pending = entry.content.pendingJobs;
        if (pending == null) return <span className="text-gray-500">--</span>;
        const num = Number(pending);
        return (
          <Badge variant={num > 0 ? 'warning' : 'success'}>
            {String(num)}
          </Badge>
        );
      },
    },
    {
      header: 'Failed',
      className: 'w-20',
      render: (entry: TelescopeEntry) => {
        const failed = entry.content.failedJobs;
        if (failed == null) return <span className="text-gray-500">--</span>;
        const num = Number(failed);
        return (
          <Badge variant={num > 0 ? 'error' : 'success'}>
            {String(num)}
          </Badge>
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
      onRowClick={(entry) => navigate(`/batches/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
