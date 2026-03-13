import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

export function DumpsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('dumps');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Location',
      className: 'w-56',
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
      header: 'Content',
      render: (entry: TelescopeEntry) => {
        const dump = entry.content.dump ?? entry.content.content;
        if (dump == null) return <span className="text-gray-500">--</span>;
        const display = typeof dump === 'object' ? JSON.stringify(dump) : String(dump);
        return (
          <span className="text-gray-100 truncate block max-w-lg text-xs font-mono">
            {truncate(display, 100)}
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
      onRowClick={(entry) => navigate(`/dumps/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
