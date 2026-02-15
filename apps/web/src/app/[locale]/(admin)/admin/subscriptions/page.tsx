'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import {
  useAdminSubscriptions,
  useAdminSubscriptionDetail,
  useUpdateSubscription,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { PLAN_COLORS, STATUS_COLORS, INVOICE_STATUS_COLORS } from '@/lib/admin-constants';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/exportCsv';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  CreditCard,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  X,
  Loader2,
  Calendar,
  Receipt,
  BarChart3,
  Download,
} from 'lucide-react';

type PlanFilter = '' | 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
type StatusFilter = '' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';


function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isHigh = pct >= 80;

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isHigh ? 'bg-red-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Panel (loaded on expand)
// ---------------------------------------------------------------------------

function SubscriptionDetail({ id, t }: { id: string; t: ReturnType<typeof useTranslations> }) {
  const locale = useLocale();
  const { data: detail, isLoading } = useAdminSubscriptionDetail(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) return null;

  const invoices = detail.invoices ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Billing Period */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">{t('period')}</h4>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('periodStart')}</span>
            <span className="font-medium">{detail.currentPeriodStart ? fmtDate(detail.currentPeriodStart, locale) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('periodEnd')}</span>
            <span className="font-medium">{detail.currentPeriodEnd ? fmtDate(detail.currentPeriodEnd, locale) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('createdAt')}</span>
            <span className="font-medium">{detail.createdAt ? fmtDate(detail.createdAt, locale) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('cancelAtEnd')}</span>
            <span className={cn('font-medium', detail.cancelAtPeriodEnd ? 'text-red-500' : '')}>
              {detail.cancelAtPeriodEnd ? t('yes') : t('no')}
            </span>
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">{t('usageLimits')}</h4>
        </div>
        <div className="space-y-3">
          <UsageBar
            used={detail.messagesUsed ?? 0}
            limit={detail.messagesLimit ?? 0}
            label={t('messages')}
          />
          <UsageBar
            used={detail.agentsUsed ?? 0}
            limit={detail.agentsLimit ?? 0}
            label={t('agents')}
          />
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="rounded-lg border bg-muted/20 p-4 sm:col-span-2 lg:col-span-1">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">{t('recentInvoices')}</h4>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('noInvoices')}</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {invoices.map((inv: any) => (
              <div
                key={inv.id}
                className="flex items-center justify-between text-sm rounded-md border bg-card px-3 py-2"
              >
                <div>
                  <span className="font-medium">
                    ${Number(inv.amount).toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground ms-2">
                    {inv.currency}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                      INVOICE_STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {inv.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(inv.createdAt, locale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SubscriptionsPage() {
  const t = useTranslations('admin.subscriptions');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [planFilter, setPlanFilter] = useState<PlanFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editState, setEditState] = useState({
    messagesLimit: 0,
    agentsLimit: 0,
  });

  const { data, isLoading, error } = useAdminSubscriptions({
    page,
    limit: 10,
    plan: planFilter || undefined,
    status: statusFilter || undefined,
  });
  const updateSubscription = useUpdateSubscription();

  const subscriptions = data?.subscriptions ?? [];
  const totalPages = data?.totalPages ?? 1;

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function startEdit(sub: any) {
    setEditId(sub.id);
    setEditState({
      messagesLimit: sub.messagesLimit ?? 0,
      agentsLimit: sub.agentsLimit ?? 0,
    });
  }

  function cancelEdit() {
    setEditId(null);
  }

  function saveEdit(id: string) {
    updateSubscription.mutate(
      {
        id,
        messagesLimit: editState.messagesLimit,
        agentsLimit: editState.agentsLimit,
      },
      {
        onSuccess: () => {
          setEditId(null);
          addToast('success', t('saved'));
        },
        onError: () => addToast('error', tc('error')),
      },
    );
  }

  function handleExport() {
    if (!subscriptions.length) return;
    const rows = subscriptions.map((sub: any) => ({
      Organization: sub.org?.name ?? '',
      Plan: sub.plan,
      Status: sub.status,
      'Messages Used': sub.messagesUsed ?? 0,
      'Messages Limit': sub.messagesLimit ?? 0,
      'Agents Used': sub.agentsUsed ?? 0,
      'Agents Limit': sub.agentsLimit ?? 0,
      'Period Start': fmtDate(sub.currentPeriodStart, locale),
      'Period End': fmtDate(sub.currentPeriodEnd, locale),
    }));
    exportToCsv('admin-subscriptions', rows);
  }

  const planOptions: { value: PlanFilter; label: string }[] = [
    { value: '', label: t('all') },
    { value: 'FREE', label: 'Free' },
    { value: 'STARTER', label: 'Starter' },
    { value: 'PROFESSIONAL', label: 'Professional' },
    { value: 'ENTERPRISE', label: 'Enterprise' },
  ];

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: '', label: t('all') },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PAST_DUE', label: 'Past Due' },
    { value: 'CANCELED', label: 'Canceled' },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tc('error')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">{t('plan')}:</label>
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value as PlanFilter);
              setPage(1);
            }}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {planOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">{t('status')}:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleExport}
          disabled={!subscriptions.length}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          {tc('export')}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-6 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded bg-muted" />
            ))}
          </div>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
            <CreditCard className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">{t('noSubscriptions')}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Subscription Cards */}
          <div className="space-y-3">
            {subscriptions.map((sub: any) => {
              const isExpanded = expandedId === sub.id;
              const isEditing = editId === sub.id;
              const invoiceCount = sub._count?.invoices ?? 0;

              return (
                <div
                  key={sub.id}
                  className="rounded-xl border bg-card shadow-sm overflow-hidden"
                >
                  {/* Main Row */}
                  <div className="flex items-center gap-4 p-4">
                    {/* Expand toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(sub.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {/* Org + plan + status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{sub.org?.name ?? '—'}</p>
                        <span
                          className={cn(
                            'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0',
                            PLAN_COLORS[sub.plan] ?? 'bg-gray-100 text-gray-700',
                          )}
                        >
                          {sub.plan}
                        </span>
                        <span
                          className={cn(
                            'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0',
                            STATUS_COLORS[sub.status] ?? 'bg-gray-100 text-gray-700',
                          )}
                        >
                          {sub.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>
                          {t('period')}: {fmtDate(sub.currentPeriodStart, locale)} — {fmtDate(sub.currentPeriodEnd, locale)}
                        </span>
                        {invoiceCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Receipt className="h-3 w-3" />
                            {invoiceCount} {t('invoices').toLowerCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Usage summary */}
                    <div className="hidden lg:flex items-center gap-6 text-sm shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">{t('messages')}</p>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editState.messagesLimit}
                            onChange={(e) =>
                              setEditState((s) => ({ ...s, messagesLimit: Number(e.target.value) }))
                            }
                            className="w-20 rounded-md border bg-background px-2 py-1 text-xs text-center outline-none focus:border-primary"
                          />
                        ) : (
                          <p className="font-medium">
                            {sub.messagesUsed ?? 0}
                            <span className="text-muted-foreground/60"> / </span>
                            {sub.messagesLimit ?? '∞'}
                          </p>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">{t('agents')}</p>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editState.agentsLimit}
                            onChange={(e) =>
                              setEditState((s) => ({ ...s, agentsLimit: Number(e.target.value) }))
                            }
                            className="w-20 rounded-md border bg-background px-2 py-1 text-xs text-center outline-none focus:border-primary"
                          />
                        ) : (
                          <p className="font-medium">
                            {sub.agentsUsed ?? 0}
                            <span className="text-muted-foreground/60"> / </span>
                            {sub.agentsLimit ?? '∞'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(sub.id)}
                            disabled={updateSubscription.isPending}
                            className="rounded-lg p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                            title={t('save')}
                          >
                            {updateSubscription.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                            title={t('cancel')}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(sub)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title={t('edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile usage (hidden on lg) */}
                  <div className="lg:hidden border-t px-4 py-3">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex-1 text-center">
                        <p className="text-xs text-muted-foreground">{t('messages')}</p>
                        <p className="font-medium">
                          {sub.messagesUsed ?? 0} / {sub.messagesLimit ?? '∞'}
                        </p>
                      </div>
                      <div className="flex-1 text-center">
                        <p className="text-xs text-muted-foreground">{t('agents')}</p>
                        <p className="font-medium">
                          {sub.agentsUsed ?? 0} / {sub.agentsLimit ?? '∞'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t bg-muted/5 p-4">
                      <SubscriptionDetail id={sub.id} t={t} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />
        </>
      )}
    </div>
  );
}
