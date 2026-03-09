'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import {
  useAdminMessageTemplates,
  useDeleteMessageTemplate,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { FileText, Trash2, Search } from 'lucide-react';

export default function MessageTemplatesPage() {
  const t = useTranslations('admin.messageTemplates');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading, error } = useAdminMessageTemplates({
    page,
    limit: 10,
    search: search || undefined,
    category: category || undefined,
  });

  const deleteMutation = useDeleteMessageTemplate();

  const templates = data?.data ?? [];
  const pagination = data?.pagination;

  // Collect unique categories from current page for filter tabs
  const categories = Array.from(
    new Set(templates.map((tpl: any) => tpl.category).filter(Boolean)),
  ) as string[];

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

        {/* Search + Category Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border bg-background ps-9 pe-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => { setCategory(''); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                !category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {t('allCategories')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  category === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {t(`category_${cat}`)}
              </button>
            ))}
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
        ) : templates.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
              <FileText className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">{t('noTemplates')}</p>
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
                      {t('templateTitle')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('category')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('shortcut')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('organization')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('content')}
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
                  {templates.map((tpl: any) => (
                    <tr key={tpl.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">{tpl.title}</td>
                      <td className="px-4 py-3 text-sm">
                        {tpl.category ? (
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                            {t(`category_${tpl.category}`)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                        {tpl.shortcut || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {tpl.org?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                        {locale === 'ar' && tpl.contentAr ? tpl.contentAr : tpl.contentEn}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {fmtDate(tpl.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <button
                          onClick={() => setDeleteTarget(tpl.id)}
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
              {templates.map((tpl: any) => (
                <div key={tpl.id} className="rounded-xl border bg-card shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{tpl.title}</p>
                      {tpl.category && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium mt-1 inline-block">
                          {t(`category_${tpl.category}`)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setDeleteTarget(tpl.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                    {locale === 'ar' && tpl.contentAr ? tpl.contentAr : tpl.contentEn}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>{tpl.org?.name || '—'}</span>
                    <span>{fmtDate(tpl.createdAt, locale)}</span>
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
