import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function GateDetailPage() {
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
      .getEntry('gates', id)
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
          {/* Gate summary */}
          <div className="flex items-center gap-3 flex-wrap">
            {(() => {
              const result = String(content.result ?? '').toLowerCase();
              const allowed = result === 'allowed' || result === 'true' || result === 'granted';
              return (
                <Badge variant={allowed ? 'success' : 'error'}>
                  {allowed ? 'allowed' : 'denied'}
                </Badge>
              );
            })()}
            <span className="text-gray-100 font-mono text-sm">
              {String(content.ability ?? content.permission ?? '')}
            </span>
          </div>

          {/* User */}
          {content.user && (
            <Section title="User">
              {typeof content.user === 'object' ? (
                <JsonViewer data={content.user} />
              ) : (
                <p className="text-gray-200 text-sm">{String(content.user)}</p>
              )}
            </Section>
          )}

          {/* Arguments */}
          {content.arguments && (
            <Section title="Arguments">
              <JsonViewer data={content.arguments} />
            </Section>
          )}

          {/* Response */}
          {content.response && (
            <Section title="Response">
              <JsonViewer data={content.response} />
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
