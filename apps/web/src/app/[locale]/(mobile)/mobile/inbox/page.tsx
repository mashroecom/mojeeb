'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAdminConversations } from '@/hooks/useAdmin';
import { ConversationCard } from '@/components/mobile/ConversationCard';
import { cn } from '@/lib/utils';
import { Search, Filter, X, RefreshCw, MessageCircle } from 'lucide-react';

/* ── Status options ───────────────────────────────────────── */
const STATUS_OPTIONS = ['ACTIVE', 'HANDED_OFF', 'WAITING', 'RESOLVED', 'ARCHIVED'] as const;

/* ── Page component ───────────────────────────────────────── */
export default function MobileInboxPage() {
  const t = useTranslations('mobile.inbox');
  const tc = useTranslations('admin.common');
  const tconv = useTranslations('admin.conversations');
  const locale = useLocale();

  /* ── Local state ──────────────────────────────────────── */
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [status]);

  /* ── Data hooks ───────────────────────────────────────── */
  const { data, isLoading, error, refetch } = useAdminConversations({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
  });

  const conversations = data?.conversations ?? [];
  const hasMore = page < (data?.totalPages ?? 1);

  /* ── Pull-to-refresh handler ──────────────────────────── */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch]);

  /* ── Scroll handler for infinite loading ──────────────── */
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
      if (bottom && !isLoading && hasMore) {
        setPage((p) => p + 1);
      }
    },
    [isLoading, hasMore],
  );

  /* ── Helpers ──────────────────────────────────────────── */
  function statusLabel(s: string) {
    const map: Record<string, string> = {
      ACTIVE: tconv('statusActive'),
      HANDED_OFF: tconv('statusHandedOff'),
      WAITING: tconv('statusWaiting'),
      RESOLVED: tconv('statusResolved'),
      ARCHIVED: tconv('statusArchived'),
    };
    return map[s] ?? s;
  }

  function clearFilters() {
    setStatus('');
  }

  const hasActiveFilters = status;

  /* ── Error state ──────────────────────────────────────── */
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <p className="text-destructive font-medium mb-2">{tc('error')}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary hover:underline"
        >
          {tc('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg p-2 hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Search bar ────────────────────────────────── */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border bg-background ps-10 pe-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* ── Filter button ─────────────────────────────── */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors',
              hasActiveFilters && 'border-primary text-primary bg-primary/5',
            )}
          >
            <Filter className="h-4 w-4" />
            {t('filters')}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors"
            >
              <X className="h-4 w-4" />
              {tc('clear')}
            </button>
          )}
        </div>

        {/* ── Expanded filters ──────────────────────────── */}
        {showFilters && (
          <div className="px-4 pb-3">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">
                {tconv('status')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{tconv('allStatuses')}</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Conversation list ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4" onScroll={handleScroll}>
        {isLoading && page === 1 ? (
          /* Loading skeleton */
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageCircle className="h-16 w-16 mb-4 opacity-40" />
            <p className="text-sm font-medium mb-1">{t('noConversations')}</p>
            <p className="text-xs">{t('noConversationsHint')}</p>
          </div>
        ) : (
          /* Conversation cards */
          <div className="space-y-3">
            {conversations.map((conv: any) => (
              <ConversationCard key={conv.id} conversation={conv} statusLabel={statusLabel} />
            ))}

            {/* Loading more indicator */}
            {isLoading && page > 1 && (
              <div className="flex justify-center py-4">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && conversations.length > 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground">{t('endOfList')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
