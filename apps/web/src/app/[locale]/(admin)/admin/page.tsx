'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtTime, fmtDateShort } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import { PLAN_COLORS } from '@/lib/admin-constants';
import {
  useAdminDashboardOverview,
  useAdminSparkline,
  useAdminSignupsOverTime,
  useAdminRevenueOverTime,
  useAdminSubscriptionsByPlan,
  useAdminTokenUsageOverTime,
  useAdminTopUsersByUsage,
  useAdminPlatformHeatmap,
  useAdminRecentEvents,
} from '@/hooks/useAdmin';
import {
  SparklineChart,
  MojeebLineChart,
  MojeebBarChart,
  MojeebDonutChart,
  MojeebHeatmapChart,
} from '@/components/charts';
import {
  Clock,
  Users,
  CreditCard,
  DollarSign,
  MessageSquare,
  Zap,
  TrendingUp,
  Activity,
  UserPlus,
  Mail,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCompact(n: number, locale?: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat(locale).format(n);
}

function formatCurrency(n: number, locale?: string): string {
  return `$${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatValue(
  n: number,
  format?: 'number' | 'currency' | 'percentage',
  locale?: string,
): string {
  if (format === 'currency') return formatCurrency(n, locale);
  if (format === 'percentage') return `${n.toFixed(1)}%`;
  return formatCompact(n, locale);
}

function timeAgo(
  dateStr: string,
  t: (key: string, values?: Record<string, number>) => string,
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return t('dashboard.daysAgo', { count: days });
  if (hours > 0) return t('dashboard.hoursAgo', { count: hours });
  if (minutes > 0) return t('dashboard.minutesAgo', { count: minutes });
  return t('dashboard.justNow');
}

// ---------------------------------------------------------------------------
// Stat Card Icons (mapping)
// ---------------------------------------------------------------------------

const STAT_ICONS: Record<string, { icon: typeof Users; color: string; bg: string }> = {
  totalUsers: {
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  activeSubscriptions: {
    icon: CreditCard,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
  },
  monthlyRevenue: {
    icon: DollarSign,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  totalConversations: {
    icon: MessageSquare,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  totalTokensUsed: {
    icon: Zap,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
  },
  totalCost: {
    icon: DollarSign,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
  activeUsersToday: {
    icon: Activity,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  totalMessages: {
    icon: Mail,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
};

const STAT_FORMATS: Record<string, 'number' | 'currency' | 'percentage'> = {
  monthlyRevenue: 'currency',
  totalCost: 'currency',
};

// Plan colors for donut chart
const PLAN_DONUT_COLORS: Record<string, string> = {
  FREE: '#94a3b8',
  STARTER: '#6366f1',
  PROFESSIONAL: '#8b5cf6',
  ENTERPRISE: '#f59e0b',
};

// Activity event type config
const EVENT_TYPE_CONFIG: Record<string, { bg: string; color: string }> = {
  user_joined: { bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
  user_signup: { bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
  org_created: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    color: 'text-purple-600 dark:text-purple-400',
  },
  conversation_created: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    color: 'text-green-600 dark:text-green-400',
  },
  subscription_created: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    color: 'text-orange-600 dark:text-orange-400',
  },
  payment_received: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  agent_created: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  message_sent: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    color: 'text-cyan-600 dark:text-cyan-400',
  },
};

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-7 w-20 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
        <div className="h-10 w-10 rounded-lg bg-muted" />
      </div>
      <div className="mt-3 h-10 w-full rounded bg-muted" />
    </div>
  );
}

function ChartSkeleton({ title }: { title?: string }) {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-6">
      <div className="h-5 w-48 rounded bg-muted mb-6" />
      <div className="h-[280px] w-full rounded bg-muted" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-6">
      <div className="h-5 w-40 rounded bg-muted mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-6">
      <div className="h-5 w-36 rounded bg-muted mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-48 rounded bg-muted" />
              <div className="h-2 w-24 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  change,
  sparklineData,
  icon,
  format,
}: {
  label: string;
  value: number;
  change: number;
  sparklineData?: { value: number }[];
  icon: React.ReactNode;
  format?: 'number' | 'currency' | 'percentage';
}) {
  const isPositive = change >= 0;
  const locale = useLocale();

  return (
    <div className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">
            {formatValue(value, format, locale)}
          </p>
          <div
            className={cn(
              'flex items-center gap-1 mt-1 text-xs font-medium',
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
            )}
          >
            <svg
              className={cn('h-3.5 w-3.5', !isPositive && 'rotate-180')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        </div>
        <div>{icon}</div>
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-3">
          <SparklineChart data={sparklineData} height={40} width={160} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline data wrapper
// ---------------------------------------------------------------------------

function SparklineDataProvider({
  metric,
  children,
}: {
  metric: string;
  children: (data: { value: number }[] | undefined) => React.ReactNode;
}) {
  const { data } = useAdminSparkline(metric);
  return <>{children(data)}</>;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const t = useTranslations('admin');
  const locale = useLocale();

  // Data hooks
  const { data: overview, isLoading: loadingOverview, dataUpdatedAt } = useAdminDashboardOverview();

  const { data: signupsData, isLoading: loadingSignups } = useAdminSignupsOverTime();
  const { data: revenueData, isLoading: loadingRevenue } = useAdminRevenueOverTime();
  const { data: subsByPlan, isLoading: loadingSubs } = useAdminSubscriptionsByPlan();
  const { data: tokenUsageData, isLoading: loadingTokenUsage } = useAdminTokenUsageOverTime();
  const { data: topUsers, isLoading: loadingTopUsers } = useAdminTopUsersByUsage();
  const { data: heatmapData, isLoading: loadingHeatmap } = useAdminPlatformHeatmap();
  const { data: recentEvents, isLoading: loadingEvents } = useAdminRecentEvents();

  // Normalize overview stats into structured array
  const stats = useMemo(() => {
    if (!overview || !Array.isArray(overview)) return [];
    return overview as Array<{
      label: string;
      value: number;
      previousValue: number;
      changePercent: number;
    }>;
  }, [overview]);

  // Normalize donut chart data
  const donutData = useMemo(() => {
    if (!subsByPlan || !Array.isArray(subsByPlan)) return [];
    return (subsByPlan as Array<{ plan: string; count: number }>).map((item) => ({
      name: item.plan,
      value: item.count,
      color: PLAN_DONUT_COLORS[item.plan] ?? '#94a3b8',
    }));
  }, [subsByPlan]);

  // Event types list
  const events = useMemo(() => {
    if (!recentEvents || !Array.isArray(recentEvents)) return [];
    return recentEvents as Array<{
      type: string;
      description: string;
      timestamp: string;
      metadata?: object;
    }>;
  }, [recentEvents]);

  // Top users data
  const topUsersData = useMemo(() => {
    if (!topUsers || !Array.isArray(topUsers)) return [];
    return topUsers as Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      orgName: string;
      plan: string;
      totalMessages: number;
      totalTokens: number;
      totalCost: number;
    }>;
  }, [topUsers]);

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            {t('dashboard.autoRefresh')}
          </span>
          {dataUpdatedAt > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t('dashboard.lastUpdated')} {fmtTime(dataUpdatedAt, locale)}
            </span>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Stat Cards (8 cards)                                          */}
      {/* ---------------------------------------------------------------- */}
      {loadingOverview ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const iconConfig = STAT_ICONS[stat.label] ?? STAT_ICONS.totalUsers;
            const Icon = iconConfig.icon;
            const format = STAT_FORMATS[stat.label];

            // Human-readable labels from i18n
            const labelMap: Record<string, string> = {
              totalUsers: t('dashboard.totalUsers'),
              activeSubscriptions: t('dashboard.activeSubscriptions'),
              monthlyRevenue: t('dashboard.monthlyRevenue'),
              totalConversations: t('dashboard.totalConversations'),
              totalTokensUsed: t('dashboard.totalTokens'),
              totalCost: t('dashboard.totalCost'),
              activeUsersToday: t('dashboard.activeUsersToday'),
              totalMessages: t('dashboard.totalMessages'),
            };

            return (
              <SparklineDataProvider key={stat.label} metric={stat.label}>
                {(sparklineData) => (
                  <StatCard
                    label={labelMap[stat.label] ?? stat.label}
                    value={stat.value}
                    change={stat.changePercent}
                    sparklineData={sparklineData}
                    format={format}
                    icon={
                      <div className={cn('rounded-lg p-2.5', iconConfig.bg)}>
                        <Icon className={cn('h-5 w-5', iconConfig.color)} />
                      </div>
                    }
                  />
                )}
              </SparklineDataProvider>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 2. Charts Row 1: Signups + Revenue                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Signups Line Chart */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">{t('dashboard.userSignups')}</h2>
          </div>
          {loadingSignups ? (
            <div className="h-[280px] w-full rounded bg-muted animate-pulse" />
          ) : (
            <MojeebLineChart
              data={signupsData ?? []}
              xKey="date"
              lines={[{ key: 'count', color: '#3b82f6', name: t('dashboard.signups') }]}
              height={280}
              formatX={(val) => fmtDateShort(val, locale)}
              noDataMessage={t('dashboard.noData')}
            />
          )}
        </div>

        {/* Revenue Over Time Line Chart */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold">{t('dashboard.revenueOverTime')}</h2>
          </div>
          {loadingRevenue ? (
            <div className="h-[280px] w-full rounded bg-muted animate-pulse" />
          ) : (
            <MojeebLineChart
              data={revenueData ?? []}
              xKey="date"
              lines={[{ key: 'revenue', color: '#10b981', name: t('dashboard.revenueDollar') }]}
              height={280}
              formatX={(val) => fmtDateShort(val, locale)}
              formatY={(val) => `$${formatCompact(val, locale)}`}
              noDataMessage={t('dashboard.noData')}
            />
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Charts Row 2: Subscriptions Donut + Token Usage Bar           */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Subscriptions by Plan Donut */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold">{t('dashboard.subscriptionsByPlan')}</h2>
          </div>
          {loadingSubs ? (
            <div className="h-[280px] w-full rounded bg-muted animate-pulse" />
          ) : (
            <MojeebDonutChart
              data={donutData}
              height={280}
              innerRadius={70}
              outerRadius={110}
              noDataMessage={t('dashboard.noData')}
            />
          )}
        </div>

        {/* Token Usage Over Time Bar Chart */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">{t('dashboard.tokenUsageOverTime')}</h2>
          </div>
          {loadingTokenUsage ? (
            <div className="h-[280px] w-full rounded bg-muted animate-pulse" />
          ) : (
            <MojeebBarChart
              data={tokenUsageData ?? []}
              xKey="date"
              bars={[
                {
                  key: 'inputTokens',
                  color: '#6366f1',
                  name: t('dashboard.inputTokens'),
                  stackId: 'stack',
                },
                {
                  key: 'outputTokens',
                  color: '#a78bfa',
                  name: t('dashboard.outputTokens'),
                  stackId: 'stack',
                },
              ]}
              height={280}
              formatX={(val) => fmtDateShort(val, locale)}
              formatY={(val) => formatCompact(val, locale)}
              noDataMessage={t('dashboard.noData')}
            />
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 4. Charts Row 3: Top Users Table + Heatmap                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Users Table */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold">{t('dashboard.topUsers')}</h2>
          </div>
          {loadingTopUsers ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between py-2">
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-4 w-20 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : topUsersData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{t('dashboard.noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-start px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      {t('dashboard.user')}
                    </th>
                    <th className="text-start px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">
                      {t('dashboard.plan')}
                    </th>
                    <th className="text-end px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      {t('dashboard.messages')}
                    </th>
                    <th className="text-end px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">
                      {t('dashboard.tokens')}
                    </th>
                    <th className="text-end px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">
                      {t('dashboard.cost')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topUsersData.map((user, idx) => (
                    <tr key={user.id ?? idx} className="hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="font-medium truncate max-w-[180px]">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {user.orgName}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                            PLAN_COLORS[user.plan] ?? PLAN_COLORS.FREE,
                          )}
                        >
                          {t(`plan_${user.plan}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-end font-semibold tabular-nums">
                        {formatCompact(user.totalMessages, locale)}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums hidden md:table-cell">
                        {formatCompact(user.totalTokens, locale)}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums hidden lg:table-cell">
                        {formatCurrency(user.totalCost, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Platform Activity Heatmap */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold">{t('dashboard.platformActivity')}</h2>
          </div>
          {loadingHeatmap ? (
            <div className="h-[260px] w-full rounded bg-muted animate-pulse" />
          ) : (
            <MojeebHeatmapChart data={heatmapData ?? []} height={260} />
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Recent Activity Feed                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('dashboard.recentActivity')}</h2>
          </div>
          {loadingEvents ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-48 rounded bg-muted" />
                    <div className="h-2 w-24 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{t('dashboard.noActivity')}</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {events.map((event, idx) => {
                const config =
                  EVENT_TYPE_CONFIG[event.type] ?? EVENT_TYPE_CONFIG.conversation_created;
                return (
                  <div
                    key={`${event.type}-${idx}`}
                    className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0',
                        config.bg,
                      )}
                    >
                      <span className={cn('text-sm', config.color)}>
                        {event.type === 'user_joined' || event.type === 'user_signup' ? (
                          <UserPlus className="h-4 w-4" />
                        ) : event.type === 'payment_received' ? (
                          <DollarSign className="h-4 w-4" />
                        ) : event.type === 'subscription_created' ? (
                          <CreditCard className="h-4 w-4" />
                        ) : event.type === 'message_sent' ? (
                          <Mail className="h-4 w-4" />
                        ) : (
                          <MessageSquare className="h-4 w-4" />
                        )}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.description}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {(
                          {
                            signup: t('dashboard.eventType_signup'),
                            error: t('dashboard.eventType_error'),
                            payment: t('dashboard.eventType_payment'),
                          } as Record<string, string>
                        )[event.type] || event.type.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                      {timeAgo(event.timestamp, t)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
