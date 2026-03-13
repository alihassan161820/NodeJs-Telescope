import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

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

export function CacheDetailPage() {
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
      .getEntry('cache', id)
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
          {/* Cache summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={commandVariants[String(content.type ?? content.command ?? '').toLowerCase()] ?? 'neutral'}>
              {String(content.type ?? content.command ?? 'get')}
            </Badge>
            <span className="text-gray-100 font-mono text-sm">
              {String(content.key ?? '')}
            </span>
            {content.expiration != null && (
              <span className="text-gray-400 text-sm">
                TTL: {String(content.expiration)}s
              </span>
            )}
          </div>

          {/* Value */}
          {content.value != null && (
            <Section title="Value">
              {typeof content.value === 'object' ? (
                <JsonViewer data={content.value} />
              ) : (
                <div className="bg-gray-950 rounded-lg border border-gray-800 p-4">
                  <p className="text-gray-100 text-sm font-mono whitespace-pre-wrap break-words">
                    {String(content.value)}
                  </p>
                </div>
              )}
            </Section>
          )}

          {/* Tags */}
          {content.tags && (
            <Section title="Cache Tags">
              <JsonViewer data={content.tags} />
            </Section>
          )}
        </div>
      )}
    </EntryDetail>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-400 mb-2">{title}</h4>
      {children}
    </div>
  );
}
