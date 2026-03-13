// → Contracts/PrunableRepository.php
// Interface for storage that supports pruning old entries

export interface Prunable {
  /** Prune entries older than the given date. Returns count of pruned entries. */
  prune(before: Date): Promise<number>;
}
