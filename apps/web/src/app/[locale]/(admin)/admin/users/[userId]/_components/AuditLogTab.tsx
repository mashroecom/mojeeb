'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Loader2, History } from 'lucide-react';
import { fmtDateTime } from '@/lib/dateFormat';

interface AuditEntry {
  id: string;
  action?: string;
  createdAt: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

interface AuditLogTabProps {
  isLoading: boolean;
  auditData?: {
    items: AuditEntry[];
    totalPages: number;
  } | null;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function AuditLogTab({ isLoading, auditData, currentPage, onPageChange }: AuditLogTabProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!auditData?.items?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t('userDetail.noAuditEntries')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {auditData.items.map((entry) => (
        <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium">{entry.action?.replace(/_/g, ' ')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('userDetail.by')} {entry.user?.firstName} {entry.user?.lastName} (
                {entry.user?.email})
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {fmtDateTime(entry.createdAt, locale)}
          </span>
        </div>
      ))}
      {auditData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {t('common.previous')}
          </button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {auditData.totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(auditData.totalPages, currentPage + 1))}
            disabled={currentPage === auditData.totalPages}
            className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
