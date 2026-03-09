'use client';

import { Fragment, useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import {
  useAdminContactMessages,
  useUpdateContactMessage,
  useDeleteContactMessage,
} from '@/hooks/useAdmin';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/exportCsv';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Mail,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
} from 'lucide-react';

type StatusFilter = '' | 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED';

const ALL_STATUSES = ['NEW', 'READ', 'REPLIED', 'ARCHIVED'] as const;

const STATUS_BADGE: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  READ: 'bg-muted text-muted-foreground',
  REPLIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ARCHIVED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export default function ContactMessagesPage() {
  const t = useTranslations('admin.contactMessages');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = useAdminContactMessages({
    page,
    limit: 10,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  });
  const updateContactMessage = useUpdateContactMessage();
  const deleteContactMessage = useDeleteContactMessage();
  const { confirmProps, confirm } = useConfirmDialog();

  const messages = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function handleExport() {
    if (!messages.length) return;
    const rows = messages.map((msg: any) => ({
      [t('csvName')]: msg.name || '',
      [t('csvEmail')]: msg.email || '',
      [t('csvSubject')]: msg.subject || '',
      [t('csvMessage')]: msg.message || '',
      [t('csvStatus')]: msg.status,
      [t('csvDate')]: fmtDate(msg.createdAt, locale),
    }));
    exportToCsv('admin-contact-messages', rows);
  }

  function handleStatusChange(id: string, status: string) {
    updateContactMessage.mutate({ id, status });
  }

  function handleDelete(id: string) {
    confirm({
      title: t('delete'),
      message: t('confirmDelete'),
      confirmLabel: t('delete'),
      cancelLabel: tc('cancel'),
      variant: 'danger',
      onConfirm: () => {
        deleteContactMessage.mutate(id);
      },
    });
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      NEW: t('new'),
      READ: t('read'),
      REPLIED: t('replied'),
      ARCHIVED: t('archived'),
    };
    return map[status] ?? status;
  }

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: '', label: t('all') },
    { key: 'NEW', label: t('new') },
    { key: 'READ', label: t('read') },
    { key: 'REPLIED', label: t('replied') },
    { key: 'ARCHIVED', label: t('archived') },
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
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <button
            onClick={handleExport}
            disabled={!messages.length}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {tc('export')}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border bg-card ps-9 pe-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
          />
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
        ) : messages.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
              <Mail className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">{t('noMessages')}</p>
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
                      {t('subject')}
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
                  {messages.map((msg: any) => (
                    <Fragment key={msg.id}>
                      <tr
                        className={cn(
                          'hover:bg-muted/50 transition-colors cursor-pointer',
                          msg.status === 'NEW' && 'font-medium',
                        )}
                        onClick={() => toggleExpand(msg.id)}
                      >
                        <td className="px-4 py-3">
                          {expandedId === msg.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {msg.name || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground" dir="ltr">
                          {msg.email || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                          {msg.subject || '—'}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={msg.status}
                            onChange={(e) => handleStatusChange(msg.id, e.target.value)}
                            className={cn(
                              'rounded-lg px-2 py-1 text-xs font-medium border-0 cursor-pointer',
                              STATUS_BADGE[msg.status] ?? 'bg-muted text-muted-foreground',
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
                          {fmtDate(msg.createdAt, locale)}
                        </td>
                        <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title={t('delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedId === msg.id && (
                        <tr key={`${msg.id}-expanded`}>
                          <td colSpan={7} className="px-4 py-4 bg-muted/20">
                            <div className="ps-8">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {t('message')}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">
                                {msg.message || '—'}
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
              {messages.map((msg: any) => (
                <div key={msg.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleExpand(msg.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className={cn('font-medium', msg.status === 'NEW' && 'text-foreground')}>
                          {msg.name || '—'}
                        </p>
                        {msg.email && (
                          <p className="text-sm text-muted-foreground" dir="ltr">{msg.email}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',
                          STATUS_BADGE[msg.status] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {statusLabel(msg.status)}
                      </span>
                    </div>
                    {msg.subject && (
                      <p className="text-sm text-muted-foreground truncate mb-2">{msg.subject}</p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(msg.createdAt, locale)}
                      </span>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={msg.status}
                          onChange={(e) => handleStatusChange(msg.id, e.target.value)}
                          className="rounded-lg px-2 py-1 text-xs border bg-background"
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {expandedId === msg.id && (
                    <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1 mt-3">
                        {t('message')}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.message || '—'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />
            )}
          </>
        )}
      </div>
      <ConfirmDialog {...confirmProps} />
    </>
  );
}
