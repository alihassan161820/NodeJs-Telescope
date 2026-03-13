// → Watchers/NotificationWatcher.php
// Captures notifications

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface NotificationData {
  channel: string;
  notification: string;
  class?: string;
  notifiable: string;
  response?: unknown;
  data?: Record<string, unknown>;
}

export class NotificationWatcher extends Watcher {
  readonly type = EntryType.Notification;

  register(_telescope: Telescope): void {
    // Notification watcher is passive — it's invoked by the notification adapter
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the notification adapter to record a notification */
  recordNotification(telescope: Telescope, data: NotificationData): void {
    this.record(telescope, {
      channel: data.channel,
      notification: data.notification,
      class: data.class ?? data.notification,
      notifiable: data.notifiable,
      response: data.response ?? null,
      data: data.data ?? {},
    });
  }
}
