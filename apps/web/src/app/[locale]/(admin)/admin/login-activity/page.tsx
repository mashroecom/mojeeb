'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import { useAdminLoginActivity, useAdminLoginActivityStats } from '@/hooks/useAdmin';
import { exportToCsv } from '@/lib/exportCsv';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Activity,
  Filter,
  Calendar,
  CheckCircle,
  XCircle,
  Globe,
  TrendingUp,
  Download,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoginEntry {
  id: string;
  email: string;
  userName?: string;
  success: boolean;
  ip: string;
  userAgent: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateUA(ua: string, max = 60) {
  if (!ua) return '-';
  return ua.length > max ? ua.slice(0, max) + '...' : ua;
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function StatSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm animate-pulse">
      <div className="h-3 w-20 rounded bg-muted mb-3" />
      <div className="h-7 w-16 rounded bg-muted" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b last:border-b-0">
      <td className="px-4 py-3">
        <div className="h-3 w-32 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-20 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-16 rounded-full bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-24 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-40 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-28 rounded bg-muted" />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LoginActivityPage() {
  const t = useTranslations('admin.loginActivity');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [email, setEmail] = useState('');
  const [ip, setIp] = useState('');
  const [success, setSuccess] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(email && { email }),
      ...(ip && { ip }),
      ...(success && { success }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    }),
    [page, email, ip, success, startDate, endDate],
  );

  const { data, isLoading, isError, refetch } = useAdminLoginActivity(params);
  const { data: stats, isLoading: statsLoading } = useAdminLoginActivityStats();

  const entries: LoginEntry[] = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function handleExport() {
    if (!entries.length) return;
    const rows = entries.map((entry) => ({
      [t('csvEmail')]: entry.email,
      [t('csvUser')]: entry.userName || '',
      [t('csvStatus')]: entry.success ? t('success') : t('failed'),
      [t('csvIP')]: entry.ip,
      [t('csvUserAgent')]: entry.userAgent,
      [t('csvTime')]: fmtDateTime(entry.createdAt, locale),
    }));
    exportToCsv('admin-login-activity', rows);
  }

  function updateFilter<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!entries.length}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Download className="h-4 w-4" />
          {tc('export')}
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {statsLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Activity className="h-4 w-4" />
                {t('totalToday')}
              </div>
              <p className="text-2xl font-bold">{stats?.totalLogins ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                {t('failedToday')}
              </div>
              <p className="text-2xl font-bold text-red-600">{stats?.failedLogins ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Globe className="h-4 w-4" />
                {t('uniqueIPs')}
              </div>
              <p className="text-2xl font-bold">{stats?.uniqueIPs ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                {t('successRate')}
              </div>
              <p className="text-2xl font-bold text-green-600">
                {stats?.totalLogins
                  ? `${Math.round((stats.successfulLogins / stats.totalLogins) * 100)}%`
                  : '-'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <Filter className="h-4 w-4" />
          {t('filters')}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('email')}
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => updateFilter(setEmail)(e.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
            />
          </div>

          {/* IP */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('ip')}
            </label>
            <input
              type="text"
              value={ip}
              onChange={(e) => updateFilter(setIp)(e.target.value)}
              placeholder="192.168.1.1"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('status')}
            </label>
            <select
              value={success}
              onChange={(e) => updateFilter(setSuccess)(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
            >
              <option value="">{t('all')}</option>
              <option value="true">{t('success')}</option>
              <option value="false">{t('failed')}</option>
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              <Calendar className="inline h-3 w-3 me-1" />
              {t('startDate')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => updateFilter(setStartDate)(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
            />
          </div>

          {/* End date */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              <Calendar className="inline h-3 w-3 me-1" />
              {t('endDate')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => updateFilter(setEndDate)(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{tc('error')}</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('email')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('user')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('ip')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('userAgent')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('time')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}

              {!isLoading && !isError && entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Activity className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noRecords')}</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium truncate block max-w-[200px]">
                        {entry.email}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {entry.userName || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {entry.success ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="h-3 w-3" />
                          {t('success')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <XCircle className="h-3 w-3" />
                          {t('failed')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-muted-foreground">{entry.ip}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs text-muted-foreground truncate block max-w-[200px]"
                        title={entry.userAgent}
                      >
                        {truncateUA(entry.userAgent)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDateTime(entry.createdAt, locale)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
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
