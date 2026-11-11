'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShieldAlert,
  ShieldCheck,
  LogIn,
  XCircle,
  TrendingUp,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { fmtDateTime } from '@/lib/dateFormat';
import { useAdminSecurityStats, useAdminRecentFailures } from '@/hooks/useAdmin';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminPagination,
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
// Types — GET /admin/security-audit/stats and /recent-failures
// ---------------------------------------------------------------------------

interface IpFailureCount {
  ip: string | null;
  failedCount: number;
}

interface SecurityStats {
  totalLogins: number;
  failedLogins: number;
  successRate: number;
  uniqueIPs: number;
  suspiciousIPs: IpFailureCount[];
  topFailedIPs: IpFailureCount[];
}

interface FailedLogin {
  id: string;
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  failReason: string | null;
  createdAt: string;
}

interface FailuresPage {
  failures: FailedLogin[];
  total: number;
  page: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

// failReason values written by apps/api/src/routes/auth.routes.ts
const FAIL_REASON_KEYS: Record<string, string> = {
  INVALID_CREDENTIALS: 'reason_INVALID_CREDENTIALS',
  GOOGLE_AUTH_FAILED: 'reason_GOOGLE_AUTH_FAILED',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminSecurityAuditPage() {
  const t = useTranslations('admin.securityAudit');
  const tc = useTranslations('admin.common');
  const fmt = useAnalyticsFormat();

  const [page, setPage] = useState(1);

  const statsQuery = useAdminSecurityStats();
  const failuresQuery = useAdminRecentFailures(page, PAGE_SIZE);

  const stats = statsQuery.data as SecurityStats | undefined;
  const failuresPage = failuresQuery.data as FailuresPage | undefined;
  const failures = failuresPage?.failures ?? [];
  const suspicious = stats?.suspiciousIPs ?? [];
  const topFailed = stats?.topFailedIPs ?? [];

  const reasonLabel = (reason: string | null) => {
    if (!reason) return '—';
    const key = FAIL_REASON_KEYS[reason];
    return key ? t(key) : reason;
  };

  const refetchAll = () => {
    statsQuery.refetch();
    failuresQuery.refetch();
  };
  const isFetching = statsQuery.isFetching || failuresQuery.isFetching;

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
        <AnalyticsError
          title={tc('error')}
          retryLabel={tc('retry')}
          onRetry={() => statsQuery.refetch()}
          className="mb-6"
        />
      ) : (
        <>
          {/* Suspicious activity alert */}
          {suspicious.length > 0 && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    {t('suspiciousAlert')}
                  </p>
                  <p className="mt-0.5 text-xs text-red-700/80 dark:text-red-300/70">
                    {t('suspiciousHint')}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {suspicious.map((entry) => (
                      <li
                        key={entry.ip ?? 'unknown'}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs dark:border-red-900/50 dark:bg-red-950/40"
                      >
                        <span className="font-mono font-medium" dir="ltr">
                          {entry.ip ?? '—'}
                        </span>
                        <span className="text-red-700 dark:text-red-300">
                          {t('attemptsCount', { count: fmt.num(entry.failedCount) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('last30Days')}
          </p>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <AdminStatCard
              icon={LogIn}
              label={t('totalLogins')}
              value={fmt.num(stats?.totalLogins)}
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={XCircle}
              label={t('failedAttempts')}
              value={fmt.num(stats?.failedLogins)}
              iconColor="text-red-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={TrendingUp}
              label={t('successRate')}
              value={stats && stats.totalLogins > 0 ? fmt.pct(stats.successRate) : '—'}
              iconColor="text-emerald-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={Globe}
              label={t('uniqueIPs')}
              value={fmt.num(stats?.uniqueIPs)}
              iconColor="text-blue-500"
              loading={statsQuery.isLoading}
            />
            <AdminStatCard
              icon={ShieldAlert}
              label={t('suspiciousIPs')}
              value={fmt.num(suspicious.length)}
              iconColor={suspicious.length > 0 ? 'text-red-500' : 'text-muted-foreground'}
              loading={statsQuery.isLoading}
            />
          </div>

          {/* Top failing IPs */}
          <div className="mb-6">
            <SectionTitle title={t('topFailedIPs')} hint={t('topFailedIPsHint')} />
            <div className="rounded-xl border bg-card shadow-sm">
              {statsQuery.isLoading ? (
                <div className="space-y-4 p-4 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-6 rounded bg-muted" />
                  ))}
                </div>
              ) : topFailed.length === 0 ? (
                <AdminEmptyState icon={ShieldCheck} message={t('noFailedIPs')} className="py-10" />
              ) : (
                <div className="p-4">
                  <BarList
                    items={topFailed.map((entry) => ({
                      key: entry.ip ?? 'unknown',
                      label: entry.ip ?? '—',
                      value: entry.failedCount,
                      color: 'bg-red-500',
                    }))}
                    total={stats?.failedLogins}
                    formatValue={fmt.num}
                    formatPercent={fmt.pct}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Recent failed logins */}
      <SectionTitle title={t('recentFailures')} />
      {failuresQuery.isError ? (
        <AnalyticsError
          title={tc('error')}
          retryLabel={tc('retry')}
          onRetry={() => failuresQuery.refetch()}
        />
      ) : (
        <>
          <AdminDataTable<FailedLogin>
            columns={[
              {
                key: 'email',
                header: t('email'),
                render: (row) => (
                  <span className="text-sm font-medium" dir="ltr">
                    {row.email}
                  </span>
                ),
              },
              {
                key: 'ip',
                header: t('ip'),
                className: 'whitespace-nowrap',
                render: (row) => (
                  <span className="font-mono text-xs" dir="ltr">
                    {row.ipAddress ?? '—'}
                  </span>
                ),
              },
              {
                key: 'location',
                header: t('location'),
                className: 'whitespace-nowrap',
                render: (row) => (
                  <span className="text-sm text-muted-foreground">
                    {[row.city, row.country].filter(Boolean).join(', ') || '—'}
                  </span>
                ),
              },
              {
                key: 'reason',
                header: t('reason'),
                className: 'whitespace-nowrap',
                render: (row) =>
                  row.failReason ? (
                    <AdminBadge variant="error">{reasonLabel(row.failReason)}</AdminBadge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  ),
              },
              {
                key: 'userAgent',
                header: t('userAgent'),
                render: (row) => (
                  <span
                    className="block max-w-[18rem] truncate text-xs text-muted-foreground"
                    dir="ltr"
                    title={row.userAgent ?? undefined}
                  >
                    {row.userAgent ?? '—'}
                  </span>
                ),
              },
              {
                key: 'timestamp',
                header: t('timestamp'),
                className: 'whitespace-nowrap',
                render: (row) => (
                  <span className="text-sm text-muted-foreground">
                    {fmtDateTime(row.createdAt, fmt.locale)}
                  </span>
                ),
              },
            ]}
            data={failures}
            loading={failuresQuery.isLoading}
            rowKey={(row) => row.id}
            emptyIcon={<ShieldCheck className="h-12 w-12 text-muted-foreground/40" />}
            emptyMessage={t('noFailures')}
          />
          <AdminPagination
            page={page}
            totalPages={failuresPage?.totalPages ?? 1}
            onPageChange={setPage}
            previousLabel={tc('previous')}
            nextLabel={tc('next')}
            pageLabel={tc('page')}
            ofLabel={tc('of')}
          />
        </>
      )}
    </div>
  );
}
