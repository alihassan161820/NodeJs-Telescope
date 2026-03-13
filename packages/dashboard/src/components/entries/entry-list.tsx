import type { ReactNode } from 'react';
import { Loading } from '../shared/loading';

interface Column<T> {
  header: string;
  className?: string;
  render: (item: T) => ReactNode;
}

interface EntryListProps<T> {
  entries: T[];
  columns: Column<T>[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRowClick: (item: T) => void;
  keyExtractor: (item: T) => string;
}

export function EntryList<T>({
  entries,
  columns,
  loading,
  hasMore,
  error,
  onLoadMore,
  onRowClick,
  keyExtractor,
}: EntryListProps<T>) {
  if (loading && entries.length === 0) {
    return <Loading />;
  }

  if (error && entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">No entries found</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            {columns.map((col) => (
              <th
                key={col.header}
                className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {entries.map((entry) => (
            <tr
              key={keyExtractor(entry)}
              onClick={() => onRowClick(entry)}
              className="hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.header}
                  className={`px-4 py-3 text-sm ${col.className ?? ''}`}
                >
                  {col.render(entry)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {(hasMore || loading) && (
        <div className="border-t border-gray-800 px-4 py-3 text-center">
          {loading ? (
            <Loading className="py-2" />
          ) : (
            <button
              onClick={onLoadMore}
              className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Load More
            </button>
          )}
        </div>
      )}
    </div>
  );
}
