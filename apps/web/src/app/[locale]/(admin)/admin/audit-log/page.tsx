'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import { useAdminAuditLog } from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  ScrollText,
  Loader2,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_OPTIONS = [
  'USER_CREATED',
  'USER_UPDATED',
  'USER_SUSPENDED',
  'USER_DELETED',
  'ORG_CREATED',
  'ORG_UPDATED',
  'ORG_SUSPENDED',
  'ORG_DELETED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_CANCELED',
  'ANNOUNCEMENT_CREATED',
  'ANNOUNCEMENT_UPDATED',
  'ANNOUNCEMENT_DELETED',
  'AGENT_CREATED',
  'AGENT_UPDATED',
  'AGENT_DELETED',
  'CHANNEL_CREATED',
  'CHANNEL_DELETED',
  'SETTINGS_UPDATED',
] as const;

const TARGET_OPTIONS = [
  'User',
  'Organization',
  'Subscription',
  'Announcement',
  'Agent',
  'Channel',
  'Settings',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function getActionColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('create')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (lower.includes('update')) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  if (lower.includes('delete') || lower.includes('suspend') || lower.includes('cancel'))
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function renderMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(metadata).map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono"
        >
          <span className="text-muted-foreground">{key}:</span>{' '}
          <span className="ms-0.5 font-medium truncate max-w-[120px]">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b last:border-b-0">
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-5 w-24 rounded-full bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-32 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Expandable Row (mobile metadata)
// ---------------------------------------------------------------------------

function AuditRow({ entry, t }: { entry: AuditLogEntry; t: ReturnType<typeof useTranslations> }) {
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <>
      <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
        {/* User */}
        <td className="px-4 py-3">
          <div className="text-sm font-medium truncate max-w-[180px]">
            {entry.userName || entry.userEmail || entry.userId}
          </div>
          {entry.userName && entry.userEmail && (
            <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
              {entry.userEmail}
            </div>
          )}
        </td>

        {/* Action */}
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
              getActionColor(entry.action),
            )}
          >
            {entry.action}
          </span>
        </td>

        {/* Target Type */}
        <td className="px-4 py-3 text-sm">{entry.targetType}</td>

        {/* Target ID */}
        <td className="px-4 py-3">
          <span className="text-xs font-mono text-muted-foreground truncate block max-w-[100px]">
            {entry.targetId}
          </span>
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
          {fmtDateTime(entry.createdAt, locale)}
        </td>

        {/* Details */}
        <td className="px-4 py-3">
          <div className="hidden lg:block">
            {renderMetadata(entry.metadata)}
            {!hasMetadata && <span className="text-xs text-muted-foreground">-</span>}
          </div>
          {/* Mobile toggle */}
          {hasMetadata && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="lg:hidden inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
            >
              {t('details')}
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          {!hasMetadata && (
            <span className="lg:hidden text-xs text-muted-foreground">-</span>
          )}
        </td>
      </tr>

      {/* Expanded metadata row for mobile */}
      {expanded && hasMetadata && (
        <tr className="lg:hidden border-b bg-muted/20">
          <td colSpan={6} className="px-4 py-3">
            {renderMetadata(entry.metadata)}
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditLogPage() {
  const t = useTranslations('admin.auditLog');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(action && { action }),
      ...(targetType && { targetType }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    }),
    [page, action, targetType, startDate, endDate],
  );

  const { data, isLoading, isError, refetch } = useAdminAuditLog(params);

  const entries: AuditLogEntry[] = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Reset to page 1 when filters change
  function updateFilter<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  // --- Render ---

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {/* Filters */}
      <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <Filter className="h-4 w-4" />
          {t('filters')}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Action filter */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('filterAction')}
            </label>
            <select
              value={action}
              onChange={(e) => updateFilter(setAction)(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="">{t('allActions')}</option>
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Target type filter */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('filterTarget')}
            </label>
            <select
              value={targetType}
              onChange={(e) => updateFilter(setTargetType)(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="">{t('allTargets')}</option>
              {TARGET_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
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
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('user')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('action')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('target')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ID
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('date')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('details')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}

              {!isLoading && !isError && entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <ScrollText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noLogs')}</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} t={t} />
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
