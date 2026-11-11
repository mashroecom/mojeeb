'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Cpu, MessageSquare, Timer, DollarSign } from 'lucide-react';
import { useAdminAIModelStats, useAdminAIModelUsage } from '@/hooks/useAdmin';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminEmptyState,
  AdminBadge,
} from '@/components/admin';
import { MojeebBarChart } from '@/components/charts';
import {
  AnalyticsError,
  ChartBlock,
  RefreshButton,
  SectionTitle,
  providerLabel,
  useAnalyticsFormat,
} from '../_analytics/shared';

// ---------------------------------------------------------------------------
// Types — GET /admin/ai-models/stats and /admin/ai-models/usage
// ---------------------------------------------------------------------------

interface ModelStat {
  model: string;
  provider: string;
  totalMessages: number;
  avgLatency: number;
  avgTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

interface ModelStats {
  models: ModelStat[];
  totalAIMessages: number;
  avgResponseTime: number;
  totalCost: number;
}

interface UsageRow {
  date: string;
  model: string;
  provider: string;
  count: number;
  totalTokens: number;
}

const SERIES_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminAIModelsPage() {
  const t = useTranslations('admin.aiModels');
  const ta = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const fmt = useAnalyticsFormat();

  const statsQuery = useAdminAIModelStats();
  const usageQuery = useAdminAIModelUsage();

  const stats = statsQuery.data as ModelStats | undefined;
  const models = useMemo(() => stats?.models ?? [], [stats]);
  const usage = useMemo(() => (usageQuery.data as UsageRow[] | undefined) ?? [], [usageQuery.data]);

  const modelName = (model: string) => (model === 'unknown' ? ta('unknown') : model);
  const formatCost = (n: number) =>
    `${t('currencySymbol')}${new Intl.NumberFormat(fmt.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(n ?? 0)}`;

  // Pivot the per-day/per-model rows into one row per day with one series per model.
  // Series use index-based keys because model names contain dots (e.g. "gpt-3.5-turbo"),
  // which recharts would treat as a nested property path.
  const chart = useMemo(() => {
    const seriesNames = Array.from(new Set(usage.map((r) => r.model)));
    const byDay = new Map<string, Record<string, string | number>>();
    for (const row of usage) {
      let point = byDay.get(row.date);
      if (!point) {
        const created: Record<string, string | number> = { label: fmt.day(row.date) };
        seriesNames.forEach((_, i) => {
          created[`s${i}`] = 0;
        });
        byDay.set(row.date, created);
        point = created;
      }
      const key = `s${seriesNames.indexOf(row.model)}`;
      point[key] = Number(point[key] ?? 0) + row.count;
    }
    return { seriesNames, data: Array.from(byDay.values()) };
  }, [usage, fmt]);

  const refetchAll = () => {
    statsQuery.refetch();
    usageQuery.refetch();
  };
  const isFetching = statsQuery.isFetching || usageQuery.isFetching;
  const isEmpty = !statsQuery.isLoading && models.length === 0 && usage.length === 0;

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
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AdminStatCard
              icon={MessageSquare}
              label={t('totalMessages')}
              value={fmt.num(stats?.totalAIMessages)}
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Timer}
              label={t('avgLatency')}
              value={t('latencyValue', { value: fmt.num(stats?.avgResponseTime) })}
              iconColor="text-amber-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={DollarSign}
              label={t('estimatedCost')}
              value={formatCost(stats?.totalCost ?? 0)}
              iconColor="text-emerald-500"
              loading={statsQuery.isLoading}
            />
          </div>

          {isEmpty ? (
            <div className="rounded-xl border bg-card shadow-sm">
              <AdminEmptyState icon={Cpu} message={t('noData')} />
            </div>
          ) : (
            <div className="space-y-6">
              {usageQuery.isError ? (
                <AnalyticsError
                  title={tc('error')}
                  retryLabel={tc('retry')}
                  onRetry={() => usageQuery.refetch()}
                />
              ) : (
                <ChartBlock title={t('usageTrend')}>
                  <MojeebBarChart
                    data={chart.data}
                    xKey="label"
                    bars={chart.seriesNames.map((name, i) => ({
                      dataKey: `s${i}`,
                      name: modelName(name),
                      color: SERIES_COLORS[i % SERIES_COLORS.length],
                      stackId: 'messages',
                    }))}
                    isLoading={usageQuery.isLoading}
                    emptyMessage={t('noUsage')}
                    height={280}
                  />
                </ChartBlock>
              )}

              <div>
                <SectionTitle title={t('modelPerformance')} />
                <AdminDataTable<ModelStat>
                  columns={[
                    {
                      key: 'model',
                      header: t('model'),
                      render: (row) => (
                        <span className="text-sm font-medium" dir="ltr">
                          {modelName(row.model)}
                        </span>
                      ),
                    },
                    {
                      key: 'provider',
                      header: t('provider'),
                      render: (row) => (
                        <AdminBadge variant="info">
                          {providerLabel(row.provider, ta('unknown'))}
                        </AdminBadge>
                      ),
                    },
                    {
                      key: 'totalMessages',
                      header: t('totalMessages'),
                      render: (row) => (
                        <span className="text-sm tabular-nums">{fmt.num(row.totalMessages)}</span>
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
                    {
                      key: 'totalTokens',
                      header: t('totalTokens'),
                      render: (row) => (
                        <span className="text-sm tabular-nums">{fmt.num(row.totalTokens)}</span>
                      ),
                    },
                    {
                      key: 'estimatedCost',
                      header: t('estimatedCost'),
                      render: (row) => (
                        <span className="text-sm font-medium tabular-nums">
                          {formatCost(row.estimatedCost)}
                        </span>
                      ),
                    },
                  ]}
                  data={models}
                  loading={statsQuery.isLoading}
                  rowKey={(row) => `${row.provider}:${row.model}`}
                  emptyMessage={t('noData')}
                  skeletonRows={3}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
