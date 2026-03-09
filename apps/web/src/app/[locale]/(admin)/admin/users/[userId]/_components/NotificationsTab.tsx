'use client';

import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import { Bell, Loader2 } from 'lucide-react';

interface NotificationsTabProps {
  isLoading: boolean;
  notificationsData?: {
    notifications: Array<{
      id: string;
      title: string;
      body: string;
      type: string;
      isRead: boolean;
      createdAt: string;
      organization?: {
        name: string;
      };
    }>;
    totalPages: number;
  };
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function NotificationsTab({
  isLoading,
  notificationsData,
  currentPage,
  onPageChange,
}: NotificationsTabProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!notificationsData?.notifications?.length) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
        {t('userDetail.noNotifications')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {notificationsData.notifications.map((notif) => (
        <div
          key={notif.id}
          className={cn(
            'flex items-center justify-between p-4 rounded-xl border',
            notif.isRead
              ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
          )}
        >
          <div className="flex items-center gap-3">
            <Bell
              className={cn(
                'w-5 h-5',
                notif.isRead ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'
              )}
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{notif.title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{notif.body}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {notif.type} · {notif.organization?.name}
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <span
              className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                notif.isRead
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              )}
            >
              {notif.isRead ? t('userDetail.read') : t('userDetail.unread')}
            </span>
            <p className="text-gray-400 dark:text-gray-500 mt-1">
              {fmtDateTime(notif.createdAt, locale)}
            </p>
          </div>
        </div>
      ))}
      {notificationsData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {currentPage} / {notificationsData.totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= notificationsData.totalPages}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
