// → Watchers/ExceptionWatcher.php
// Captures uncaught exceptions and unhandled promise rejections

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export class ExceptionWatcher extends Watcher {
  readonly type = EntryType.Exception;
  private uncaughtHandler?: (error: Error) => void;
  private rejectionHandler?: (reason: unknown) => void;

  register(telescope: Telescope): void {
    this.uncaughtHandler = (error: Error) => {
      this.recordException(telescope, error);
    };

    this.rejectionHandler = (reason: unknown) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      this.recordException(telescope, error);
    };

    process.on('uncaughtException', this.uncaughtHandler);
    process.on('unhandledRejection', this.rejectionHandler);
  }

  unregister(): void {
    if (this.uncaughtHandler) {
      process.removeListener('uncaughtException', this.uncaughtHandler);
    }
    if (this.rejectionHandler) {
      process.removeListener('unhandledRejection', this.rejectionHandler);
    }
  }

  /** Record an exception — can be called manually or via global handlers */
  recordException(telescope: Telescope, error: Error): void {
    this.record(telescope, {
      class: error.name,
      message: error.message,
      stack: this.parseStack(error.stack),
      file: this.extractFile(error.stack),
      line: this.extractLine(error.stack),
      context: {},
    });
  }

  private parseStack(stack?: string): string[] {
    if (!stack) return [];
    return stack
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('at '));
  }

  private extractFile(stack?: string): string {
    if (!stack) return 'unknown';
    const match = stack.match(/at\s+.+?\((.+?):\d+:\d+\)/);
    return match?.[1] ?? 'unknown';
  }

  private extractLine(stack?: string): number {
    if (!stack) return 0;
    const match = stack.match(/at\s+.+?\(.+?:(\d+):\d+\)/);
    return match?.[1] ? Number.parseInt(match[1], 10) : 0;
  }
}
