import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function CommandDetailPage() {
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
      .getEntry('commands', id)
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
          {/* Command summary */}
          <div className="flex items-center gap-3 flex-wrap">
            {(() => {
              const code = content.exitCode ?? content.exit_code;
              if (code != null) {
                const numCode = Number(code);
                return (
                  <Badge variant={numCode === 0 ? 'success' : 'error'}>
                    exit: {numCode}
                  </Badge>
                );
              }
              return null;
            })()}
            <span className="text-gray-100 font-mono text-sm">
              {String(content.command ?? content.name ?? '')}
            </span>
            {content.duration != null && (
              <span className="text-gray-400 text-sm">
                {Number(content.duration).toFixed(0)}ms
              </span>
            )}
          </div>

          {/* Arguments */}
          {content.arguments && (
            <Section title="Arguments">
              <JsonViewer data={content.arguments} />
            </Section>
          )}

          {/* Options */}
          {content.options && (
            <Section title="Options">
              <JsonViewer data={content.options} />
            </Section>
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
