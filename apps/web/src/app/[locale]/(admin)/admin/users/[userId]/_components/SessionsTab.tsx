'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Loader2, Monitor, LogOut, X } from 'lucide-react';
import { fmtDateTime } from '@/lib/dateFormat';

interface Session {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
}

interface SessionsTabProps {
  isLoading: boolean;
  sessionData?: {
    items: Session[];
    totalPages: number;
  } | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onKillSession: (sessionId: string) => void;
  onKillAllSessions: () => void;
  killSessionPending: boolean;
  killAllSessionsPending: boolean;
}

export function SessionsTab({
  isLoading,
  sessionData,
  currentPage,
  onPageChange,
  onKillSession,
  onKillAllSessions,
  killSessionPending,
  killAllSessionsPending,
}: SessionsTabProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessionData?.items?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t('userDetail.noSessions')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Kill All Sessions button */}
      <div className="flex justify-end">
        <button
          onClick={onKillAllSessions}
          disabled={killAllSessionsPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t('userDetail.killAllSessions')}
        </button>
      </div>

      {sessionData.items.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Monitor className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {session.ipAddress || t('userDetail.unknownIP')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                {session.userAgent || '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('userDetail.expires')}: {fmtDateTime(session.expiresAt, locale)}
              </p>
            </div>
          </div>
          <button
            onClick={() => onKillSession(session.id)}
            disabled={killSessionPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-2.5 py-1.5 text-xs font-medium transition-colors"
          >
            <X className="h-3 w-3" />
            {t('userDetail.kill')}
          </button>
        </div>
      ))}
      {sessionData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {t('common.previous')}
          </button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {sessionData.totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(sessionData.totalPages, currentPage + 1))}
            disabled={currentPage === sessionData.totalPages}
            className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
