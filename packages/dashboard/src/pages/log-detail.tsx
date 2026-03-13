import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const levelVariants: Record<string, BadgeVariant> = {
  error: 'error',
  warn: 'warning',
  warning: 'warning',
  info: 'info',
  debug: 'neutral',
  log: 'neutral',
};

export function LogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<TelescopeEntry | null>(null);
  const [batch, setBatch] = useState<TelescopeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getEntry('logs', id)
      .then((data) => {
        if (cancelled) return;
        setEntry(data.entry);
        setBatch(data.batch ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch entry');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const content = entry?.content ?? {};

  return (
    <EntryDetail entry={entry} batch={batch} loading={loading} error={error}>
      {entry && (
        <div className="space-y-6">
          {/* Log summary */}
          <div className="flex items-center gap-3">
            <Badge variant={levelVariants[String(content.level ?? 'info').toLowerCase()] ?? 'neutral'}>
              {String(content.level ?? 'info')}
            </Badge>
          </div>

          {/* Message */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Message</h4>
            <div className="bg-gray-950 rounded-lg border border-gray-800 p-4">
              <p className="text-gray-100 text-sm whitespace-pre-wrap break-words">
                {String(content.message ?? '')}
              </p>
            </div>
          </div>

          {/* Context */}
          {content.context && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Context</h4>
              <JsonViewer data={content.context} />
            </div>
          )}
        </div>
      )}
    </EntryDetail>
  );
}
