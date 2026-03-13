import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const commandVariants: Record<string, BadgeVariant> = {
  hit: 'success',
  set: 'info',
  write: 'info',
  put: 'info',
  miss: 'warning',
  forget: 'error',
  delete: 'error',
  flush: 'error',
};

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

export function CachePage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('cache');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Command',
      className: 'w-24',
      render: (entry: TelescopeEntry) => {
        const command = String(entry.content.type ?? entry.content.command ?? 'get').toLowerCase();
        return <Badge variant={commandVariants[command] ?? 'neutral'}>{command}</Badge>;
      },
    },
    {
      header: 'Key',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md font-mono text-xs">
          {String(entry.content.key ?? '')}
        </span>
      ),
    },
    {
      header: 'Value',
      className: 'w-48',
      render: (entry: TelescopeEntry) => {
        const val = entry.content.value;
        if (val == null) return <span className="text-gray-500">--</span>;
        const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return (
          <span className="text-gray-400 text-xs truncate block">
            {truncate(display, 40)}
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
      onRowClick={(entry) => navigate(`/cache/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
