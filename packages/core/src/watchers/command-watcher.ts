// → Watchers/CommandWatcher.php
// Captures CLI command execution

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface CommandData {
  command: string;
  name?: string;
  exitCode: number;
  exit_code?: number;
  duration: number;
  arguments?: string[];
  args?: string[];
  options?: Record<string, unknown>;
  output?: string;
}

export class CommandWatcher extends Watcher {
  readonly type = EntryType.Command;

  register(_telescope: Telescope): void {
    // Command watcher is passive — it's invoked by the CLI framework adapter
    // Commander.js: hook, yargs: middleware
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the CLI adapter to record a command execution */
  recordCommand(telescope: Telescope, data: CommandData): void {
    this.record(telescope, {
      command: data.command,
      name: data.name ?? data.command,
      exitCode: data.exitCode,
      exit_code: data.exit_code ?? data.exitCode,
      duration: data.duration,
      arguments: data.arguments ?? data.args ?? [],
      options: data.options ?? {},
      output: data.output ?? null,
    });
  }
}
