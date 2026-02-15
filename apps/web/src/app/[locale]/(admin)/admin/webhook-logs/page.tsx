'use client';

import { useState, useMemo, Fragment } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import { useAdminWebhookLogs, useAdminWebhookLogStats } from '@/hooks/useAdmin';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Webhook,
  Filter,
  Calendar,
  CheckCircle,
  XCircle,
  Activity,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookLogEntry {
  id: string;
  webhookId: string;
  webhookUrl: string;
  event: string;
  success: boolean;
  statusCode?: number;
  duration?: number;
  attempt: number;
  requestBody?: string;
  responseBody?: string;
  createdAt: string;
}

interface WebhookLogStats {
  totalDeliveries: number;
  successRate: number;
  avgDuration: number;
  totalFailures: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function truncateUrl(url: string, max = 50) {
  if (!url) return '-';
  return url.length > max ? url.slice(0, max) + '...' : url;
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function StatSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm animate-pulse">
      <div className="h-3 w-20 rounded bg-muted mb-3" />
      <div className="h-7 w-16 rounded bg-muted" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b last:border-b-0">
      <td className="px-4 py-3"><div className="h-3 w-40 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-10 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WebhookLogsPage() {
  const t = useTranslations('admin.webhookLogs');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [successFilter, setSuccessFilter] = useState('');
  const [event, setEvent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(successFilter && { success: successFilter }),
      ...(event && { event }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    }),
    [page, successFilter, event, startDate, endDate],
  );

  const { data, isLoading, isError, refetch } = useAdminWebhookLogs(params);
  const { data: stats, isLoading: statsLoading } = useAdminWebhookLogStats();

  const entries: WebhookLogEntry[] = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const statsData = stats as WebhookLogStats | undefined;

  function updateFilter<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
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
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Activity className="h-4 w-4" />
                {t('totalDeliveries')}
              </div>
              <p className="text-2xl font-bold">{statsData?.totalDeliveries ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {t('successRate')}
              </div>
              <p className="text-2xl font-bold text-green-600">
                {statsData?.successRate != null ? `${statsData.successRate}%` : '-'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                {t('avgDuration')}
              </div>
              <p className="text-2xl font-bold">
                {statsData?.avgDuration != null ? `${statsData.avgDuration}ms` : '-'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                {t('totalFailures')}
              </div>
              <p className="text-2xl font-bold text-red-600">{statsData?.totalFailures ?? 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <Filter className="h-4 w-4" />
          {t('filters')}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('status')}</label>
            <select
              value={successFilter}
              onChange={(e) => updateFilter(setSuccessFilter)(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="">{t('all')}</option>
              <option value="true">{t('success')}</option>
              <option value="false">{t('failed')}</option>
            </select>
          </div>

          {/* Event */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('event')}</label>
            <input
              type="text"
              value={event}
              onChange={(e) => updateFilter(setEvent)(e.target.value)}
              placeholder={t('eventPlaceholder')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
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
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
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
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('loadError')}</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('webhookUrl')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('event')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('duration')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('attempt')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('time')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}

              {!isLoading && !isError && entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Webhook className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noLogs')}</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                entries.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {expandedId === entry.id ? (
                            <ChevronUp className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-sm font-mono truncate block max-w-[250px]" title={entry.webhookUrl}>
                            {truncateUrl(entry.webhookUrl)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">{entry.event}</span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.success ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="h-3 w-3" />
                            {entry.statusCode || t('ok')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="h-3 w-3" />
                            {entry.statusCode || t('failed')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {entry.duration != null ? `${entry.duration}ms` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.attempt}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(entry.createdAt, locale)}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr className="border-b last:border-b-0 bg-muted/10">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-md border bg-background p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">{t('requestBody')}</p>
                              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                                {entry.requestBody
                                  ? (() => {
                                      try {
                                        return JSON.stringify(JSON.parse(entry.requestBody), null, 2);
                                      } catch {
                                        return entry.requestBody;
                                      }
                                    })()
                                  : t('noRequestBody')}
                              </pre>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">{t('responseBody')}</p>
                              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                                {entry.responseBody
                                  ? (() => {
                                      try {
                                        return JSON.stringify(JSON.parse(entry.responseBody), null, 2);
                                      } catch {
                                        return entry.responseBody;
                                      }
                                    })()
                                  : t('noResponseBody')}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && (
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />
      )}
    </div>
  );
}
