// → Watchers/LogWatcher.php
// Captures console.log/warn/error/info/debug calls

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export class LogWatcher extends Watcher {
  readonly type = EntryType.Log;
  private originalMethods: Partial<Record<LogLevel, (...args: unknown[]) => void>> = {};
  private recording = false; // Re-entrance guard to prevent infinite loops

  register(telescope: Telescope): void {
    const levels: LogLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

    for (const level of levels) {
      this.originalMethods[level] = console[level];

      console[level] = (...args: unknown[]) => {
        // Call original first — never interfere with app behavior
        this.originalMethods[level]?.apply(console, args);

        // Skip if we're already recording (prevents infinite loop when
        // telescope internals call console.warn during recordEntry → store)
        if (this.recording) return;

        // Skip internal telescope messages
        if (typeof args[0] === 'string' && args[0].startsWith('[Telescope]')) return;

        // Record the log entry
        try {
          this.recording = true;
          this.record(telescope, {
            level,
            message: args.map((arg) => this.stringify(arg)).join(' '),
            context: args.length > 1 ? this.extractContext(args.slice(1)) : {},
          });
        } catch {
          // Silently ignore — never crash the app from logging
        } finally {
          this.recording = false;
        }
      };
    }
  }

  unregister(): void {
    for (const [level, original] of Object.entries(this.originalMethods)) {
      if (original) {
        console[level as LogLevel] = original;
      }
    }
    this.originalMethods = {};
  }

  private stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private extractContext(args: unknown[]): Record<string, unknown> {
    const context: Record<string, unknown> = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] !== null && typeof args[i] === 'object') {
        Object.assign(context, args[i]);
      } else {
        context[`arg${i}`] = args[i];
      }
    }
    return context;
  }
}
