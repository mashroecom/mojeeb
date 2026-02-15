'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import {
  useAdminUsers,
  useToggleUserSuspension,
  useDeleteUser,
  useBulkSuspendUsers,
  useBulkUnsuspendUsers,
  useBulkDeleteUsers,
} from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/exportCsv';
import { useRouter } from '@/i18n/navigation';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Search,
  Loader2,
  UserX,
  UserCheck,
  Trash2,
  Users,
  Download,
  X,
} from 'lucide-react';

type StatusFilter = '' | 'active' | 'suspended';

export default function AdminUsersPage() {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('admin.common');
  const locale = useLocale();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant?: 'danger' | 'default'; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when status changes
  useEffect(() => {
    setPage(1);
  }, [status]);

  // Clear selection when page, search, or status changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, debouncedSearch, status]);

  const { data, isLoading, error } = useAdminUsers({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    status: status || undefined,
  });

  const toggleSuspension = useToggleUserSuspension();
  const deleteUser = useDeleteUser();
  const bulkSuspend = useBulkSuspendUsers();
  const bulkUnsuspend = useBulkUnsuspendUsers();
  const bulkDelete = useBulkDeleteUsers();

  const users = data?.users ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u: any) => u.id)));
    }
  }, [selectedIds.size, users]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  function handleToggleSuspension(userId: string, isSuspended: boolean) {
    setConfirmDialog({
      open: true,
      title: isSuspended ? t('suspend') : t('activate'),
      message: isSuspended ? t('confirmSuspend') : t('confirmActivate'),
      variant: isSuspended ? 'danger' : 'default',
      onConfirm: () => { toggleSuspension.mutate(userId); },
    });
  }

  function handleDelete(userId: string) {
    setConfirmDialog({
      open: true,
      title: t('delete'),
      message: t('confirmDelete'),
      variant: 'danger',
      onConfirm: () => { deleteUser.mutate(userId); },
    });
  }

  function handleBulkSuspend() {
    const ids = Array.from(selectedIds);
    setConfirmDialog({
      open: true,
      title: t('bulkSuspend', { count: ids.length }),
      message: t('confirmBulkSuspend', { count: ids.length }),
      variant: 'danger',
      onConfirm: () => {
        bulkSuspend.mutate(ids, {
          onSuccess: () => { setSelectedIds(new Set()); },
        });
      },
    });
  }

  function handleBulkUnsuspend() {
    const ids = Array.from(selectedIds);
    setConfirmDialog({
      open: true,
      title: t('bulkUnsuspend', { count: ids.length }),
      message: t('confirmBulkUnsuspend', { count: ids.length }),
      variant: 'default',
      onConfirm: () => {
        bulkUnsuspend.mutate(ids, {
          onSuccess: () => { setSelectedIds(new Set()); },
        });
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
          onSuccess: () => { setSelectedIds(new Set()); },
        });
      },
    });
  }

  function handleExport() {
    if (!users.length) return;
    const rows = users.map((user: any) => ({
      Name: `${user.firstName} ${user.lastName}`,
      Email: user.email,
      Organizations: user._count?.memberships ?? 0,
      Status: user.suspendedAt ? 'Suspended' : 'Active',
      Joined: fmtDate(user.createdAt, locale),
    }));
    exportToCsv('admin-users', rows);
  }

  const statusTabs: { label: string; value: StatusFilter }[] = [
    { label: t('all'), value: '' },
    { label: t('active'), value: 'active' },
    { label: t('suspended'), value: 'suspended' },
  ];

  const allSelected = users.length > 0 && selectedIds.size === users.length;
  const someSelected = selectedIds.size > 0;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tCommon('error')}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary hover:underline"
        >
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative pb-16">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-card ps-10 pe-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Status tabs */}
        <div className="flex rounded-lg border bg-card overflow-hidden">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                status === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Export CSV */}
        <button
          onClick={handleExport}
          disabled={!users.length}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          {tCommon('export')}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">{t('noUsers')}</p>
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
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
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
                    {t('organizations')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('status')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('joined')}
                  </th>
                  <th className="text-end px-4 py-3 font-medium text-muted-foreground">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user: any) => {
                  const isSuspended = !!user.suspendedAt;
                  const isSelected = selectedIds.has(user.id);
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        'hover:bg-muted/50 transition-colors',
                        isSelected && 'bg-primary/5'
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(user.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <button
                          onClick={() => router.push(`/admin/users/${user.id}`)}
                          className="hover:text-primary transition-colors"
                        >
                          {user.firstName} {user.lastName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        {user._count?.memberships ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            isSuspended
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          )}
                        >
                          {isSuspended ? t('suspended') : t('active')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {fmtDate(user.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              handleToggleSuspension(user.id, !isSuspended)
                            }
                            disabled={toggleSuspension.isPending}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                              isSuspended
                                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50'
                            )}
                          >
                            {isSuspended ? (
                              <>
                                <UserCheck className="h-3.5 w-3.5" />
                                {t('activate')}
                              </>
                            ) : (
                              <>
                                <UserX className="h-3.5 w-3.5" />
                                {t('suspend')}
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={deleteUser.isPending}
                            className="inline-flex items-center gap-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 text-xs font-medium transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('delete')}
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
        {!isLoading && users.length > 0 && (
          <div className="border-t px-4 py-3">
            <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tCommon('previous')} nextLabel={tCommon('next')} pageLabel={tCommon('page')} ofLabel={tCommon('of')} />
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
            onClick={handleBulkSuspend}
            disabled={bulkSuspend.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <UserX className="h-3.5 w-3.5" />
            {t('bulkSuspend', { count: selectedIds.size })}
          </button>
          <button
            onClick={handleBulkUnsuspend}
            disabled={bulkUnsuspend.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <UserCheck className="h-3.5 w-3.5" />
            {t('bulkUnsuspend', { count: selectedIds.size })}
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('bulkDelete', { count: selectedIds.size })}
          </button>
          <button
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
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
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
