import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

export function MailPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('mail');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Mailable',
      className: 'w-48',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block font-mono text-xs">
          {String(entry.content.mailable ?? entry.content.class ?? '--')}
        </span>
      ),
    },
    {
      header: 'Subject',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-md">
          {String(entry.content.subject ?? '')}
        </span>
      ),
    },
    {
      header: 'To',
      className: 'w-44',
      render: (entry: TelescopeEntry) => {
        const to = entry.content.to;
        const display = Array.isArray(to) ? (to as string[]).join(', ') : String(to ?? '--');
        return (
          <span className="text-gray-400 text-xs truncate block">
            {display}
          </span>
        );
      },
    },
    {
      header: 'Status',
      className: 'w-24',
      render: (entry: TelescopeEntry) => {
        const queued = Boolean(entry.content.queued);
        return (
          <Badge variant={queued ? 'warning' : 'success'}>
            {queued ? 'queued' : 'sent'}
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
      onRowClick={(entry) => navigate(`/mail/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
