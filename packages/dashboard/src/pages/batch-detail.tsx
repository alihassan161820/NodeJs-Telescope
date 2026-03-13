import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function BatchDetailPage() {
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
      .getEntry('batches', id)
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
          {/* Batch summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="info">batch</Badge>
            <span className="text-gray-100 font-mono text-sm">
              {String(content.name ?? content.id ?? entry.id)}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {content.totalJobs != null && (
              <InfoCard label="Total Jobs" value={String(content.totalJobs)} />
            )}
            {content.pendingJobs != null && (
              <InfoCard label="Pending" value={String(content.pendingJobs)} variant={Number(content.pendingJobs) > 0 ? 'warning' : 'default'} />
            )}
            {content.failedJobs != null && (
              <InfoCard label="Failed" value={String(content.failedJobs)} variant={Number(content.failedJobs) > 0 ? 'error' : 'default'} />
            )}
            {content.processedJobs != null && (
              <InfoCard label="Processed" value={String(content.processedJobs)} />
            )}
          </div>

          {/* Progress */}
          {content.progress != null && (
            <Section title="Progress">
              <div className="bg-gray-950 rounded-lg border border-gray-800 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Number(content.progress))}%` }}
                    />
                  </div>
                  <span className="text-gray-300 text-sm font-mono">
                    {Number(content.progress).toFixed(0)}%
                  </span>
                </div>
              </div>
            </Section>
          )}

          {/* Options / Data */}
          {content.options && (
            <Section title="Options">
              <JsonViewer data={content.options} />
            </Section>
          )}

          {content.data && (
            <Section title="Data">
              <JsonViewer data={content.data} />
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

function InfoCard({ label, value, variant = 'default' }: { label: string; value: string; variant?: 'default' | 'warning' | 'error' }) {
  const borderColor = variant === 'error' ? 'border-red-900/50' : variant === 'warning' ? 'border-yellow-900/50' : 'border-gray-800';
  return (
    <div className={`bg-gray-950 rounded-lg border ${borderColor} p-3`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg text-gray-200 font-mono">{value}</p>
    </div>
  );
}
