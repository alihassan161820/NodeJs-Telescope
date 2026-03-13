import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { JsonViewer } from '../components/shared/json-viewer';

export function DumpDetailPage() {
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
      .getEntry('dumps', id)
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
          {/* Location */}
          {content.file && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs font-mono">
                {String(content.file)}{content.line != null ? `:${content.line}` : ''}
              </span>
            </div>
          )}

          {/* Dump content */}
          <Section title="Dump">
            {(() => {
              const dump = content.dump ?? content.content;
              if (dump == null) {
                return <p className="text-gray-500 text-sm">No dump content</p>;
              }
              if (typeof dump === 'object') {
                return <JsonViewer data={dump} />;
              }
              return (
                <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 overflow-auto">
                  <pre className="font-mono text-sm text-gray-100 whitespace-pre-wrap break-words">
                    {String(dump)}
                  </pre>
                </div>
              );
            })()}
          </Section>
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
