import { useNavigate } from 'react-router-dom';
import type { TelescopeEntry } from '../../api/client';
import { JsonViewer } from '../shared/json-viewer';
import { Badge } from '../shared/badge';
import { TimeAgo } from '../shared/time-ago';
import { Loading } from '../shared/loading';

interface EntryDetailProps {
  entry: TelescopeEntry | null;
  batch: TelescopeEntry[];
  loading: boolean;
  error: string | null;
  children?: React.ReactNode;
}

export function EntryDetail({ entry, batch, loading, error, children }: EntryDetailProps) {
  const navigate = useNavigate();

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">Entry not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back
      </button>

      {/* Entry meta */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="info">{entry.type}</Badge>
          <span className="text-xs text-gray-500">ID: {entry.id}</span>
          <TimeAgo date={entry.createdAt} />
        </div>

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex gap-2 mb-4">
            {entry.tags.map((tag) => (
              <Badge key={tag} variant="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Custom content from the page */}
        {children}
      </div>

      {/* Content JSON */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">Content</h3>
        <JsonViewer data={entry.content} />
      </div>

      {/* Batch entries */}
      {batch && batch.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Related Entries ({batch.length})
          </h3>
          <div className="space-y-2">
            {batch.map((batchEntry) => (
              <div
                key={batchEntry.id}
                onClick={() => navigate(`/${getRouteForType(batchEntry.type)}/${batchEntry.id}`)}
                className="bg-gray-900 rounded-lg border border-gray-800 p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
              >
                <Badge variant="info">{batchEntry.type}</Badge>
                <span className="text-sm text-gray-300 truncate flex-1">
                  {getBatchEntrySummary(batchEntry)}
                </span>
                <TimeAgo date={batchEntry.createdAt} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Map entry.type (singular from API) to the dashboard route path (plural) */
const typeToRoute: Record<string, string> = {
  request: 'requests',
  exception: 'exceptions',
  query: 'queries',
  log: 'logs',
  model: 'models',
  event: 'events',
  job: 'jobs',
  mail: 'mail',
  notification: 'notifications',
  cache: 'cache',
  redis: 'redis',
  gate: 'gates',
  'http-client': 'http-client',
  command: 'commands',
  schedule: 'schedules',
  dump: 'dumps',
  batch: 'batches',
  view: 'views',
};

function getRouteForType(type: string): string {
  return typeToRoute[type] ?? type;
}

function getBatchEntrySummary(entry: TelescopeEntry): string {
  const c = entry.content;
  switch (entry.type) {
    case 'requests':
      return `${c.method ?? 'GET'} ${c.uri ?? c.path ?? ''} ${c.status ?? ''}`;
    case 'exceptions':
      return `${c.class ?? 'Error'}: ${c.message ?? ''}`;
    case 'queries':
      return String(c.sql ?? '').slice(0, 80);
    case 'logs':
      return `[${c.level ?? 'info'}] ${String(c.message ?? '').slice(0, 80)}`;
    case 'models':
      return `${c.action ?? 'updated'} ${c.model ?? c.class ?? ''}${c.key != null ? ` #${c.key}` : ''}`;
    case 'events':
      return String(c.name ?? c.event ?? '');
    case 'jobs':
      return `[${c.status ?? 'pending'}] ${c.name ?? c.job ?? c.class ?? ''}`;
    case 'mail':
      return `${c.subject ?? ''} -> ${Array.isArray(c.to) ? (c.to as string[]).join(', ') : (c.to ?? '')}`;
    case 'notifications':
      return `[${c.channel ?? 'mail'}] ${c.notification ?? c.class ?? ''}`;
    case 'cache':
      return `${c.type ?? c.command ?? 'get'} ${c.key ?? ''}`;
    case 'redis':
      return String(c.command ?? '').slice(0, 80);
    case 'gates':
      return `${c.result ?? 'denied'}: ${c.ability ?? c.permission ?? ''}`;
    case 'http-client':
      return `${c.method ?? 'GET'} ${c.uri ?? c.url ?? ''} ${c.status ?? ''}`;
    case 'commands':
      return `${c.command ?? c.name ?? ''}${c.exitCode != null || c.exit_code != null ? ` (exit: ${c.exitCode ?? c.exit_code})` : ''}`;
    case 'schedules':
      return `${c.command ?? c.name ?? ''} ${c.expression ?? ''}`;
    case 'dumps':
      return `${c.file ? String(c.file).split('/').pop() : ''}${c.line != null ? `:${c.line}` : ''}`;
    case 'batches':
      return `${c.name ?? entry.id}${c.totalJobs != null ? ` (${c.totalJobs} jobs)` : ''}`;
    case 'views':
      return String(c.name ?? c.view ?? c.path ?? '');
    default:
      return entry.id;
  }
}
