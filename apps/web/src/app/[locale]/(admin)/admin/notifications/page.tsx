'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useAdminNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Bell,
  Trash2,
  Loader2,
  CheckCheck,
  Eye,
} from 'lucide-react';
import { AdminPagination } from '@/components/admin/AdminPagination';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  type: 'NEW_USER' | 'FAILED_PAYMENT' | 'SYSTEM_ERROR' | 'SUPPORT_MESSAGE' | string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


const typeBadge: Record<string, string> = {
  NEW_USER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FAILED_PAYMENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  SYSTEM_ERROR: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  SUPPORT_MESSAGE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// typeLabel moved inside component to use translations

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="h-5 w-24 rounded-full bg-muted" />
        <div className="h-3 w-28 rounded bg-muted" />
      </div>
      <div className="h-4 w-3/4 rounded bg-muted mb-2" />
      <div className="h-3 w-full rounded bg-muted mb-1" />
      <div className="h-3 w-2/3 rounded bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const t = useTranslations('admin.notifications');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  function typeLabel(type: string): string {
    return t(`types.${type}` as any) || type;
  }

  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useAdminNotifications({
    page,
    limit: 20,
    unreadOnly,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const notifications: Notification[] = data?.notifications ?? data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  async function handleMarkRead(id: string) {
    try {
      await markRead.mutateAsync(id);
    } catch {
      addToast('error', t('toasts.markReadFailed'));
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead.mutateAsync();
      addToast('success', t('toasts.allMarkedRead'));
    } catch {
      addToast('error', t('toasts.markAllFailed'));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNotification.mutateAsync(id);
      addToast('success', t('toasts.deleted'));
      setDeleteConfirmId(null);
    } catch {
      addToast('error', t('toasts.deleteFailed'));
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={handleMarkAllRead}
          disabled={markAllRead.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 shrink-0"
        >
          {markAllRead.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4" />
          )}
          {t('markAllRead')}
        </button>
      </div>

      {/* Filter: All / Unread Only */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setUnreadOnly(false);
            setPage(1);
          }}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            !unreadOnly
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {t('all')}
        </button>
        <button
          onClick={() => {
            setUnreadOnly(true);
            setPage(1);
          }}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            unreadOnly
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {t('unreadOnly')}
        </button>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('loadError')}</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">
            {unreadOnly ? t('noUnread') : t('noNotifications')}
          </p>
        </div>
      )}

      {/* Notification Cards */}
      {!isLoading && !isError && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                'rounded-lg border bg-card p-5 shadow-sm transition-colors',
                !n.isRead && 'border-primary/30 bg-primary/[0.02]',
              )}
            >
              {/* Card Top Row */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                      typeBadge[n.type] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                    )}
                  >
                    {typeLabel(n.type)}
                  </span>
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {fmtDateTime(n.createdAt, locale)}
                </span>
              </div>

              {/* Title */}
              <h3 className={cn('text-sm mb-1', !n.isRead ? 'font-semibold' : 'font-medium text-muted-foreground')}>
                {n.title}
              </h3>

              {/* Body */}
              <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                {n.body}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t pt-3">
                {!n.isRead && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    disabled={markRead.isPending}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Eye className="h-3 w-3" />
                    {t('markAsRead')}
                  </button>
                )}

                {deleteConfirmId === n.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(n.id)}
                      disabled={deleteNotification.isPending}
                      className="inline-flex items-center gap-1 rounded-md bg-red-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deleteNotification.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      {tc('confirm')}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-muted transition-colors"
                    >
                      {tc('cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(n.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    {tc('delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />}
    </div>
  );
}
