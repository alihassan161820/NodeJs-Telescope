import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { MethodBadge, StatusBadge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function HttpClientDetailPage() {
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
      .getEntry('http-client', id)
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
          {/* Request summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <MethodBadge method={String(content.method ?? 'GET')} />
            <span className="text-gray-100 font-mono text-sm break-all">
              {String(content.uri ?? content.url ?? '')}
            </span>
            {content.status != null && <StatusBadge status={Number(content.status)} />}
            {content.duration != null && (
              <span className="text-gray-400 text-sm">
                {Number(content.duration).toFixed(0)}ms
              </span>
            )}
          </div>

          {/* Request Headers */}
          {content.headers && (
            <Section title="Request Headers">
              <JsonViewer data={content.headers} initialExpanded={false} />
            </Section>
          )}

          {/* Request Payload */}
          {content.payload && (
            <Section title="Payload">
              <JsonViewer data={content.payload} />
            </Section>
          )}

          {/* Response Headers */}
          {content.responseHeaders && (
            <Section title="Response Headers">
              <JsonViewer data={content.responseHeaders} initialExpanded={false} />
            </Section>
          )}

          {/* Response Body */}
          {content.response && (
            <Section title="Response Body">
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
