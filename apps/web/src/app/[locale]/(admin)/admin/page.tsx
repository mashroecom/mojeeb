'use client';

import { useTranslations, useLocale } from 'next-intl';
import { fmtDateShort, fmtTime, fmtDate } from '@/lib/dateFormat';
import { useMemo } from 'react';
import {
  useAdminOverview,
  useAdminDailyRevenue,
  useAdminTopOrgs,
  useAdminRecentActivity,
  useSystemHealth,
  useSystemQueues,
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
  RefreshCw,
  TrendingUp,
  Activity,
  UserPlus,
  Plus,
  MessageCircle,
  Database,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

function timeAgo(dateStr: string | Date, tFn: (key: string, params?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return tFn('daysAgo', { count: days });
  if (hours > 0) return tFn('hoursAgo', { count: hours });
  if (minutes > 0) return tFn('minutesAgo', { count: minutes });
  return tFn('justNow');
}


const activityIcons: Record<string, typeof UserPlus> = {
  user_joined: UserPlus,
  org_created: Plus,
  conversation_created: MessageCircle,
};

const activityColors: Record<string, { bg: string; color: string }> = {
  user_joined: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    color: 'text-blue-600 dark:text-blue-400',
  },
  org_created: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    color: 'text-purple-600 dark:text-purple-400',
  },
  conversation_created: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    color: 'text-green-600 dark:text-green-400',
  },
};

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

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

function ChartSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-6">
      <div className="h-5 w-48 rounded bg-muted mb-6" />
      <div className="h-48 w-full rounded bg-muted" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-6">
      <div className="h-5 w-40 rounded bg-muted mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-6">
      <div className="h-5 w-36 rounded bg-muted mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-40 rounded bg-muted" />
              <div className="h-2 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue SVG Line Chart
// ---------------------------------------------------------------------------

