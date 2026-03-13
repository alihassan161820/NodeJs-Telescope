import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function QueryDetailPage() {
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
      .getEntry('queries', id)
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
          {/* Query summary */}
          <div className="flex items-center gap-3 flex-wrap">
            {content.connection && (
              <Badge variant="info">{String(content.connection)}</Badge>
            )}
            {content.duration != null && (
              <span className={`text-sm ${content.slow ? 'text-red-400' : 'text-gray-400'}`}>
                {Number(content.duration).toFixed(1)}ms
              </span>
            )}
            {content.slow && <Badge variant="error">slow</Badge>}
          </div>

          {/* SQL */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">SQL Query</h4>
            <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 overflow-auto">
              <pre className="font-mono text-sm text-gray-100 whitespace-pre-wrap break-words">
                {String(content.sql ?? '')}
              </pre>
            </div>
          </div>

          {/* Bindings */}
          {content.bindings && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Bindings</h4>
              <JsonViewer data={content.bindings} />
            </div>
          )}
        </div>
      )}
    </EntryDetail>
  );
}
