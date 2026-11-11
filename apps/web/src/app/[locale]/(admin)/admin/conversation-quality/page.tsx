'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Award, MessageSquare, MessagesSquare, Clock, Star, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/dateFormat';
import {
  useAdminConversationQualityStats,
  useAdminLowQualityConversations,
} from '@/hooks/useAdmin';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminPagination,
  AdminBadge,
} from '@/components/admin';
import {
  AnalyticsError,
  RefreshButton,
  SectionTitle,
  useAnalyticsFormat,
} from '../_analytics/shared';

// ---------------------------------------------------------------------------
// Types — GET /admin/conversation-quality/stats and /low-quality
// ---------------------------------------------------------------------------

interface QualityStats {
  totalConversations: number;
  avgMessages: number;
  avgResolutionMinutes: number;
  avgResolutionHours: number;
  avgRating: number;
  qualityTiers: { high: number; medium: number; low: number; total: number };
}

interface LowQualityConversation {
  conversationId: string;
  customerName: string | null;
  customerEmail: string | null;
  orgName: string;
  rating: number;
  feedback: string | null;
  messageCount: number;
  durationMinutes: number;
  status: string;
  createdAt: string;
}

interface LowQualityPage {
  conversations: LowQualityConversation[];
  total: number;
  page: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

const TIERS = [
  { key: 'high', labelKey: 'highQuality', hintKey: 'highQualityHint', color: 'bg-emerald-500' },
  { key: 'medium', labelKey: 'mediumQuality', hintKey: 'mediumQualityHint', color: 'bg-amber-400' },
  { key: 'low', labelKey: 'lowQuality', hintKey: 'lowQualityHint', color: 'bg-red-500' },
] as const;

// ConversationStatus enum -> existing admin.conversations labels
const STATUS_LABEL_KEYS: Record<string, string> = {
  ACTIVE: 'statusActive',
  HANDED_OFF: 'statusHandedOff',
  WAITING: 'statusWaiting',
  RESOLVED: 'statusResolved',
  ARCHIVED: 'statusArchived',
};

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-4 w-4',
            i < count ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminConversationQualityPage() {
  const t = useTranslations('admin.conversationQuality');
  const ta = useTranslations('admin');
  const tConv = useTranslations('admin.conversations');
  const tc = useTranslations('admin.common');
  const fmt = useAnalyticsFormat();

  const [page, setPage] = useState(1);

  const statsQuery = useAdminConversationQualityStats();
  const lowQuery = useAdminLowQualityConversations(page, PAGE_SIZE);

  const stats = statsQuery.data as QualityStats | undefined;
  const low = lowQuery.data as LowQualityPage | undefined;
  const conversations = low?.conversations ?? [];
  const tiers = stats?.qualityTiers;
  const ratedTotal = tiers?.total ?? 0;

  /** 45 -> "45 min", 150 -> "2.5 h", 4320 -> "3 d" */
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return t('minutesValue', { value: fmt.num(minutes) });
    if (minutes < 60 * 24) return t('hoursValue', { value: fmt.dec(minutes / 60) });
    return t('daysValue', { value: fmt.dec(minutes / (60 * 24)) });
  };

  const statusLabel = (status: string) => {
    const key = STATUS_LABEL_KEYS[status];
    return key ? tConv(key) : status;
  };

  const refetchAll = () => {
    statsQuery.refetch();
    lowQuery.refetch();
  };
  const isFetching = statsQuery.isFetching || lowQuery.isFetching;

  return (
    <div>
      <AdminPageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <RefreshButton label={tc('refresh')} onClick={refetchAll} isFetching={isFetching} />
        }
      />

