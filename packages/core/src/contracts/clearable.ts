// → Contracts/ClearableRepository.php
// Interface for storage that supports clearing entries

import type { EntryType } from '../entry-type.js';

export interface Clearable {
  /** Delete all entries, optionally filtered by type */
  truncate(type?: EntryType): Promise<void>;
}
