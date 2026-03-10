'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import {
  useAdminWebhooks,
  useAdminWebhookStats,
  useUpdateAdminWebhook,
  useDeleteAdminWebhook,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Webhook, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  org?: { id: string; name: string };
  _count?: { logs: number };
}

type StatusFilter = '' | 'active' | 'inactive';

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
        <div className="h-3 w-40 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-24 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-20 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-16 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-12 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-20 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-7 w-20 rounded bg-muted" />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminWebhooksPage() {
  const t = useTranslations('admin.adminWebhooks');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(statusFilter && { status: statusFilter }),
    }),
    [page, statusFilter],
  );

  const { data, isLoading, isError, refetch } = useAdminWebhooks(params);
  const { data: stats, isLoading: statsLoading } = useAdminWebhookStats();
  const updateWebhook = useUpdateAdminWebhook();
  const deleteWebhook = useDeleteAdminWebhook();

  const entries: WebhookEntry[] = data?.webhooks ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Toggle active state
  function handleToggleActive(entry: WebhookEntry) {
    updateWebhook.mutate(
      { webhookId: entry.id, isActive: !entry.isActive },
      {
        onSuccess: () => addToast('success', t('toasts.updated')),
        onError: () => addToast('error', t('toasts.error')),
      },
    );
  }

  // Delete webhook
  function handleDelete(id: string) {
    setConfirmDialog({
      open: true,
      title: t('deleteTitle'),
      message: t('confirmDelete'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteWebhook.mutateAsync(id);
          addToast('success', t('toasts.deleted'));
        } catch {
          addToast('error', t('toasts.error'));
        }
      },
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Stat Cards */}
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
                <Webhook className="h-4 w-4" />
                {t('totalWebhooks')}
              </div>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {t('active')}
              </div>
              <p className="text-2xl font-bold text-green-600">{stats?.active ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                {t('inactive')}
              </div>
              <p className="text-2xl font-bold text-red-600">{stats?.inactive ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t('recentErrors')}
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats?.recentErrors ?? 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">{t('status')}:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
          >
            <option value="">{t('allStatuses')}</option>
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive')}</option>
          </select>
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
                  {t('url')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('organization')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('events')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('logs')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('created')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}

              {!isLoading && !isError && entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Webhook className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noWebhooks')}</p>
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
                    {/* URL (truncated) */}
                    <td className="px-4 py-3">
                      <span
                        className="text-sm font-mono text-muted-foreground truncate max-w-[260px] block"
                        title={entry.url}
                      >
                        {entry.url.length > 50 ? entry.url.slice(0, 50) + '...' : entry.url}
                      </span>
                    </td>

                    {/* Organization */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium truncate max-w-[140px] block">
                        {entry.org?.name ?? '--'}
                      </span>
                    </td>

                    {/* Events (badges) */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(entry.events ?? []).map((event) => (
                          <span
                            key={event}
                            className="inline-block rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 text-[10px] font-medium"
                          >
                            {event}
                          </span>
                        ))}
                        {(!entry.events || entry.events.length === 0) && (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </div>
                    </td>

                    {/* Status (toggle) */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(entry)}
                        disabled={updateWebhook.isPending}
                        className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: entry.isActive
                            ? 'rgb(34, 197, 94)'
                            : 'rgb(209, 213, 219)',
                        }}
                        role="switch"
                        aria-checked={entry.isActive}
                      >
                        <span
                          className={cn(
                            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                            entry.isActive ? 'translate-x-4' : 'translate-x-0.5',
                          )}
                        />
                      </button>
                    </td>

                    {/* Logs count */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {entry._count?.logs ?? 0}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDate(entry.createdAt, locale)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={deleteWebhook.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        {tc('delete')}
                      </button>
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
