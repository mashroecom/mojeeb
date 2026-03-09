'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  onSort?: (key: string, direction: SortDirection) => void;
  className?: string;
  rowKey?: (row: T, index: number) => string | number;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  skeletonRows = 5,
  onSort,
  className,
  rowKey,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = useCallback(
    (key: string) => {
      let nextDir: SortDirection;
      if (sortKey === key) {
        if (sortDir === 'asc') nextDir = 'desc';
        else if (sortDir === 'desc') nextDir = null;
        else nextDir = 'asc';
      } else {
        nextDir = 'asc';
      }

      setSortKey(nextDir === null ? null : key);
      setSortDir(nextDir);
      onSort?.(key, nextDir);
    },
    [sortKey, sortDir, onSort],
  );

  const sortedData = (() => {
    if (!sortKey || !sortDir || onSort) return data;
    // Client-side sort when no external onSort handler
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDir === 'asc' ? -1 : 1;
      if (bVal == null) return sortDir === 'asc' ? 1 : -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  })();

  return (
    <div className={cn('w-full overflow-x-auto rounded-xl border', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground',
                  col.sortable && 'cursor-pointer select-none hover:text-foreground',
                  col.className,
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                aria-sort={
                  sortKey === col.key && sortDir
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <span className="inline-flex flex-col">
                      <ChevronUp
                        className={cn(
                          'h-3 w-3 -mb-0.5',
                          sortKey === col.key && sortDir === 'asc'
                            ? 'text-foreground'
                            : 'text-muted-foreground/40',
                        )}
                      />
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 -mt-0.5',
                          sortKey === col.key && sortDir === 'desc'
                            ? 'text-foreground'
                            : 'text-muted-foreground/40',
                        )}
                      />
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b last:border-b-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            : sortedData.length === 0
              ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                )
              : sortedData.map((row, index) => (
                  <tr
                    key={rowKey ? rowKey(row, index) : index}
                    className="border-b last:border-b-0 transition-colors hover:bg-muted/50"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3', col.className)}>
                        {col.render
                          ? col.render(row, index)
                          : (row[col.key] as ReactNode) ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
        </tbody>
      </table>
    </div>
  );
}
