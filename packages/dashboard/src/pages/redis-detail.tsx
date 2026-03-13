import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function RedisDetailPage() {
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
      .getEntry('redis', id)
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
          {/* Redis summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="error">redis</Badge>
            {content.connection && (
              <Badge variant="neutral">{String(content.connection)}</Badge>
            )}
            {content.duration != null && (
              <span className="text-gray-400 text-sm">
                {Number(content.duration).toFixed(2)}ms
              </span>
            )}
          </div>

          {/* Command */}
          <Section title="Command">
            <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 overflow-auto">
              <pre className="font-mono text-sm text-gray-100 whitespace-pre-wrap break-words">
                {String(content.command ?? '')}
              </pre>
            </div>
          </Section>

          {/* Parameters */}
          {content.parameters && (
            <Section title="Parameters">
              <JsonViewer data={content.parameters} />
            </Section>
          )}

          {/* Result */}
          {content.result != null && (
            <Section title="Result">
              {typeof content.result === 'object' ? (
                <JsonViewer data={content.result} />
              ) : (
                <div className="bg-gray-950 rounded-lg border border-gray-800 p-4">
                  <p className="text-gray-100 text-sm font-mono">{String(content.result)}</p>
                </div>
              )}
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
