import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

export function EventsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('events');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Event',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md font-mono text-xs">
          {String(entry.content.name ?? entry.content.event ?? '')}
        </span>
      ),
    },
    {
      header: 'Listeners',
      className: 'w-28',
      render: (entry: TelescopeEntry) => {
        const listeners = entry.content.listeners;
        const count = Array.isArray(listeners) ? listeners.length : (listeners != null ? Number(listeners) : 0);
        return (
          <Badge variant={count > 0 ? 'info' : 'neutral'}>
            {count} {count === 1 ? 'listener' : 'listeners'}
          </Badge>
        );
      },
    },
    {
      header: 'Broadcaster',
      className: 'w-32',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-400 text-xs">
          {entry.content.broadcast ? String(entry.content.broadcaster ?? 'yes') : '--'}
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
      onRowClick={(entry) => navigate(`/events/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
