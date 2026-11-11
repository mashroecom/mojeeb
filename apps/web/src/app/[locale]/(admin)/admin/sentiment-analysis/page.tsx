'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Heart, Smile, Frown, Meh, ScanSearch, ExternalLink } from 'lucide-react';
import { fmtDateTime } from '@/lib/dateFormat';
import { useAdminSentimentStats, useAdminSentimentTrends } from '@/hooks/useAdmin';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminEmptyState,
  AdminBadge,
} from '@/components/admin';
import {
  AnalyticsError,
  BarList,
  RefreshButton,
  SectionTitle,
  useAnalyticsFormat,
} from '../_analytics/shared';

// ---------------------------------------------------------------------------
// Types — GET /admin/sentiment-analysis/stats and /admin/sentiment-analysis/trends
// ---------------------------------------------------------------------------

interface SentimentStats {
  totalAnalyzed: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  emotionDistribution: Record<string, number>;
}

interface NegativeConversation {
  id: string;
  conversationId: string;
  visitorName: string | null;
  emotion: string | null;
  messagePreview: string;
  createdAt: string;
}

interface SentimentTrends {
  recentNegative: NegativeConversation[];
}

// Emotions the AI emits (see apps/api/src/ai/prompts/emotion.ts).
const EMOTIONS: Record<string, { labelKey: string; color: string }> = {
  happy: { labelKey: 'emotion_happy', color: 'bg-emerald-500' },
  satisfied: { labelKey: 'emotion_satisfied', color: 'bg-lime-500' },
  neutral: { labelKey: 'emotion_neutral', color: 'bg-slate-400' },
  confused: { labelKey: 'emotion_confused', color: 'bg-amber-400' },
  urgent: { labelKey: 'emotion_urgent', color: 'bg-orange-500' },
  frustrated: { labelKey: 'emotion_frustrated', color: 'bg-rose-400' },
  sad: { labelKey: 'emotion_sad', color: 'bg-blue-500' },
  angry: { labelKey: 'emotion_angry', color: 'bg-red-600' },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminSentimentAnalysisPage() {
  const t = useTranslations('admin.sentimentAnalysis');
  const ta = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const fmt = useAnalyticsFormat();

  const statsQuery = useAdminSentimentStats();
  const trendsQuery = useAdminSentimentTrends();

  const stats = statsQuery.data as SentimentStats | undefined;
  const recentNegative = (trendsQuery.data as SentimentTrends | undefined)?.recentNegative ?? [];

  const emotionLabel = (emotion: string | null) => {
    if (!emotion) return ta('unknown');
    const known = EMOTIONS[emotion];
    return known ? t(known.labelKey) : emotion;
  };

  const emotionItems = useMemo(
    () =>
      Object.entries(stats?.emotionDistribution ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([emotion, value]) => {
          const known = EMOTIONS[emotion];
          return {
            key: emotion,
            label: known ? t(known.labelKey) : emotion,
            value,
            color: known?.color ?? 'bg-slate-400',
          };
        }),
    [stats, t],
  );

  const refetchAll = () => {
    statsQuery.refetch();
    trendsQuery.refetch();
  };
  const isFetching = statsQuery.isFetching || trendsQuery.isFetching;

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
        <AnalyticsError title={tc('error')} retryLabel={tc('retry')} onRetry={refetchAll} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStatCard
              icon={ScanSearch}
              label={t('totalAnalyzed')}
              value={fmt.num(stats?.totalAnalyzed)}
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Smile}
              label={t('positive')}
              value={fmt.pct(stats?.positivePct)}
              iconColor="text-emerald-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Frown}
              label={t('negative')}
              value={fmt.pct(stats?.negativePct)}
              iconColor="text-red-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Meh}
              label={t('neutral')}
              value={fmt.pct(stats?.neutralPct)}
              iconColor="text-slate-400"
              loading={statsQuery.isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <SectionTitle title={t('emotionDistribution')} />
              <div className="rounded-xl border bg-card shadow-sm">
                {statsQuery.isLoading ? (
                  <div className="space-y-4 p-4 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-6 rounded bg-muted" />
                    ))}
                  </div>
                ) : emotionItems.length === 0 ? (
                  <AdminEmptyState icon={Heart} message={t('noData')} />
                ) : (
                  <div className="p-4">
                    <BarList
                      items={emotionItems}
                      total={stats?.totalAnalyzed}
                      formatValue={fmt.num}
                      formatPercent={fmt.pct}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="xl:col-span-3">
              <SectionTitle title={t('recentNegative')} />
              {trendsQuery.isError ? (
                <AnalyticsError
                  title={tc('error')}
                  retryLabel={tc('retry')}
                  onRetry={() => trendsQuery.refetch()}
                />
              ) : (
                <AdminDataTable<NegativeConversation>
                  columns={[
                    {
                      key: 'conversation',
                      header: t('conversation'),
                      className: 'whitespace-nowrap',
                      render: (row) => (
                        <Link
                          href={`/${fmt.locale}/admin/conversations/${row.conversationId}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          {row.visitorName || ta('anonymous')}
                          <ExternalLink className="h-3 w-3 shrink-0 rtl:-scale-x-100" />
                        </Link>
                      ),
                    },
                    {
                      key: 'emotion',
                      header: t('emotion'),
                      render: (row) => (
                        <AdminBadge variant="error">{emotionLabel(row.emotion)}</AdminBadge>
                      ),
                    },
                    {
                      key: 'message',
                      header: t('message'),
                      render: (row) => (
                        <p
                          className="max-w-xs truncate text-sm text-muted-foreground"
                          dir="auto"
                          title={row.messagePreview}
                        >
                          {row.messagePreview || '—'}
                        </p>
                      ),
                    },
                    {
                      key: 'date',
                      header: t('date'),
                      className: 'whitespace-nowrap',
                      render: (row) => (
                        <span className="text-sm text-muted-foreground">
                          {fmtDateTime(row.createdAt, fmt.locale)}
                        </span>
                      ),
                    },
                  ]}
                  data={recentNegative}
                  loading={trendsQuery.isLoading}
                  rowKey={(row) => row.id}
                  emptyIcon={<Smile className="h-12 w-12 text-muted-foreground/40" />}
                  emptyMessage={t('noNegative')}
                  skeletonRows={4}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
