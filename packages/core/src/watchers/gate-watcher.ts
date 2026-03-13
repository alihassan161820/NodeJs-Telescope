// → Watchers/GateWatcher.php
// Captures authorization checks

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface GateData {
  ability: string;
  permission?: string;
  result: 'allowed' | 'denied';
  user?: string;
  arguments?: unknown[];
  response?: unknown;
}

export class GateWatcher extends Watcher {
  readonly type = EntryType.Gate;

  register(_telescope: Telescope): void {
    // Gate watcher is passive — it's invoked by the authorization adapter
    // CASL: ability checks, custom guard middleware
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the authorization adapter to record an authorization check */
  recordGate(telescope: Telescope, data: GateData): void {
    this.record(telescope, {
      ability: data.ability,
      permission: data.permission ?? data.ability,
      result: data.result,
      user: data.user ?? 'anonymous',
      arguments: data.arguments ?? [],
      response: data.response ?? null,
    });
  }
}
