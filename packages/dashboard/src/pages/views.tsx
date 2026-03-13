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

export function ViewsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('views');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'View',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md font-mono text-xs">
          {String(entry.content.name ?? entry.content.view ?? entry.content.path ?? '')}
        </span>
      ),
    },
    {
      header: 'Data Keys',
      className: 'w-48',
      render: (entry: TelescopeEntry) => {
        const data = entry.content.data;
        if (!data || typeof data !== 'object') return <span className="text-gray-500">--</span>;
        const keys = Object.keys(data as Record<string, unknown>);
        if (keys.length === 0) return <span className="text-gray-500">--</span>;
        return (
          <span className="text-gray-400 text-xs truncate block">
            {truncate(keys.join(', '), 40)}
          </span>
        );
      },
    },
    {
      header: 'Composer',
      className: 'w-36',
      render: (entry: TelescopeEntry) => {
        const composer = entry.content.composer;
        if (!composer) return <span className="text-gray-500">--</span>;
        return (
          <Badge variant="neutral">
            {truncate(String(composer), 20)}
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
      onRowClick={(entry) => navigate(`/views/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