function RevenueChart({
  data,
}: {
  data: Array<{ date: string; revenue: number }>;
}) {
  const t = useTranslations('admin.overview');
  const locale = useLocale();

  const maxRevenue = useMemo(
    () => Math.max(...data.map((d) => d.revenue), 1),
    [data],
  );

  const chartWidth = 600;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const points = useMemo(() => {
    return data.map((d, i) => ({
      x: padding.left + (i / Math.max(data.length - 1, 1)) * innerWidth,
      y: padding.top + innerHeight - (d.revenue / maxRevenue) * innerHeight,
      date: d.date,
      revenue: d.revenue,
    }));
  }, [data, maxRevenue, innerWidth, innerHeight, padding.left, padding.top]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const baseline = padding.top + innerHeight;
    return (
      `M ${points[0].x} ${baseline} ` +
      points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${points[points.length - 1].x} ${baseline} Z`
    );
  }, [points, padding.top, innerHeight]);

  // Y-axis labels
  const yLabels = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const value = (maxRevenue / steps) * i;
      const y = padding.top + innerHeight - (i / steps) * innerHeight;
      return { value, y };
    });
  }, [maxRevenue, innerHeight, padding.top]);

  // X-axis labels (show ~6 labels)
  const xLabels = useMemo(() => {
    const step = Math.max(1, Math.floor(data.length / 6));
    return data
      .filter((_, i) => i % step === 0 || i === data.length - 1)
      .map((d, idx, arr) => {
        const originalIdx = data.indexOf(d);
        return {
          label: fmtDateShort(d.date, locale),
          x:
            padding.left +
            (originalIdx / Math.max(data.length - 1, 1)) * innerWidth,
        };
      });
  }, [data, innerWidth, padding.left]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto min-w-[400px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={label.y}
            x2={chartWidth - padding.right}
            y2={label.y}
            className="stroke-muted-foreground/10"
            strokeWidth="1"
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((label, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={label.y + 4}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            ${label.value >= 1000
              ? `${(label.value / 1000).toFixed(1)}k`
              : label.value.toFixed(0)}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={chartHeight - 5}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {label.label}
          </text>
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          className="fill-emerald-500/10 dark:fill-emerald-400/10"
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          className="stroke-emerald-500 dark:stroke-emerald-400"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="3"
              className="fill-emerald-500 dark:fill-emerald-400 opacity-0 hover:opacity-100 transition-opacity"
            />
            <title>
              {fmtDate(p.date, locale)} - ${p.revenue.toFixed(2)}
            </title>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminOverviewPage() {
  const t = useTranslations('admin.overview');
  const locale = useLocale();

  // 1. Auto-refresh: 30 second refetchInterval on the overview query
  const {
    data: overview,
    isLoading: loadingOverview,
    error: overviewError,
    dataUpdatedAt,
  } = useAdminOverview();

  // Patch the query to include refetchInterval (we do it via the hook options)
  // Since useAdminOverview doesn't take options, we use a separate approach
  // and add refetchInterval via the query directly

  // 2. Revenue chart data
  const { data: dailyRevenue, isLoading: loadingRevenue } =
    useAdminDailyRevenue();

  // 3. Top organizations
  const { data: topOrgs, isLoading: loadingTopOrgs } = useAdminTopOrgs();

  // 4. Recent activity
  const { data: recentActivity, isLoading: loadingActivity } =
    useAdminRecentActivity();

  // 5. System health
  const { data: healthData, isLoading: loadingHealth } = useSystemHealth();
  const { data: queuesRaw, isLoading: loadingQueues } = useSystemQueues();

  // Normalize health checks from { checks: { database: {...}, redis: {...} } }
  const healthChecks = useMemo(() => {
    if (!healthData) return [];
    // health data shape: { status, timestamp, checks: { database: {...}, redis: {...} } }
    const checks = healthData.checks ?? healthData;
    if (typeof checks !== 'object') return [];
    return Object.entries(checks).map(([name, value]: [string, any]) => ({
      name,
      status: value.status ?? 'unknown',
      latencyMs: value.latencyMs ?? null,
    }));
  }, [healthData]);

  const overallHealth = useMemo(() => {
    if (!healthData) return null;
    return healthData.status ?? (healthChecks.every((c) => c.status === 'healthy') ? 'healthy' : 'degraded');
  }, [healthData, healthChecks]);

  // Normalize queues from { queues: { name: {waiting, active, ...} } }
  const queues = useMemo(() => {
    if (!queuesRaw) return [];
    const raw = queuesRaw.queues ?? queuesRaw;
    if (typeof raw !== 'object') return [];
    return Object.entries(raw).map(([name, value]: [string, any]) => ({
      name,
      waiting: value.waiting ?? 0,
      active: value.active ?? 0,
      failed: value.failed ?? 0,
    }));
  }, [queuesRaw]);

  // Revenue chart data normalized
  const revenueData: Array<{ date: string; revenue: number }> = useMemo(() => {
    if (!dailyRevenue) return [];
    if (Array.isArray(dailyRevenue)) return dailyRevenue;
    return [];
  }, [dailyRevenue]);

  const totalRevenueLast30 = useMemo(
    () => revenueData.reduce((sum, d) => sum + d.revenue, 0),
    [revenueData],
  );

  // Stats cards configuration
  const stats = [
    {
      key: 'totalUsers',
      label: t('totalUsers'),
      value: overview?.totalUsers ?? 0,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      key: 'totalOrgs',
      label: t('totalOrgs'),
      value: overview?.totalOrgs ?? 0,
      icon: Building2,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      key: 'totalConversations',
      label: t('totalConversations'),
      value: overview?.totalConversations ?? 0,
      icon: MessageSquare,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      key: 'totalMessages',
      label: t('totalMessages'),
      value: overview?.totalMessages ?? 0,
      icon: Mail,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    },
    {
      key: 'activeSubscriptions',
      label: t('activeSubscriptions'),
      value: overview?.activeSubscriptions ?? 0,
      icon: CreditCard,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      key: 'totalRevenue',
      label: t('totalRevenue'),
      value: overview?.totalRevenue ?? 0,
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      isCurrency: true,
    },
  ];

  // Error state
  if (overviewError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{t('title')}</p>
        <p className="text-sm text-muted-foreground">{t('errorLoading')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with auto-refresh indicator */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            {t('autoRefresh')} 30s
          </span>
          {dataUpdatedAt > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t('lastUpdated')}:{' '}
              {fmtTime(dataUpdatedAt, locale)}
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Stat Cards (with auto-refresh from refetchInterval)             */}
      {/* ------------------------------------------------------------------ */}
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
                    <p className="text-sm text-muted-foreground">
                      {stat.label}
                    </p>
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

      {/* ------------------------------------------------------------------ */}
      {/* 2. Revenue Chart + 5. System Health (side by side on large)        */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue Chart - takes 2 cols */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-semibold">{t('revenueChart')}</h2>
            </div>
            {revenueData.length > 0 && (
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                ${totalRevenueLast30.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {loadingRevenue ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : revenueData.length === 0 ||
            revenueData.every((d) => d.revenue === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <DollarSign className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{t('noRevenueData')}</p>
            </div>
          ) : (
            <RevenueChart data={revenueData} />
          )}
        </div>

        {/* System Health - takes 1 col */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('systemHealth')}</h2>
          </div>

          {loadingHealth ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Overall Status */}
              {overallHealth && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                    overallHealth === 'healthy'
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : overallHealth === 'degraded'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
                  )}
                >
                  {overallHealth === 'healthy' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : overallHealth === 'degraded' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {overallHealth === 'healthy'
                    ? t('healthy')
                    : overallHealth === 'degraded'
                      ? t('degraded')
                      : t('unhealthy')}
                </div>
              )}

              {/* Individual checks */}
              {healthChecks.map((check) => {
                const isHealthy = check.status === 'healthy';
                const Icon = check.name === 'database' ? Database : Server;
                const label =
                  check.name === 'database'
                    ? t('database')
                    : check.name === 'redis'
                      ? t('redis')
                      : check.name;
                return (
                  <div
                    key={check.name}
                    className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {check.latencyMs != null && (
                        <span className="text-xs text-muted-foreground">
                          {check.latencyMs}ms
                        </span>
                      )}
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          isHealthy
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        )}
                      >
                        {isHealthy ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {isHealthy ? t('healthy') : t('unhealthy')}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Queue Status */}
              {!loadingQueues && queues.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {t('queueStatus')}
                  </p>
                  {queues.map((q) => (
                    <div
                      key={q.name}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <span className="capitalize text-muted-foreground">
                        {q.name}
                      </span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-amber-600 dark:text-amber-400">
                          {t('waiting')}: {q.waiting}
                        </span>
                        <span className="text-blue-600 dark:text-blue-400">
                          {t('active')}: {q.active}
                        </span>
                        {q.failed > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            {t('failed')}: {q.failed}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Top Organizations + 4. Recent Activity (side by side)           */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Organizations */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold">{t('topOrganizations')}</h2>
          </div>

          {loadingTopOrgs ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-center justify-between py-2"
                >
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : !topOrgs || (Array.isArray(topOrgs) && topOrgs.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{t('noTopOrgs')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-start px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      {t('organization')}
                    </th>
                    <th className="text-start px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      {t('plan')}
                    </th>
                    <th className="text-end px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      {t('messages')}
                    </th>
                    <th className="text-end px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">
                      {t('conversations')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(Array.isArray(topOrgs) ? topOrgs : []).map(
                    (org: any, idx: number) => (
                      <tr
                        key={org.id ?? idx}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <div className="font-medium truncate max-w-[180px]">
                            {org.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {org.members} {t('members')} / {org.agents}{' '}
                            {t('agents')}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                              PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE,
                            )}
                          >
                            {org.plan}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-end font-semibold tabular-nums">
                          {formatNumber(org.messages)}
                        </td>
                        <td className="px-3 py-2.5 text-end tabular-nums hidden sm:table-cell">
                          {formatNumber(org.conversations)}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('activityFeed')}</h2>
          </div>

          {loadingActivity ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-40 rounded bg-muted" />
                    <div className="h-2 w-20 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : !recentActivity ||
            (Array.isArray(recentActivity) &&
              recentActivity.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{t('noActivity')}</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {(Array.isArray(recentActivity) ? recentActivity : []).map(
                (activity: any, idx: number) => {
                  const Icon =
                    activityIcons[activity.type] ?? MessageCircle;
                  const colors = activityColors[activity.type] ??
                    activityColors.conversation_created;
                  const labelKey =
                    activity.type === 'user_joined'
                      ? 'activityUserJoined'
                      : activity.type === 'org_created'
                        ? 'activityOrgCreated'
                        : 'activityConversationCreated';

                  return (
                    <div
                      key={`${activity.type}-${activity.id}-${idx}`}
                      className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0',
                          colors.bg,
                        )}
                      >
                        <Icon className={cn('h-4 w-4', colors.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          {t(labelKey as any)}
                        </p>
                        <p className="text-sm font-medium truncate">
                          {activity.description}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                        {timeAgo(activity.createdAt, t as any)}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
