'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  previousLabel?: string;
  nextLabel?: string;
  pageLabel?: string;
  ofLabel?: string;
}

export function AdminPagination({
  page,
  totalPages,
  onPageChange,
  previousLabel,
  nextLabel,
  pageLabel,
  ofLabel,
}: AdminPaginationProps) {
  const t = useTranslations('pagination');
  const resolvedPreviousLabel = previousLabel ?? t('previous');
  const resolvedNextLabel = nextLabel ?? t('next');
  const resolvedPageLabel = pageLabel ?? t('page');
  const resolvedOfLabel = ofLabel ?? t('of');
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
      >
        <ChevronLeft className="h-4 w-4" />
        {resolvedPreviousLabel}
      </button>
      <span className="text-sm text-muted-foreground">
        {resolvedPageLabel} {page} {resolvedOfLabel} {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
      >
        {resolvedNextLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
