'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Loader2, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate, fmtDateTime } from '@/lib/dateFormat';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes?: string[];
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  org?: {
    name: string;
  };
}

interface ApiKeysTabProps {
  isLoading: boolean;
  apiKeysData?: {
    keys: ApiKey[];
    totalPages: number;
  } | null;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function ApiKeysTab({ isLoading, apiKeysData, currentPage, onPageChange }: ApiKeysTabProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!apiKeysData?.keys?.length) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
        {t('userDetail.noApiKeys')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {apiKeysData.keys.map((key) => (
        <div
          key={key.id}
          className="flex items-center justify-between p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800"
        >
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{key.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {key.keyPrefix}... · {key.org?.name}
              </p>
              {key.scopes && key.scopes.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {key.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-right text-sm">
            <span
              className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                key.revokedAt
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
              )}
            >
              {key.revokedAt ? t('userDetail.revoked') : t('userDetail.active')}
            </span>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('userDetail.lastUsed')}:{' '}
              {key.lastUsedAt ? fmtDateTime(key.lastUsedAt, locale) : t('userDetail.never')}
            </p>
            <p className="text-gray-400 dark:text-gray-500">{fmtDate(key.createdAt, locale)}</p>
          </div>
        </div>
      ))}
      {apiKeysData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {currentPage} / {apiKeysData.totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= apiKeysData.totalPages}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
