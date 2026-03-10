'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateShort } from '@/lib/dateFormat';
import { useAdminOverview, useAdminGrowth, useAdminRevenue } from '@/hooks/useAdmin';
import { PLAN_COLORS } from '@/lib/admin-constants';
import { cn } from '@/lib/utils';
import {
  Users,
  Building2,
  MessageSquare,
  Mail,
  CreditCard,
  DollarSign,
  TrendingUp,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { AnalyticsWidget, ChartWidget, EmptyState } from '@/components/mobile/AnalyticsWidget';
import { MobileNav } from '@/components/mobile/MobileNav';

const GROUP_BY_OPTIONS = ['day', 'week', 'month'] as const;
type GroupBy = (typeof GROUP_BY_OPTIONS)[number];

export default function MobileAnalyticsPage() {
  const t = useTranslations('admin.analytics');
  const tOverview = useTranslations('admin.overview');
  const tCommon = useTranslations('admin.common');
  const locale = useLocale();
  const [groupBy, setGroupBy] = useState<GroupBy>('day');

  const {
    data: overview,
    isLoading: loadingOverview,
    error: overviewError,
    refetch: refetchOverview,
  } = useAdminOverview();
  const {
    data: growth,
    isLoading: loadingGrowth,
    refetch: refetchGrowth,
  } = useAdminGrowth({
    groupBy,
  });
  const { data: revenue, isLoading: loadingRevenue, refetch: refetchRevenue } = useAdminRevenue();

  const handleRefresh = () => {
    refetchOverview();
    refetchGrowth();
    refetchRevenue();
  };

  // Stat widgets
  const stats = [
    {
      key: 'totalUsers',
      label: tOverview('totalUsers'),
      value: overview?.totalUsers ?? 0,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      key: 'totalOrgs',
      label: tOverview('totalOrgs'),
      value: overview?.totalOrgs ?? 0,
      icon: Building2,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      key: 'totalConversations',
      label: tOverview('totalConversations'),
      value: overview?.totalConversations ?? 0,
      icon: MessageSquare,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      key: 'totalMessages',
      label: tOverview('totalMessages'),
      value: overview?.totalMessages ?? 0,
      icon: Mail,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    },
    {
      key: 'activeSubscriptions',
      label: tOverview('activeSubscriptions'),
      value: overview?.activeSubscriptions ?? 0,
      icon: CreditCard,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      key: 'totalRevenue',
      label: tOverview('totalRevenue'),
      value: overview?.totalRevenue ?? 0,
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      isCurrency: true,
    },
  ];

  // Growth chart data
  const growthData: any[] = growth?.growth ?? growth?.data ?? [];
  const maxGrowthValue =
    growthData.length > 0
      ? Math.max(
          ...growthData.map((d: any) =>
            Math.max(d.users ?? 0, d.organizations ?? 0, d.conversations ?? 0),
          ),
          1,
        )
      : 1;

  // Revenue / plan distribution
  const planDistribution: any[] = revenue?.planDistribution ?? revenue?.plans ?? [];

  if (overviewError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 pb-20">
        <p className="text-destructive font-medium mb-2">{tCommon('error')}</p>
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
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <button
            onClick={handleRefresh}
            disabled={loadingOverview || loadingGrowth || loadingRevenue}
            className="flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw
              className={cn(
                'h-5 w-5',
                (loadingOverview || loadingGrowth || loadingRevenue) && 'animate-spin',
              )}
            />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Stat Widgets */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <AnalyticsWidget
              key={stat.key}
              title={stat.label}
              value={
                stat.isCurrency
                  ? `${t('currencySymbol')}${Number(stat.value).toLocaleString(locale)}`
                  : Number(stat.value).toLocaleString(locale)
              }
              icon={stat.icon}
              color={stat.color}
              bg={stat.bg}
              isLoading={loadingOverview}
            />
          ))}
        </div>

        {/* Growth Chart */}
        <ChartWidget title={t('growth')} icon={TrendingUp} isLoading={loadingGrowth}>
          {/* Group By Toggle */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex rounded-lg border bg-muted/50 overflow-hidden">
              {GROUP_BY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setGroupBy(opt)}
                  className={cn(
                    'px-4 py-2 text-xs font-medium transition-colors',
                    groupBy === opt
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground active:text-foreground active:bg-muted',
                  )}
                >
                  {t(opt)}
                </button>
              ))}
            </div>
          </div>

          {growthData.length === 0 ? (
            <EmptyState icon={BarChart3} message={tCommon('noData')} />
          ) : (
            <>
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-blue-500" />
                  <span className="text-muted-foreground">{t('newUsers')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-purple-500" />
                  <span className="text-muted-foreground">{t('newOrgs')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-green-500" />
                  <span className="text-muted-foreground">{t('newConversations')}</span>
                </div>
              </div>

              {/* Chart */}
              <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
                {growthData.map((point: any, index: number) => {
                  const usersHeight = ((point.users ?? 0) / maxGrowthValue) * 100;
                  const orgsHeight = ((point.organizations ?? 0) / maxGrowthValue) * 100;
                  const convsHeight = ((point.conversations ?? 0) / maxGrowthValue) * 100;

                  return (
                    <div
                      key={point.date ?? index}
                      className="flex flex-col items-center flex-1 min-w-[40px]"
                    >
                      <div className="relative w-full flex justify-center items-end gap-0.5 flex-1">
                        {/* Users bar */}
                        <div
                          className="w-1/4 max-w-[10px] rounded-t bg-blue-500 dark:bg-blue-400 active:opacity-80 transition-opacity"
                          style={{ height: `${Math.max(usersHeight, 2)}%` }}
                        />
                        {/* Orgs bar */}
                        <div
                          className="w-1/4 max-w-[10px] rounded-t bg-purple-500 dark:bg-purple-400 active:opacity-80 transition-opacity"
                          style={{ height: `${Math.max(orgsHeight, 2)}%` }}
                        />
                        {/* Conversations bar */}
                        <div
                          className="w-1/4 max-w-[10px] rounded-t bg-green-500 dark:bg-green-400 active:opacity-80 transition-opacity"
                          style={{ height: `${Math.max(convsHeight, 2)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-1.5 truncate w-full text-center">
                        {point.date ? fmtDateShort(point.date, locale) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mobile-friendly data summary */}
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {growthData
                        .reduce((sum: number, d: any) => sum + (d.users ?? 0), 0)
                        .toLocaleString(locale)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t('newUsers')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {growthData
                        .reduce((sum: number, d: any) => sum + (d.organizations ?? 0), 0)
                        .toLocaleString(locale)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t('newOrgs')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {growthData
                        .reduce((sum: number, d: any) => sum + (d.conversations ?? 0), 0)
                        .toLocaleString(locale)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t('newConversations')}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </ChartWidget>

        {/* Plan Distribution */}
        <ChartWidget title={t('planDistribution')} icon={BarChart3} isLoading={loadingRevenue}>
          {planDistribution.length === 0 ? (
            <EmptyState icon={CreditCard} message={tCommon('noData')} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {planDistribution.map((plan: any) => {
                const planName = (plan.plan ?? plan.name ?? 'FREE').toUpperCase();
                const count = plan.count ?? plan._count ?? 0;
                return (
                  <div key={planName} className="rounded-lg border bg-card/50 p-4 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold mb-3',
                        PLAN_COLORS[planName] ?? PLAN_COLORS.FREE,
                      )}
                    >
                      {t(`plan_${planName}`)}
                    </span>
                    <p className="text-2xl font-bold">{Number(count).toLocaleString(locale)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('subscriptions')}</p>
                  </div>
                );
              })}
            </div>
          )}
        </ChartWidget>
      </div>

      <MobileNav />
    </div>
  );
}
