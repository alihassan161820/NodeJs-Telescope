import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

export function GatesPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('gates');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Ability',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md font-mono text-xs">
          {String(entry.content.ability ?? entry.content.permission ?? '')}
        </span>
      ),
    },
    {
      header: 'Result',
      className: 'w-28',
      render: (entry: TelescopeEntry) => {
        const result = String(entry.content.result ?? '').toLowerCase();
        const allowed = result === 'allowed' || result === 'true' || result === 'granted';
        return (
          <Badge variant={allowed ? 'success' : 'error'}>
            {allowed ? 'allowed' : 'denied'}
          </Badge>
        );
      },
    },
    {
      header: 'User',
      className: 'w-40',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-400 text-xs truncate block">
          {entry.content.user ? String(entry.content.user) : '--'}
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
      onRowClick={(entry) => navigate(`/gates/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
