import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry, ReplayResponse } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { MethodBadge, StatusBadge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<TelescopeEntry | null>(null);
  const [batch, setBatch] = useState<TelescopeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayResponse | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getEntry('requests', id)
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

  const handleReplay = async () => {
    if (!id || replaying) return;
    setReplaying(true);
    setReplayResult(null);
    setReplayError(null);

    try {
      const result = await api.replayRequest(id);
      setReplayResult(result);
    } catch (err) {
      setReplayError(err instanceof Error ? err.message : 'Replay failed');
    } finally {
      setReplaying(false);
    }
  };

  const content = entry?.content ?? {};

  return (
    <EntryDetail entry={entry} batch={batch} loading={loading} error={error}>
      {entry && (
        <div className="space-y-6">
          {/* Request summary + Replay button */}
          <div className="flex items-center gap-3 flex-wrap">
            <MethodBadge method={String(content.method ?? 'GET')} />
            <span className="text-gray-100 font-mono text-sm">
              {String(content.uri ?? content.path ?? '')}
            </span>
            {content.status != null && <StatusBadge status={Number(content.status)} />}
            {content.duration != null && (
              <span className="text-gray-400 text-sm">
                {Number(content.duration).toFixed(0)}ms
              </span>
            )}
            {content.memory != null && (
              <span className="text-gray-400 text-sm">
                {formatBytes(Number(content.memory))}
              </span>
            )}
            <button
              onClick={handleReplay}
              disabled={replaying}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              {replaying ? 'Replaying...' : 'Replay Request'}
            </button>
          </div>

          {/* Replay result */}
          {replayResult && (
            <div className="bg-indigo-950/30 border border-indigo-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-medium text-indigo-400">Replay Result</h4>
                <StatusBadge status={replayResult.replay.status} />
                <span className="text-gray-400 text-xs font-mono">{replayResult.replay.method} {replayResult.replay.url}</span>
              </div>
              <Section title="Response Body">
                <JsonViewer data={replayResult.replay.body} />
              </Section>
              <Section title="Response Headers">
                <JsonViewer data={replayResult.replay.headers} initialExpanded={false} />
              </Section>
            </div>
          )}

          {/* Replay error */}
          {replayError && (
            <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4">
              <p className="text-sm text-red-400">Replay failed: {replayError}</p>
            </div>
          )}

          {/* Request headers */}
          {content.headers && (
            <Section title="Request Headers">
              <JsonViewer data={content.headers} initialExpanded={false} />
            </Section>
          )}

          {/* Request payload */}
          {content.payload && (
            <Section title="Payload">
              <JsonViewer data={content.payload} />
            </Section>
          )}

          {/* Response headers */}
          {content.responseHeaders && (
            <Section title="Response Headers">
              <JsonViewer data={content.responseHeaders} initialExpanded={false} />
            </Section>
          )}

          {/* Response body */}
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
