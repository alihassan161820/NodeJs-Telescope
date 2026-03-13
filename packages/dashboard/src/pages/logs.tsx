import { useNavigate } from 'react-router-dom';
import { useEntries } from '../hooks/use-entries';
import { EntryList } from '../components/entries/entry-list';
import { Badge } from '../components/shared/badge';
import { TimeAgo } from '../components/shared/time-ago';
import type { TelescopeEntry } from '../api/client';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const levelVariants: Record<string, BadgeVariant> = {
  error: 'error',
  warn: 'warning',
  warning: 'warning',
  info: 'info',
  debug: 'neutral',
  log: 'neutral',
};

function getLevelVariant(level: string): BadgeVariant {
  return levelVariants[level.toLowerCase()] ?? 'neutral';
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

export function LogsPage() {
  const { entries, loading, error, loadMore, hasMore } = useEntries('logs');
  const navigate = useNavigate();

  const columns = [
    {
      header: 'Level',
      className: 'w-24',
      render: (entry: TelescopeEntry) => {
        const level = String(entry.content.level ?? 'info');
        return <Badge variant={getLevelVariant(level)}>{level}</Badge>;
      },
    },
    {
      header: 'Message',
      render: (entry: TelescopeEntry) => (
        <span className="text-gray-100 truncate block max-w-xl">
          {truncate(String(entry.content.message ?? ''), 120)}
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
      onRowClick={(entry) => navigate(`/logs/${entry.id}`)}
      keyExtractor={(entry) => entry.id}
    />
  );
}
