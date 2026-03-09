'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { exportToCsv } from '@/lib/exportCsv';
import { fmtDateTime } from '@/lib/dateFormat';
import { useAdminBlockedIPs, useBlockIP, useUnblockIP } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  ShieldBan,
  Plus,
  X,
  Loader2,
  Trash2,
  Download,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockedIP {
  id: string;
  ip: string;
  reason: string;
  blockedByName?: string;
  blockedByEmail?: string;
  isAuto: boolean;
  expiresAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b last:border-b-0">
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-40 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-7 w-16 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BlockedIPsPage() {
  const t = useTranslations('admin.blockedIPs');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant?: 'danger' | 'default'; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });
  const [formIP, setFormIP] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formExpiry, setFormExpiry] = useState('');

  const { data, isLoading, isError, refetch } = useAdminBlockedIPs({ page, limit: 20 });
  const blockIP = useBlockIP();
  const unblockIP = useUnblockIP();

  const entries: BlockedIP[] = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function handleExport() {
    if (!entries.length) return;
    const rows = entries.map((entry) => ({
      [t('csvIP')]: entry.ip,
      [t('csvReason')]: entry.reason || '',
      [t('csvBlockedBy')]: entry.blockedByName || entry.blockedByEmail || '',
      [t('csvType')]: entry.isAuto ? t('auto') : t('manual'),
      [t('csvExpiresAt')]: entry.expiresAt ? fmtDateTime(entry.expiresAt, locale) : t('never'),
      [t('csvCreatedAt')]: fmtDateTime(entry.createdAt, locale),
    }));
    exportToCsv('admin-blocked-ips', rows);
  }

  const handleBlock = async () => {
    if (!formIP.trim()) return;
    try {
      await blockIP.mutateAsync({
        ip: formIP.trim(),
        reason: formReason.trim(),
        ...(formExpiry && { expiresAt: formExpiry }),
      });
      addToast('success', t('blocked'));
      setShowForm(false);
      setFormIP('');
      setFormReason('');
      setFormExpiry('');
    } catch {
      addToast('error', tc('error'));
    }
  };

  const handleUnblock = (id: string) => {
    setConfirmDialog({
      open: true,
      title: t('unblock'),
      message: t('confirmUnblock'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          await unblockIP.mutateAsync(id);
          addToast('success', t('unblocked'));
        } catch {
          addToast('error', tc('error'));
        }
      },
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExport}
            disabled={!entries.length}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {tc('export')}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {t('blockIP')}
          </button>
        </div>
      </div>

      {/* Block IP Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('ip')} *
              </label>
              <input
                type="text"
                value={formIP}
                onChange={(e) => setFormIP(e.target.value)}
                placeholder="192.168.1.1"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('reason')}
              </label>
              <textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder={t('reasonPlaceholder')}
                rows={1}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('expiresAt')}
              </label>
              <input
                type="datetime-local"
                value={formExpiry}
                onChange={(e) => setFormExpiry(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleBlock}
              disabled={blockIP.isPending || !formIP.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {blockIP.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('blockIP')}
            </button>
          </div>
        </div>
      )}

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
                  {t('ip')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('reason')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('blockedBy')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('type')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('expiresAt')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('createdAt')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}

              {!isLoading && !isError && entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <ShieldBan className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noRecords')}</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium">{entry.ip}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                        {entry.reason || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {entry.blockedByName || entry.blockedByEmail || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {entry.isAuto ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          {t('auto')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {t('manual')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {entry.expiresAt ? fmtDateTime(entry.expiresAt, locale) : t('never')}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDateTime(entry.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleUnblock(entry.id)}
                        disabled={unblockIP.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('unblock')}
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
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />
      )}

      <AdminConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
