'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3, MessageSquare, Timer, Coins, Hash } from 'lucide-react';
import { useAdminMessageAnalyticsStats, useAdminMessageAnalyticsTrends } from '@/hooks/useAdmin';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminEmptyState,
} from '@/components/admin';
import { MojeebBarChart, MojeebLineChart } from '@/components/charts';
import {
  AnalyticsError,
  BarList,
  ChartBlock,
  RefreshButton,
  SectionTitle,
  providerLabel,
  useAnalyticsFormat,
} from '../_analytics/shared';

// ---------------------------------------------------------------------------
// Types — GET /admin/message-analytics/stats and /admin/message-analytics/trends
// ---------------------------------------------------------------------------

interface ProviderStat {
  count: number;
  avgLatency: number;
  avgTokens: number;
}

interface MessageStats {
  avgLatency: number;
  totalTokens: number;
  totalMessages: number;
  avgTokensPerMessage: number;
  messagesByProvider: Record<string, ProviderStat>;
  deliveryStatusBreakdown: Record<string, number>;
}

interface TrendRow {
  date: string;
  count: number;
  avgLatency: number;
  totalTokens: number;
}

interface ProviderRow extends ProviderStat {
  provider: string;
}

// Prisma DeliveryStatus enum, in pipeline order.
const DELIVERY_STATUSES = [
  { status: 'QUEUED', labelKey: 'deliveryStatus_pending', color: 'bg-slate-400' },
  { status: 'SENT', labelKey: 'deliveryStatus_sent', color: 'bg-blue-500' },
  { status: 'DELIVERED', labelKey: 'deliveryStatus_delivered', color: 'bg-emerald-500' },
  { status: 'READ', labelKey: 'deliveryStatus_read', color: 'bg-violet-500' },
  { status: 'FAILED', labelKey: 'deliveryStatus_failed', color: 'bg-red-500' },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminMessageAnalyticsPage() {
  const t = useTranslations('admin.messageAnalytics');
  const ta = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const fmt = useAnalyticsFormat();

  const statsQuery = useAdminMessageAnalyticsStats();
  const trendsQuery = useAdminMessageAnalyticsTrends();

  const stats = statsQuery.data as MessageStats | undefined;
  const trends = useMemo(
    () => (trendsQuery.data as TrendRow[] | undefined) ?? [],
    [trendsQuery.data],
  );

  const trendData = useMemo(
    () =>
      trends.map((row) => ({
        label: fmt.day(row.date),
        count: row.count,
        avgLatency: row.avgLatency,
        totalTokens: row.totalTokens,
      })),
    [trends, fmt],
  );

  const providerRows: ProviderRow[] = useMemo(
    () =>
      Object.entries(stats?.messagesByProvider ?? {})
        .map(([provider, value]) => ({ provider, ...value }))
        .sort((a, b) => b.count - a.count),
    [stats],
  );

  const deliveryItems = useMemo(() => {
    const breakdown = stats?.deliveryStatusBreakdown ?? {};
    const known = DELIVERY_STATUSES.map((s) => ({
      key: s.status,
      label: t(s.labelKey),
      value: breakdown[s.status] ?? 0,
      color: s.color,
    }));
    // Any status the API returns that this page does not know about yet.
    const extra = Object.entries(breakdown)
      .filter(([status]) => !DELIVERY_STATUSES.some((s) => s.status === status))
      .map(([status, value]) => ({ key: status, label: status, value, color: 'bg-slate-400' }));
    return [...known, ...extra];
  }, [stats, t]);

  const refetchAll = () => {
    statsQuery.refetch();
    trendsQuery.refetch();
  };
  const isFetching = statsQuery.isFetching || trendsQuery.isFetching;
  const isEmpty = !statsQuery.isLoading && (stats?.totalMessages ?? 0) === 0 && trends.length === 0;

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
              icon={MessageSquare}
              label={t('totalMessages')}
              value={fmt.num(stats?.totalMessages)}
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Timer}
              label={t('avgLatency')}
              value={t('latencyValue', { value: fmt.num(stats?.avgLatency) })}
              iconColor="text-amber-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Coins}
              label={t('totalTokens')}
              value={fmt.num(stats?.totalTokens)}
              iconColor="text-violet-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Hash}
              label={t('avgTokensPerMessage')}
              value={fmt.num(stats?.avgTokensPerMessage)}
              iconColor="text-emerald-500"
              loading={statsQuery.isLoading}
            />
          </div>

          {isEmpty ? (
            <div className="rounded-xl border bg-card shadow-sm">
              <AdminEmptyState icon={BarChart3} message={t('noData')} />
            </div>
          ) : (
            <div className="space-y-6">
              {trendsQuery.isError ? (
                <AnalyticsError
                  title={tc('error')}
                  retryLabel={tc('retry')}
                  onRetry={() => trendsQuery.refetch()}
                />
              ) : (
                <>
                  <ChartBlock title={t('messagesPerDay')}>
                    <MojeebLineChart
                      data={trendData}
                      xKey="label"
                      lines={[{ dataKey: 'count', name: t('totalMessages'), color: '#6366f1' }]}
                      isLoading={trendsQuery.isLoading}
                      emptyMessage={t('noTrend')}
                      showLegend={false}
                      height={260}
                    />
                  </ChartBlock>
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <ChartBlock title={t('latencyPerDay')}>
                      <MojeebLineChart
                        data={trendData}
                        xKey="label"
                        lines={[{ dataKey: 'avgLatency', name: t('avgLatency'), color: '#f59e0b' }]}
                        isLoading={trendsQuery.isLoading}
                        emptyMessage={t('noTrend')}
                        showLegend={false}
                        height={220}
                      />
                    </ChartBlock>
                    <ChartBlock title={t('tokensPerDay')}>
                      <MojeebBarChart
                        data={trendData}
                        xKey="label"
                        bars={[
                          { dataKey: 'totalTokens', name: t('totalTokens'), color: '#8b5cf6' },
                        ]}
                        isLoading={trendsQuery.isLoading}
                        emptyMessage={t('noTrend')}
                        showLegend={false}
                        height={220}
                      />
                    </ChartBlock>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                <div className="xl:col-span-3">
                  <SectionTitle title={t('byProvider')} />
                  <AdminDataTable<ProviderRow>
                    columns={[
                      {
                        key: 'provider',
                        header: t('provider'),
                        render: (row) => (
                          <span className="text-sm font-medium">
                            {providerLabel(row.provider, ta('unknown'))}
                          </span>
                        ),
                      },
                      {
                        key: 'count',
                        header: t('totalMessages'),
                        render: (row) => (
                          <span className="text-sm tabular-nums">{fmt.num(row.count)}</span>
                        ),
                      },
                      {
                        key: 'avgLatency',
                        header: t('avgLatency'),
                        render: (row) => (
                          <span className="text-sm tabular-nums">
                            {t('latencyValue', { value: fmt.num(row.avgLatency) })}
                          </span>
                        ),
                      },
                      {
                        key: 'avgTokens',
                        header: t('avgTokens'),
                        render: (row) => (
                          <span className="text-sm tabular-nums">{fmt.num(row.avgTokens)}</span>
                        ),
                      },
                    ]}
                    data={providerRows}
                    loading={statsQuery.isLoading}
                    rowKey={(row) => row.provider}
                    emptyMessage={t('noProviderData')}
                    skeletonRows={2}
                  />
                </div>

                <div className="xl:col-span-2">
                  <SectionTitle title={t('deliveryStatus')} />
                  <div className="rounded-xl border bg-card p-4 shadow-sm">
                    {statsQuery.isLoading ? (
                      <div className="space-y-4 animate-pulse">
                        {DELIVERY_STATUSES.map((s) => (
                          <div key={s.status} className="h-6 rounded bg-muted" />
                        ))}
                      </div>
                    ) : (
                      <BarList
                        items={deliveryItems}
                        total={stats?.totalMessages}
                        formatValue={fmt.num}
                        formatPercent={fmt.pct}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
