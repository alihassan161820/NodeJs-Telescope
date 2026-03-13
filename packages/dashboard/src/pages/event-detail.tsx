import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function EventDetailPage() {
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
      .getEntry('events', id)
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
          {/* Event summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="info">event</Badge>
            <span className="text-gray-100 font-mono text-sm">
              {String(content.name ?? content.event ?? '')}
            </span>
            {content.broadcast && (
              <Badge variant="neutral">broadcast</Badge>
            )}
          </div>

          {/* Listeners */}
          {content.listeners && Array.isArray(content.listeners) && (
            <Section title={`Listeners (${content.listeners.length})`}>
              <div className="space-y-1">
                {(content.listeners as string[]).map((listener, i) => (
                  <div key={i} className="text-gray-300 font-mono text-xs bg-gray-950 border border-gray-800 rounded px-3 py-2">
                    {String(listener)}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Payload */}
          {content.payload && (
            <Section title="Payload">
              <JsonViewer data={content.payload} />
            </Section>
          )}

          {/* Data */}
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
