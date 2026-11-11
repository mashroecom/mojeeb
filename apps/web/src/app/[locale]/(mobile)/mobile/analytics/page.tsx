'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Mail,
  MessageSquare,
  MessagesSquare,
  PieChart,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useMobileAnalytics, useMobileStats } from '@/hooks/useMobile';
import { AnalyticsWidget, ChartWidget, EmptyState } from '@/components/mobile/AnalyticsWidget';
import { MobileNav } from '@/components/mobile/MobileNav';
import { cn } from '@/lib/utils';

/** Presentation for each metric returned by GET /mobile/analytics/dashboard */
const METRICS: Record<string, { icon: LucideIcon; color: string; bg: string; hasTrend: boolean }> =
  {
    totalConversations: {
      icon: MessageSquare,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
      hasTrend: true,
    },
    totalMessages: {
      icon: Mail,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
      hasTrend: true,
    },
    activeConversations: {
      icon: Activity,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      hasTrend: false,
    },
    resolvedConversations: {
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      hasTrend: false,
    },
    avgMessagesPerConversation: {
      icon: MessagesSquare,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      hasTrend: true,
    },
    conversationsToday: {
      icon: CalendarDays,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      hasTrend: false,
    },
  };

const STATUS_ORDER = ['ACTIVE', 'HANDED_OFF', 'WAITING', 'RESOLVED', 'ARCHIVED'] as const;

const STATUS_BAR_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  HANDED_OFF: 'bg-orange-500',
  WAITING: 'bg-yellow-500',
  RESOLVED: 'bg-blue-500',
  ARCHIVED: 'bg-muted-foreground/50',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  ACTIVE: 'statusActive',
  HANDED_OFF: 'statusHandedOff',
  WAITING: 'statusWaiting',
  RESOLVED: 'statusResolved',
  ARCHIVED: 'statusArchived',
};

export default function MobileAnalyticsPage() {
  const t = useTranslations('mobile.analytics');
  const tConv = useTranslations('admin.conversations');
  const tCommon = useTranslations('admin.common');
  const locale = useLocale();

  const {
    data: metrics,
    isLoading: loadingMetrics,
    isFetching: fetchingMetrics,
    error: metricsError,
    refetch: refetchMetrics,
  } = useMobileAnalytics();
  const {
    data: stats,
    isLoading: loadingStats,
    isFetching: fetchingStats,
    refetch: refetchStats,
  } = useMobileStats();

  const refreshing = fetchingMetrics || fetchingStats;
  const handleRefresh = () => {
    refetchMetrics();
    refetchStats();
  };

  const formatValue = (value: number) =>
    value.toLocaleString(locale, { maximumFractionDigits: 1 });

  const formatTrend = (changePercent: number) => {
    const sign = changePercent > 0 ? '+' : '';
    return t('vsPrevious', {
      change: `${sign}${changePercent.toLocaleString(locale, { maximumFractionDigits: 1 })}%`,
    });
  };

  // Keep a stable card order even if the API adds or reorders metrics
  const cards = Object.keys(METRICS).map((key) => ({
    key,
    ...METRICS[key]!,
    metric: metrics?.find((m) => m.label === key),
  }));

  const statusCounts = new Map((stats?.byStatus ?? []).map((row) => [row.status, row._count]));
  const statusTotal = stats?.total ?? 0;

  if (metricsError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 pb-20">
        <p className="mb-2 font-medium text-destructive">{tCommon('error')}</p>
        <button onClick={handleRefresh} className="text-sm text-primary hover:underline">
          {tCommon('retry')}
        </button>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t('title')}</h1>
            <p className="text-xs text-muted-foreground">{t('period')}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
            aria-label={t('refresh')}
          >
            <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          {cards.map(({ key, icon, color, bg, hasTrend, metric }) => (
            <AnalyticsWidget
              key={key}
              title={t(`metrics.${key}`)}
              value={formatValue(metric?.value ?? 0)}
              subtitle={hasTrend && metric ? formatTrend(metric.changePercent) : undefined}
              icon={icon}
              color={color}
              bg={bg}
              isLoading={loadingMetrics}
            />
          ))}
        </div>

        {/* Conversations by status */}
        <ChartWidget title={t('byStatus')} icon={PieChart} isLoading={loadingStats}>
          {statusTotal === 0 ? (
            <EmptyState icon={BarChart3} message={t('noConversations')} />
          ) : (
            <ul className="space-y-3">
              {STATUS_ORDER.map((status) => {
                const count = statusCounts.get(status) ?? 0;
                const percent = statusTotal > 0 ? (count / statusTotal) * 100 : 0;
                return (
                  <li key={status}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{tConv(STATUS_LABEL_KEYS[status]!)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {count.toLocaleString(locale)}
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={Math.round(percent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={tConv(STATUS_LABEL_KEYS[status]!)}
                    >
                      <div
                        className={cn('h-full rounded-full', STATUS_BAR_COLORS[status])}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartWidget>
      </div>

      <MobileNav />
    </div>
  );
}
