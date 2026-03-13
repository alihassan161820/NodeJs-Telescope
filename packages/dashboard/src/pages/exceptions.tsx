import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

export function ExceptionsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('exceptions');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Class',
      className: 'w-40',
      render: (entry: TelescopeEntry) => (
        <Badge variant="error">{String(entry.content.class ?? 'Error')}</Badge>
      ),
    },
    {
      header: 'Message',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-lg">
          {String(entry.content.message ?? '')}
        </span>
      ),
    },
    {
      header: 'Location',
      className: 'w-48',
      render: (entry: TelescopeEntry) => {
        const file = entry.content.file ? String(entry.content.file) : null;
        const line = entry.content.line;
        if (!file) return <span className="text-gray-500">--</span>;
        const shortFile = file.split('/').pop() ?? file;
        return (
          <span className="text-gray-400 text-xs font-mono truncate block">
            {shortFile}{line != null ? `:${line}` : ''}
          </span>
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
      onRowClick={(entry) => navigate(`/exceptions/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
