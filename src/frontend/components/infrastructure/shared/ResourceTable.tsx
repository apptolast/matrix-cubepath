import React, { useState, useMemo } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface ResourceTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

type SortDir = 'asc' | 'desc';

export function ResourceTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data',
  searchable = false,
  searchPlaceholder = 'Search...',
}: ResourceTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(q),
      ),
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <div className="space-y-2">
      {searchable && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-matrix-bg border border-matrix-border rounded px-2 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-matrix-accent/60 transition-colors"
        />
      )}

      <div className="overflow-x-auto rounded border border-matrix-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-matrix-bg">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border ${
                    col.sortable ? 'cursor-pointer select-none hover:text-gray-300' : ''
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-matrix-accent text-[10px]">
                        {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-xs text-matrix-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((item, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(item)}
                  className={`border-b border-matrix-border/50 transition-colors ${
                    i % 2 === 0 ? 'bg-matrix-surface' : 'bg-matrix-bg/30'
                  } ${onRowClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-gray-300">
                      {col.render
                        ? col.render(item)
                        : (item[col.key] as React.ReactNode) ?? '\u2014'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
