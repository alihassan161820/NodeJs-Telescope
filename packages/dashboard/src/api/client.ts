// API client for fetching telescope entries from the backend

const API_BASE = '/__telescope/api';

export interface TelescopeEntry {
  id: string;
  batchId: string;
  type: string;
  content: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  familyHash?: string;
}

export interface EntriesResponse {
  entries: TelescopeEntry[];
  hasMore: boolean;
}

export interface EntryDetailResponse {
  entry: TelescopeEntry;
  batch: TelescopeEntry[];
}

export interface StatusResponse {
  recording: boolean;
}

export interface ReplayResponse {
  success: boolean;
  replay: {
    method: string;
    url: string;
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  /** Fetch entries by type */
  getEntries(type: string, beforeId?: string, take = 50): Promise<EntriesResponse> {
    const params = new URLSearchParams({ take: String(take) });
    if (beforeId) params.set('beforeId', beforeId);
    return fetchJson<EntriesResponse>(`${API_BASE}/${type}?${params}`);
  },

  /** Fetch a single entry with its batch */
  getEntry(type: string, id: string): Promise<EntryDetailResponse> {
    return fetchJson<EntryDetailResponse>(`${API_BASE}/${type}/${id}`);
  },

  /** Get telescope recording status */
  getStatus(): Promise<StatusResponse> {
    return fetchJson<StatusResponse>(`${API_BASE}/status`);
  },

  /** Toggle telescope recording */
  setStatus(recording: boolean): Promise<StatusResponse> {
    return fetchJson<StatusResponse>(`${API_BASE}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recording }),
    });
  },

  /** Clear all entries */
  clearEntries(): Promise<void> {
    return fetchJson<void>(`${API_BASE}/entries`, { method: 'DELETE' });
  },

  /** Replay a captured request */
  replayRequest(id: string): Promise<ReplayResponse> {
    return fetchJson<ReplayResponse>(`${API_BASE}/replay/${id}`, {
      method: 'POST',
    });
  },
};
