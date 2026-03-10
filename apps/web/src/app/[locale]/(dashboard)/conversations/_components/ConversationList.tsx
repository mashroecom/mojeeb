'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Search,
  RefreshCw,
  Inbox,
  Loader2,
  Star,
  AlertTriangle,
  Filter,
  X,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChannels } from '@/hooks/useChannels';
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
  categoryBadgeClass,
  CATEGORY_TRANSLATION_KEY,
  type StatusFilter,
} from '../_lib/constants';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
  channelId: string;
  onChannelChange: (id: string) => void;
  sentiment: string;
  onSentimentChange: (s: string) => void;
  category: string;
  onCategoryChange: (c: string) => void;
  startDate: string;
  onStartDateChange: (d: string) => void;
  endDate: string;
  onEndDateChange: (d: string) => void;
  isLoading: boolean;
  isError?: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  onExport: () => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
}

const STATUS_TABS: { key: StatusFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'active', labelKey: 'filterActive' },
  { key: 'handoff', labelKey: 'filterHandoff' },
  { key: 'resolved', labelKey: 'filterResolved' },
];

const SENTIMENT_OPTIONS = [
  { key: '', labelKey: 'sentimentAll' },
  { key: 'positive', labelKey: 'sentimentPositive' },
  { key: 'neutral', labelKey: 'sentimentNeutral' },
  { key: 'negative', labelKey: 'sentimentNegative' },
];

export const ConversationList = React.memo(function ConversationList({
  conversations,
  selectedId,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  channelId,
  onChannelChange,
  sentiment,
  onSentimentChange,
  category,
  onCategoryChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  isLoading,
  isError,
  isFetching,
  onRefresh,
  onSelect,
  onExport,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  allSelected,
  someSelected,
}: ConversationListProps) {
  const t = useTranslations('dashboard.conversations');
  const tc = useTranslations('common');
  const [showFilters, setShowFilters] = useState(false);
  const { data: channels = [] } = useChannels();

  const hasActiveFilters = channelId || sentiment || category || startDate || endDate;

  const clearFilters = () => {
    onChannelChange('');
    onSentimentChange('');
    onCategoryChange('');
    onStartDateChange('');
    onEndDateChange('');
  };

  return (
    <aside
      className={cn(
        'flex w-full md:w-80 shrink-0 flex-col border-e bg-card',
        selectedId ? 'hidden md:flex' : 'flex',
      )}
    >
      {/* Search + Filter Toggle + Refresh */}
      <div className="border-b p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-lg border bg-background py-2 ps-9 pe-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted',
              (showFilters || hasActiveFilters) && 'bg-primary/10 border-primary/30 text-primary',
            )}
            title={t('filters')}
          >
            <Filter className="h-4 w-4" />
          </button>
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
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b px-3 py-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onStatusFilterChange(tab.key)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              statusFilter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Expandable filters panel */}
      {showFilters && (
        <div className="border-b p-3 space-y-3 bg-muted/30">
          {/* Channel filter */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {t('filterChannel')}
            </label>
            <select
              value={channelId}
              onChange={(e) => onChannelChange(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <option value="">{t('allChannels')}</option>
              {channels.map((ch: any) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name} ({ch.type})
                </option>
              ))}
            </select>
          </div>

          {/* Sentiment filter */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {t('filterSentiment')}
            </label>
            <div className="mt-1 flex gap-1">
              {SENTIMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onSentimentChange(opt.key)}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                    sentiment === opt.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted border',
                  )}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {t('filterCategory')}
            </label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <option value="">{t('allCategories')}</option>
              <option value="complaint">{t('categoryComplaint')}</option>
              <option value="inquiry">{t('categoryInquiry')}</option>
              <option value="purchase_request">{t('categoryPurchaseRequest')}</option>
              <option value="feedback">{t('categoryFeedback')}</option>
              <option value="support">{t('categorySupport')}</option>
              <option value="other">{t('categoryOther')}</option>
            </select>
          </div>

          {/* Date range filter */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {t('filterFrom')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {t('filterTo')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <X className="h-3 w-3" />
              {t('clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Select all header */}
      {conversations.length > 0 && (
        <div className="border-b px-4 py-2 bg-muted/30">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              title={t('selectAll')}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {someSelected ? t('selected', { count: selectedIds.size }) : t('selectAll')}
            </span>
          </label>
        </div>
      )}

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
              className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
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
          const isSelected = selectedIds.has(conv.id);

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'w-full border-b px-4 py-3 text-start transition-colors hover:bg-muted/50',
                selectedId === conv.id && 'bg-muted',
                isSelected && 'bg-primary/5',
              )}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div className="flex items-center pt-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(conv.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>

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
                            'bg-muted text-muted-foreground',
                        )}
                      >
                        {CHANNEL_TRANSLATION_KEY[channelType]
                          ? t(CHANNEL_TRANSLATION_KEY[channelType])
                          : conv.channel.type}
                      </span>
                    )}

                    {/* Category badge */}
                    {conv.category && (
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                          categoryBadgeClass(conv.category),
                        )}
                      >
                        {t(CATEGORY_TRANSLATION_KEY[conv.category] || 'categoryOther')}
                      </span>
                    )}

                    {/* Tags - Not available in current Conversation interface */}
                    {/* {conv.tags?.map((conversationTag) => (
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
                    ))} */}

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
