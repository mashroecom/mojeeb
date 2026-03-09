'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Search,
  RefreshCw,
  Inbox,
  Loader2,
  Star,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/hooks/useConversations';
import {
  relativeTime,
  getEmotionEmoji,
  getDisplayName,
  getConversationSummary,
  STATUS_BADGE,
  CHANNEL_BADGE,
  CHANNEL_TRANSLATION_KEY,
  EMOTION_TRANSLATION_KEY,
  type StatusFilter,
} from '../_lib/constants';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
  isLoading: boolean;
  isError?: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  onExport: () => void;
}

const STATUS_TABS: { key: StatusFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'active', labelKey: 'filterActive' },
  { key: 'handoff', labelKey: 'filterHandoff' },
  { key: 'resolved', labelKey: 'filterResolved' },
];

export const ConversationList = React.memo(function ConversationList({
  conversations,
  selectedId,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  isLoading,
  isError,
  isFetching,
  onRefresh,
  onSelect,
  onExport,
}: ConversationListProps) {
  const t = useTranslations('dashboard.conversations');
  const tc = useTranslations('common');

  return (
    <aside
      className={cn(
        'flex w-full md:w-80 shrink-0 flex-col border-e bg-card',
        selectedId ? 'hidden md:flex' : 'flex',
      )}
    >
      {/* Search + Refresh */}
      <div className="border-b p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-lg border bg-background py-2 ps-9 pe-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            onClick={onRefresh}
            disabled={isFetching}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted disabled:opacity-50"
            title={t('refresh')}
          >
            <RefreshCw
              className={cn(
                'h-4 w-4 text-muted-foreground',
                isFetching && 'animate-spin',
              )}
            />
          </button>
          <button
            onClick={onExport}
            disabled={conversations.length === 0}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted disabled:opacity-50"
            title={t('export')}
          >
            <Download className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b px-3 py-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onStatusFilterChange(tab.key)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              statusFilter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertTriangle className="mb-2 h-8 w-8 text-destructive" />
            <span className="text-sm font-medium text-foreground">{tc('somethingWentWrong')}</span>
            <span className="mt-1 text-xs">{tc('errorDescription')}</span>
            <button
              onClick={onRefresh}
              className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {tc('tryAgain')}
            </button>
          </div>
        )}

        {!isLoading && !isError && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Inbox className="mb-2 h-8 w-8" />
            <span className="text-sm">{t('noConversations')}</span>
          </div>
        )}

        {conversations.map((conv) => {
          const displayName = getDisplayName(conv, t('guestUser'));
          const initials = displayName
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const emoji = getEmotionEmoji(conv.lastEmotion);
          const summary = getConversationSummary(conv);
          const channelType = conv.channel?.type?.toLowerCase() ?? '';
          const rating = conv.ratings?.[0]?.rating ?? null;

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'w-full border-b px-4 py-3 text-start transition-colors hover:bg-muted/50',
                selectedId === conv.id && 'bg-muted',
              )}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Top row: name + emoji + time */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate text-sm font-medium">
                        {displayName}
                      </span>
                      {emoji && (
                        <span
                          className="shrink-0 text-sm"
                          title={
                            conv.lastEmotion
                              ? EMOTION_TRANSLATION_KEY[conv.lastEmotion.toLowerCase()]
                                ? t(EMOTION_TRANSLATION_KEY[conv.lastEmotion.toLowerCase()])
                                : conv.lastEmotion
                              : ''
                          }
                        >
                          {emoji}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {relativeTime(conv.lastMessageAt, t)}
                    </span>
                  </div>

                  {/* Summary line */}
                  {summary && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {channelType && (
                        <span className="font-medium">
                          {CHANNEL_TRANSLATION_KEY[channelType]
                            ? t(CHANNEL_TRANSLATION_KEY[channelType])
                            : channelType}{' '}
                          &middot;{' '}
                        </span>
                      )}
                      {summary}
                    </p>
                  )}

                  {/* Badges row */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {/* Status badge */}
                    <span
                      className={cn(
                        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                        STATUS_BADGE[conv.status] ?? STATUS_BADGE.ACTIVE,
                      )}
                    >
                      {t(`status${conv.status}`)}
                    </span>

                    {/* Channel badge */}
                    {conv.channel && (
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                          CHANNEL_BADGE[channelType] ??
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                        )}
                      >
                        {CHANNEL_TRANSLATION_KEY[channelType]
                          ? t(CHANNEL_TRANSLATION_KEY[channelType])
                          : conv.channel.type}
                      </span>
                    )}

                    {/* Tags */}
                    {conv.tags?.map((conversationTag) => (
                      <span
                        key={conversationTag.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
                        style={{
                          backgroundColor: conversationTag.tag.color + '20',
                          color: conversationTag.tag.color,
                          borderColor: conversationTag.tag.color + '40',
                        }}
                      >
                        {conversationTag.tag.name}
                      </span>
                    ))}

                    {/* Rating */}
                    {rating && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'h-2.5 w-2.5',
                              i < rating
                                ? 'fill-amber-500 text-amber-500'
                                : 'fill-none text-amber-300 dark:text-amber-600',
                            )}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
});