      {statsQuery.isError ? (
        <AnalyticsError
          title={tc('error')}
          retryLabel={tc('retry')}
          onRetry={() => statsQuery.refetch()}
          className="mb-6"
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStatCard
              icon={MessagesSquare}
              label={t('totalConversations')}
              value={fmt.num(stats?.totalConversations)}
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={MessageSquare}
              label={t('avgMessages')}
              value={fmt.dec(stats?.avgMessages)}
              iconColor="text-blue-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Clock}
              label={t('avgResolutionTime')}
              value={stats?.avgResolutionMinutes ? formatDuration(stats.avgResolutionMinutes) : '—'}
              iconColor="text-amber-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Star}
              label={t('avgRating')}
              // LRI…PDI keeps "1.9 / 5" in that order inside RTL text.
              value={
                ratedTotal > 0
                  ? `\u2066${t('ratingValue', { value: fmt.dec(stats?.avgRating) })}\u2069`
                  : '—'
              }
              iconColor="text-yellow-500"
              loading={statsQuery.isLoading}
            />
          </div>

          {/* Quality tiers */}
          <div className="mb-6">
            <SectionTitle
              title={t('qualityScore')}
              hint={t('ratedConversations', { count: fmt.num(ratedTotal) })}
            />
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              {statsQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-pulse">
                  {TIERS.map((tier) => (
                    <div key={tier.key} className="h-16 rounded-lg bg-muted" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {TIERS.map((tier) => {
                      const count = tiers?.[tier.key] ?? 0;
                      const pct = ratedTotal > 0 ? (count / ratedTotal) * 100 : 0;
                      return (
                        <div key={tier.key} className="rounded-lg border bg-background p-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className={cn('h-2.5 w-2.5 rounded-full', tier.color)} />
                            {t(tier.labelKey)}
                          </div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tabular-nums">
                              {fmt.num(count)}
                            </span>
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {fmt.pct(pct)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{t(tier.hintKey)}</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Stacked share bar */}
                  <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
                    {ratedTotal > 0 &&
                      TIERS.map((tier) => (
                        <div
                          key={tier.key}
                          className={cn('h-full', tier.color)}
                          style={{ width: `${((tiers?.[tier.key] ?? 0) / ratedTotal) * 100}%` }}
                        />
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Low-quality conversations */}
      <SectionTitle title={t('lowQualityConversations')} hint={t('lowQualityListHint')} />
      {lowQuery.isError ? (
        <AnalyticsError
          title={tc('error')}
          retryLabel={tc('retry')}
          onRetry={() => lowQuery.refetch()}
        />
      ) : (
        <>
          <AdminDataTable<LowQualityConversation>
            columns={[
              {
                key: 'customer',
                header: t('customer'),
                render: (row) => (
                  <div className="min-w-0">
                    <Link
                      href={`/${fmt.locale}/admin/conversations/${row.conversationId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {row.customerName || ta('anonymous')}
                    </Link>
                    {row.customerEmail && (
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">
                        {row.customerEmail}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: 'organization',
                header: t('organization'),
                render: (row) => <span className="text-sm">{row.orgName}</span>,
              },
              {
                key: 'rating',
                header: t('rating'),
                render: (row) => <Stars count={row.rating} />,
              },
              {
                key: 'reason',
                header: t('reason'),
                render: (row) => (
                  <p
                    className="max-w-xs truncate text-sm text-muted-foreground"
                    dir="auto"
                    title={row.feedback ?? undefined}
                  >
                    {row.feedback || '—'}
                  </p>
                ),
              },
              {
                key: 'messageCount',
                header: t('messageCount'),
                render: (row) => (
                  <span className="text-sm tabular-nums">{fmt.num(row.messageCount)}</span>
                ),
              },
              {
                key: 'duration',
                header: t('duration'),
                className: 'whitespace-nowrap',
                render: (row) => (
                  <span className="text-sm tabular-nums">
                    {formatDuration(row.durationMinutes)}
                  </span>
                ),
              },
              {
                key: 'status',
                header: t('status'),
                render: (row) => (
                  <AdminBadge variant={row.status === 'RESOLVED' ? 'success' : 'default'}>
                    {statusLabel(row.status)}
                  </AdminBadge>
                ),
              },
              {
                key: 'date',
                header: t('date'),
                className: 'whitespace-nowrap',
                render: (row) => (
                  <span className="text-sm text-muted-foreground">
                    {fmtDate(row.createdAt, fmt.locale)}
                  </span>
                ),
              },
            ]}
            data={conversations}
            loading={lowQuery.isLoading}
            rowKey={(row) => `${row.conversationId}:${row.rating}:${row.feedback ?? ''}`}
            emptyIcon={
              ratedTotal > 0 ? (
                <ThumbsUp className="h-12 w-12 text-muted-foreground/40" />
              ) : (
                <Award className="h-12 w-12 text-muted-foreground/40" />
              )
            }
            emptyMessage={ratedTotal > 0 ? t('noLowQuality') : t('noData')}
          />
          <AdminPagination
            page={page}
            totalPages={low?.totalPages ?? 1}
            onPageChange={setPage}
            previousLabel={tc('previous')}
            nextLabel={tc('next')}
            pageLabel={tc('page')}
            ofLabel={tc('of')}
          />
        </>
      )}
    </div>
  );
}
