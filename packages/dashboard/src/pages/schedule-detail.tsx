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
  success: 'success',
  running: 'info',
  pending: 'warning',
  skipped: 'neutral',
  failed: 'error',
};

export function ScheduleDetailPage() {
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
      .getEntry('schedules', id)
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
          {/* Schedule summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={statusVariants[String(content.status ?? '').toLowerCase()] ?? 'neutral'}>
              {String(content.status ?? 'completed')}
            </Badge>
            <span className="text-gray-100 font-mono text-sm">
              {String(content.command ?? content.name ?? '')}
            </span>
          </div>

          {/* Schedule info */}
          <div className="grid grid-cols-3 gap-4">
            {content.expression && (
              <InfoCard label="Cron Expression" value={String(content.expression)} />
            )}
            {content.nextDue && (
              <InfoCard label="Next Due" value={String(content.nextDue)} />
            )}
            {content.timezone && (
              <InfoCard label="Timezone" value={String(content.timezone)} />
            )}
          </div>

          {/* Duration */}
          {content.duration != null && (
            <div className="grid grid-cols-3 gap-4">
              <InfoCard label="Duration" value={`${Number(content.duration).toFixed(0)}ms`} />
            </div>
          )}

          {/* Output */}
          {content.output && (
            <Section title="Output">
              <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 overflow-auto max-h-96">
                <pre className="font-mono text-xs text-gray-100 whitespace-pre-wrap break-words">
                  {String(content.output)}
                </pre>
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
      <p className="text-sm text-gray-200 font-mono">{value}</p>
    </div>
  );
}
