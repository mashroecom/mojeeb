'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/dateFormat';

interface Conversation {
  id: string;
  customerName?: string;
  customerEmail?: string;
  status: string;
  updatedAt: string;
  channel?: {
    name: string;
  };
  org?: {
    name: string;
  };
  _count?: {
    messages: number;
  };
}

interface ConversationsTabProps {
  isLoading: boolean;
  conversationsData?: {
    conversations: Conversation[];
    totalPages: number;
  } | null;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function ConversationsTab({
  isLoading,
  conversationsData,
  currentPage,
  onPageChange,
}: ConversationsTabProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!conversationsData?.conversations?.length) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
        {t('userDetail.noConversations')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {conversationsData.conversations.map((conv) => (
        <div
          key={conv.id}
          className="flex items-center justify-between p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {conv.customerName || conv.customerEmail || 'Anonymous'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {conv.channel?.name} · {conv.org?.name}
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <span
              className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                conv.status === 'ACTIVE'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : conv.status === 'RESOLVED'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
              )}
            >
              {conv.status}
            </span>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('userDetail.messages')}: {conv._count?.messages || 0}
            </p>
            <p className="text-gray-400 dark:text-gray-500">
              {fmtDateTime(conv.updatedAt, locale)}
            </p>
          </div>
        </div>
      ))}
      {conversationsData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {currentPage} / {conversationsData.totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= conversationsData.totalPages}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
