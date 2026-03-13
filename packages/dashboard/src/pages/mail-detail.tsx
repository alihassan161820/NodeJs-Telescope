import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';
import { EntryDetail } from '../components/entries/entry-detail';
import { Badge } from '../components/shared/badge';
import { JsonViewer } from '../components/shared/json-viewer';

export function MailDetailPage() {
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
      .getEntry('mail', id)
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
          {/* Mail summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={content.queued ? 'warning' : 'success'}>
              {content.queued ? 'queued' : 'sent'}
            </Badge>
            <span className="text-gray-100 font-mono text-sm">
              {String(content.mailable ?? content.class ?? '')}
            </span>
          </div>

          {/* Subject */}
          {content.subject && (
            <Section title="Subject">
              <p className="text-gray-100 text-sm">{String(content.subject)}</p>
            </Section>
          )}

          {/* Recipients */}
          <div className="grid grid-cols-2 gap-4">
            {content.to && (
              <RecipientsCard label="To" recipients={content.to} />
            )}
            {content.cc && (
              <RecipientsCard label="CC" recipients={content.cc} />
            )}
            {content.bcc && (
              <RecipientsCard label="BCC" recipients={content.bcc} />
            )}
            {content.replyTo && (
              <RecipientsCard label="Reply To" recipients={content.replyTo} />
            )}
          </div>

          {/* HTML Preview */}
          {content.html && (
            <Section title="HTML Body">
              <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 overflow-auto max-h-96">
                <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words">
                  {String(content.html)}
                </pre>
              </div>
            </Section>
          )}

          {/* Attachments */}
          {content.attachments && Array.isArray(content.attachments) && content.attachments.length > 0 && (
            <Section title={`Attachments (${content.attachments.length})`}>
              <JsonViewer data={content.attachments} />
            </Section>
          )}

          {/* Raw data */}
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

function RecipientsCard({ label, recipients }: { label: string; recipients: unknown }) {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return (
    <div className="bg-gray-950 rounded-lg border border-gray-800 p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {list.map((r, i) => (
        <p key={i} className="text-sm text-gray-200">{String(r)}</p>
      ))}
    </div>
  );
}
