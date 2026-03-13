import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const statusVariants: Record<string, BadgeVariant> = {
  completed: 'success',
  processed: 'success',
  pending: 'warning',
  queued: 'warning',
  failed: 'error',
  running: 'info',
};

export function JobsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('jobs');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Job',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md font-mono text-xs">
          {String(entry.content.name ?? entry.content.job ?? entry.content.class ?? '')}
        </span>
      ),
    },
    {
      header: 'Queue',
      className: 'w-32',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-400 text-xs">
          {entry.content.queue ? String(entry.content.queue) : '--'}
        </span>
      ),
    },
    {
      header: 'Status',
      className: 'w-28',
      render: (entry: TelescopeEntry) => {
        const status = String(entry.content.status ?? 'pending').toLowerCase();
        return <Badge variant={statusVariants[status] ?? 'neutral'}>{status}</Badge>;
      },
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
      onRowClick={(entry) => navigate(`/jobs/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
