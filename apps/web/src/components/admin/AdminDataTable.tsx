'use client';
import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface AdminDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  skeletonRows?: number;
}

export function AdminDataTable<T>({
  columns,
  data,
  loading,
  emptyIcon,
  emptyMessage,
  rowKey,
  onRowClick,
  skeletonRows = 5,
}: AdminDataTableProps<T>) {
  const t = useTranslations('admin.common');
  const resolvedEmptyMessage = emptyMessage ?? t('noDataFound');
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="animate-pulse border-b last:border-b-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-3 w-24 rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  {emptyIcon && <div className="flex justify-center mb-4">{emptyIcon}</div>}
                  <p className="text-sm text-muted-foreground">{resolvedEmptyMessage}</p>
                </td>
              </tr>
            )}

            {!loading &&
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b last:border-b-0 transition-colors hover:bg-muted/30',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
