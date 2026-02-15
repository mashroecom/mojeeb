'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showInfo?: boolean;
  className?: string;
}

/**
 * Build a list of page numbers to display, with ellipses for gaps.
 * Always shows first, last, and pages around the current page.
 */
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  pages.push(1);

  if (left > 2) {
    pages.push('ellipsis');
  }

  for (let i = left; i <= right; i++) {
    pages.push(i);
  }

  if (right < total - 1) {
    pages.push('ellipsis');
  }

  pages.push(total);

  return pages;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  showInfo = true,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);
  const isFirst = page === 1;
  const isLast = page === totalPages;

  const buttonBase =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-9 min-w-[36px] px-2 disabled:pointer-events-none disabled:opacity-50';

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      {showInfo && (
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
      )}

      <div className="flex items-center gap-1">
        <button
          disabled={isFirst}
          onClick={() => onPageChange(page - 1)}
          className={cn(buttonBase, 'hover:bg-muted')}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span
              key={`ellipsis-${i}`}
              className="inline-flex h-9 min-w-[36px] items-center justify-center text-sm text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                buttonBase,
                p === page
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}

        <button
          disabled={isLast}
          onClick={() => onPageChange(page + 1)}
          className={cn(buttonBase, 'hover:bg-muted')}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
