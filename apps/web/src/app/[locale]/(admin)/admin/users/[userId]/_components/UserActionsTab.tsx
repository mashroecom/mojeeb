'use client';

import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import { Activity, Loader2 } from 'lucide-react';

interface UserActionsTabProps {
  isLoading: boolean;
  userActionsData?: {
    logs: Array<{
      id: string;
      action: string;
      targetType: string;
      targetId: string;
      createdAt: string;
    }>;
    totalPages: number;
  };
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function UserActionsTab({
  isLoading,
  userActionsData,
  currentPage,
  onPageChange,
}: UserActionsTabProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!userActionsData?.logs?.length) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
        {t('userDetail.noUserActions')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {userActionsData.logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{log.action}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('userDetail.target')}: {log.targetType} ({log.targetId?.substring(0, 12)}...)
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-400 dark:text-gray-500">{fmtDateTime(log.createdAt, locale)}</p>
          </div>
        </div>
      ))}
      {userActionsData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {currentPage} / {userActionsData.totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= userActionsData.totalPages}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
