'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useAdminConversations,
  useAdminConversationStats,
  useBulkUpdateConversationStatus,
  useDeleteAdminConversation,
  useBulkDeleteConversations,
} from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/exportCsv';
import {
  Search,
  MessageCircle,
  Play,
  CheckCircle,
  BarChart,
  Eye,
  Filter,
  X,
  Download,
  Archive,
  Trash2,
} from 'lucide-react';

/* ── Status badge colours ─────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  HANDED_OFF: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WAITING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  RESOLVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

const STATUS_OPTIONS = ['ACTIVE', 'HANDED_OFF', 'WAITING', 'RESOLVED', 'ARCHIVED'] as const;

/* ── Page component ───────────────────────────────────────── */
export default function AdminConversationsPage() {
  const t = useTranslations('admin.conversations');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  /* ── Local state ──────────────────────────────────────── */
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [status, startDate, endDate]);

  // Clear selection when page, search, or status changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, debouncedSearch, status, startDate, endDate]);

  /* ── Data hooks ───────────────────────────────────────── */
  const { data, isLoading, error } = useAdminConversations({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const { data: stats, isLoading: statsLoading } = useAdminConversationStats();
  const bulkStatus = useBulkUpdateConversationStatus();
  const deleteConversation = useDeleteAdminConversation();
  const bulkDelete = useBulkDeleteConversations();

  const conversations = data?.conversations ?? [];
  const totalPages = data?.totalPages ?? 1;

  /* ── Selection handlers ────────────────────────────────── */
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === conversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map((c: any) => c.id)));
    }
  }, [selectedIds.size, conversations]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = conversations.length > 0 && selectedIds.size === conversations.length;
  const someSelected = selectedIds.size > 0;

  /* ── Bulk action handlers ──────────────────────────────── */
  function handleBulkResolve() {
    const ids = Array.from(selectedIds);
    setConfirmDialog({
      open: true,
      title: t('bulkResolve', { count: ids.length }),
      message: t('confirmBulkResolve', { count: ids.length }),
      variant: 'default',
      onConfirm: () => {
        bulkStatus.mutate(
          { conversationIds: ids, status: 'RESOLVED' },
          {
            onSuccess: () => setSelectedIds(new Set()),
          },
        );
      },
    });
  }

  function handleDeleteSingle(id: string) {
    setConfirmDialog({
      open: true,
      title: tc('delete'),
      message: t('confirmDelete'),
      variant: 'danger',
      onConfirm: () => {
        deleteConversation.mutate(id);
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

  function handleBulkArchive() {
    const ids = Array.from(selectedIds);
    setConfirmDialog({
      open: true,
      title: t('bulkArchive', { count: ids.length }),
      message: t('confirmBulkArchive', { count: ids.length }),
      variant: 'danger',
      onConfirm: () => {
        bulkStatus.mutate(
          { conversationIds: ids, status: 'ARCHIVED' },
          {
            onSuccess: () => setSelectedIds(new Set()),
          },
        );
      },
    });
  }

  /* ── Helpers ──────────────────────────────────────────── */
  const activeCount = useMemo(() => {
    if (!stats?.byStatus) return 0;
    const found = stats.byStatus.find((s: any) => s.status === 'ACTIVE');
    return found?._count ?? 0;
  }, [stats]);

  const resolvedCount = useMemo(() => {
    if (!stats?.byStatus) return 0;
    const found = stats.byStatus.find((s: any) => s.status === 'RESOLVED');
    return found?._count ?? 0;
  }, [stats]);

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      ACTIVE: t('statusActive'),
      HANDED_OFF: t('statusHandedOff'),
      WAITING: t('statusWaiting'),
      RESOLVED: t('statusResolved'),
      ARCHIVED: t('statusArchived'),
    };
    return map[s] ?? s;
  }

  function handleExport() {
    if (!conversations.length) return;
    const rows = conversations.map((conv: any) => ({
      [t('csvCustomer')]: conv.customerName ?? conv.leads?.[0]?.name ?? '',
      [t('csvEmail')]: conv.customerEmail ?? conv.leads?.[0]?.email ?? '',
      [t('csvOrganization')]: conv.org?.name ?? '',
      [t('csvChannel')]: conv.channel?.name ?? '',
      [t('csvChannelType')]: conv.channel?.type ?? '',
      [t('csvMessages')]: conv._count?.messages ?? 0,
      [t('csvStatus')]: conv.status,
      [t('csvEmotion')]: conv.lastEmotion ?? '',
      [t('csvLastMessage')]: fmtDateTime(conv.lastMessageAt, locale),
    }));
    exportToCsv('admin-conversations', rows);
  }

  function clearFilters() {
    setStatus('');
    setStartDate('');
    setEndDate('');
  }

  const hasActiveFilters = status || startDate || endDate;

  /* ── Error state ──────────────────────────────────────── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tc('error')}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary hover:underline"
        >
          {tc('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative pb-16">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: t('totalConversations'),
            value: stats?.total,
            icon: MessageCircle,
            color: 'text-primary',
          },
          {
            label: t('activeConversations'),
            value: activeCount,
            icon: Play,
            color: 'text-green-600 dark:text-green-400',
          },
          {
            label: t('resolvedConversations'),
            value: resolvedCount,
            icon: CheckCircle,
            color: 'text-blue-600 dark:text-blue-400',
          },
          {
            label: t('avgMessages'),
            value: stats?.avgMessages != null ? Number(stats.avgMessages).toFixed(1) : undefined,
            icon: BarChart,
            color: 'text-primary',
          },
        ].map((card, idx) => (
          <div key={idx} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <card.icon className={cn('h-4 w-4', card.color)} />
              <span className="text-sm">{card.label}</span>
            </div>
            {statsLoading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-2xl font-bold">{card.value ?? 0}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Search & filters bar ────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
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

        {/* Toggle filters */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted',
            hasActiveFilters && 'border-primary text-primary',
          )}
        >
          <Filter className="h-4 w-4" />
          {tc('filters')}
        </button>

        {/* Export CSV */}
        <button
          onClick={handleExport}
          disabled={!conversations.length}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          {tc('export')}
        </button>
      </div>

      {/* ── Expanded filters ────────────────────────────── */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6 rounded-xl border bg-card p-4">
          {/* Status */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('status')}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t('allStatuses')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('startDate')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* End date */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('endDate')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          /* Loading skeleton */
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="flex-1" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">{t('noConversations')}</p>
          </div>
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
                    {t('customer')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('organization')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('channel')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('messages')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('status')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('emotion')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('lastMessage')}
                  </th>
                  <th className="text-end px-4 py-3 font-medium text-muted-foreground">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {conversations.map((conv: any) => {
                  const isSelected = selectedIds.has(conv.id);
                  return (
                    <tr
                      key={conv.id}
                      className={cn(
                        'hover:bg-muted/50 transition-colors',
                        isSelected && 'bg-primary/5',
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(conv.id)}
                          className="h-4 w-4 rounded border text-primary focus-visible:ring-primary cursor-pointer"
                        />
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">
                            {conv.customerName ?? conv.leads?.[0]?.name ?? '\u2014'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {conv.customerEmail ?? conv.leads?.[0]?.email ?? ''}
                          </p>
                        </div>
                      </td>

                      {/* Organization */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {conv.org?.name ?? '\u2014'}
                      </td>

                      {/* Channel */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{conv.channel?.name ?? '\u2014'}</span>
                          {conv.channel?.type && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                              {t(`channel_${conv.channel.type}`)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Messages count */}
                      <td className="px-4 py-3 font-medium">{conv._count?.messages ?? 0}</td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            STATUS_COLORS[conv.status] ?? STATUS_COLORS.ACTIVE,
                          )}
                        >
                          {statusLabel(conv.status)}
                        </span>
                      </td>

                      {/* Emotion */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {conv.lastEmotion ? t(`emotion_${conv.lastEmotion}`) : '\u2014'}
                      </td>

                      {/* Last message */}
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {fmtDateTime(conv.lastMessageAt, locale)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/${locale}/admin/conversations/${conv.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 text-xs font-medium transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t('viewDetail')}
                          </Link>
                          <button
                            onClick={() => handleDeleteSingle(conv.id)}
                            disabled={deleteConversation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {tc('delete')}
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

        {/* Pagination */}
        {!isLoading && conversations.length > 0 && (
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
            onClick={handleBulkResolve}
            disabled={bulkStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {t('bulkResolve', { count: selectedIds.size })}
          </button>
          <button
            onClick={handleBulkArchive}
            disabled={bulkStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-accent px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" />
            {t('bulkArchive', { count: selectedIds.size })}
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
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
