'use client';

import { useTranslations, useLocale } from 'next-intl';
import { fmtDateShort, fmtDate } from '@/lib/dateFormat';
import {
  useAdminOverview,
  useAdminGrowth,
  useAdminRevenue,
} from '@/hooks/useAdmin';
import { PLAN_COLORS } from '@/lib/admin-constants';
import { cn } from '@/lib/utils';
import {
  Users,
  Building2,
  MessageSquare,
  Mail,
  CreditCard,
  DollarSign,
  Loader2,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-6">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-6 w-16 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const t = useTranslations('admin.analytics');
  const tOverview = useTranslations('admin.overview');
  const tCommon = useTranslations('admin.common');
  const locale = useLocale();

  const { data: overview, isLoading: loadingOverview, error: overviewError } = useAdminOverview();
  const { data: growth, isLoading: loadingGrowth } = useAdminGrowth();
  const { data: revenue, isLoading: loadingRevenue } = useAdminRevenue();

  // Stat cards (same 6 as overview page)
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
  const maxGrowthValue = growthData.length > 0
    ? Math.max(
        ...growthData.map((d: any) =>
          Math.max(d.users ?? 0, d.organizations ?? 0, d.conversations ?? 0)
        ),
        1
      )
    : 1;

  // Revenue / plan distribution
  const planDistribution: any[] = revenue?.planDistribution ?? revenue?.plans ?? [];

  if (overviewError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tCommon('error')}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary hover:underline"
        >
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {/* Stat Cards */}
      {loadingOverview ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.key} className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-4">
                  <div className={cn('rounded-lg p-2.5', stat.bg)}>
                    <Icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-0.5">
                      {stat.isCurrency
                        ? `$${Number(stat.value).toLocaleString()}`
                        : Number(stat.value).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Growth Chart & Table */}
      <div className="mt-8 rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('growth')}</h2>
        </div>

        {loadingGrowth ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : growthData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">{tCommon('noData')}</p>
          </div>
        ) : (
          <>
            {/* Bar Chart */}
            <div className="mb-8">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
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
              <div className="flex items-end gap-1 h-52 overflow-x-auto pb-2">
                {growthData.map((point: any, index: number) => {
                  const usersHeight = ((point.users ?? 0) / maxGrowthValue) * 100;
                  const orgsHeight = ((point.organizations ?? 0) / maxGrowthValue) * 100;
                  const convsHeight = ((point.conversations ?? 0) / maxGrowthValue) * 100;

                  return (
                    <div
                      key={point.date ?? index}
                      className="flex flex-col items-center flex-1 min-w-[48px] group"
                    >
                      <div className="relative w-full flex justify-center items-end gap-0.5 flex-1">
                        {/* Users bar */}
                        <div
                          className="w-1/4 max-w-[12px] rounded-t bg-blue-500 dark:bg-blue-400 transition-all hover:opacity-80"
                          style={{ height: `${Math.max(usersHeight, 2)}%` }}
                          title={`${t('newUsers')}: ${point.users ?? 0}`}
                        />
                        {/* Orgs bar */}
                        <div
                          className="w-1/4 max-w-[12px] rounded-t bg-purple-500 dark:bg-purple-400 transition-all hover:opacity-80"
                          style={{ height: `${Math.max(orgsHeight, 2)}%` }}
                          title={`${t('newOrgs')}: ${point.organizations ?? 0}`}
                        />
                        {/* Conversations bar */}
                        <div
                          className="w-1/4 max-w-[12px] rounded-t bg-green-500 dark:bg-green-400 transition-all hover:opacity-80"
                          style={{ height: `${Math.max(convsHeight, 2)}%` }}
                          title={`${t('newConversations')}: ${point.conversations ?? 0}`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1.5 truncate w-full text-center">
                        {point.date
                          ? fmtDateShort(point.date, locale)
                          : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Growth Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t('date')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t('newUsers')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t('newOrgs')}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t('newConversations')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {growthData.map((point: any, index: number) => (
                    <tr
                      key={point.date ?? index}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {point.date
                          ? fmtDate(point.date, locale)
                          : '-'}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {(point.users ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {(point.organizations ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {(point.conversations ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Plan Distribution */}
      <div className="mt-8 rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('planDistribution')}</h2>
        </div>

        {loadingRevenue ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : planDistribution.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CreditCard className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">{tCommon('noData')}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {planDistribution.map((plan: any) => {
              const planName = (plan.plan ?? plan.name ?? 'FREE').toUpperCase();
              const count = plan.count ?? plan._count ?? 0;
              return (
                <div
                  key={planName}
                  className="rounded-lg border bg-card p-5 flex-1 min-w-[180px]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                        PLAN_COLORS[planName] ?? PLAN_COLORS.FREE
                      )}
                    >
                      {planName}
                    </span>
                  </div>
                  <p className="text-3xl font-bold">
                    {Number(count).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('subscriptions')}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
