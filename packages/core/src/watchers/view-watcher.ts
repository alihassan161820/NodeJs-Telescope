// → Watchers/ViewWatcher.php
// Captures template rendering

import { EntryType } from '../entry-type.js';
import type { Telescope } from '../telescope.js';
import { Watcher } from './watcher.js';

export interface ViewData {
  name: string;
  view?: string;
  path?: string;
  data?: Record<string, unknown>;
  composer?: string;
  composers?: string[];
  duration?: number;
}

export class ViewWatcher extends Watcher {
  readonly type = EntryType.View;

  register(_telescope: Telescope): void {
    // View watcher is passive — it's invoked by the template engine adapter
    // EJS, Handlebars, Pug, Nunjucks render hooks
  }

  unregister(): void {
    // Nothing to clean up — adapter handles lifecycle
  }

  /** Called by the template adapter to record a view render */
  recordView(telescope: Telescope, data: ViewData): void {
    this.record(telescope, {
      name: data.name,
      view: data.view ?? data.name,
      path: data.path ?? null,
      data: data.data ?? {},
      composer: data.composer ?? null,
      composers: data.composers ?? [],
      duration: data.duration ?? 0,
    });
  }
}
