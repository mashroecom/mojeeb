'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Users, Target, Gauge, Star, Info, Activity, PieChart, TrendingUp } from 'lucide-react';
import { useAdminLeadInsightsStats, useAdminTopLeads } from '@/hooks/useAdmin';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminEmptyState,
  AdminBadge,
} from '@/components/admin';
import { AdminChartCard } from '@/components/admin/AdminChartCard';
import { MojeebLineChart, MojeebDonutChart } from '@/components/charts';
import { fmtDateShort } from '@/lib/dateFormat';
import { fmtNumber, fmtPercent } from '@/lib/adminFormat';
import { cn } from '@/lib/utils';

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';

interface LeadInsightsStats {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  avgConfidence: number | null;
  highValueLeads: number;
  highValueThreshold: number;
  newLeadsLast30Days: number;
  statusFunnel: { status: LeadStatus; count: number; percentage: number }[];
  bySource: { source: string | null; count: number; percentage: number }[];
  budgetDistribution: {
    items: { budget: string; count: number }[];
    otherCount: number;
    unspecifiedCount: number;
  };
  leadsOverTime: { date: string; count: number }[];
  activities: {
    total: number;
    leadsWithActivity: number;
    topActions: { action: string; count: number }[];
  };
}

interface TopLeadRow {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  confidence: number;
  budget: string | null;
  source: string | null;
  status: LeadStatus;
  orgName: string;
}

const STATUS_COLOR: Record<LeadStatus, string> = {
  NEW: 'bg-blue-500',
  CONTACTED: 'bg-amber-500',
  QUALIFIED: 'bg-violet-500',
  CONVERTED: 'bg-emerald-500',
  LOST: 'bg-red-500',
};

const STATUS_VARIANT: Record<LeadStatus, 'info' | 'warning' | 'default' | 'success' | 'error'> = {
  NEW: 'info',
  CONTACTED: 'warning',
  QUALIFIED: 'default',
  CONVERTED: 'success',
  LOST: 'error',
};

// Sources written by the platform itself; anything else is free text and shown as-is
const KNOWN_SOURCES = ['WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'WEBCHAT', 'MANUAL'] as const;
type KnownSource = (typeof KNOWN_SOURCES)[number];

function isKnownSource(value: string): value is KnownSource {
  return (KNOWN_SOURCES as readonly string[]).includes(value);
}

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-6 rounded bg-muted" />
      ))}
    </div>
  );
}

