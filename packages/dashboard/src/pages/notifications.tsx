import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

export function NotificationsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('notifications');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Channel',
      className: 'w-28',
      render: (entry: TelescopeEntry) => (
        <Badge variant="info">
          {String(entry.content.channel ?? 'mail')}
        </Badge>
      ),
    },
    {
      header: 'Notification',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md font-mono text-xs">
          {String(entry.content.notification ?? entry.content.class ?? '')}
        </span>
      ),
    },
    {
      header: 'Notifiable',
      className: 'w-44',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-400 text-xs truncate block">
          {String(entry.content.notifiable ?? '--')}
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
      onRowClick={(entry) => navigate(`/notifications/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
