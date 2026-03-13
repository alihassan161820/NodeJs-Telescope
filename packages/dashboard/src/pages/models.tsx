import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const actionVariants: Record<string, BadgeVariant> = {
  created: 'success',
  updated: 'info',
  deleted: 'error',
  retrieved: 'neutral',
};

export function ModelsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('models');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Action',
      className: 'w-28',
      render: (entry: TelescopeEntry) => {
        const action = String(entry.content.action ?? 'updated').toLowerCase();
        return <Badge variant={actionVariants[action] ?? 'neutral'}>{action}</Badge>;
      },
    },
    {
      header: 'Model',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md font-mono text-xs">
          {String(entry.content.model ?? entry.content.class ?? '')}
        </span>
      ),
    },
    {
      header: 'Key',
      className: 'w-28',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-400 text-xs">
          {entry.content.key != null ? String(entry.content.key) : '--'}
        </span>
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
      onRowClick={(entry) => navigate(`/models/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
