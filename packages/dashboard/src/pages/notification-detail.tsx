import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function NotificationDetailPage() {
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
      .getEntry('notifications', id)
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
          {/* Notification summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="info">{String(content.channel ?? 'mail')}</Badge>
            <span className="text-gray-100 font-mono text-sm">
              {String(content.notification ?? content.class ?? '')}
            </span>
          </div>

          {/* Notifiable */}
          {content.notifiable && (
            <Section title="Notifiable">
              <p className="text-gray-200 text-sm font-mono">{String(content.notifiable)}</p>
            </Section>
          )}

          {/* Response */}
          {content.response && (
            <Section title="Response">
              <JsonViewer data={content.response} />
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
