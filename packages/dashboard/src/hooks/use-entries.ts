import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { TelescopeEntry } from '../api/client';

interface UseEntriesResult {
  entries: TelescopeEntry[];
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  hasMore: boolean;
}

export function useEntries(type: string): UseEntriesResult {
  const [entries, setEntries] = useState<TelescopeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchEntries = useCallback(
    async (beforeId?: string) => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getEntries(type, beforeId);

        if (beforeId) {
          setEntries((prev) => [...prev, ...data.entries]);
        } else {
          setEntries(data.entries);
        }
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch entries');
      } finally {
        setLoading(false);
      }
    },
    [type],
  );

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const loadMore = useCallback(() => {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      fetchEntries(lastEntry.id);
    }
  }, [entries, fetchEntries]);

  const refresh = useCallback(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, error, loadMore, refresh, hasMore };
}
