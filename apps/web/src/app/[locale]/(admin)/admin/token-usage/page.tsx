'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { isAxiosError } from 'axios';
import { Zap, DollarSign, Building2, Trophy, BarChart3 } from 'lucide-react';
import {
  useAdminTokenSummary,
  useAdminTokenByDay,
  useAdminTokenByModel,
  useAdminTokenByOrg,
  useAdminTopConsumers,
} from '@/hooks/useAdmin';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminPagination,
  AdminEmptyState,
  AdminBadge,
} from '@/components/admin';
import { AdminChartCard } from '@/components/admin/AdminChartCard';
import { MojeebBarChart } from '@/components/charts';
import { fmtDateShort } from '@/lib/dateFormat';
import { fmtNumber, fmtCompact, fmtUsd, fmtPercent } from '@/lib/adminFormat';

interface TokenSummary {
  startDate: string;
  endDate: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requestCount: number;
  activeOrgs: number;
  avgTokensPerOrg: number;
  avgCostPerOrg: number;
  topConsumer: {
    orgId: string;
    orgName: string | null;
    totalTokens: number;
    totalCost: number;
    share: number;
  } | null;
}

interface TokenDayRow {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requests: number;
}

interface TokenModelRow {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requests: number;
  share: number;
}

interface TokenOrgRow {
  orgId: string;
  orgName: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requests: number;
}

interface TopConsumerRow extends TokenOrgRow {
  rank: number;
  share: number;
}

const ORG_PAGE_SIZE = 10;
const TOP_CONSUMERS_LIMIT = 5;

