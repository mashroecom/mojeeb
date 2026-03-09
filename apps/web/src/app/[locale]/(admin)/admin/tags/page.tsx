'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import { useAdminTags, useDeleteTag } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { Tag, Trash2, Search } from 'lucide-react';

export default function TagsPage() {
  const t = useTranslations('admin.tags');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading, error } = useAdminTags({
    page,
    limit: 10,
    search: search || undefined,
  });

  const deleteMutation = useDeleteTag();

  const tags = data?.data ?? [];
  const pagination = data?.pagination;

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        addToast('success', t('toasts.deleted'));
        setDeleteTarget(null);
      },
      onError: () => {
        addToast('error', t('toasts.error'));
      },
    });
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tc('error')}</p>
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

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border bg-background ps-9 pe-3 py-2 text-sm"
            />
          </div>
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
        ) : tags.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
              <Tag className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">{t('noTags')}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('tagName')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('color')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('organization')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('usageCount')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('created')}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-medium text-muted-foreground uppercase">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tags.map((tag: any) => (
                    <tr key={tag.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                        {tag.color}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {tag.orgName || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {tag.usageCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {fmtDate(tag.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <button
                          onClick={() => setDeleteTarget(tag.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title={tc('delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {tags.map((tag: any) => (
                <div key={tag.id} className="rounded-xl border bg-card shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <p className="font-medium">{tag.name}</p>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(tag.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>{tag.orgName || '—'}</span>
                    <span>
                      {t('usageCount')}: {tag.usageCount ?? 0}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {fmtDate(tag.createdAt, locale)}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && (
              <AdminPagination
                page={page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                previousLabel={tc('previous')}
                nextLabel={tc('next')}
                pageLabel={tc('page')}
                ofLabel={tc('of')}
              />
            )}
          </>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <AdminConfirmDialog
        open={!!deleteTarget}
        title={t('deleteTitle')}
        message={t('confirmDelete')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