export default function AdminLeadInsightsPage() {
  const t = useTranslations('admin.leadInsights');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const statsQuery = useAdminLeadInsightsStats();
  const topLeadsQuery = useAdminTopLeads();

  const stats = statsQuery.data as LeadInsightsStats | undefined;
  const topLeads = (topLeadsQuery.data ?? []) as TopLeadRow[];
  const loading = statsQuery.isLoading;

  const n = (value: number | undefined) => fmtNumber(value ?? 0, locale);
  const sourceLabel = (source: string | null) => {
    if (!source) return t('unknown');
    return isKnownSource(source) ? t(`source_${source}`) : source;
  };
  // The donut renders "<name> <percent>%" inside an LTR SVG; a left-to-right mark after an
  // Arabic name keeps the percentage from being reordered around it.
  const chartLabel = (label: string) => (locale === 'ar' ? `${label}‎` : label);

  if (statsQuery.error || topLeadsQuery.error) {
    return (
      <div>
        <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-destructive font-medium mb-2">{tc('error')}</p>
          <button
            type="button"
            onClick={() => {
              statsQuery.refetch();
              topLeadsQuery.refetch();
            }}
            className="text-sm text-primary hover:underline"
          >
            {tc('retry')}
          </button>
        </div>
      </div>
    );
  }

  const isEmpty = !loading && (stats?.totalLeads ?? 0) === 0;

  const budgetRows = stats
    ? [
        ...stats.budgetDistribution.items.map((row) => ({ label: row.budget, count: row.count })),
        ...(stats.budgetDistribution.otherCount > 0
          ? [{ label: t('other'), count: stats.budgetDistribution.otherCount }]
          : []),
        ...(stats.budgetDistribution.unspecifiedCount > 0
          ? [{ label: t('notSpecified'), count: stats.budgetDistribution.unspecifiedCount }]
          : []),
      ]
    : [];
  const maxBudgetCount = Math.max(1, ...budgetRows.map((row) => row.count));

  return (
    <div>
      <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-3">
        <AdminStatCard
          icon={Users}
          label={t('totalLeads')}
          value={n(stats?.totalLeads)}
          loading={loading}
        />
        <AdminStatCard
          icon={Target}
          iconColor="text-emerald-500"
          label={t('conversionRate')}
          value={fmtPercent(stats?.conversionRate ?? 0, locale)}
          loading={loading}
        />
        <AdminStatCard
          icon={Gauge}
          iconColor="text-blue-500"
          label={t('avgConfidence')}
          value={
            stats?.avgConfidence == null ? '—' : fmtPercent(stats.avgConfidence * 100, locale, 0)
          }
          loading={loading}
        />
        <AdminStatCard
          icon={Star}
          iconColor="text-amber-500"
          label={t('highValueLeads')}
          value={n(stats?.highValueLeads)}
          loading={loading}
        />
      </div>
      {stats && !isEmpty && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground mb-6">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            {t('highValueLeads')}:{' '}
            {t('highValueHint', {
              percent: fmtPercent(stats.highValueThreshold * 100, locale, 0),
            })}
            {' · '}
            {t('convertedOfTotal', {
              converted: n(stats.convertedLeads),
              total: n(stats.totalLeads),
            })}
          </span>
        </p>
      )}

      {isEmpty ? (
        <div className="rounded-xl border bg-card shadow-sm mt-6">
          <AdminEmptyState icon={Users} message={t('noData')} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 mb-6">
            {/* Status funnel */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">{t('statusFunnel')}</h2>
              {loading ? (
                <CardSkeleton rows={5} />
              ) : (
                <div className="space-y-3">
                  {(stats?.statusFunnel ?? []).map((row) => (
                    <div key={row.status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLOR[row.status])}
                          />
                          {t(`leadStatus_${row.status}`)}
                        </span>
                        <span className="text-muted-foreground">
                          {n(row.count)} · {fmtPercent(row.percentage, locale)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', STATUS_COLOR[row.status])}
                          style={{ width: `${Math.min(100, row.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lead source */}
            <AdminChartCard title={t('leadSource')} icon={PieChart}>
              <MojeebDonutChart
                data={(stats?.bySource ?? []).map((row) => ({
                  name: chartLabel(sourceLabel(row.source)),
                  value: row.count,
                }))}
                height={260}
                innerRadius={50}
                outerRadius={80}
                isLoading={loading}
                noDataMessage={t('noData')}
              />
            </AdminChartCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 mb-6">
            {/* New leads over time */}
            <AdminChartCard title={t('leadsOverTime')} icon={TrendingUp}>
              <MojeebLineChart
                data={stats?.leadsOverTime ?? []}
                xKey="date"
                lines={[{ key: 'count', color: '#6366f1', name: t('leads') }]}
                height={260}
                isLoading={loading}
                showLegend={false}
                formatX={(value) => fmtDateShort(value, locale)}
                formatY={(value) => fmtNumber(Number(value), locale, 1)}
                noDataMessage={t('noData')}
              />
            </AdminChartCard>

            {/* Budget distribution */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">{t('budgetDistribution')}</h2>
              {loading ? (
                <CardSkeleton />
              ) : budgetRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noData')}</p>
              ) : (
                <div className="space-y-3">
                  {budgetRows.map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between gap-3 text-sm mb-1">
                        <bdi className="min-w-0 truncate">{row.label}</bdi>
                        <span className="text-muted-foreground flex-shrink-0">{n(row.count)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(row.count / maxBudgetCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lead activities */}
          <div className="rounded-xl border bg-card p-6 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{t('activities')}</h2>
            </div>
            {loading ? (
              <CardSkeleton rows={3} />
            ) : (stats?.activities.total ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noActivities')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('totalActivities')}</p>
                    <p className="text-2xl font-bold">{n(stats?.activities.total)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('leadsWithActivity')}</p>
                    <p className="text-2xl font-bold">{n(stats?.activities.leadsWithActivity)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('newLeadsLast30Days')}</p>
                    <p className="text-2xl font-bold">{n(stats?.newLeadsLast30Days)}</p>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground mb-3">{t('topActions')}</p>
                  <ul className="space-y-2">
                    {(stats?.activities.topActions ?? []).map((row) => (
                      <li
                        key={row.action}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <bdi className="min-w-0 truncate">{row.action}</bdi>
                        <AdminBadge className="flex-shrink-0">{n(row.count)}</AdminBadge>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Top leads */}
          <h2 className="text-lg font-semibold mb-3">{t('topLeads')}</h2>
          <AdminDataTable<TopLeadRow>
            loading={topLeadsQuery.isLoading}
            data={topLeads}
            rowKey={(row) => row.id}
            emptyMessage={t('noTopLeads')}
            columns={[
              {
                key: 'name',
                header: t('name'),
                render: (row) => (
                  <div>
                    <p className="text-sm font-medium">
                      <bdi>{row.name || t('unnamedLead')}</bdi>
                    </p>
                    {row.email && (
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {row.email}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: 'company',
                header: t('company'),
                render: (row) => (
                  <bdi className="text-sm text-muted-foreground">{row.company || '—'}</bdi>
                ),
              },
              {
                key: 'org',
                header: t('organization'),
                render: (row) => <span className="text-sm">{row.orgName}</span>,
              },
              {
                key: 'source',
                header: t('source'),
                render: (row) => (
                  <span className="text-sm text-muted-foreground">{sourceLabel(row.source)}</span>
                ),
              },
              {
                key: 'confidence',
                header: t('confidence'),
                render: (row) => (
                  <div className="flex items-center gap-2 min-w-[7rem]">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, row.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {fmtPercent(row.confidence * 100, locale, 0)}
                    </span>
                  </div>
                ),
              },
              {
                key: 'budget',
                header: t('budget'),
                render: (row) => (
                  <bdi className="text-sm text-muted-foreground">{row.budget || '—'}</bdi>
                ),
              },
              {
                key: 'status',
                header: t('status'),
                render: (row) => (
                  <AdminBadge variant={STATUS_VARIANT[row.status]}>
                    {t(`leadStatus_${row.status}`)}
                  </AdminBadge>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
