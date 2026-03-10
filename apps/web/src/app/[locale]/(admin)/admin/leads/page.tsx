'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useAdminLeads,
  useAdminLeadStats,
  useDeleteAdminLead,
  useBulkUpdateLeadStatus,
  useBulkDeleteLeads,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/exportCsv';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Search,
  Trash2,
  UserPlus,
  Sparkles,
  CheckCircle,
  TrendingUp,
  Target,
  Download,
  Phone,
  Star,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Status badge colours
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONTACTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  QUALIFIED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  CONVERTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ALL_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'] as const;
type StatusFilter = '' | (typeof ALL_STATUSES)[number];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminLeadsPage() {
  const t = useTranslations('admin.leads');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Clear selection when page, search, or status changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, debouncedSearch, statusFilter]);

  const { data, isLoading, isError, refetch } = useAdminLeads({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });
  const { data: stats, isLoading: statsLoading } = useAdminLeadStats();
  const deleteLead = useDeleteAdminLead();
  const bulkStatus = useBulkUpdateLeadStatus();
  const bulkDelete = useBulkDeleteLeads();

  const leads = data?.leads ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l: any) => l.id)));
    }
  }, [selectedIds.size, leads]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const someSelected = selectedIds.size > 0;

  // Derive stat values from byStatus array
  const newCount = useMemo(() => {
    if (!stats?.byStatus) return 0;
    const found = stats.byStatus.find((s: any) => s.status === 'NEW');
    return found?._count ?? 0;
  }, [stats]);

  const convertedCount = useMemo(() => {
    if (!stats?.byStatus) return 0;
    const found = stats.byStatus.find((s: any) => s.status === 'CONVERTED');
    return found?._count ?? 0;
  }, [stats]);

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      NEW: t('statusNew'),
      CONTACTED: t('statusContacted'),
      QUALIFIED: t('statusQualified'),
      CONVERTED: t('statusConverted'),
      LOST: t('statusLost'),
    };
    return map[status] ?? status;
  }

  function handleDelete(leadId: string) {
    setConfirmDialog({
      open: true,
      title: t('deleteLead'),
      message: t('confirmDelete'),
      variant: 'danger',
      onConfirm: () => {
        deleteLead.mutate(leadId, {
          onSuccess: () => addToast('success', t('deleteSuccess')),
          onError: () => addToast('error', t('deleteFailed')),
        });
      },
    });
  }

  function handleExport() {
    if (!leads.length) return;
    const rows = leads.map((lead: any) => ({
      [t('csvName')]: lead.name || '',
      [t('csvEmail')]: lead.email || '',
      [t('csvPhone')]: lead.phone || '',
      [t('csvOrganization')]: lead.org?.name ?? '',
      [t('csvStatus')]: lead.status,
      [t('csvSource')]: lead.source || '',
      [t('csvConfidence')]: lead.confidence != null ? `${lead.confidence}%` : '',
      [t('csvAssignedTo')]: lead.assignedUser
        ? `${lead.assignedUser.firstName ?? ''} ${lead.assignedUser.lastName ?? ''}`.trim()
        : '',
      [t('csvCreated')]: fmtDateTime(lead.createdAt, locale),
    }));
    exportToCsv('admin-leads', rows);
  }

  // Bulk action handlers
  function handleBulkContacted() {
    const ids = Array.from(selectedIds);
    setConfirmDialog({
      open: true,
      title: t('bulkContacted', { count: ids.length }),
      message: t('confirmBulkContacted', { count: ids.length }),
      variant: 'default',
      onConfirm: () => {
        bulkStatus.mutate(
          { leadIds: ids, status: 'CONTACTED' },
          {
            onSuccess: () => setSelectedIds(new Set()),
          },
        );
      },
    });
  }

  function handleBulkQualified() {
    const ids = Array.from(selectedIds);
    setConfirmDialog({
      open: true,
      title: t('bulkQualified', { count: ids.length }),
      message: t('confirmBulkQualified', { count: ids.length }),
      variant: 'default',
      onConfirm: () => {
        bulkStatus.mutate(
          { leadIds: ids, status: 'QUALIFIED' },
          {
            onSuccess: () => setSelectedIds(new Set()),
          },
        );
      },
    });
  }

  function handleBulkConverted() {
    const ids = Array.from(selectedIds);
    setConfirmDialog({
      open: true,
      title: t('bulkConverted', { count: ids.length }),
      message: t('confirmBulkConverted', { count: ids.length }),
      variant: 'default',
      onConfirm: () => {
        bulkStatus.mutate(
          { leadIds: ids, status: 'CONVERTED' },
          {
            onSuccess: () => setSelectedIds(new Set()),
          },
        );
      },
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setConfirmDialog({
      open: true,
      title: t('bulkDelete', { count: ids.length }),
      message: t('confirmBulkDelete', { count: ids.length }),
      variant: 'danger',
      onConfirm: () => {
        bulkDelete.mutate(ids, {
          onSuccess: () => setSelectedIds(new Set()),
        });
      },
    });
  }

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: '', label: t('all') },
    { key: 'NEW', label: t('statusNew') },
    { key: 'CONTACTED', label: t('statusContacted') },
    { key: 'QUALIFIED', label: t('statusQualified') },
    { key: 'CONVERTED', label: t('statusConverted') },
    { key: 'LOST', label: t('statusLost') },
  ];

  if (isError) {
    return (
      <ErrorState
        title={tc('error')}
        description={t('errorDescription')}
        retryLabel={tc('retry')}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="relative pb-16">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {statsLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <Skeleton variant="text" className="w-20 h-3" />
                <Skeleton variant="text" className="w-16 h-7" />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <UserPlus className="h-4 w-4" />
                {t('totalLeads')}
              </div>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-1">
                <Sparkles className="h-4 w-4" />
                {t('newLeads')}
              </div>
              <p className="text-2xl font-bold">{newCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
                <CheckCircle className="h-4 w-4" />
                {t('convertedLeads')}
              </div>
              <p className="text-2xl font-bold">{convertedCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
                <TrendingUp className="h-4 w-4" />
                {t('conversionRate')}
              </div>
              <p className="text-2xl font-bold">
                {stats?.conversionRate != null ? `${stats.conversionRate}%` : '0%'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Conversion Funnel */}
      {!statsLoading && stats?.byStatus && (
        <div className="rounded-xl border bg-card p-6 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {t('conversionFunnel')}
          </h3>
          {(() => {
            const stages = [
              { key: 'NEW', label: t('statusNew'), color: 'bg-blue-500' },
              { key: 'CONTACTED', label: t('statusContacted'), color: 'bg-amber-500' },
              { key: 'QUALIFIED', label: t('statusQualified'), color: 'bg-purple-500' },
              { key: 'CONVERTED', label: t('statusConverted'), color: 'bg-green-500' },
            ];
            const maxCount = Math.max(
              ...stages.map((s) => {
                const found = stats.byStatus.find((bs: any) => bs.status === s.key);
                return found?._count ?? 0;
              }),
              1,
            );
            return (
              <div className="space-y-3">
                {stages.map((stage) => {
                  const found = stats.byStatus.find((bs: any) => bs.status === stage.key);
                  const count = found?._count ?? 0;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={stage.key} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-24 shrink-0">{stage.label}</span>
                      <div className="flex-1 h-7 rounded bg-muted/50 overflow-hidden">
                        <div
                          className={cn('h-full rounded transition-all', stage.color)}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold tabular-nums w-10 text-end">{count}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-card ps-10 pe-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex rounded-lg border bg-card overflow-hidden">
          {statusTabs.map((tab) => (
            <button
              key={tab.key || 'all'}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                statusFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          disabled={!leads.length}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          {tc('export')}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 w-10" />
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('name')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('email')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('phone')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('organization')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('status')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('source')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('confidence')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('assignedTo')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('created')}
                  </th>
                  <th className="text-end px-4 py-3 font-medium text-muted-foreground">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Skeleton variant="rect" className="h-4 w-4" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="text" className="w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="text" className="w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="text" className="w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="text" className="w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="rect" className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="text" className="w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="text" className="w-10" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="text" className="w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="text" className="w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton variant="rect" className="h-7 w-8" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Target}
            title={t('noLeads')}
            description={t('noLeadsDescription')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border text-primary focus-visible:ring-primary cursor-pointer"
                      title={t('selectAll')}
                    />
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('name')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('email')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('phone')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('organization')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('status')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('source')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('confidence')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('assignedTo')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('created')}
                  </th>
                  <th className="text-end px-4 py-3 font-medium text-muted-foreground">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.map((lead: any) => {
                  const isSelected = selectedIds.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={cn(
                        'hover:bg-muted/50 transition-colors',
                        isSelected && 'bg-primary/5',
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(lead.id)}
                          className="h-4 w-4 rounded border text-primary focus-visible:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{lead.name || '\u2014'}</td>
                      <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                        {lead.email || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                        {lead.phone || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lead.org?.name ?? '\u2014'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            STATUS_BADGE[lead.status] ?? 'bg-muted text-muted-foreground',
                          )}
                        >
                          {statusLabel(lead.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{lead.source || '\u2014'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lead.confidence != null ? `${lead.confidence}%` : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lead.assignedUser
                          ? `${lead.assignedUser.firstName ?? ''} ${lead.assignedUser.lastName ?? ''}`.trim() ||
                            '\u2014'
                          : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(lead.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => handleDelete(lead.id)}
                            disabled={deleteLead.isPending}
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title={t('deleteLead')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="border-t px-4 py-3">
            <AdminPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              previousLabel={tc('previous')}
              nextLabel={tc('next')}
              pageLabel={tc('page')}
              ofLabel={tc('of')}
            />
          </div>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      {someSelected && (
        <div className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-muted-foreground">
            {t('selected', { count: selectedIds.size })}
          </span>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={handleBulkContacted}
            disabled={bulkStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Phone className="h-3.5 w-3.5" />
            {t('bulkContacted', { count: selectedIds.size })}
          </button>
          <button
            onClick={handleBulkQualified}
            disabled={bulkStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Star className="h-3.5 w-3.5" />
            {t('bulkQualified', { count: selectedIds.size })}
          </button>
          <button
            onClick={handleBulkConverted}
            disabled={bulkStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {t('bulkConverted', { count: selectedIds.size })}
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('bulkDelete', { count: selectedIds.size })}
          </button>
          <button
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
            {t('clearSelection')}
          </button>
        </div>
      )}

      <AdminConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        loading={deleteLead.isPending || bulkStatus.isPending || bulkDelete.isPending}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
