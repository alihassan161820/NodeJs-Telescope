import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const statusVariants: Record<string, BadgeVariant> = {
  completed: 'success',
  success: 'success',
  running: 'info',
  pending: 'warning',
  skipped: 'neutral',
  failed: 'error',
};

export function SchedulesPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('schedules');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Command',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md font-mono text-xs">
          {String(entry.content.command ?? entry.content.name ?? '')}
        </span>
      ),
    },
    {
      header: 'Expression',
      className: 'w-36',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-400 font-mono text-xs">
          {entry.content.expression ? String(entry.content.expression) : '--'}
        </span>
      ),
    },
    {
      header: 'Status',
      className: 'w-28',
      render: (entry: TelescopeEntry) => {
        const status = String(entry.content.status ?? 'completed').toLowerCase();
        return <Badge variant={statusVariants[status] ?? 'neutral'}>{status}</Badge>;
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
      onRowClick={(entry) => navigate(`/schedules/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
