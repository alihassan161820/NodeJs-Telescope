// → Watchers/MailWatcher.php
// Captures emails sent (Nodemailer, etc)

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface MailData {
  mailable?: string;
  class?: string;
  to: string | string[];
  from: string;
  subject: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  html?: boolean | string;
  queued: boolean;
  attachments?: unknown[];
  data?: Record<string, unknown>;
}

export class MailWatcher extends Watcher {
  readonly type = EntryType.Mail;

  register(_telescope: Telescope): void {
    // Mail watcher is passive — it's invoked by the mailer adapter
    // Nodemailer: transport plugin, SendGrid: interceptor
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the mailer adapter to record an outgoing email */
  recordMail(telescope: Telescope, data: MailData): void {
    this.record(telescope, {
      mailable: data.mailable ?? data.class ?? null,
      to: data.to,
      from: data.from,
      subject: data.subject,
      cc: data.cc ?? [],
      bcc: data.bcc ?? [],
      replyTo: data.replyTo ?? [],
      html: data.html ?? false,
      queued: data.queued,
      attachments: data.attachments ?? [],
      data: data.data ?? {},
    });
  }
}
