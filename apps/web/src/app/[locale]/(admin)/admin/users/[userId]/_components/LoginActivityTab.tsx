'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Loader2, CheckCircle2, AlertTriangle, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/dateFormat';

interface LoginItem {
  id: string;
  success: boolean;
  ipAddress?: string;
  failReason?: string;
  country?: string;
  city?: string;
  userAgent?: string;
  createdAt: string;
}

interface LoginActivityTabProps {
  isLoading: boolean;
  loginData?: {
    items: LoginItem[];
    totalPages: number;
  } | null;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function LoginActivityTab({
  isLoading,
  loginData,
  currentPage,
  onPageChange,
}: LoginActivityTabProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!loginData?.items?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t('userDetail.noLoginActivity')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {loginData.items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex items-center justify-between rounded-lg border p-3',
            item.success
              ? 'border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10'
              : 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center',
              item.success
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            )}>
              {item.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {item.success ? t('userDetail.loginSuccess') : t('userDetail.loginFailed')}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{item.ipAddress}</span>
                {item.failReason && (
                  <span className="text-red-500">({item.failReason})</span>
                )}
              </div>
              {(item.country || item.city) && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <Globe className="w-3 h-3 inline mr-1" />
                  {[item.city, item.country].filter(Boolean).join(', ') || t('userDetail.unknownLocation')}
                </p>
              )}
              {item.userAgent && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs" title={item.userAgent}>
                  {item.userAgent.substring(0, 60)}...
                </p>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {fmtDateTime(item.createdAt, locale)}
          </span>
        </div>
      ))}
      {loginData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {t('common.previous')}
          </button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {loginData.totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(loginData.totalPages, currentPage + 1))}
            disabled={currentPage === loginData.totalPages}
            className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
