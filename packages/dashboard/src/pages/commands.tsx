import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

export function CommandsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('commands');
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
      header: 'Exit Code',
      className: 'w-28',
      render: (entry: TelescopeEntry) => {
        const code = entry.content.exitCode ?? entry.content.exit_code;
        if (code == null) return <span className="text-gray-500">--</span>;
        const numCode = Number(code);
        return (
          <Badge variant={numCode === 0 ? 'success' : 'error'}>
            {String(numCode)}
          </Badge>
        );
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
      onRowClick={(entry) => navigate(`/commands/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
