import type { TelescopeEntry } from '../../api/client';
import { MethodBadge, StatusBadge, Badge } from '../shared/badge';
import { TimeAgo } from '../shared/time-ago';

interface EntryRowProps {
  entry: TelescopeEntry;
}

/** Generic entry row that renders type-specific summary info. */
export function EntryRow({ entry }: EntryRowProps) {
  const content = entry.content;

  switch (entry.type) {
    case 'requests':
      return (
        <div className="flex items-center gap-3">
          <MethodBadge method={String(content.method ?? 'GET')} />
          <span className="text-gray-100 truncate">{String(content.uri ?? content.path ?? '')}</span>
          {content.status != null && <StatusBadge status={Number(content.status)} />}
          {content.duration != null && (
            <span className="text-gray-500 text-xs">{Number(content.duration).toFixed(0)}ms</span>
          )}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'exceptions':
      return (
        <div className="flex items-center gap-3">
          <Badge variant="error">{String(content.class ?? 'Error')}</Badge>
          <span className="text-gray-100 truncate">{String(content.message ?? '')}</span>
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'queries':
      return (
        <div className="flex items-center gap-3">
          <span className="text-gray-100 truncate font-mono text-xs">
            {truncate(String(content.sql ?? ''), 80)}
          </span>
          {content.slow && <Badge variant="error">slow</Badge>}
          {content.duration != null && (
            <span className="text-gray-500 text-xs">{Number(content.duration).toFixed(1)}ms</span>
          )}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'logs':
      return (
        <div className="flex items-center gap-3">
          <LevelBadge level={String(content.level ?? 'info')} />
          <span className="text-gray-100 truncate">{truncate(String(content.message ?? ''), 100)}</span>
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'models':
      return (
        <div className="flex items-center gap-3">
          <ActionBadge action={String(content.action ?? 'updated')} />
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.model ?? content.class ?? '')}</span>
          {content.key != null && <span className="text-gray-500 text-xs">#{String(content.key)}</span>}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'events':
      return (
        <div className="flex items-center gap-3">
          <Badge variant="info">event</Badge>
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.name ?? content.event ?? '')}</span>
          {Array.isArray(content.listeners) && (
            <span className="text-gray-500 text-xs">{content.listeners.length} listeners</span>
          )}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'jobs':
      return (
        <div className="flex items-center gap-3">
          <JobStatusBadge status={String(content.status ?? 'pending')} />
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.name ?? content.job ?? content.class ?? '')}</span>
          {content.queue && <Badge variant="neutral">{String(content.queue)}</Badge>}
          {content.duration != null && (
            <span className="text-gray-500 text-xs">{Number(content.duration).toFixed(0)}ms</span>
          )}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'mail':
      return (
        <div className="flex items-center gap-3">
          <Badge variant={content.queued ? 'warning' : 'success'}>{content.queued ? 'queued' : 'sent'}</Badge>
          <span className="text-gray-100 truncate">{truncate(String(content.subject ?? ''), 60)}</span>
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'notifications':
      return (
        <div className="flex items-center gap-3">
          <Badge variant="info">{String(content.channel ?? 'mail')}</Badge>
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.notification ?? content.class ?? '')}</span>
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'cache':
      return (
        <div className="flex items-center gap-3">
          <CacheCommandBadge command={String(content.type ?? content.command ?? 'get')} />
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.key ?? '')}</span>
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'redis':
      return (
        <div className="flex items-center gap-3">
          <Badge variant="error">redis</Badge>
          <span className="text-gray-100 truncate font-mono text-xs">{truncate(String(content.command ?? ''), 80)}</span>
          {content.duration != null && (
            <span className="text-gray-500 text-xs">{Number(content.duration).toFixed(2)}ms</span>
          )}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'gates':
      return (
        <div className="flex items-center gap-3">
          <GateResultBadge result={String(content.result ?? '')} />
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.ability ?? content.permission ?? '')}</span>
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'http-client':
      return (
        <div className="flex items-center gap-3">
          <MethodBadge method={String(content.method ?? 'GET')} />
          <span className="text-gray-100 truncate font-mono text-xs">{truncate(String(content.uri ?? content.url ?? ''), 60)}</span>
          {content.status != null && <StatusBadge status={Number(content.status)} />}
          {content.duration != null && (
            <span className="text-gray-500 text-xs">{Number(content.duration).toFixed(0)}ms</span>
          )}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'commands':
      return (
        <div className="flex items-center gap-3">
          <ExitCodeBadge code={content.exitCode ?? content.exit_code} />
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.command ?? content.name ?? '')}</span>
          {content.duration != null && (
            <span className="text-gray-500 text-xs">{Number(content.duration).toFixed(0)}ms</span>
          )}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'schedules':
      return (
        <div className="flex items-center gap-3">
          <Badge variant="info">schedule</Badge>
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.command ?? content.name ?? '')}</span>
          {content.expression && <span className="text-gray-500 text-xs">{String(content.expression)}</span>}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'dumps':
      return (
        <div className="flex items-center gap-3">
          <Badge variant="warning">dump</Badge>
          {content.file && (
            <span className="text-gray-400 text-xs font-mono">
              {String(content.file).split('/').pop()}{content.line != null ? `:${content.line}` : ''}
            </span>
          )}
          <span className="text-gray-100 truncate text-xs">
            {truncate(typeof content.dump === 'object' ? JSON.stringify(content.dump) : String(content.dump ?? content.content ?? ''), 60)}
          </span>
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'batches':
      return (
        <div className="flex items-center gap-3">
          <Badge variant="info">batch</Badge>
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.name ?? content.id ?? entry.id)}</span>
          {content.totalJobs != null && <span className="text-gray-500 text-xs">{String(content.totalJobs)} jobs</span>}
          {content.failedJobs != null && Number(content.failedJobs) > 0 && (
            <Badge variant="error">{String(content.failedJobs)} failed</Badge>
          )}
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    case 'views':
      return (
        <div className="flex items-center gap-3">
          <Badge variant="neutral">view</Badge>
          <span className="text-gray-100 truncate font-mono text-xs">{String(content.name ?? content.view ?? content.path ?? '')}</span>
          <TagList tags={entry.tags} />
          <TimeAgo date={entry.createdAt} />
        </div>
      );

    default:
      return (
        <div className="flex items-center gap-3">
          <Badge variant="neutral">{entry.type}</Badge>
          <span className="text-gray-400 text-sm">{entry.id}</span>
          <TimeAgo date={entry.createdAt} />
        </div>
      );
  }
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant="neutral">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const variants: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
    error: 'error',
    warn: 'warning',
    warning: 'warning',
    info: 'info',
    debug: 'neutral',
    log: 'neutral',
  };
  return <Badge variant={variants[level.toLowerCase()] ?? 'neutral'}>{level}</Badge>;
}

