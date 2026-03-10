'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import { useAdminInvoices, useAdminInvoiceStats, useUpdateAdminInvoice } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Receipt, DollarSign, Clock, RefreshCw, Loader2, FileText } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceEntry {
  id: string;
  amount: number;
  currency: string;
  status: string; // PENDING | PAID | FAILED | REFUNDED
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  subscription?: { id: string; plan: string; status: string; org: { id: string; name: string } };
}

type StatusFilter = '' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

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
        <div className="h-3 w-20 rounded bg-muted" />
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
        <div className="h-3 w-20 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-20 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-16 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-7 w-24 rounded bg-muted" />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REFUNDED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminInvoicesPage() {
  const t = useTranslations('admin.invoices');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(statusFilter && { status: statusFilter }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    }),
    [page, statusFilter, startDate, endDate],
  );

  const { data, isLoading, isError, refetch } = useAdminInvoices(params);
  const { data: stats, isLoading: statsLoading } = useAdminInvoiceStats();
  const updateInvoice = useUpdateAdminInvoice();

  const entries: InvoiceEntry[] = data?.invoices ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Handle status update
  function handleStatusChange(invoiceId: string, newStatus: string) {
    updateInvoice.mutate(
      { invoiceId, status: newStatus },
      {
        onSuccess: () => addToast('success', t('toasts.updated')),
        onError: () => addToast('error', t('toasts.error')),
      },
    );
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
                <Receipt className="h-4 w-4" />
                {t('totalInvoices')}
              </div>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4 text-green-500" />
                {t('totalRevenue')}
              </div>
              <p className="text-2xl font-bold text-green-600">${stats?.totalRevenue ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4 text-yellow-500" />
                {t('pendingAmount')}
              </div>
              <p className="text-2xl font-bold text-yellow-600">${stats?.pendingAmount ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                {t('refundedAmount')}
              </div>
              <p className="text-2xl font-bold text-blue-600">${stats?.refundedAmount ?? 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
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
            <option value="PENDING">{t('status_PENDING')}</option>
            <option value="PAID">{t('status_PAID')}</option>
            <option value="FAILED">{t('status_FAILED')}</option>
            <option value="REFUNDED">{t('status_REFUNDED')}</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">{t('startDate')}:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">{t('endDate')}:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        {(statusFilter || startDate || endDate) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            {tc('filters')}
          </button>
        )}
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
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('invoiceId')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('organization')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('amount')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('dueDate')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('paidDate')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('plan')}
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
                  <td colSpan={8} className="py-16 text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noInvoices')}</p>
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
                    {/* Invoice ID (truncated) */}
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-muted-foreground">
                        {entry.id.slice(0, 8)}...
                      </code>
                    </td>

                    {/* Organization */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium truncate max-w-[160px] block">
                        {entry.subscription?.org?.name ?? '--'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold">
                        {formatCurrency(entry.amount, entry.currency, locale)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          STATUS_BADGE[entry.status] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {t(`status_${entry.status}`)}
                      </span>
                    </td>

                    {/* Due Date */}
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDate(entry.dueDate, locale)}
                    </td>

                    {/* Paid Date */}
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDate(entry.paidAt, locale)}
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      {entry.subscription?.plan ? (
                        <span className="inline-block rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 text-[10px] font-medium">
                          {t(`plan_${entry.subscription.plan}`)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </td>

                    {/* Actions - Status Update */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={entry.status}
                          onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                          disabled={updateInvoice.isPending}
                          className="rounded-lg border bg-background px-2 py-1 text-xs outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
                        >
                          <option value="PENDING">{t('status_PENDING')}</option>
                          <option value="PAID">{t('status_PAID')}</option>
                          <option value="FAILED">{t('status_FAILED')}</option>
                          <option value="REFUNDED">{t('status_REFUNDED')}</option>
                        </select>
                        {updateInvoice.isPending && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
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
