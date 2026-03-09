'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import {
  useAdminApiKeys,
  useAdminApiKeyStats,
  useRevokeAdminApiKey,
  useDeleteAdminApiKey,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Key,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKeyUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ApiKeyOrg {
  id: string;
  name: string;
}

interface ApiKeyEntry {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  user?: ApiKeyUser;
  org?: ApiKeyOrg;
}

type StatusFilter = '' | 'active' | 'revoked';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function deriveStatus(entry: ApiKeyEntry): 'active' | 'revoked' | 'expired' {
  if (entry.revokedAt) return 'revoked';
  if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) return 'expired';
  return 'active';
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

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
      <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-7 w-24 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminApiKeysPage() {
  const t = useTranslations('admin.adminApiKeys');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(statusFilter && { status: statusFilter }),
    }),
    [page, debouncedSearch, statusFilter],
  );

  const { data, isLoading, isError, refetch } = useAdminApiKeys(params);
  const { data: stats, isLoading: statsLoading } = useAdminApiKeyStats();
  const revokeKey = useRevokeAdminApiKey();
  const deleteKey = useDeleteAdminApiKey();

  const entries: ApiKeyEntry[] = data?.apiKeys ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Handlers
  function handleRevoke(id: string) {
    setConfirmDialog({
      open: true,
      title: t('revokeTitle'),
      message: t('confirmRevoke'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          await revokeKey.mutateAsync(id);
          addToast('success', t('toasts.revoked'));
        } catch {
          addToast('error', t('toasts.error'));
        }
      },
    });
  }

  function handleDelete(id: string) {
    setConfirmDialog({
      open: true,
      title: t('deleteTitle'),
      message: t('confirmDelete'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteKey.mutateAsync(id);
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
                <Key className="h-4 w-4" />
                {t('totalKeys')}
              </div>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {t('activeKeys')}
              </div>
              <p className="text-2xl font-bold text-green-600">{stats?.active ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                {t('revokedKeys')}
              </div>
              <p className="text-2xl font-bold text-red-600">{stats?.revoked ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4 text-amber-500" />
                {t('expiredKeys')}
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats?.expired ?? 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border bg-background ps-9 pe-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
          />
        </div>
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
            <option value="revoked">{t('revoked')}</option>
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
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('name')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('keyPrefix')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('owner')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('organization')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('scopes')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('lastUsed')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('expires')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}

              {!isLoading && !isError && entries.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Key className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noApiKeys')}</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                entries.map((entry) => {
                  const status = deriveStatus(entry);
                  return (
                    <tr
                      key={entry.id}
                      className="border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium truncate max-w-[160px] block">
                          {entry.name}
                        </span>
                      </td>

                      {/* Key Prefix */}
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {entry.keyPrefix}...
                        </code>
                      </td>

                      {/* Owner */}
                      <td className="px-4 py-3">
                        {entry.user ? (
                          <div>
                            <div className="text-sm font-medium truncate max-w-[160px]">
                              {entry.user.firstName} {entry.user.lastName}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                              {entry.user.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">--</span>
                        )}
                      </td>

                      {/* Organization */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground truncate max-w-[140px] block">
                          {entry.org?.name ?? '--'}
                        </span>
                      </td>

                      {/* Scopes */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(entry.scopes ?? []).map((scope) => (
                            <span
                              key={scope}
                              className="inline-block rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 text-[10px] font-medium"
                            >
                              {scope}
                            </span>
                          ))}
                          {(!entry.scopes || entry.scopes.length === 0) && (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </div>
                      </td>

                      {/* Last Used */}
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {entry.lastUsedAt ? fmtDateTime(entry.lastUsedAt, locale) : t('never')}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            STATUS_BADGE[status] ?? 'bg-muted text-muted-foreground',
                          )}
                        >
                          {t(status)}
                        </span>
                      </td>

                      {/* Expires */}
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {entry.expiresAt ? fmtDateTime(entry.expiresAt, locale) : t('never')}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {status === 'active' && (
                            <button
                              onClick={() => handleRevoke(entry.id)}
                              disabled={revokeKey.isPending}
                              className="inline-flex items-center gap-1 rounded-lg border border-orange-200 px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
                            >
                              <ShieldAlert className="h-3 w-3" />
                              {t('revoke')}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deleteKey.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
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