function ActionBadge({ action }: { action: string }) {
  const variants: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
    created: 'success',
    updated: 'info',
    deleted: 'error',
    retrieved: 'neutral',
  };
  return <Badge variant={variants[action.toLowerCase()] ?? 'neutral'}>{action}</Badge>;
}

function JobStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
    completed: 'success',
    processed: 'success',
    pending: 'warning',
    queued: 'warning',
    failed: 'error',
    running: 'info',
  };
  return <Badge variant={variants[status.toLowerCase()] ?? 'neutral'}>{status}</Badge>;
}

function CacheCommandBadge({ command }: { command: string }) {
  const variants: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
    hit: 'success',
    set: 'info',
    write: 'info',
    put: 'info',
    miss: 'warning',
    forget: 'error',
    delete: 'error',
    flush: 'error',
  };
  return <Badge variant={variants[command.toLowerCase()] ?? 'neutral'}>{command}</Badge>;
}

function GateResultBadge({ result }: { result: string }) {
  const lower = result.toLowerCase();
  const allowed = lower === 'allowed' || lower === 'true' || lower === 'granted';
  return <Badge variant={allowed ? 'success' : 'error'}>{allowed ? 'allowed' : 'denied'}</Badge>;
}

function ExitCodeBadge({ code }: { code: unknown }) {
  if (code == null) return <Badge variant="neutral">cli</Badge>;
  const num = Number(code);
  return <Badge variant={num === 0 ? 'success' : 'error'}>exit: {num}</Badge>;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}
