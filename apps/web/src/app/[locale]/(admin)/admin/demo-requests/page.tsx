'use client';

import { Fragment, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import {
  useAdminDemoRequests,
  useUpdateDemoRequest,
  useDeleteDemoRequest,
} from '@/hooks/useAdmin';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Presentation,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type StatusFilter = '' | 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'COMPLETED' | 'REJECTED';

const ALL_STATUSES = ['NEW', 'CONTACTED', 'SCHEDULED', 'COMPLETED', 'REJECTED'] as const;

const STATUS_BADGE: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONTACTED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  SCHEDULED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function DemoRequestsPage() {
  const t = useTranslations('admin.demoRequests');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useAdminDemoRequests({
    page,
    limit: 10,
    status: statusFilter || undefined,
  });
  const updateDemoRequest = useUpdateDemoRequest();
  const deleteDemoRequest = useDeleteDemoRequest();
  const { confirmProps, confirm } = useConfirmDialog();

  const requests = data?.data ?? [];
  const pagination = data?.pagination;

  function handleStatusChange(id: string, status: string) {
    updateDemoRequest.mutate({ id, status });
  }

  function handleDelete(id: string) {
    confirm({
      title: t('delete'),
      message: t('confirmDelete'),
      confirmLabel: t('delete'),
      cancelLabel: tc('cancel'),
      variant: 'danger',
      onConfirm: () => {
        deleteDemoRequest.mutate(id);
      },
    });
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      NEW: t('new'),
      CONTACTED: t('contacted'),
      SCHEDULED: t('scheduled'),
      COMPLETED: t('completed'),
      REJECTED: t('rejected'),
    };
    return map[status] ?? status;
  }

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: '', label: t('all') },
    { key: 'NEW', label: t('new') },
    { key: 'CONTACTED', label: t('contacted') },
    { key: 'SCHEDULED', label: t('scheduled') },
    { key: 'COMPLETED', label: t('completed') },
    { key: 'REJECTED', label: t('rejected') },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tc('error')}</p>
        <p className="text-sm text-muted-foreground">{tc('error')}</p>
      </div>
    );
  }

  return (
    <>
      <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key || 'all'}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded bg-muted" />
              ))}
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
              <Presentation className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">{t('noRequests')}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase w-8" />
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('name')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('email')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('phone')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('company')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('status')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('date')}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-medium text-muted-foreground uppercase">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((req: any) => (
                    <Fragment key={req.id}>
                      <tr
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(req.id)}
                      >
                        <td className="px-4 py-3">
                          {expandedId === req.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {req.name || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground" dir="ltr">
                          {req.email || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground" dir="ltr">
                          {req.phone || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {req.company || '—'}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={req.status}
                            onChange={(e) => handleStatusChange(req.id, e.target.value)}
                            className={cn(
                              'rounded-md px-2 py-1 text-xs font-medium border-0 cursor-pointer',
                              STATUS_BADGE[req.status] ?? 'bg-gray-100 text-gray-700',
                            )}
                          >
                            {ALL_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {statusLabel(s)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {fmtDate(req.createdAt, locale)}
                        </td>
                        <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete(req.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title={t('delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedId === req.id && (
                        <tr key={`${req.id}-expanded`}>
                          <td colSpan={8} className="px-4 py-4 bg-muted/20">
                            <div className="ps-8">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {t('message')}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">
                                {req.message || '—'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {requests.map((req: any) => (
                <div key={req.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleExpand(req.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{req.name || '—'}</p>
                        {req.email && (
                          <p className="text-sm text-muted-foreground" dir="ltr">{req.email}</p>
                        )}
                        {req.phone && (
                          <p className="text-sm text-muted-foreground" dir="ltr">{req.phone}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',
                          STATUS_BADGE[req.status] ?? 'bg-gray-100 text-gray-700',
                        )}
                      >
                        {statusLabel(req.status)}
                      </span>
                    </div>
                    {req.company && (
                      <p className="text-sm text-muted-foreground mb-2">{req.company}</p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(req.createdAt, locale)}
                      </span>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={req.status}
                          onChange={(e) => handleStatusChange(req.id, e.target.value)}
                          className="rounded-md px-2 py-1 text-xs border bg-background"
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {expandedId === req.id && req.message && (
                    <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1 mt-3">
                        {t('message')}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{req.message}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && (
              <AdminPagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />
            )}
          </>
        )}
      </div>
      <ConfirmDialog {...confirmProps} />
    </>
  );
}
