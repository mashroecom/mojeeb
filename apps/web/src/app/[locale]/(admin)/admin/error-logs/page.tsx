'use client';

import { useState, useMemo, Fragment } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import { useAdminErrorLogs, useCleanupErrorLogs } from '@/hooks/useAdmin';
import { exportToCsv } from '@/lib/exportCsv';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  AlertTriangle,
  Filter,
  Calendar,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Download,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorLogEntry {
  id: string;
  level: string;
  message: string;
  source: string;
  path?: string;
  stack?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function truncateMessage(msg: string, max = 80) {
  if (!msg) return '-';
  return msg.length > max ? msg.slice(0, max) + '...' : msg;
}

function levelBadge(level: string) {
  switch (level?.toLowerCase()) {
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {level}
        </span>
      );
    case 'warn':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          {level}
        </span>
      );
    case 'info':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {level}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          {level}
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b last:border-b-0">
      <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-48 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ErrorLogsPage() {
  const t = useTranslations('admin.errorLogs');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState('');
  const [source, setSource] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Cleanup state
  const [showCleanup, setShowCleanup] = useState(false);
  const [cleanupDays, setCleanupDays] = useState('30');

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(level && { level }),
      ...(source && { source }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(search && { search }),
    }),
    [page, level, source, startDate, endDate, search],
  );

  const { data, isLoading, isError, refetch } = useAdminErrorLogs(params);
  const cleanupMutation = useCleanupErrorLogs();

  const entries: ErrorLogEntry[] = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function handleExport() {
    if (!entries.length) return;
    const rows = entries.map((entry) => ({
      Level: entry.level,
      Message: entry.message,
      Source: entry.source || '',
      Path: entry.path || '',
      Time: fmtDateTime(entry.createdAt, locale),
    }));
    exportToCsv('admin-error-logs', rows);
  }

  function updateFilter<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function handleCleanup() {
    const days = parseInt(cleanupDays, 10);
    if (isNaN(days) || days < 1) return;
    cleanupMutation.mutate(days, {
      onSuccess: () => {
        setShowCleanup(false);
        setCleanupDays('30');
      },
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={!entries.length}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {tc('export')}
          </button>
          <button
            onClick={() => setShowCleanup(!showCleanup)}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Trash2 className="h-4 w-4" />
            {t('cleanup')}
          </button>
        </div>
      </div>

      {/* Cleanup Panel */}
      {showCleanup && (
        <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">{t('deleteOldLogs')}</h3>
            <button onClick={() => setShowCleanup(false)} aria-label={tc('close')} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('deleteOlderThan')}
              </label>
              <input
                type="number"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(e.target.value)}
                min={1}
                className="w-32 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <button
              onClick={handleCleanup}
              disabled={cleanupMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Trash2 className="h-4 w-4" />
              {cleanupMutation.isPending ? t('deleting') : tc('delete')}
            </button>
          </div>
          {cleanupMutation.isSuccess && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">{t('cleanupSuccess')}</p>
          )}
          {cleanupMutation.isError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t('cleanupFailed')}</p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <Filter className="h-4 w-4" />
          {t('filters')}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Level */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('level')}</label>
            <select
              value={level}
              onChange={(e) => updateFilter(setLevel)(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="">{t('all')}</option>
              <option value="error">{t('error')}</option>
              <option value="warn">{t('warn')}</option>
              <option value="info">{t('info')}</option>
            </select>
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('source')}</label>
            <input
              type="text"
              value={source}
              onChange={(e) => updateFilter(setSource)(e.target.value)}
              placeholder={t('sourcePlaceholder')}
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

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              <Search className="inline h-3 w-3 me-1" />
              {t('search')}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => updateFilter(setSearch)(e.target.value)}
              placeholder={t('searchPlaceholder')}
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
                  {t('level')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('message')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('source')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('path')}
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
                  <td colSpan={5} className="py-16 text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
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
                      <td className="px-4 py-3">{levelBadge(entry.level)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {expandedId === entry.id ? (
                            <ChevronUp className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-sm truncate block max-w-[300px]" title={entry.message}>
                            {truncateMessage(entry.message)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.source || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-muted-foreground truncate block max-w-[200px]" title={entry.path}>
                          {entry.path || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(entry.createdAt, locale)}
                      </td>
                    </tr>
                    {expandedId === entry.id && entry.stack && (
                      <tr className="border-b last:border-b-0 bg-muted/10">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="rounded-md border bg-background p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">{t('stackTrace')}</p>
                            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                              {entry.stack}
                            </pre>
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

