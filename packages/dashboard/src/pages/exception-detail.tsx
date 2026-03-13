import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function ExceptionDetailPage() {
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
      .getEntry('exceptions', id)
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
          {/* Exception summary */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant="error">{String(content.class ?? 'Error')}</Badge>
              {content.file && (
                <span className="text-gray-500 text-xs font-mono">
                  {String(content.file)}{content.line != null ? `:${content.line}` : ''}
                </span>
              )}
            </div>
            <p className="text-gray-100 text-sm">{String(content.message ?? '')}</p>
          </div>

          {/* Stack trace */}
          {content.trace && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Stack Trace</h4>
              <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 overflow-auto">
                <pre className="font-mono text-xs leading-relaxed">
                  {formatTrace(content.trace)}
                </pre>
              </div>
            </div>
          )}

          {/* Context */}
          {content.context && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Context</h4>
              <JsonViewer data={content.context} />
            </div>
          )}
        </div>
      )}
    </EntryDetail>
  );
}

function formatTrace(trace: unknown): React.ReactNode {
  // Handle string stack trace
  if (typeof trace === 'string') {
    return trace.split('\n').map((line, i) => (
      <div
        key={i}
        className={`py-0.5 px-2 -mx-2 rounded ${
          isAppLine(line)
            ? 'text-gray-100 bg-gray-900/50'
            : 'text-gray-500'
        }`}
      >
        {line}
      </div>
    ));
  }

  // Handle array of trace frames
  if (Array.isArray(trace)) {
    return trace.map((frame, i) => {
      const file = frame?.file ?? frame?.fileName ?? '';
      const line = frame?.line ?? frame?.lineNumber ?? '';
      const fn = frame?.function ?? frame?.methodName ?? frame?.functionName ?? '<anonymous>';
      const text = `at ${fn} (${file}:${line})`;

      return (
        <div
          key={i}
          className={`py-0.5 px-2 -mx-2 rounded ${
            isAppLine(String(file))
              ? 'text-gray-100 bg-gray-900/50'
              : 'text-gray-500'
          }`}
        >
          {text}
        </div>
      );
    });
  }

  // Fallback: render as JSON
  return <span className="text-gray-400">{JSON.stringify(trace, null, 2)}</span>;
}

function isAppLine(line: string): boolean {
  // Highlight lines that are NOT from node_modules
  return !line.includes('node_modules') && line.trim().length > 0;
}
