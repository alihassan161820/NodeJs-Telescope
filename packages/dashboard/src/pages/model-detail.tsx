import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

const actionVariants: Record<string, BadgeVariant> = {
  created: 'success',
  updated: 'info',
  deleted: 'error',
  retrieved: 'neutral',
};

export function ModelDetailPage() {
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
      .getEntry('models', id)
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
          {/* Model summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={actionVariants[String(content.action ?? '').toLowerCase()] ?? 'neutral'}>
              {String(content.action ?? 'unknown')}
            </Badge>
            <span className="text-gray-100 font-mono text-sm">
              {String(content.model ?? content.class ?? '')}
            </span>
            {content.key != null && (
              <span className="text-gray-400 text-sm">Key: {String(content.key)}</span>
            )}
          </div>

          {/* Changes */}
          {content.changes && (
            <Section title="Changes">
              <JsonViewer data={content.changes} />
            </Section>
          )}

          {/* Original attributes */}
          {content.original && (
            <Section title="Original Attributes">
              <JsonViewer data={content.original} initialExpanded={false} />
            </Section>
          )}

          {/* Attributes */}
          {content.attributes && (
            <Section title="Attributes">
              <JsonViewer data={content.attributes} initialExpanded={false} />
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