export default function AdminTokenUsagePage() {
  const t = useTranslations('admin.tokenUsage');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const range = { startDate: startDate || undefined, endDate: endDate || undefined };

  const summaryQuery = useAdminTokenSummary(range);
  const byDayQuery = useAdminTokenByDay(range);
  const byModelQuery = useAdminTokenByModel(range);
  const byOrgQuery = useAdminTokenByOrg({ ...range, page, limit: ORG_PAGE_SIZE });
  const topConsumersQuery = useAdminTopConsumers({ ...range, limit: TOP_CONSUMERS_LIMIT });

  const summary = summaryQuery.data as TokenSummary | undefined;
  const byDay = (byDayQuery.data ?? []) as TokenDayRow[];
  const byModel = (byModelQuery.data ?? []) as TokenModelRow[];
  const byOrg = (byOrgQuery.data?.data ?? []) as TokenOrgRow[];
  const orgPagination = byOrgQuery.data?.pagination as { totalPages: number } | undefined;
  const topConsumers = (topConsumersQuery.data ?? []) as TopConsumerRow[];

  const queries = [summaryQuery, byDayQuery, byModelQuery, byOrgQuery, topConsumersQuery];
  const firstError = queries.find((q) => q.error)?.error;
  const isRangeError = isAxiosError(firstError) && firstError.response?.status === 400;

  const today = new Date().toISOString().slice(0, 10);
  const hasCustomRange = Boolean(startDate || endDate);
  const hasDailyUsage = byDay.some((day) => day.totalTokens > 0);

  function resetRange() {
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  // Keep the range ordered on the client so a reversed range is never requested
  function changeStart(value: string) {
    setStartDate(value);
    if (value && value > (endDate || today)) setEndDate(value);
    setPage(1);
  }

  function changeEnd(value: string) {
    setEndDate(value);
    if (value && startDate && value < startDate) setStartDate(value);
    setPage(1);
  }

  const orgLabel = (name: string | null) => name ?? t('deletedOrg');

  const rangeFilter = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {t('from')}
        <input
          type="date"
          value={startDate || summary?.startDate || ''}
          max={endDate || today}
          onChange={(e) => changeStart(e.target.value)}
          className="rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {t('to')}
        <input
          type="date"
          value={endDate || summary?.endDate || ''}
          min={startDate || undefined}
          max={today}
          onChange={(e) => changeEnd(e.target.value)}
          className="rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      {hasCustomRange && (
        <button
          type="button"
          onClick={resetRange}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          {t('resetRange')}
        </button>
      )}
    </div>
  );

  if (firstError) {
    return (
      <div>
        <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-destructive font-medium mb-3">
            {isRangeError ? t('rangeError') : tc('error')}
          </p>
          <button
            type="button"
            onClick={() => (isRangeError ? resetRange() : queries.forEach((q) => q.refetch()))}
            className="text-sm text-primary hover:underline"
          >
            {isRangeError ? t('resetRange') : tc('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="mb-6">{rangeFilter}</div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <AdminStatCard
          icon={Zap}
          iconColor="text-amber-500"
          label={t('totalTokens')}
          value={fmtNumber(summary?.totalTokens ?? 0, locale)}
          loading={summaryQuery.isLoading}
        />
        <AdminStatCard
          icon={DollarSign}
          iconColor="text-emerald-500"
          label={t('totalCost')}
          value={fmtUsd(summary?.totalCost ?? 0, locale)}
          loading={summaryQuery.isLoading}
        />
        <AdminStatCard
          icon={Building2}
          iconColor="text-blue-500"
          label={t('avgPerOrg')}
          value={fmtNumber(summary?.avgTokensPerOrg ?? 0, locale)}
          loading={summaryQuery.isLoading}
        />
        <AdminStatCard
          icon={Trophy}
          iconColor="text-purple-500"
          label={t('topConsumer')}
          value={summary?.topConsumer ? orgLabel(summary.topConsumer.orgName) : '—'}
          loading={summaryQuery.isLoading}
        />
      </div>

      {/* Daily usage */}
      <AdminChartCard title={t('byDay')} icon={BarChart3} className="mb-6">
        <MojeebBarChart
          data={hasDailyUsage ? byDay.map((day) => ({ ...day })) : []}
          xKey="date"
          bars={[
            { key: 'inputTokens', color: '#6366f1', name: t('inputTokens'), stackId: 'tokens' },
            { key: 'outputTokens', color: '#a78bfa', name: t('outputTokens'), stackId: 'tokens' },
          ]}
          height={300}
          isLoading={byDayQuery.isLoading}
          formatX={(value) => fmtDateShort(value, locale)}
          formatY={(value) => fmtCompact(Number(value), locale)}
          noDataMessage={t('noData')}
        />
      </AdminChartCard>

      {/* Top consumers */}
      <div className="rounded-xl border bg-card p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">{t('topConsumers')}</h2>
        {topConsumersQuery.isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-muted" />
            ))}
          </div>
        ) : topConsumers.length === 0 ? (
          <AdminEmptyState icon={Trophy} message={t('noConsumerData')} className="py-8" />
        ) : (
          <ol className="space-y-4">
            {topConsumers.map((row) => (
              <li key={row.orgId}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1.5">
                  <span className="text-sm font-medium">
                    <span className="text-muted-foreground me-2">
                      {fmtNumber(row.rank, locale)}.
                    </span>
                    {orgLabel(row.orgName)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {fmtNumber(row.totalTokens, locale)} {t('tokens')} · {fmtUsd(row.cost, locale)}{' '}
                    · {t('ofTotal', { percent: fmtPercent(row.share, locale) })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, row.share)}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* By model */}
      <h2 className="text-lg font-semibold mb-3">{t('byModel')}</h2>
      <div className="mb-6">
        <AdminDataTable<TokenModelRow>
          loading={byModelQuery.isLoading}
          data={byModel}
          rowKey={(row) => `${row.provider}:${row.model}`}
          emptyMessage={t('noData')}
          skeletonRows={3}
          columns={[
            {
              key: 'model',
              header: t('model'),
              render: (row) => (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium" dir="ltr">
                    {row.model}
                  </span>
                  <AdminBadge variant="info">{row.provider}</AdminBadge>
                </div>
              ),
            },
            {
              key: 'input',
              header: t('input'),
              render: (row) => (
                <span className="text-sm">{fmtNumber(row.inputTokens, locale)}</span>
              ),
            },
            {
              key: 'output',
              header: t('output'),
              render: (row) => (
                <span className="text-sm">{fmtNumber(row.outputTokens, locale)}</span>
              ),
            },
            {
              key: 'total',
              header: t('total'),
              render: (row) => (
                <span className="text-sm font-medium">{fmtNumber(row.totalTokens, locale)}</span>
              ),
            },
            {
              key: 'requests',
              header: t('requests'),
              render: (row) => <span className="text-sm">{fmtNumber(row.requests, locale)}</span>,
            },
            {
              key: 'cost',
              header: t('cost'),
              render: (row) => <span className="text-sm">{fmtUsd(row.cost, locale)}</span>,
            },
            {
              key: 'share',
              header: t('share'),
              render: (row) => (
                <div className="flex items-center gap-2 min-w-[8rem]">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, row.share)}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {fmtPercent(row.share, locale)}
                  </span>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* By organization */}
      <h2 className="text-lg font-semibold mb-3">{t('byOrg')}</h2>
      <AdminDataTable<TokenOrgRow>
        loading={byOrgQuery.isLoading}
        data={byOrg}
        rowKey={(row) => row.orgId}
        emptyMessage={t('noData')}
        skeletonRows={4}
        columns={[
          {
            key: 'org',
            header: t('orgName'),
            render: (row) => <span className="text-sm font-medium">{orgLabel(row.orgName)}</span>,
          },
          {
            key: 'input',
            header: t('input'),
            render: (row) => <span className="text-sm">{fmtNumber(row.inputTokens, locale)}</span>,
          },
          {
            key: 'output',
            header: t('output'),
            render: (row) => <span className="text-sm">{fmtNumber(row.outputTokens, locale)}</span>,
          },
          {
            key: 'total',
            header: t('total'),
            render: (row) => (
              <span className="text-sm font-medium">{fmtNumber(row.totalTokens, locale)}</span>
            ),
          },
          {
            key: 'requests',
            header: t('requests'),
            render: (row) => <span className="text-sm">{fmtNumber(row.requests, locale)}</span>,
          },
          {
            key: 'cost',
            header: t('cost'),
            render: (row) => <span className="text-sm">{fmtUsd(row.cost, locale)}</span>,
          },
        ]}
      />
      {orgPagination && (
        <AdminPagination
          page={page}
          totalPages={orgPagination.totalPages}
          onPageChange={setPage}
          previousLabel={tc('previous')}
          nextLabel={tc('next')}
          pageLabel={tc('page')}
          ofLabel={tc('of')}
        />
      )}
    </div>
  );
}
