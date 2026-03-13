import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const statusVariants: Record<string, BadgeVariant> = {
  completed: 'success',
  processed: 'success',
  pending: 'warning',
  queued: 'warning',
  failed: 'error',
  running: 'info',
};

export function JobDetailPage() {
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
      .getEntry('jobs', id)
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
          {/* Job summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={statusVariants[String(content.status ?? '').toLowerCase()] ?? 'neutral'}>
              {String(content.status ?? 'pending')}
            </Badge>
            <span className="text-gray-100 font-mono text-sm">
              {String(content.name ?? content.job ?? content.class ?? '')}
            </span>
            {content.queue && (
              <Badge variant="neutral">queue: {String(content.queue)}</Badge>
            )}
            {content.duration != null && (
              <span className="text-gray-400 text-sm">
                {Number(content.duration).toFixed(0)}ms
              </span>
            )}
          </div>

          {/* Connection / Tries */}
          {(content.connection || content.tries || content.timeout) && (
            <Section title="Configuration">
              <div className="grid grid-cols-3 gap-4">
                {content.connection && (
                  <InfoCard label="Connection" value={String(content.connection)} />
                )}
                {content.tries != null && (
                  <InfoCard label="Tries" value={String(content.tries)} />
                )}
                {content.timeout != null && (
                  <InfoCard label="Timeout" value={`${content.timeout}s`} />
                )}
              </div>
            </Section>
          )}

          {/* Exception */}
          {content.exception && (
            <Section title="Exception">
              <div className="bg-gray-950 rounded-lg border border-red-900/50 p-4">
                <p className="text-red-400 text-sm font-mono">{String(content.exception)}</p>
              </div>
            </Section>
          )}

          {/* Payload / Data */}
          {content.data && (
            <Section title="Data">
              <JsonViewer data={content.data} />
            </Section>
          )}

          {content.payload && (
            <Section title="Payload">
              <JsonViewer data={content.payload} />
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-950 rounded-lg border border-gray-800 p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-200">{value}</p>
    </div>
  );
}
